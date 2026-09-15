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

/* ---------------- Shared nav icon set ----------------
   One inline-SVG icon set used by every sidebar + bottom nav on every page,
   so navigation never mismatches between screens or between desktop/mobile. */
const NAV_ICONS = {
  home: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9"/></svg>',
  library: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H9a1.5 1.5 0 0 1 1.5 1.5v16A1.5 1.5 0 0 1 9 22H5.5A1.5 1.5 0 0 1 4 20.5z"/><path d="M13.7 4.1 17 3.2a1.5 1.5 0 0 1 1.84 1.06l4 15.46a1.5 1.5 0 0 1-1.06 1.84l-3.29.88a1.5 1.5 0 0 1-1.84-1.06l-4-15.46A1.5 1.5 0 0 1 13.7 4.1Z"/></svg>',
  study: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  progress: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M12 20V4"/><path d="M20 20v-7"/></svg>',
  settings: '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>'
};

const NAV_LINKS = [
  { href: 'dashboard.html', key: 'home', label: 'Home' },
  { href: 'library.html', key: 'library', label: 'Library' },
  { href: 'study.html', key: 'study', label: 'Study Mode', shortLabel: 'Study' },
  { href: 'progress.html', key: 'progress', label: 'Progress' }
];

/** Renders the sidebar nav (desktop) into any element with [data-app-sidebar-nav]. */
function renderSidebarNav(){
  const mount = document.querySelector('[data-app-sidebar-nav]');
  if(!mount) return;
  const links = NAV_LINKS.map(l=>
    `<a class="nav-item" href="${l.href}">${NAV_ICONS[l.key]}<span>${l.label}</span></a>`
  ).join('');
  mount.innerHTML = `
    ${links}
    <div class="sidebar-divider"></div>
    <a class="nav-item" href="settings.html">${NAV_ICONS.settings}<span>Settings</span></a>`;
}

/** Renders the bottom nav (mobile) into any element with [data-app-bottom-nav]. */
function renderBottomNav(){
  const mount = document.querySelector('[data-app-bottom-nav]');
  if(!mount) return;
  mount.innerHTML = NAV_LINKS.map(l=>
    `<a class="nav-item" href="${l.href}">${NAV_ICONS[l.key]}<span>${l.shortLabel || l.label}</span></a>`
  ).join('');
}

/** Builds a slim top bar for mobile (logo + settings shortcut), since the
 *  sidebar — which is the only place Settings lives — is hidden on mobile. */
function renderMobileTopbar(){
  if(document.querySelector('.mobile-topbar')) return; // don't duplicate on repeated calls
  if(document.querySelector('.study-shell')) return; // study.html has its own topbar with back nav + settings isn't needed mid-session
  const anchor = document.querySelector('.app-shell');
  if(!anchor) return;
  const bar = document.createElement('div');
  bar.className = 'mobile-topbar';
  bar.innerHTML = `
    <a href="dashboard.html" class="mobile-topbar-logo"><img src="assets/logo.svg" alt="MyTube logo"> MyTube</a>
    <a href="settings.html" class="mobile-topbar-settings" aria-label="Settings">${NAV_ICONS.settings}</a>`;
  anchor.parentNode.insertBefore(bar, anchor);
}

/** Builds the full app shell chrome (sidebar + bottom nav) so every screen,
 *  including Study Mode, shares identical navigation. Call once per page,
 *  before highlightActiveNav(). */
function renderAppNav(){
  renderSidebarNav();
  renderBottomNav();
  renderMobileTopbar();
}

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  renderAppNav();
  highlightActiveNav();
  animatePageIn();
});

/* ---------------- Page transition ---------------- */
function animatePageIn(){
  const main = document.querySelector('.main-content, .study-shell, .auth-shell');
  if(main) main.classList.add('page-enter');
}
