/* ==========================================================================
   api.js — talks to the real MyTube backend (FastAPI) instead of localStorage.
   Load this BEFORE any page script that calls api()/login()/register().
   ========================================================================== */

// Point this at your running backend. Swap for your deployed URL when you host it.
const API_BASE = 'https://mytube-backend-smzj.onrender.com';

const TOKEN_KEY = 'mytube_token';

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(token){ localStorage.setItem(TOKEN_KEY, token); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn(){ return !!getToken(); }

/**
 * Core request helper. Adds the JWT automatically, throws a readable Error
 * on failure, and redirects to the login page on a 401.
 */
async function api(path, options = {}){
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if(token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try{
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }catch(err){
    throw new Error('Could not reach the server. Is the backend running?');
  }

  if(res.status === 401){
    clearToken();
    window.location.href = 'login.html';
    return null;
  }

  if(!res.ok){
    let detail = 'Request failed';
    try{ detail = (await res.json()).detail || detail; }catch(e){ /* ignore */ }
    throw new Error(detail);
  }

  return res.status === 204 ? null : res.json();
}

/* ---------------- Auth ---------------- */
async function apiLogin(email, password){
  const form = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', body: form });
  if(!res.ok){
    let detail = 'Login failed';
    try{ detail = (await res.json()).detail || detail; }catch(e){ /* ignore */ }
    throw new Error(detail);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

async function apiRegister(email, password, displayName){
  const data = await api('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  });
  setToken(data.access_token);
  return data;
}

function apiLogout(){
  clearToken();
  window.location.href = 'login.html';
}

/**
 * Call at the top of any page that requires a logged-in user.
 * Sends the person to login.html if there's no token yet.
 */
function requireAuth(){
  if(!isLoggedIn()){
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

/* ---------------- Small shared formatters ---------------- */
function formatDuration(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
