/* ==========================================================================
   dashboard.js — home dashboard, backed by the real API
   ========================================================================== */

function greetingForNow(){
  const h = new Date().getHours();
  if(h < 12) return 'Good morning';
  if(h < 17) return 'Good afternoon';
  return 'Good evening';
}

function renderGreeting(){
  const el = document.getElementById('greetingText');
  if(el) el.textContent = `${greetingForNow()} 👋`;
}

async function renderContinueLearning(){
  const wrap = document.getElementById('continuePlaylists');
  if(!wrap) return;

  let playlists = [];
  try{
    playlists = await api('/playlists');
  }catch(err){
    wrap.innerHTML = `<div class="empty-state"><h3>Couldn't load your playlists</h3><p>${escapeHtml(err.message)}</p></div>`;
    return;
  }

  const inProgress = playlists
    .filter(p => p.videos.length && p.videos.some(v => !v.completed))
    .slice(0, 3);

  if(inProgress.length === 0){
    wrap.innerHTML = `<div class="empty-state"><h3>No study sessions yet</h3><p><a href="add-content.html" style="color:var(--accent-hover)">Add a playlist</a> to start learning.</p></div>`;
    return;
  }

  wrap.innerHTML = inProgress.map(p=>{
    const done = p.videos.filter(v=>v.completed).length;
    const total = p.videos.length;
    const percent = pct(done, total);
    return `
      <a class="card playlist-card" href="playlist.html?id=${p.id}">
        <div class="playlist-thumb" style="${cardBackground(p)}">
          <span class="count-badge">${total} videos</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="channel-name">${escapeHtml(p.channel_name || 'Imported')}</div>
        <div class="playlist-meta"><span>${done} / ${total} videos</span><span>${percent}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="continue-link">Continue →</div>
      </a>`;
  }).join('');
}

async function renderTodayFocus(){
  try{
    const today = await api('/progress/today');
    document.getElementById('todayMinutes').textContent = today.minutes;
    document.getElementById('todaySessions').textContent = today.sessions;
    document.getElementById('todayVideos').textContent = today.videos;
  }catch(err){
    // Leave the zeroed defaults in place — not critical enough to block the page.
  }
}

async function renderStreak(){
  try{
    const summary = await api('/progress/summary');
    document.getElementById('streakValue').textContent = `${summary.streak || 0} Day Streak`;
  }catch(err){
    document.getElementById('streakValue').textContent = '0 Day Streak';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(!requireAuth()) return;
  renderGreeting();
  renderContinueLearning();
  renderTodayFocus();
  renderStreak();
});
