/* ==========================================================================
   progress.js — Progress dashboard
   ========================================================================== */

function renderStats(){
  const progress = getData(STORAGE_KEYS.PROGRESS, {});
  document.getElementById('statTotalTime').textContent = formatMinutes(progress.totalMinutes || 0);
  document.getElementById('statVideos').textContent = progress.videosCompleted || 0;
  document.getElementById('statSessions').textContent = progress.sessions || 0;
  document.getElementById('statStreak').textContent = progress.streak || 0;
}

function renderWeeklyChart(){
  const progress = getData(STORAGE_KEYS.PROGRESS, {});
  const weekly = progress.weekly || {};
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const max = Math.max(...days.map(d => weekly[d] || 0), 1);
  const wrap = document.getElementById('weeklyChart');
  wrap.innerHTML = days.map(d=>{
    const val = weekly[d] || 0;
    const heightPct = Math.max(4, Math.round((val/max)*100));
    return `
      <div class="chart-col">
        <div class="chart-bar-wrap"><div class="chart-bar" style="height:${heightPct}%" data-val="${val}m"></div></div>
        <span class="chart-day">${d}</span>
      </div>`;
  }).join('');
}

function renderCourseProgress(){
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  const wrap = document.getElementById('courseList');
  if(playlists.length === 0){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">No courses yet — add a playlist to see progress here.</p>`;
    return;
  }
  wrap.innerHTML = playlists.map(p=>{
    const done = p.videos.filter(v=>v.completed).length;
    const percent = pct(done, p.videos.length);
    return `
      <div class="course-row">
        <div class="course-row-top"><span class="name">${escapeHtml(p.title)}</span><span class="pct">${percent}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', ()=>{
  renderStats();
  renderWeeklyChart();
  renderCourseProgress();
});
