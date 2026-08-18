/* ==========================================================================
   study.js — Real YouTube Study Mode for MyTube

   This file replaces the old mock-player implementation.

   Data source:
     GET /playlists/{id}

   Each backend video must contain:
     {
       id: 123,                    // MyTube database ID
       youtube_video_id: "abc123", // REAL YouTube ID
       title: "...",
       completed: false
     }

   The YouTube IFrame Player API does NOT need the YouTube Data API key.
   The Data API key remains backend-only.
   ========================================================================== */

let studyPlaylist = null;
let currentVideoIndex = 0;

let youtubePlayer = null;
let youtubeApiReady = false;
let youtubePlayerReady = false;
let playbackInterval = null;
let currentYoutubeVideoId = null;

let timerTotalSeconds = 25 * 60;
let timerRemaining = timerTotalSeconds;
let timerInterval = null;
let timerRunning = false;

let rememberPosition = true;
let autoplayNext = true;

const POSITION_KEY = 'mytube_playback_positions';
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 76;
const COMPLETION_THRESHOLD_SECONDS = 30;

/* ---------------- Small helpers ---------------- */

function sGetParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getRealYouTubeVideoId(video) {
  if (!video) return null;

  const value =
    video.youtube_video_id ||
    video.youtubeVideoId ||
    video.youtube_id ||
    video.youtubeId ||
    null;

  if (!value || typeof value !== 'string') return null;

  // Accept a raw YouTube ID as well as common URL formats.
  const trimmed = value.trim();

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (url.hostname.includes('youtube.com')) {
      const id = url.searchParams.get('v');
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    }
  } catch (_) {
    // Not a URL; fall through.
  }

  return null;
}

function getPositionStore() {
  try {
    const data = JSON.parse(localStorage.getItem(POSITION_KEY) || '{}');
    return data && typeof data === 'object' ? data : {};
  } catch (_) {
    return {};
  }
}

function getSavedPosition(video) {
  if (!rememberPosition) return 0;

  const youtubeId = getRealYouTubeVideoId(video);
  if (!youtubeId) return 0;

  const store = getPositionStore();
  const value = Number(store[youtubeId]);

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function savePosition(video, seconds) {
  if (!rememberPosition) return;

  const youtubeId = getRealYouTubeVideoId(video);
  if (!youtubeId || !Number.isFinite(seconds)) return;

  const store = getPositionStore();
  store[youtubeId] = Math.max(0, Math.floor(seconds));

  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(store));
  } catch (_) {
    // Storage failure should never stop Study Mode.
  }
}

function clearSavedPosition(video) {
  const youtubeId = getRealYouTubeVideoId(video);
  if (!youtubeId) return;

  const store = getPositionStore();
  delete store[youtubeId];

  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(store));
  } catch (_) {}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setPlayerStatus(text) {
  const el = document.getElementById('playerStatus');
  if (el) el.textContent = text;
}

function showYoutubeLoading(show) {
  const el = document.getElementById('youtubeLoading');
  if (el) el.classList.toggle('hidden', !show);
}

function showYoutubeError(message) {
  const error = document.getElementById('youtubeError');
  const messageEl = document.getElementById('youtubeErrorMessage');

  if (messageEl) messageEl.textContent = message;
  if (error) error.classList.add('show');

  showYoutubeLoading(false);
}

function hideYoutubeError() {
  const error = document.getElementById('youtubeError');
  if (error) error.classList.remove('show');
}

function setCenterPlayVisible(visible) {
  const wrap = document.getElementById('centerPlayBtnWrap');
  if (wrap) wrap.classList.toggle('hidden', !visible);
}

function updatePlayIcon() {
  const icon = document.getElementById('playIcon');
  if (!icon) return;

  if (!youtubePlayer || typeof youtubePlayer.getPlayerState !== 'function') {
    icon.textContent = '▶';
    return;
  }

  icon.textContent =
    youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING ? '⏸' : '▶';
}

function formatPlayerTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function updatePlayerProgress() {
  if (!youtubePlayer || !youtubePlayerReady) return;

  let current = 0;
  let duration = 0;

  try {
    current = Number(youtubePlayer.getCurrentTime()) || 0;
    duration = Number(youtubePlayer.getDuration()) || 0;
  } catch (_) {
    return;
  }

  const percent = duration > 0
    ? Math.max(0, Math.min(100, (current / duration) * 100))
    : 0;

  const fill = document.getElementById('playerScrubFill');
  const scrub = document.getElementById('playerScrub');
  const time = document.getElementById('playerTime');

  if (fill) fill.style.width = `${percent}%`;

  if (scrub) {
    scrub.setAttribute('aria-valuenow', String(Math.round(percent)));
  }

  if (time) {
    time.textContent = `${formatPlayerTime(current)} / ${formatPlayerTime(duration)}`;
  }

  const video = studyPlaylist?.videos?.[currentVideoIndex];
  if (video && current > 0) {
    savePosition(video, current);
  }

  // If the video is almost finished, remember it as complete.
  if (
    video &&
    !video.completed &&
    duration > 0 &&
    current >= Math.max(1, duration - COMPLETION_THRESHOLD_SECONDS)
  ) {
    markCurrentComplete({ auto: true });
  }
}

/* ---------------- Empty / error states ---------------- */

function showEmptyState() {
  document.getElementById('studyRoot').innerHTML = `
    <div class="empty-state">
      <h3>No study content yet</h3>
      <p>
        <a href="add-content.html" style="color:var(--accent-hover)">
          Add a playlist to get started
        </a>
      </p>
    </div>`;
}

function showStudyError(message) {
  document.getElementById('studyRoot').innerHTML = `
    <div class="empty-state">
      <h3>Couldn't load Study Mode</h3>
      <p>${escapeHtml(message)}</p>
      <p style="margin-top:12px;">
        <a href="library.html" style="color:var(--accent-hover)">Return to Library</a>
      </p>
    </div>`;
}

/* ---------------- Load playlist ---------------- */

async function loadStudyData() {
  const idParam = sGetParam('id');

  try {
    if (idParam) {
      studyPlaylist = await api(`/playlists/${encodeURIComponent(idParam)}`);
    } else {
      const playlists = await api('/playlists');
      studyPlaylist = playlists && playlists.length ? playlists[0] : null;
    }
  } catch (err) {
    showStudyError(err.message);
    return false;
  }

  if (
    !studyPlaylist ||
    !Array.isArray(studyPlaylist.videos) ||
    studyPlaylist.videos.length === 0
  ) {
    showEmptyState();
    return false;
  }

  const videoIdParam = sGetParam('video');
  const videoId = videoIdParam ? Number(videoIdParam) : null;

  const requestedIndex = studyPlaylist.videos.findIndex(
    video => Number(video.id) === videoId
  );

  const firstIncompleteIndex = studyPlaylist.videos.findIndex(
    video => !video.completed
  );

  currentVideoIndex =
    requestedIndex >= 0
      ? requestedIndex
      : firstIncompleteIndex >= 0
        ? firstIncompleteIndex
        : 0;

  return true;
}

/* ---------------- Render ---------------- */

function renderTopbar() {
  document.getElementById('topbarPlaylistTitle').textContent =
    studyPlaylist.title || 'Study Mode';
}

function renderVideoInfo() {
  const video = studyPlaylist.videos[currentVideoIndex];
  if (!video) return;

  document.getElementById('videoTitle').textContent =
    video.title || 'Untitled video';

  document.getElementById('videoMeta').textContent =
    `${studyPlaylist.title || 'Playlist'} · ` +
    `${studyPlaylist.channel_name || 'Imported'} · ` +
    `Video ${currentVideoIndex + 1} of ${studyPlaylist.videos.length}`;

  const markBtn = document.getElementById('markCompleteBtn');

  if (video.completed) {
    markBtn.textContent = '✓ Completed';
    markBtn.disabled = true;
  } else {
    markBtn.textContent = 'Mark as complete';
    markBtn.disabled = false;
  }

  history.replaceState(
    null,
    '',
    `study.html?id=${encodeURIComponent(studyPlaylist.id)}&video=${encodeURIComponent(video.id)}`
  );
}

function renderQueue() {
  const listEl = document.getElementById('studyQueueList');

  document.getElementById('queuePlaylistTitle').textContent =
    studyPlaylist.title || 'Playlist';

  listEl.innerHTML = studyPlaylist.videos.map((video, index) => {
    let state = 'pending';
    let icon = '○';

    if (video.completed) {
      state = 'done';
      icon = '✓';
    }

    if (index === currentVideoIndex) {
      state = 'current';
      icon = '▶';
    }

    return `
      <button
        class="queue-item ${state}"
        data-index="${index}"
        type="button"
        aria-current="${index === currentVideoIndex ? 'true' : 'false'}"
      >
        <span class="queue-status ${state}" aria-hidden="true">${icon}</span>
        <span class="queue-item-title">
          ${String(index + 1).padStart(2, '0')} ${escapeHtml(video.title)}
        </span>
        <span class="queue-duration">
          ${formatDuration(video.duration_seconds)}
        </span>
      </button>`;
  }).join('');

  listEl.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = Number(item.dataset.index);
      if (!Number.isInteger(index)) return;
      loadVideoAtIndex(index);
    });
  });
}

/* ---------------- YouTube IFrame Player ---------------- */

function onYouTubeIframeAPIReady() {
  youtubeApiReady = true;

  // study.js can load before the API finishes downloading.
  if (studyPlaylist) {
    initializeYouTubePlayer();
  }
}

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

function initializeYouTubePlayer() {
  if (!youtubeApiReady || !studyPlaylist) return;
  if (youtubePlayer) return;

  const video = studyPlaylist.videos[currentVideoIndex];
  const youtubeId = getRealYouTubeVideoId(video);

  if (!youtubeId) {
    showYoutubeError(
      'This video does not have a valid YouTube video ID. ' +
      'Re-import the playlist from YouTube so the backend can save the real video ID.'
    );
    return;
  }

  hideYoutubeError();
  showYoutubeLoading(true);
  currentYoutubeVideoId = youtubeId;

  youtubePlayer = new YT.Player('youtube-player', {
    width: '100%',
    height: '100%',
    videoId: youtubeId,
    playerVars: {
      autoplay: 0,
      controls: 1,
      rel: 0,
      playsinline: 1,
      modestbranding: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: handleYouTubeReady,
      onStateChange: handleYouTubeStateChange,
      onError: handleYouTubeError
    }
  });
}

function handleYouTubeReady(event) {
  youtubePlayerReady = true;
  showYoutubeLoading(false);
  hideYoutubeError();

  const video = studyPlaylist.videos[currentVideoIndex];
  const savedPosition = getSavedPosition(video);

  if (savedPosition > 5) {
    try {
      event.target.seekTo(savedPosition, true);
      setPlayerStatus(`Resumed at ${formatPlayerTime(savedPosition)}`);
    } catch (_) {
      setPlayerStatus('Ready');
    }
  } else {
    setPlayerStatus('Ready');
  }

  updatePlayIcon();
  updatePlayerProgress();
}

function handleYouTubeStateChange(event) {
  updatePlayIcon();

  if (event.data === YT.PlayerState.PLAYING) {
    setPlayerStatus('Playing');
    setCenterPlayVisible(false);
    startPlaybackTracking();
  } else if (event.data === YT.PlayerState.PAUSED) {
    setPlayerStatus('Paused');
    setCenterPlayVisible(true);
    stopPlaybackTracking();
    updatePlayerProgress();
  } else if (event.data === YT.PlayerState.ENDED) {
    setPlayerStatus('Completed');
    setCenterPlayVisible(true);
    stopPlaybackTracking();

    const video = studyPlaylist.videos[currentVideoIndex];

    if (video) {
      savePosition(video, 0);
      markCurrentComplete({ auto: true });
    }

    if (autoplayNext && currentVideoIndex < studyPlaylist.videos.length - 1) {
      window.setTimeout(() => {
        loadVideoAtIndex(currentVideoIndex + 1, true);
      }, 700);
    }
  } else if (event.data === YT.PlayerState.BUFFERING) {
    setPlayerStatus('Buffering…');
    setCenterPlayVisible(false);
  } else if (event.data === YT.PlayerState.CUED) {
    setPlayerStatus('Ready');
    setCenterPlayVisible(true);
  }
}

function handleYouTubeError(event) {
  stopPlaybackTracking();
  setCenterPlayVisible(true);

  const messages = {
    2: 'The YouTube video ID is invalid.',
    5: 'The video cannot be played in the HTML5 player.',
    100: 'This video was removed or is unavailable.',
    101: 'The video owner does not allow embedded playback.',
    150: 'The video owner does not allow embedded playback.'
  };

  showYoutubeError(
    messages[event.data] ||
    `YouTube could not play this video (error ${event.data}).`
  );
  setPlayerStatus('Unavailable');
}

function startPlaybackTracking() {
  clearInterval(playbackInterval);
  playbackInterval = window.setInterval(updatePlayerProgress, 1000);
}

function stopPlaybackTracking() {
  clearInterval(playbackInterval);
  playbackInterval = null;
  updatePlayerProgress();
}

function loadYouTubeVideo(youtubeId, startSeconds = 0) {
  if (!youtubePlayer || !youtubePlayerReady) {
    initializeYouTubePlayer();
    return;
  }

  if (!youtubeId) {
    showYoutubeError('This video is missing its real YouTube video ID.');
    return;
  }

  currentYoutubeVideoId = youtubeId;
  hideYoutubeError();
  showYoutubeLoading(false);
  stopPlaybackTracking();

  try {
    youtubePlayer.loadVideoById({
      videoId: youtubeId,
      startSeconds: Math.max(0, Number(startSeconds) || 0)
    });

    setPlayerStatus(startSeconds > 5 ? 'Resuming…' : 'Ready');
    updatePlayerProgress();
  } catch (err) {
    showYoutubeError('Could not load the YouTube video.');
  }
}

function loadVideoAtIndex(index, autoplay = false) {
  if (
    !studyPlaylist ||
    index < 0 ||
    index >= studyPlaylist.videos.length
  ) {
    return;
  }

  // Save the old video's position before switching.
  if (youtubePlayerReady && studyPlaylist.videos[currentVideoIndex]) {
    updatePlayerProgress();
  }

  currentVideoIndex = index;

  renderVideoInfo();
  renderQueue();

  const video = studyPlaylist.videos[currentVideoIndex];
  const youtubeId = getRealYouTubeVideoId(video);

  if (!youtubeId) {
    showYoutubeError(
      'This video has no valid YouTube video ID. ' +
      'Please re-import this playlist.'
    );
    return;
  }

  const savedPosition = getSavedPosition(video);

  if (!youtubePlayerReady) {
    initializeYouTubePlayer();
    return;
  }

  loadYouTubeVideo(youtubeId, savedPosition);

  if (autoplay) {
    // loadVideoById starts playback; this timeout is only a safety fallback.
    window.setTimeout(() => {
      try {
        youtubePlayer.playVideo();
      } catch (_) {}
    }, 150);
  }
}

function togglePlayback() {
  if (!youtubePlayer || !youtubePlayerReady) return;

  const state = youtubePlayer.getPlayerState();

  if (
    state === YT.PlayerState.PLAYING ||
    state === YT.PlayerState.BUFFERING
  ) {
    youtubePlayer.pauseVideo();
  } else {
    youtubePlayer.playVideo();
  }
}

function goToVideo(delta) {
  const nextIndex = currentVideoIndex + delta;

  if (
    nextIndex < 0 ||
    nextIndex >= studyPlaylist.videos.length
  ) {
    showToast(
      delta < 0 ? 'This is the first video.' : 'This is the last video.',
      'warning'
    );
    return;
  }

  loadVideoAtIndex(nextIndex);
}

async function markCurrentComplete(options = {}) {
  const video = studyPlaylist?.videos?.[currentVideoIndex];

  if (!video || video.completed) return;

  const markBtn = document.getElementById('markCompleteBtn');
  if (markBtn) markBtn.disabled = true;

  try {
    const updated = await api(
      `/playlists/${studyPlaylist.id}/videos/${video.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ completed: true })
      }
    );

    video.completed = Boolean(updated.completed);
    clearSavedPosition(video);

    if (!options.auto) {
      showToast('Progress saved');
    }
  } catch (err) {
    if (markBtn) markBtn.disabled = false;

    if (!options.auto) {
      showToast(err.message, 'warning');
    }
    return;
  }

  renderVideoInfo();
  renderQueue();
}

function seekFromPointer(event) {
  if (!youtubePlayer || !youtubePlayerReady) return;

  const rect = event.currentTarget.getBoundingClientRect();
  const ratio = Math.max(
    0,
    Math.min(1, (event.clientX - rect.left) / rect.width)
  );

  const duration = Number(youtubePlayer.getDuration()) || 0;

  if (duration <= 0) return;

  youtubePlayer.seekTo(duration * ratio, true);
  updatePlayerProgress();
}

function seekFromKeyboard(event) {
  if (!youtubePlayer || !youtubePlayerReady) return;

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

  event.preventDefault();

  const current = Number(youtubePlayer.getCurrentTime()) || 0;
  const duration = Number(youtubePlayer.getDuration()) || 0;
  const change = event.key === 'ArrowRight' ? 10 : -10;

  youtubePlayer.seekTo(
    Math.max(0, Math.min(duration, current + change)),
    true
  );

  updatePlayerProgress();
}

function fullscreenPlayer() {
  const iframe =
    youtubePlayer &&
    typeof youtubePlayer.getIframe === 'function'
      ? youtubePlayer.getIframe()
      : document.querySelector('#youtube-player iframe');

  if (iframe?.requestFullscreen) {
    iframe.requestFullscreen().catch(() => {});
    return;
  }

  const player = document.getElementById('studyPlayer');
  if (player?.requestFullscreen) {
    player.requestFullscreen().catch(() => {});
  }
}

function wirePlayerControls() {
  document
    .getElementById('playPauseBtn')
    .addEventListener('click', togglePlayback);

  document
    .getElementById('centerPlayBtn')
    .addEventListener('click', togglePlayback);

  document
    .getElementById('prevBtn')
    .addEventListener('click', () => goToVideo(-1));

  document
    .getElementById('nextBtn')
    .addEventListener('click', () => goToVideo(1));

  document
    .getElementById('markCompleteBtn')
    .addEventListener('click', () => markCurrentComplete());

  document
    .getElementById('fullscreenBtn')
    .addEventListener('click', fullscreenPlayer);

  document
    .getElementById('playerScrub')
    .addEventListener('click', seekFromPointer);

  document
    .getElementById('playerScrub')
    .addEventListener('keydown', seekFromKeyboard);

  window.addEventListener('beforeunload', () => {
    if (youtubePlayerReady) {
      updatePlayerProgress();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && youtubePlayerReady) {
      updatePlayerProgress();
    }
  });
}

/* ---------------- Focus timer ---------------- */

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerRing() {
  const fraction =
    timerTotalSeconds > 0
      ? timerRemaining / timerTotalSeconds
      : 0;

  const offset = TIMER_CIRCUMFERENCE * (1 - fraction);

  document.getElementById('timerRingFill').style.strokeDashoffset = offset;
  document.getElementById('timerTime').textContent =
    formatTimer(timerRemaining);
}

function setTimerPreset(minutes, btn) {
  pauseTimer();

  timerTotalSeconds = minutes * 60;
  timerRemaining = timerTotalSeconds;

  document
    .querySelectorAll('.preset-btn')
    .forEach(b => b.classList.remove('active'));

  if (btn) btn.classList.add('active');

  document
    .getElementById('timerCompleteMsg')
    .classList.remove('show');

  updateTimerRing();
}

function startTimer() {
  if (timerRunning) return;

  if (timerRemaining <= 0) {
    timerRemaining = timerTotalSeconds;
  }

  timerRunning = true;
  document.getElementById('timerStartBtn').textContent = 'Pause';

  timerInterval = window.setInterval(() => {
    timerRemaining -= 1;
    updateTimerRing();

    if (timerRemaining <= 0) {
      completeTimer();
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;

  const btn = document.getElementById('timerStartBtn');
  if (btn) btn.textContent = 'Start Focus';
}

function toggleTimer() {
  timerRunning ? pauseTimer() : startTimer();
}

function resetTimer() {
  pauseTimer();
  timerRemaining = timerTotalSeconds;

  document
    .getElementById('timerCompleteMsg')
    .classList.remove('show');

  updateTimerRing();
}

function completeTimer() {
  pauseTimer();

  timerRemaining = 0;
  updateTimerRing();

  document
    .getElementById('timerCompleteMsg')
    .classList.add('show');

  showToast('Focus session completed! 🎉', 'success');

  logFocusSession(Math.round(timerTotalSeconds / 60));
}

async function logFocusSession(minutes) {
  try {
    await api('/progress/sessions', {
      method: 'POST',
      body: JSON.stringify({
        minutes,
        playlist_id: studyPlaylist ? studyPlaylist.id : null
      })
    });
  } catch (err) {
    showToast(
      `Session finished, but couldn't save it: ${err.message}`,
      'warning'
    );
  }
}

function wireTimerControls() {
  document
    .querySelectorAll('.preset-btn[data-minutes]')
    .forEach(btn => {
      btn.addEventListener('click', () => {
        setTimerPreset(Number(btn.dataset.minutes), btn);
      });
    });

  document
    .getElementById('customPresetBtn')
    .addEventListener('click', () => {
      const input = prompt(
        'Custom focus duration in minutes:',
        '45'
      );

      const minutes = Number.parseInt(input, 10);

      if (minutes && minutes > 0 && minutes <= 240) {
        document
          .querySelectorAll('.preset-btn')
          .forEach(b => b.classList.remove('active'));

        document
          .getElementById('customPresetBtn')
          .classList.add('active');

        setTimerPreset(
          minutes,
          document.getElementById('customPresetBtn')
        );
      }
    });

  document
    .getElementById('timerStartBtn')
    .addEventListener('click', toggleTimer);

  document
    .getElementById('timerResetBtn')
    .addEventListener('click', resetTimer);
}

/* ---------------- Focus Mode ---------------- */

function wireFocusModeToggle() {
  const btn = document.getElementById('focusModeBtn');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const active = document.body.classList.toggle(
      'focus-mode-active'
    );

    const side = document.querySelector('.study-side');

    if (side) {
      side.style.display = active ? 'none' : '';
    }

    btn.textContent = active
      ? '🎯 Exit Focus'
      : '🎯 Focus Mode';
  });
}

/* ---------------- User settings ---------------- */

async function loadStudySettings() {
  try {
    const settings = await api('/settings');

    rememberPosition =
      settings.remember_position !== false;

    autoplayNext =
      settings.autoplay !== false;

    return settings;
  } catch (_) {
    rememberPosition = true;
    autoplayNext = true;
    return null;
  }
}

/* ---------------- Init ---------------- */

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;

  const loaded = await loadStudyData();
  if (!loaded) return;

  renderTopbar();
  renderVideoInfo();
  renderQueue();
  wirePlayerControls();
  wireTimerControls();
  wireFocusModeToggle();

  const settings = await loadStudySettings();

  const defaultMinutes =
    Number(settings?.focus_duration) > 0
      ? Number(settings.focus_duration)
      : 25;

  timerTotalSeconds = defaultMinutes * 60;
  timerRemaining = timerTotalSeconds;

  const matchingPreset = document.querySelector(
    `.preset-btn[data-minutes="${defaultMinutes}"]`
  );

  if (matchingPreset) {
    matchingPreset.classList.add('active');
  }

  updateTimerRing();

  // If the YouTube API is already loaded, initialize immediately.
  // Otherwise onYouTubeIframeAPIReady() will do it.
  if (window.YT && window.YT.Player) {
    youtubeApiReady = true;
    initializeYouTubePlayer();
  }
});
