/* ==========================================================================
   dashboard.js — renders the home dashboard
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

function renderContinueLearning(){
  const wrap = document.getElementById('continuePlaylists');
  if(!wrap) return;
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  const inProgress = playlists.filter(p => {
    const done = p.videos.filter(v=>v.completed).length;
    return done < p.videos.length;
  }).slice(0,3);

  if(inProgress.length === 0){
    wrap.innerHTML = `<div class="empty-state"><h3>No study sessions yet</h3><p>Add a playlist to start learning.</p></div>`;
    return;
  }

  wrap.innerHTML = inProgress.map(p=>{
    const done = p.videos.filter(v=>v.completed).length;
    const total = p.videos.length;
    const percent = pct(done, total);
    return `
      <a class="card playlist-card" href="playlist.html?id=${p.id}">
        <div class="playlist-thumb" style="background:${p.gradient}">
          <span class="count-badge">${total} videos</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="channel-name">${escapeHtml(p.channel)}</div>
        <div class="playlist-meta"><span>${done} / ${total} videos</span><span>${percent}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        <div class="continue-link">Continue →</div>
      </a>`;
  }).join('');
}

function renderTodayFocus(){
  const progress = getData(STORAGE_KEYS.PROGRESS, {});
  const today = progress.today || { minutes:0, sessions:0, videos:0 };
  document.getElementById('todayMinutes').textContent = today.minutes;
  document.getElementById('todaySessions').textContent = today.sessions;
  document.getElementById('todayVideos').textContent = today.videos;
}

function renderStreak(){
  const progress = getData(STORAGE_KEYS.PROGRESS, {});
  const streakEl = document.getElementById('streakValue');
  if(streakEl) streakEl.textContent = `${progress.streak || 0} Day Streak`;
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderGreeting();
  renderContinueLearning();
  renderTodayFocus();
  renderStreak();
});
