/* ==========================================================================
   login.js
   ========================================================================== */

function showAuthError(message){
  const el = document.getElementById('authError');
  el.textContent = message;
  el.classList.add('show');
}
function hideAuthError(){
  document.getElementById('authError').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(isLoggedIn()){
    window.location.href = 'dashboard.html';
    return;
  }

  document.getElementById('loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    hideAuthError();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    try{
      await apiLogin(email, password);

      // Pull the account's saved theme so it applies immediately on this device.
      try{
        const settings = await api('/settings');
        if(settings && settings.theme) setTheme(settings.theme);
      }catch(err){ /* non-fatal — theme just falls back to local default */ }

      window.location.href = 'dashboard.html';
    }catch(err){
      showAuthError(err.message || 'Login failed. Check your email and password.');
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  });
});
