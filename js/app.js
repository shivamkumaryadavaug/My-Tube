/* ==========================================================================
   MyTube — app.js
   Shared utilities used across every page: theme, toasts, nav highlighting,
   and small formatters. Data itself now lives on the backend (see api.js) —
   this file no longer seeds or stores any mock playlists/channels/progress.
   ========================================================================== */

const STORAGE_KEYS = {
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

/* ---------------- Generic localStorage helpers (used for theme caching only) ---------------- */
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

/* ---------------- Formatting helpers ---------------- */
function gradientFor(seed){
  let hash = 0;
  for(let i=0;i<seed.length;i++) hash = seed.charCodeAt(i) + ((hash<<5)-hash);
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}
function cardBackground(item){
  // Real YouTube thumbnail when we have one, otherwise a stable gradient.
  if(item && item.thumbnail_url){
    return `background-image:url('${item.thumbnail_url}');background-size:cover;background-position:center;`;
  }
  return `background:${gradientFor((item && (item.title || item.name)) || 'MyTube')};`;
}
function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str == null ? '' : str;
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

/* ---------------- Light client-side pre-validation (server validates for real) ---------------- */
function isValidPlaylistUrl(url){
  return /^https?:\/\/(www\.)?youtube\.com\/(playlist\?list=|watch\?.*[?&]list=)[\w-]+/i.test(url.trim());
}
function isValidChannelUrl(url){
  return /^https?:\/\/(www\.)?youtube\.com\/(channel\/|c\/|@|user\/)[\w-]+/i.test(url.trim());
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
  initTheme();
  highlightActiveNav();
});
