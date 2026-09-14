"""
Study preferences, appearance, and notification settings for the current user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=schemas.SettingsOut)
def get_settings(current_user: models.User = Depends(get_current_user)):
    return current_user.settings


@router.put("", response_model=schemas.SettingsOut)
def update_settings(
    payload: schemas.SettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings_row = current_user.settings
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row
