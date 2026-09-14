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

GUEST_EMAIL_SUFFIX = "@guest.mytube.local"


def _is_guest(user: models.User) -> bool:
    return user.email.endswith(GUEST_EMAIL_SUFFIX)


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


@router.get("/me/is-guest")
def is_guest(current_user: models.User = Depends(get_current_user)):
    """Lets the frontend tailor account-management UI for guest sessions
    (e.g. hide 'current password' since guests never set one)."""
    return {"is_guest": _is_guest(current_user)}


@router.put("/me", response_model=schemas.UserOut)
def update_profile(
    payload: schemas.ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = payload.display_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Display name cannot be empty.")
    if len(name) > 120:
        raise HTTPException(status_code=400, detail="Display name is too long.")

    current_user.display_name = name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    payload: schemas.PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters.")

    # Guest accounts have a random password the user never saw, so there's
    # nothing meaningful to verify — anyone already holding a valid guest
    # session token is treated as authorized to set a real password.
    if not _is_guest(current_user):
        if not auth_utils.verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.hashed_password = auth_utils.hash_password(payload.new_password)
    db.commit()
    return {"status": "ok"}


@router.delete("/me", status_code=204)
def delete_account(
    payload: schemas.AccountDelete,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Same reasoning as change_password: guests have no known password to check.
    if not _is_guest(current_user):
        if not auth_utils.verify_password(payload.password, current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Password is incorrect.")

    db.delete(current_user)
    db.commit()
