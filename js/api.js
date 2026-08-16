/* ==========================================================================
   api.js — talks to the real MyTube FastAPI backend.
   ========================================================================== */

const API_BASE = 'https://mytube-backend-smzj.onrender.com';
const TOKEN_KEY = 'mytube_token';

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(token){ localStorage.setItem(TOKEN_KEY, token); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn(){ return !!getToken(); }

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

async function apiLogin(email, password){
  const form = new URLSearchParams({ username: email.trim().toLowerCase(), password });
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

async function apiGuestLogin(){
  const res = await fetch(`${API_BASE}/auth/guest`, { method: 'POST' });
  if(!res.ok){
    let detail = 'Guest mode could not be started';
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
    body: JSON.stringify({ email: email.trim().toLowerCase(), password, display_name: displayName }),
  });
  setToken(data.access_token);
  return data;
}

function apiLogout(){
  clearToken();
  window.location.href = 'login.html';
}

function requireAuth(){
  if(!isLoggedIn()){
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function formatDuration(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
