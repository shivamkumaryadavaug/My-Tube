"""
ORM models. One user owns channels, playlists (each with videos), a settings
row, and a log of completed focus sessions.
"""
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(120), default="Student")
    created_at = Column(DateTime, default=datetime.utcnow)

    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    channels = relationship("Channel", back_populates="user", cascade="all, delete-orphan")
    playlists = relationship("Playlist", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("FocusSession", back_populates="user", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    focus_duration = Column(Integer, default=25)
    autoplay = Column(Boolean, default=True)
    remember_position = Column(Boolean, default=True)
    study_reminders = Column(Boolean, default=True)
    streak_reminders = Column(Boolean, default=True)
    theme = Column(String(10), default="dark")  # 'dark' | 'light' | 'system'

    user = relationship("User", back_populates="settings")


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    youtube_channel_id = Column(String(64), nullable=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, default="")
    thumbnail_url = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="channels")
    playlists = relationship("Playlist", back_populates="channel", cascade="all, delete-orphan")


class Playlist(Base):
    __tablename__ = "playlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("channels.id"), nullable=True)

    youtube_playlist_id = Column(String(64), nullable=True)
    title = Column(String(255), nullable=False)
    channel_name = Column(String(255), default="")
    thumbnail_url = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="playlists")
    channel = relationship("Channel", back_populates="playlists")
    videos = relationship(
        "Video", back_populates="playlist", cascade="all, delete-orphan",
        order_by="Video.position"
    )


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=False)

    youtube_video_id = Column(String(32), nullable=True)
    title = Column(String(500), nullable=False)
    duration_seconds = Column(Integer, default=0)
    position = Column(Integer, default=0)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)

    playlist = relationship("Playlist", back_populates="videos")


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    playlist_id = Column(Integer, ForeignKey("playlists.id"), nullable=True)

    minutes = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
