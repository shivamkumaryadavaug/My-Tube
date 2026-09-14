"""
Channels: resolve a YouTube channel URL into selectable playlists/videos
(mirrors the frontend's "choose what you want to study" flow), then save
the user's picks — either as a brand new channel, or added onto one that
already exists.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, youtube
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/channels", tags=["channels"])


def _owned_channel(db: Session, user: models.User, channel_id: int) -> models.Channel:
    channel = (
        db.query(models.Channel)
        .filter(models.Channel.id == channel_id, models.Channel.user_id == user.id)
        .first()
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found.")
    return channel


def _attach_selected_content(
    db: Session,
    user: models.User,
    channel: models.Channel,
    channel_name: str,
    selected_playlist_ids: List[str],
    selected_video_ids: List[str],
    playlist_candidates: List[schemas.PlaylistCandidate],
    video_candidates: List[schemas.VideoCandidate],
) -> None:
    """Creates Playlist/Video rows under `channel` for whatever the user checked."""
    playlist_lookup = {p.youtube_playlist_id: p for p in playlist_candidates}
    for pid in selected_playlist_ids:
        candidate = playlist_lookup.get(pid)
        if not candidate:
            continue
        db.add(models.Playlist(
            user_id=user.id,
            channel_id=channel.id,
            youtube_playlist_id=candidate.youtube_playlist_id,
            title=candidate.title,
            channel_name=channel_name,
            thumbnail_url=candidate.thumbnail_url,
        ))

    video_lookup = {v.youtube_video_id: v for v in video_candidates}
    selected_videos = [video_lookup[vid] for vid in selected_video_ids if vid in video_lookup]
    if selected_videos:
        video_playlist = models.Playlist(
            user_id=user.id,
            channel_id=channel.id,
            title=f"{channel_name}: Selected Videos",
            channel_name=channel_name,
        )
        db.add(video_playlist)
        db.flush()
        for i, v in enumerate(selected_videos):
            db.add(models.Video(
                playlist_id=video_playlist.id,
                youtube_video_id=v.youtube_video_id,
                title=v.title,
                duration_seconds=v.duration_seconds,
                position=i,
            ))


@router.get("", response_model=List[schemas.ChannelOut])
def list_channels(current_user: models.User = Depends(get_current_user)):
    return current_user.channels


@router.get("/{channel_id}", response_model=schemas.ChannelOut)
def get_channel(
    channel_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _owned_channel(db, current_user, channel_id)


@router.post("/resolve", response_model=schemas.ChannelResolveResponse)
async def resolve_channel(payload: schemas.ChannelResolveRequest):
    """Step 1: look up the channel and return candidate playlists/videos.
    Nothing is saved yet — the frontend shows checkboxes from this response."""
    return await youtube.resolve_channel(payload.url)


@router.post("/confirm", response_model=schemas.ChannelOut)
def confirm_channel(
    payload: schemas.ChannelConfirmRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Step 2 (new channel): save the channel plus only the playlists/videos selected."""
    if not payload.selected_playlist_ids and not payload.selected_video_ids:
        raise HTTPException(status_code=400, detail="Select at least one playlist or video.")

    channel = models.Channel(
        user_id=current_user.id,
        youtube_channel_id=payload.youtube_channel_id,
        name=payload.name,
        description=payload.description,
        thumbnail_url=payload.thumbnail_url,
    )
    db.add(channel)
    db.flush()

    _attach_selected_content(
        db, current_user, channel, payload.name,
        payload.selected_playlist_ids, payload.selected_video_ids,
        payload.playlist_candidates, payload.video_candidates,
    )

    db.commit()
    db.refresh(channel)
    return channel


@router.post("/{channel_id}/add-content", response_model=schemas.ChannelOut)
def add_content_to_channel(
    channel_id: int,
    payload: schemas.ChannelAddContentRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Adds more selected playlists/videos onto a channel that already exists,
    instead of creating a duplicate channel row."""
    if not payload.selected_playlist_ids and not payload.selected_video_ids:
        raise HTTPException(status_code=400, detail="Select at least one playlist or video.")

    channel = _owned_channel(db, current_user, channel_id)

    _attach_selected_content(
        db, current_user, channel, channel.name,
        payload.selected_playlist_ids, payload.selected_video_ids,
        payload.playlist_candidates, payload.video_candidates,
    )

    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/{channel_id}", status_code=204)
def delete_channel(
    channel_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = _owned_channel(db, current_user, channel_id)
    db.delete(channel)
    db.commit()
