"""
Playlists: list, fetch from YouTube, view, delete, and mark videos complete.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, youtube
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/playlists", tags=["playlists"])


def _owned_playlist(db: Session, user: models.User, playlist_id: int) -> models.Playlist:
    playlist = (
        db.query(models.Playlist)
        .filter(models.Playlist.id == playlist_id, models.Playlist.user_id == user.id)
        .first()
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found.")
    return playlist


@router.get("", response_model=List[schemas.PlaylistOut])
def list_playlists(current_user: models.User = Depends(get_current_user)):
    return current_user.playlists


@router.get("/{playlist_id}", response_model=schemas.PlaylistOut)
def get_playlist(
    playlist_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _owned_playlist(db, current_user, playlist_id)


@router.post("/from-youtube", response_model=schemas.PlaylistOut)
async def add_playlist_from_youtube(
    payload: schemas.PlaylistFromUrl,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = await youtube.fetch_playlist_with_videos(payload.url)

    playlist = models.Playlist(
        user_id=current_user.id,
        youtube_playlist_id=data["youtube_playlist_id"],
        title=data["title"],
        channel_name=data["channel_name"],
        thumbnail_url=data["thumbnail_url"],
    )
    db.add(playlist)
    db.flush()  # assigns playlist.id before we attach videos

    for v in data["videos"]:
        db.add(models.Video(
            playlist_id=playlist.id,
            youtube_video_id=v["youtube_video_id"],
            title=v["title"],
            duration_seconds=v["duration_seconds"],
            position=v["position"],
        ))

    db.commit()
    db.refresh(playlist)
    return playlist


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = _owned_playlist(db, current_user, playlist_id)
    db.delete(playlist)
    db.commit()


@router.patch("/{playlist_id}/videos/{video_id}", response_model=schemas.VideoOut)
def update_video(
    playlist_id: int,
    video_id: int,
    payload: schemas.VideoUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = _owned_playlist(db, current_user, playlist_id)
    video = next((v for v in playlist.videos if v.id == video_id), None)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found in this playlist.")

    video.completed = payload.completed
    video.completed_at = datetime.utcnow() if payload.completed else None
    db.commit()
    db.refresh(video)
    return video
