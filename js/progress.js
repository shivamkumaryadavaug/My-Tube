/* ==========================================================================
   progress.js — Progress dashboard, backed by the real API
   ========================================================================== */

async function renderStats(){
  try{
    const summary = await api('/progress/summary');
    document.getElementById('statTotalTime').textContent = formatMinutes(summary.total_minutes || 0);
    document.getElementById('statVideos').textContent = summary.videos_completed || 0;
    document.getElementById('statSessions').textContent = summary.sessions || 0;
    document.getElementById('statStreak').textContent = summary.streak || 0;
  }catch(err){
    showToast(err.message, 'warning');
  }
}

async function renderWeeklyChart(){
  const wrap = document.getElementById('weeklyChart');
  let weekly = [];
  try{
    weekly = await api('/progress/weekly');
  }catch(err){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.85rem;">Couldn't load weekly activity.</p>`;
    return;
  }

  const max = Math.max(...weekly.map(w => w.minutes), 1);
  wrap.innerHTML = weekly.map(w=>{
    const heightPct = Math.max(4, Math.round((w.minutes / max) * 100));
    return `
      <div class="chart-col">
        <div class="chart-bar-wrap"><div class="chart-bar" style="height:${heightPct}%" data-val="${w.minutes}m"></div></div>
        <span class="chart-day">${w.day}</span>
      </div>`;
  }).join('');
}

async function renderCourseProgress(){
  const wrap = document.getElementById('courseList');
  let courses = [];
  try{
    courses = await api('/progress/courses');
  }catch(err){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">Couldn't load course progress.</p>`;
    return;
  }

  if(courses.length === 0){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">No courses yet — <a href="add-content.html" style="color:var(--accent-hover)">add a playlist</a> to see progress here.</p>`;
    return;
  }

  wrap.innerHTML = courses.map(c=>`
    <a class="course-row" href="playlist.html?id=${c.playlist_id}" style="text-decoration:none;color:inherit;">
      <div class="course-row-top"><span class="name">${escapeHtml(c.title)}</span><span class="pct">${c.percent}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${c.percent}%"></div></div>
    </a>`).join('');
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(!requireAuth()) return;
  renderStats();
  renderWeeklyChart();
  renderCourseProgress();
});
