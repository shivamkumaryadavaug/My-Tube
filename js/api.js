/* ==========================================================================
   api.js — talks to the real MyTube FastAPI backend.
   ========================================================================== */

const API_BASE = 'https://mytube-backend-smzj.onrender.com';
const TOKEN_KEY = 'mytube_token';

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(token){ localStorage.setItem(TOKEN_KEY, token); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }
function isLoggedIn(){ return !!getToken(); }

async function api(path, options = {}, _retryCount = 0){
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if(token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try{
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  }catch(err){
    // A network failure (e.g. the free-tier backend is cold-starting and
    // hasn't woken up yet) is not proof the session is invalid. Retry a
    // couple of times with a short backoff before giving up, since Render's
    // free tier can take up to ~60s to wake from sleep.
    if(_retryCount < 2){
      await new Promise(r => setTimeout(r, 1500 * (_retryCount + 1)));
      return api(path, options, _retryCount + 1);
    }
    throw new Error('Could not reach the server. It may be waking up — please try again in a few seconds.');
  }

  if(res.status === 401){
    // Only trust a clean, fully-formed 401 from the API itself as a real
    // "your session is invalid" signal. Distinguish that from Render's
    // proxy/cold-start responses, which usually aren't valid JSON.
    let isRealAuthError = false;
    try{
      const body = await res.clone().json();
      isRealAuthError = typeof body === 'object' && body !== null;
    }catch(e){
      isRealAuthError = false;
    }

    if(isRealAuthError){
      clearToken();
      window.location.href = 'login.html';
      return null;
    }

    if(_retryCount < 2){
      await new Promise(r => setTimeout(r, 1500 * (_retryCount + 1)));
      return api(path, options, _retryCount + 1);
    }
    throw new Error('The server is still starting up — please try again in a few seconds.');
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

/* ---------------- Account management ---------------- */
async function apiIsGuest(){
  const data = await api('/auth/me/is-guest');
  return !!(data && data.is_guest);
}

async function apiUpdateProfile(displayName){
  return api('/auth/me', {
    method: 'PUT',
    body: JSON.stringify({ display_name: displayName }),
  });
}

async function apiChangePassword(currentPassword, newPassword){
  return api('/auth/me/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

async function apiDeleteAccount(password){
  return api('/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({ password: password || '' }),
  });
}

async function apiGetMe(){
  return api('/auth/me');
}

async function apiGetSettings(){
  return api('/settings');
}

async function apiUpdateSettings(partial){
  return api('/settings', {
    method: 'PUT',
    body: JSON.stringify(partial),
  });
}

function formatDuration(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
