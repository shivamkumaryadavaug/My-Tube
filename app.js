/* ==========================================================================
   MyTube — app.js
   Shared utilities: storage, mock data seeding, toasts, theme, nav highlighting
   Loaded on every page before the page-specific script.
   ========================================================================== */

const STORAGE_KEYS = {
  PLAYLISTS: 'mytube_playlists',
  CHANNELS: 'mytube_channels',
  PROGRESS: 'mytube_progress',
  SESSIONS: 'mytube_sessions',
  SETTINGS: 'mytube_settings',
  THEME: 'mytube_theme'
};

const GRADIENTS = [
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#22c55e,#4ade80)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#06b6d4,#22d3ee)',
  'linear-gradient(135deg,#ff3b30,#ff8a70)'
];

const VIDEO_TITLES = ['Introduction','Variables','Data Types','Operators','Conditional Statements','Loops','Functions','Arrays','Pointers'];

/* ---------------- Storage helpers ---------------- */
function getData(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){
    console.error('Storage read failed for', key, e);
    return fallback;
  }
}
function setData(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    console.error('Storage write failed for', key, e);
  }
}
function generateId(prefix){
  return prefix + '-' + Math.random().toString(36).slice(2,9);
}
function gradientFor(seed){
  let hash = 0;
  for(let i=0;i<seed.length;i++) hash = seed.charCodeAt(i) + ((hash<<5)-hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function formatMinutes(totalMinutes){
  const h = Math.floor(totalMinutes/60);
  const m = totalMinutes % 60;
  if(h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}
function pct(part, total){
  if(!total) return 0;
  return Math.round((part/total)*100);
}
function debounce(fn, wait){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

/* ---------------- YouTube URL validation ---------------- */
function isValidPlaylistUrl(url){
  return /^https?:\/\/(www\.)?youtube\.com\/(playlist\?list=|watch\?.*[?&]list=)[\w-]+/i.test(url.trim());
}
function isValidChannelUrl(url){
  return /^https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@)[\w-]+/i.test(url.trim());
}

/* ---------------- Mock data seeding ---------------- */
function buildVideos(count, completedCount){
  const videos = [];
  for(let i=0;i<count;i++){
    const base = VIDEO_TITLES[i % VIDEO_TITLES.length];
    const round = Math.floor(i / VIDEO_TITLES.length);
    const title = round === 0 ? base : `${base} — Part ${round+1}`;
    videos.push({
      id: `v${i+1}`,
      title,
      duration: `${8 + (i % 12)}:${(i*7 % 60).toString().padStart(2,'0')}`,
      completed: i < completedCount
    });
  }
  return videos;
}

function seedMockData(){
  if(!localStorage.getItem(STORAGE_KEYS.CHANNELS)){
    setData(STORAGE_KEYS.CHANNELS, [
      { id:'channel-cwh', name:'CodeWithHarry', gradient: gradientFor('CodeWithHarry'), description:'Programming tutorials in Hindi and English, from absolute basics to advanced projects.', totalSelected:24 },
      { id:'channel-fcc', name:'freeCodeCamp.org', gradient: gradientFor('freeCodeCamp.org'), description:'Free, in-depth courses on web development, data science and computer science fundamentals.', totalSelected:18 },
      { id:'channel-apna', name:'Apna College', gradient: gradientFor('Apna College'), description:'DSA and placement-focused computer science courses for interview preparation.', totalSelected:15 }
    ]);
  }

  if(!localStorage.getItem(STORAGE_KEYS.PLAYLISTS)){
    setData(STORAGE_KEYS.PLAYLISTS, [
      { id:'pl-c', title:'C Programming', channel:'CodeWithHarry', channelId:'channel-cwh', gradient: gradientFor('C Programming'), videos: buildVideos(36,24) },
      { id:'pl-python', title:'Python Programming', channel:'CodeWithHarry', channelId:'channel-cwh', gradient: gradientFor('Python Programming'), videos: buildVideos(40,12) },
      { id:'pl-webdev', title:'Web Development', channel:'freeCodeCamp.org', channelId:'channel-fcc', gradient: gradientFor('Web Development'), videos: buildVideos(32,18) },
      { id:'pl-dsa', title:'Data Structures & Algorithms', channel:'Apna College', channelId:'channel-apna', gradient: gradientFor('Data Structures & Algorithms'), videos: buildVideos(40,6) },
      { id:'pl-js', title:'JavaScript', channel:'CodeWithHarry', channelId:'channel-cwh', gradient: gradientFor('JavaScript'), videos: buildVideos(28,3) }
    ]);
  }

  if(!localStorage.getItem(STORAGE_KEYS.PROGRESS)){
    setData(STORAGE_KEYS.PROGRESS, {
      totalMinutes: 1472,
      videosCompleted: 86,
      sessions: 42,
      streak: 7,
      lastStudyDate: new Date().toDateString(),
      today: { minutes: 42, sessions: 3, videos: 5 },
      weekly: { Mon:45, Tue:60, Wed:35, Thu:80, Fri:52, Sat:90, Sun:42 }
    });
  }

  if(!localStorage.getItem(STORAGE_KEYS.SESSIONS)){
    setData(STORAGE_KEYS.SESSIONS, []);
  }

  if(!localStorage.getItem(STORAGE_KEYS.SETTINGS)){
    setData(STORAGE_KEYS.SETTINGS, {
      focusDuration: 25,
      autoplay: true,
      rememberPosition: true,
      studyReminders: true,
      streakReminders: true
    });
  }
}

/* ---------------- Toast system ---------------- */
function ensureToastStack(){
  let stack = document.querySelector('.toast-stack');
  if(!stack){
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }
  return stack;
}
function showToast(message, type = 'success'){
  const stack = ensureToastStack();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icon = type === 'success' ? '✓' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  setTimeout(()=>{
    toast.classList.add('leaving');
    setTimeout(()=> toast.remove(), 260);
  }, 2800);
}

/* ---------------- Theme ---------------- */
function applyTheme(theme){
  let resolved = theme;
  if(theme === 'system'){
    resolved = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}
function initTheme(){
  const theme = getData(STORAGE_KEYS.THEME, 'dark');
  applyTheme(theme);
}
function setTheme(theme){
  setData(STORAGE_KEYS.THEME, theme);
  applyTheme(theme);
}

/* ---------------- Nav highlighting ---------------- */
function highlightActiveNav(){
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item[href]').forEach(link=>{
    const href = link.getAttribute('href');
    if(href === current){
      link.classList.add('active');
    }
  });
}

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  seedMockData();
  initTheme();
  highlightActiveNav();
});
