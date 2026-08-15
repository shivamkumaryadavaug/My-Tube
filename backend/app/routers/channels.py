"""
Channels: resolve a YouTube channel URL into selectable playlists/videos
(mirrors the frontend's "choose what you want to study" flow), then save
the user's picks.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, youtube
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/channels", tags=["channels"])


@router.get("", response_model=List[schemas.ChannelOut])
def list_channels(current_user: models.User = Depends(get_current_user)):
    return current_user.channels


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
    """Step 2: save the channel plus only the playlists/videos the user selected."""
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

    playlist_lookup = {p.youtube_playlist_id: p for p in payload.playlist_candidates}
    for pid in payload.selected_playlist_ids:
        candidate = playlist_lookup.get(pid)
        if not candidate:
            continue
        db.add(models.Playlist(
            user_id=current_user.id,
            channel_id=channel.id,
            youtube_playlist_id=candidate.youtube_playlist_id,
            title=candidate.title,
            channel_name=payload.name,
            thumbnail_url=candidate.thumbnail_url,
        ))

    video_lookup = {v.youtube_video_id: v for v in payload.video_candidates}
    selected_videos = [video_lookup[vid] for vid in payload.selected_video_ids if vid in video_lookup]
    if selected_videos:
        video_playlist = models.Playlist(
            user_id=current_user.id,
            channel_id=channel.id,
            title=f"{payload.name}: Selected Videos",
            channel_name=payload.name,
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

    db.commit()
    db.refresh(channel)
    return channel


@router.delete("/{channel_id}", status_code=204)
def delete_channel(
    channel_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    channel = (
        db.query(models.Channel)
        .filter(models.Channel.id == channel_id, models.Channel.user_id == current_user.id)
        .first()
    )
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found.")
    db.delete(channel)
    db.commit()
