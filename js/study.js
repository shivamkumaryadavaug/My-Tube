/* ==========================================================================
   study.js — Study Mode, wired to the real MyTube backend (js/api.js)
   Load order in study.html: app.js -> api.js -> study.js
   ========================================================================== */

/* ---------------- State ---------------- */
let studyPlaylist = null;
let currentVideoIndex = 0;
let isPlaying = false;
let playInterval = null;
let mockProgress = 38; // % across the fake scrub bar — playback itself is still simulated

const TIMER_CIRCUMFERENCE = 2 * Math.PI * 76;

let timerTotalSeconds = 25 * 60;
let timerRemaining = timerTotalSeconds;
let timerInterval = null;
let timerRunning = false;

function sGetParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

/* ---------------- Empty / error states ---------------- */
function showEmptyState(){
  document.getElementById('studyRoot').innerHTML = `
    <div class="empty-state">
      <h3>No study content yet</h3>
      <p><a href="add-content.html" style="color:var(--accent-hover)">Add a playlist to get started</a></p>
    </div>`;
}

function showStudyError(message){
  document.getElementById('studyRoot').innerHTML = `
    <div class="empty-state">
      <h3>Couldn't load Study Mode</h3>
      <p>${escapeHtml(message)}</p>
    </div>`;
}

/* ---------------- Load playlist / video from the API ---------------- */
async function loadStudyData(){
  const idParam = sGetParam('id');

  try{
    if(idParam){
      studyPlaylist = await api(`/playlists/${idParam}`);
    }else{
      const playlists = await api('/playlists');
      studyPlaylist = (playlists && playlists.length) ? playlists[0] : null;
    }
  }catch(err){
    showStudyError(err.message);
    return false;
  }

  if(!studyPlaylist || !studyPlaylist.videos || studyPlaylist.videos.length === 0){
    showEmptyState();
    return false;
  }

  const videoIdParam = sGetParam('video');
  const videoId = videoIdParam ? parseInt(videoIdParam, 10) : null;
  const idx = studyPlaylist.videos.findIndex(v => v.id === videoId);
  currentVideoIndex = idx >= 0 ? idx : studyPlaylist.videos.findIndex(v => !v.completed);
  if(currentVideoIndex < 0) currentVideoIndex = 0;
  return true;
}

/* ---------------- Render ---------------- */
function renderTopbar(){
  document.getElementById('topbarPlaylistTitle').textContent = studyPlaylist.title;
}

function renderVideoInfo(){
  const video = studyPlaylist.videos[currentVideoIndex];
  document.getElementById('videoTitle').textContent = video.title;
  document.getElementById('videoMeta').textContent =
    `${studyPlaylist.title} · ${studyPlaylist.channel_name || 'Imported'} · Video ${currentVideoIndex + 1} of ${studyPlaylist.videos.length}`;
  document.getElementById('mockPlayerTitle').textContent = video.title;

  const markBtn = document.getElementById('markCompleteBtn');
  if(video.completed){
    markBtn.textContent = '✓ Completed';
    markBtn.classList.add('btn-secondary');
    markBtn.disabled = true;
  }else{
    markBtn.textContent = 'Mark as complete';
    markBtn.classList.remove('btn-secondary');
    markBtn.disabled = false;
  }

  history.replaceState(null, '', `study.html?id=${studyPlaylist.id}&video=${video.id}`);
}

function renderQueue(){
  const listEl = document.getElementById('studyQueueList');
  document.getElementById('queuePlaylistTitle').textContent = studyPlaylist.title;

  listEl.innerHTML = studyPlaylist.videos.map((v, i) => {
    let state = 'pending', icon = '○';
    if(v.completed){ state = 'done'; icon = '✓'; }
    if(i === currentVideoIndex){ state = 'current'; icon = '▶'; }
    return `
      <div class="queue-item ${state}" data-index="${i}">
        <span class="queue-status ${state}">${icon}</span>
        <span class="queue-item-title">${String(i + 1).padStart(2, '0')} ${escapeHtml(v.title)}</span>
        <span class="queue-duration">${formatDuration(v.duration_seconds)}</span>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.queue-item').forEach(item => {
    item.addEventListener('click', () => {
      currentVideoIndex = parseInt(item.dataset.index, 10);
      pausePlayback();
      mockProgress = 4;
      updateScrub();
      renderVideoInfo();
      renderQueue();
    });
  });
}

/* ---------------- Mock player (playback is still simulated — see README) ---------------- */
function updateScrub(){
  document.getElementById('playerScrubFill').style.width = `${mockProgress}%`;
}

function togglePlayback(){
  isPlaying ? pausePlayback() : startPlayback();
}
function startPlayback(){
  isPlaying = true;
  document.getElementById('playIcon').textContent = '⏸';
  document.getElementById('centerPlayBtn').style.opacity = '0';
  document.getElementById('centerPlayBtn').style.pointerEvents = 'none';
  document.getElementById('playerVisual').classList.add('show-controls');
  clearInterval(playInterval);
  playInterval = setInterval(() => {
    mockProgress = Math.min(100, mockProgress + 0.6);
    updateScrub();
    if(mockProgress >= 100) pausePlayback();
  }, 300);
}
function pausePlayback(){
  isPlaying = false;
  clearInterval(playInterval);
  const el = document.getElementById('playIcon');
  if(el) el.textContent = '▶';
  const center = document.getElementById('centerPlayBtn');
  if(center){ center.style.opacity = '1'; center.style.pointerEvents = 'auto'; }
}

function goToVideo(delta){
  const nextIndex = currentVideoIndex + delta;
  if(nextIndex < 0 || nextIndex >= studyPlaylist.videos.length) return;
  currentVideoIndex = nextIndex;
  pausePlayback();
  mockProgress = 4;
  updateScrub();
  renderVideoInfo();
  renderQueue();
}

/* ---------------- Mark complete (writes through to the backend) ---------------- */
async function markCurrentComplete(){
  const video = studyPlaylist.videos[currentVideoIndex];
  if(video.completed) return;

  const markBtn = document.getElementById('markCompleteBtn');
  markBtn.disabled = true;

  try{
    const updated = await api(`/playlists/${studyPlaylist.id}/videos/${video.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    });
    video.completed = updated.completed;
    showToast('Progress saved');
  }catch(err){
    showToast(err.message, 'warning');
  }

  renderVideoInfo();
  renderQueue();
}

function wirePlayerControls(){
  document.getElementById('playPauseBtn').addEventListener('click', togglePlayback);
  document.getElementById('centerPlayBtn').addEventListener('click', togglePlayback);
  document.getElementById('prevBtn').addEventListener('click', () => goToVideo(-1));
  document.getElementById('nextBtn').addEventListener('click', () => goToVideo(1));
  document.getElementById('markCompleteBtn').addEventListener('click', markCurrentComplete);
  document.getElementById('fullscreenBtn').addEventListener('click', () => {
    const player = document.getElementById('playerVisual').closest('.player');
    if(player.requestFullscreen) player.requestFullscreen().catch(() => {});
  });
  document.getElementById('playerScrub').addEventListener('click', (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mockProgress = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    updateScrub();
  });
}

/* ---------------- Focus timer ---------------- */
function formatTimer(seconds){
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateTimerRing(){
  const fraction = timerRemaining / timerTotalSeconds;
  const offset = TIMER_CIRCUMFERENCE * (1 - fraction);
  document.getElementById('timerRingFill').style.strokeDashoffset = offset;
  document.getElementById('timerTime').textContent = formatTimer(timerRemaining);
}

function setTimerPreset(minutes, btn){
  pauseTimer();
  timerTotalSeconds = minutes * 60;
  timerRemaining = timerTotalSeconds;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.getElementById('timerCompleteMsg').classList.remove('show');
  updateTimerRing();
}

function startTimer(){
  if(timerRunning) return;
  if(timerRemaining <= 0) timerRemaining = timerTotalSeconds;
  timerRunning = true;
  document.getElementById('timerStartBtn').textContent = 'Pause';
  document.getElementById('timerCompleteMsg').classList.remove('show');
  timerInterval = setInterval(() => {
    timerRemaining -= 1;
    updateTimerRing();
    if(timerRemaining <= 0){
      completeTimer();
    }
  }, 1000);
}

function pauseTimer(){
  timerRunning = false;
  clearInterval(timerInterval);
  const btn = document.getElementById('timerStartBtn');
  if(btn) btn.textContent = 'Start Focus';
}

function toggleTimer(){
  timerRunning ? pauseTimer() : startTimer();
}

function resetTimer(){
  pauseTimer();
  timerRemaining = timerTotalSeconds;
  document.getElementById('timerCompleteMsg').classList.remove('show');
  updateTimerRing();
}

function completeTimer(){
  pauseTimer();
  timerRemaining = 0;
  updateTimerRing();
  document.getElementById('timerCompleteMsg').classList.add('show');
  showToast('Focus session completed! 🎉', 'success');
  logFocusSession(Math.round(timerTotalSeconds / 60));
}

/* Writes the completed session to the backend instead of localStorage. */
async function logFocusSession(minutes){
  try{
    await api('/progress/sessions', {
      method: 'POST',
      body: JSON.stringify({
        minutes,
        playlist_id: studyPlaylist ? studyPlaylist.id : null,
      }),
    });
  }catch(err){
    showToast(`Session finished, but couldn't save it: ${err.message}`, 'warning');
  }
}

function wireTimerControls(){
  document.querySelectorAll('.preset-btn[data-minutes]').forEach(btn => {
    btn.addEventListener('click', () => setTimerPreset(parseInt(btn.dataset.minutes, 10), btn));
  });
  document.getElementById('customPresetBtn').addEventListener('click', () => {
    const input = prompt('Custom focus duration in minutes:', '45');
    const minutes = parseInt(input, 10);
    if(minutes && minutes > 0 && minutes <= 240){
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('customPresetBtn').classList.add('active');
      pauseTimer();
      timerTotalSeconds = minutes * 60;
      timerRemaining = timerTotalSeconds;
      document.getElementById('timerCompleteMsg').classList.remove('show');
      updateTimerRing();
    }
  });
  document.getElementById('timerStartBtn').addEventListener('click', toggleTimer);
  document.getElementById('timerResetBtn').addEventListener('click', resetTimer);
}

/* ---------------- Focus Mode (hide chrome) ---------------- */
function wireFocusModeToggle(){
  const btn = document.getElementById('focusModeBtn');
  if(!btn) return;
  btn.addEventListener('click', () => {
    document.body.classList.toggle('focus-mode-active');
    const side = document.querySelector('.study-side');
    if(side) side.style.display = document.body.classList.contains('focus-mode-active') ? 'none' : '';
  });
}

/* ---------------- Default focus duration from the user's saved settings ---------------- */
async function loadDefaultFocusMinutes(){
  try{
    const settings = await api('/settings');
    return settings.focus_duration || 25;
  }catch(err){
    return 25; // fall back quietly — this isn't critical enough to block the page
  }
}

/* ---------------- Init ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  if(!requireAuth()) return; // sends to login.html if there's no token yet

  const loaded = await loadStudyData();
  if(!loaded) return;

  renderTopbar();
  renderVideoInfo();
  renderQueue();
  updateScrub();
  wirePlayerControls();
  wireTimerControls();
  wireFocusModeToggle();

  const defaultMinutes = await loadDefaultFocusMinutes();
  timerTotalSeconds = defaultMinutes * 60;
  timerRemaining = timerTotalSeconds;
  const matchingPreset = document.querySelector(`.preset-btn[data-minutes="${defaultMinutes}"]`);
  if(matchingPreset) matchingPreset.classList.add('active');
  updateTimerRing();
});
