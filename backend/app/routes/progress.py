"""
Study statistics: totals, streak, a 7-day chart, per-course completion,
and logging completed focus-timer sessions.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/progress", tags=["progress"])

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _compute_streak(session_dates) -> int:
    if not session_dates:
        return 0
    days = sorted(set(session_dates), reverse=True)
    today = datetime.utcnow().date()
    if days[0] not in (today, today - timedelta(days=1)):
        return 0
    streak = 1
    for i in range(1, len(days)):
        if (days[i - 1] - days[i]).days == 1:
            streak += 1
        else:
            break
    return streak


def _build_summary(db: Session, user: models.User) -> schemas.ProgressSummary:
    sessions = db.query(models.FocusSession).filter(models.FocusSession.user_id == user.id).all()
    total_minutes = sum(s.minutes for s in sessions)
    videos_completed = (
        db.query(models.Video)
        .join(models.Playlist)
        .filter(models.Playlist.user_id == user.id, models.Video.completed.is_(True))
        .count()
    )
    streak = _compute_streak([s.created_at.date() for s in sessions])
    return schemas.ProgressSummary(
        total_minutes=total_minutes,
        videos_completed=videos_completed,
        sessions=len(sessions),
        streak=streak,
    )


@router.get("/summary", response_model=schemas.ProgressSummary)
def summary(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_summary(db, current_user)


@router.get("/weekly", response_model=List[schemas.WeeklyPoint])
def weekly(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=7)
    sessions = (
        db.query(models.FocusSession)
        .filter(models.FocusSession.user_id == current_user.id, models.FocusSession.created_at >= since)
        .all()
    )
    totals = defaultdict(int)
    for s in sessions:
        totals[WEEKDAYS[s.created_at.weekday()]] += s.minutes
    return [schemas.WeeklyPoint(day=d, minutes=totals.get(d, 0)) for d in WEEKDAYS]


@router.get("/courses", response_model=List[schemas.CourseProgress])
def courses(current_user: models.User = Depends(get_current_user)):
    result = []
    for p in current_user.playlists:
        total = len(p.videos)
        completed = sum(1 for v in p.videos if v.completed)
        percent = round((completed / total) * 100) if total else 0
        result.append(schemas.CourseProgress(
            playlist_id=p.id, title=p.title, completed=completed, total=total, percent=percent
        ))
    return result


@router.post("/sessions", response_model=schemas.ProgressSummary)
def log_session(
    payload: schemas.SessionCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.add(models.FocusSession(
        user_id=current_user.id, minutes=payload.minutes, playlist_id=payload.playlist_id
    ))
    db.commit()
    return _build_summary(db, current_user)
