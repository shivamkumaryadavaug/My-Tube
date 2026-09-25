"""
Pydantic schemas — request bodies and response shapes for the API.
"""
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, ConfigDict, Field


# ---------------- Auth ----------------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: Optional[str] = "Student"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    # Optional rather than a strict required EmailStr: this endpoint must
    # never 500 on serialization, even for a legacy/edge-case row with a
    # missing or malformed email — better to return null than crash.
    email: Optional[str] = None
    display_name: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    display_name: str


class PasswordChange(BaseModel):
    # Optional: guest accounts have a random password the user never saw,
    # so the frontend never collects one — the router skips verification
    # entirely for guest accounts rather than relying on a client-sent value.
    current_password: Optional[str] = None
    new_password: str = Field(min_length=8, max_length=72)


class AccountDelete(BaseModel):
    password: str


# ---------------- Settings ----------------
class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    focus_duration: int
    autoplay: bool
    remember_position: bool
    study_reminders: bool
    streak_reminders: bool
    theme: str


class SettingsUpdate(BaseModel):
    focus_duration: Optional[int] = None
    autoplay: Optional[bool] = None
    remember_position: Optional[bool] = None
    study_reminders: Optional[bool] = None
    streak_reminders: Optional[bool] = None
    theme: Optional[str] = None


# ---------------- Videos ----------------
class VideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    youtube_video_id: Optional[str]
    title: str
    duration_seconds: int
    position: int
    completed: bool


class VideoUpdate(BaseModel):
    completed: bool


# ---------------- Playlists ----------------
class PlaylistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    channel_name: str
    thumbnail_url: str
    channel_id: Optional[int]
    videos: List[VideoOut] = []


class PlaylistFromUrl(BaseModel):
    url: str


# ---------------- Channels ----------------
class PlaylistCandidate(BaseModel):
    youtube_playlist_id: str
    title: str
    video_count: int
    thumbnail_url: str = ""


class VideoCandidate(BaseModel):
    youtube_video_id: str
    title: str
    duration_seconds: int = 0


class ChannelResolveRequest(BaseModel):
    url: str


class ChannelResolveResponse(BaseModel):
    youtube_channel_id: str
    name: str
    description: str
    thumbnail_url: str
    playlist_candidates: List[PlaylistCandidate]
    video_candidates: List[VideoCandidate]


class ChannelConfirmRequest(BaseModel):
    youtube_channel_id: str
    name: str
    description: str = ""
    thumbnail_url: str = ""
    selected_playlist_ids: List[str] = []   # youtube_playlist_id values from candidates
    selected_video_ids: List[str] = []      # youtube_video_id values from candidates
    # Full candidate lists are re-sent so the backend doesn't need to re-call the YouTube API
    playlist_candidates: List[PlaylistCandidate] = []
    video_candidates: List[VideoCandidate] = []


class ChannelAddContentRequest(BaseModel):
    selected_playlist_ids: List[str] = []
    selected_video_ids: List[str] = []
    playlist_candidates: List[PlaylistCandidate] = []
    video_candidates: List[VideoCandidate] = []


class ChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    youtube_channel_id: Optional[str] = None
    name: str
    description: str
    thumbnail_url: str


# ---------------- Progress ----------------
class ProgressSummary(BaseModel):
    total_minutes: int
    videos_completed: int
    sessions: int
    streak: int


class TodayStats(BaseModel):
    minutes: int
    sessions: int
    videos: int


class WeeklyPoint(BaseModel):
    day: str
    minutes: int


class CourseProgress(BaseModel):
    playlist_id: int
    title: str
    completed: int
    total: int
    percent: int


class SessionCreate(BaseModel):
    minutes: int
    playlist_id: Optional[int] = None
