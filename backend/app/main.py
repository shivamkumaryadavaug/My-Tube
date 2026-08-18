"""
MyTube API — entrypoint.

Run locally with:
    uvicorn app.main:app --reload
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import auth, settings as settings_router, playlists, channels, progress

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MyTube API",
    description="Backend for MyTube — accounts, real YouTube playlist/channel import, and study progress.",
    version="1.0.0",
)

origins = ["*"] if settings.cors_origins.strip() == "*" else [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(playlists.router)
app.include_router(channels.router)
app.include_router(progress.router)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}
