"""
Thin wrapper around the YouTube Data API v3 (https://developers.google.com/youtube/v3).

All calls use a server-side API key (never exposed to the frontend) and only
read public data — no scraping, no unofficial endpoints, no bypassing of any
YouTube restriction. Requires YOUTUBE_API_KEY to be set in the environment.
"""
import re
from typing import Optional
from urllib.parse import urlparse, parse_qs

import httpx
from fastapi import HTTPException

from .config import settings

BASE_URL = "https://www.googleapis.com/youtube/v3"


def _require_api_key():
    if not settings.youtube_api_key:
        raise HTTPException(
            status_code=500,
            detail="YOUTUBE_API_KEY is not configured on the server. Add it to your .env file.",
        )


def extract_playlist_id(url: str) -> Optional[str]:
    parsed = urlparse(url.strip())
    query = parse_qs(parsed.query)
    if "list" in query:
        return query["list"][0]
    return None


def extract_channel_ref(url: str):
    """Returns (ref_type, value) where ref_type is 'id' | 'handle' | 'custom' | 'user'."""
    path = urlparse(url.strip()).path.strip("/")
    parts = path.split("/")
    if not parts or parts[0] == "":
        return None

    if parts[0] == "channel" and len(parts) > 1:
        return ("id", parts[1])
    if parts[0].startswith("@"):
        return ("handle", parts[0].lstrip("@"))
    if parts[0] == "c" and len(parts) > 1:
        return ("custom", parts[1])
    if parts[0] == "user" and len(parts) > 1:
        return ("user", parts[1])
    return None


def parse_iso8601_duration(duration: str) -> int:
    """Converts 'PT1H2M10S' style durations into total seconds."""
    match = re.match(
        r"P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or ""
    )
    if not match:
        return 0
    hours, minutes, seconds = (int(g) if g else 0 for g in match.groups())
    return hours * 3600 + minutes * 60 + seconds


async def _get(client: httpx.AsyncClient, path: str, params: dict):
    params = {**params, "key": settings.youtube_api_key}
    resp = await client.get(f"{BASE_URL}/{path}", params=params)
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"YouTube API error ({resp.status_code}): {resp.text[:300]}",
        )
    return resp.json()


async def resolve_channel_id(client: httpx.AsyncClient, url: str) -> str:
    ref = extract_channel_ref(url)
    if not ref:
        raise HTTPException(status_code=400, detail="Could not parse a channel from that URL.")
    ref_type, value = ref

    if ref_type == "id":
        return value

    if ref_type == "handle":
        data = await _get(client, "channels", {"part": "id", "forHandle": value})
        items = data.get("items", [])
        if items:
            return items[0]["id"]

    if ref_type == "user":
        data = await _get(client, "channels", {"part": "id", "forUsername": value})
        items = data.get("items", [])
        if items:
            return items[0]["id"]

    # Fallback for legacy /c/customName links (and anything the above missed):
    # search by name and take the top channel result.
    data = await _get(client, "search", {"part": "snippet", "q": value, "type": "channel", "maxResults": 1})
    items = data.get("items", [])
    if items:
        return items[0]["snippet"]["channelId"]

    raise HTTPException(status_code=404, detail="Channel not found.")


async def resolve_channel(url: str) -> dict:
    """Fetches channel metadata plus candidate playlists/videos for selection."""
    _require_api_key()
    async with httpx.AsyncClient(timeout=15) as client:
        channel_id = await resolve_channel_id(client, url)

        data = await _get(
            client, "channels",
            {"part": "snippet,contentDetails", "id": channel_id},
        )
        items = data.get("items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Channel not found.")
        info = items[0]
        snippet = info["snippet"]
        uploads_playlist_id = info["contentDetails"]["relatedPlaylists"]["uploads"]

        # Candidate playlists (public playlists created by the channel)
        playlists_data = await _get(
            client, "playlists",
            {"part": "snippet,contentDetails", "channelId": channel_id, "maxResults": 15},
        )
        playlist_candidates = [
            {
                "youtube_playlist_id": p["id"],
                "title": p["snippet"]["title"],
                "video_count": p["contentDetails"]["itemCount"],
                "thumbnail_url": (p["snippet"].get("thumbnails", {}).get("medium") or {}).get("url", ""),
            }
            for p in playlists_data.get("items", [])
        ]

        # Candidate individual videos (most recent uploads)
        uploads_data = await _get(
            client, "playlistItems",
            {"part": "snippet,contentDetails", "playlistId": uploads_playlist_id, "maxResults": 10},
        )
        video_ids = [i["contentDetails"]["videoId"] for i in uploads_data.get("items", [])]
        durations = await _fetch_durations(client, video_ids)
        video_candidates = [
            {
                "youtube_video_id": i["contentDetails"]["videoId"],
                "title": i["snippet"]["title"],
                "duration_seconds": durations.get(i["contentDetails"]["videoId"], 0),
            }
            for i in uploads_data.get("items", [])
        ]

        return {
            "youtube_channel_id": channel_id,
            "name": snippet["title"],
            "description": snippet.get("description", "")[:500],
            "thumbnail_url": (snippet.get("thumbnails", {}).get("medium") or {}).get("url", ""),
            "playlist_candidates": playlist_candidates,
            "video_candidates": video_candidates,
        }


async def _fetch_durations(client: httpx.AsyncClient, video_ids: list) -> dict:
    if not video_ids:
        return {}
    data = await _get(client, "videos", {"part": "contentDetails", "id": ",".join(video_ids)})
    return {
        item["id"]: parse_iso8601_duration(item["contentDetails"]["duration"])
        for item in data.get("items", [])
    }


async def fetch_playlist_with_videos(url_or_id: str, is_id: bool = False) -> dict:
    """Fetches playlist metadata and its full video list, in order."""
    _require_api_key()
    playlist_id = url_or_id if is_id else extract_playlist_id(url_or_id)
    if not playlist_id:
        raise HTTPException(status_code=400, detail="Could not find a playlist ID in that URL.")

    async with httpx.AsyncClient(timeout=15) as client:
        meta = await _get(client, "playlists", {"part": "snippet,contentDetails", "id": playlist_id})
        items = meta.get("items", [])
        if not items:
            raise HTTPException(status_code=404, detail="Playlist not found or is private.")
        snippet = items[0]["snippet"]

        videos = []
        page_token = None
        while True:
            params = {"part": "snippet,contentDetails", "playlistId": playlist_id, "maxResults": 50}
            if page_token:
                params["pageToken"] = page_token
            page = await _get(client, "playlistItems", params)

            video_ids = [i["contentDetails"]["videoId"] for i in page.get("items", [])]
            durations = await _fetch_durations(client, video_ids)

            for i in page.get("items", []):
                vid = i["contentDetails"]["videoId"]
                videos.append({
                    "youtube_video_id": vid,
                    "title": i["snippet"]["title"],
                    "duration_seconds": durations.get(vid, 0),
                    "position": i["snippet"].get("position", len(videos)),
                })

            page_token = page.get("nextPageToken")
            if not page_token or len(videos) >= 300:  # sane cap per import
                break

        return {
            "youtube_playlist_id": playlist_id,
            "title": snippet["title"],
            "channel_name": snippet.get("channelTitle", ""),
            "thumbnail_url": (snippet.get("thumbnails", {}).get("medium") or {}).get("url", ""),
            "videos": videos,
        }
