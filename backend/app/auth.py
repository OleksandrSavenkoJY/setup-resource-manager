import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .security import hash_password, verify_password

SESSION_COOKIE = "session"
SESSION_TTL = timedelta(hours=int(os.getenv("SESSION_TTL_HOURS", "12")))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
MIN_ADMIN_PASSWORD_LENGTH = 8

# Verified against when the username is unknown, to keep login timing uniform.
_DUMMY_HASH = hash_password("dummy-password")

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


class AdminSetupRequest(BaseModel):
    password: str = Field(min_length=MIN_ADMIN_PASSWORD_LENGTH, max_length=256)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=MIN_ADMIN_PASSWORD_LENGTH, max_length=256)


class UserRead(BaseModel):
    username: str
    role: str

    model_config = {"from_attributes": True}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def ensure_guest(db: Session) -> None:
    if db.query(models.User).filter(models.User.username == "guest").first():
        return
    db.add(models.User(username="guest", password_hash=hash_password("guest"), role="guest"))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def _start_session(db: Session, response: Response, user: models.User) -> None:
    db.query(models.AuthSession).filter(models.AuthSession.expires_at <= _now()).delete()
    token = secrets.token_urlsafe(32)
    db.add(
        models.AuthSession(
            token_hash=_token_hash(token),
            user_id=user.id,
            expires_at=_now() + SESSION_TTL,
        )
    )
    db.commit()
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=COOKIE_SECURE,
        path="/",
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        session = (
            db.query(models.AuthSession)
            .filter(
                models.AuthSession.token_hash == _token_hash(token),
                models.AuthSession.expires_at > _now(),
            )
            .first()
        )
        if session:
            return session.user
    # No (valid) session: browse as the read-only guest; admin mode needs the admin password.
    guest = db.query(models.User).filter(models.User.username == "guest", models.User.role == "guest").first()
    if guest:
        return guest
    raise HTTPException(status_code=401, detail="Not authenticated")


def require_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    admin = db.query(models.User.id).filter(models.User.role == "admin").first()
    return {"admin_configured": admin is not None}


@router.post("/setup-admin", response_model=UserRead)
def setup_admin(body: AdminSetupRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(models.User.id).filter(models.User.role == "admin").first():
        raise HTTPException(status_code=409, detail="Admin is already configured")
    user = models.User(username="admin", password_hash=hash_password(body.password), role="admin")
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Admin is already configured")
    _start_session(db, response, user)
    return user


MAX_FAILURES = 5
FAILURE_WINDOW = timedelta(minutes=10)
LOCKOUT = timedelta(minutes=5)
_failures: dict[str, list] = {}  # username -> failure times; in memory, so a restart clears it


def _check_lockout(username: str) -> None:
    now = _now()
    times = [t for t in _failures.get(username, []) if now - t < FAILURE_WINDOW]
    _failures[username] = times
    if len(times) >= MAX_FAILURES and now - times[-1] < LOCKOUT:
        wait = int((LOCKOUT - (now - times[-1])).total_seconds()) + 1
        raise HTTPException(status_code=429, detail=f"Too many failed attempts. Try again in {wait} s.",
                            headers={"Retry-After": str(wait)})


@router.post("/login", response_model=UserRead)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    key = body.username.strip().lower()
    _check_lockout(key)
    user = db.query(models.User).filter(models.User.username == body.username).first()
    valid = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not valid:
        _failures.setdefault(key, []).append(_now())
        raise HTTPException(status_code=401, detail="Invalid username or password")
    _failures.pop(key, None)
    _start_session(db, response, user)
    return user


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    user: models.User = Depends(require_admin),
):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    # Drop every existing session of this user, then keep the current browser logged in.
    db.query(models.AuthSession).filter(models.AuthSession.user_id == user.id).delete()
    db.commit()
    _start_session(db, response, user)
    return {"ok": True}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.query(models.AuthSession).filter(
            models.AuthSession.token_hash == _token_hash(token)
        ).delete()
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.get("/me", response_model=UserRead)
def me(user: models.User = Depends(get_current_user)):
    return user
