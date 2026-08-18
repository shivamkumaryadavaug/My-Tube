"""Registration, login, guest login, and current-user endpoint."""
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from .. import auth as auth_utils
from ..database import get_db
from ..deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _create_settings_and_token(db: Session, user: models.User) -> schemas.Token:
    if user.settings is None:
        db.add(models.UserSettings(user_id=user.id))
    db.commit()
    db.refresh(user)
    token = auth_utils.create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token)


@router.post("/register", response_model=schemas.Token)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with that email already exists.")

    user = models.User(
        email=email,
        hashed_password=auth_utils.hash_password(payload.password),
        display_name=(payload.display_name or "Student").strip() or "Student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _create_settings_and_token(db, user)


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    email = form_data.username.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not auth_utils.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    token = auth_utils.create_access_token(subject=str(user.id))
    return schemas.Token(access_token=token)


@router.post("/guest", response_model=schemas.Token)
def guest_login(db: Session = Depends(get_db)):
    """Create a temporary anonymous MyTube account and return a normal JWT.

    Guest users use the same protected APIs as registered users, but receive a
    unique database user so their playlists/progress cannot mix with anyone else.
    """
    unique_id = uuid.uuid4().hex
    email = f"guest_{unique_id}@guest.mytube.local"
    random_password = secrets.token_urlsafe(24)

    user = models.User(
        email=email,
        hashed_password=auth_utils.hash_password(random_password),
        display_name="Guest Student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _create_settings_and_token(db, user)


@router.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
