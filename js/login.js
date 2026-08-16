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
      try{
        const settings = await api('/settings');
        if(settings && settings.theme) setTheme(settings.theme);
      }catch(err){ /* non-fatal */ }
      window.location.href = 'dashboard.html';
    }catch(err){
      showAuthError(err.message || 'Login failed. Check your email and password.');
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  });

  const guestBtn = document.getElementById('guestBtn');
  if(guestBtn){
    guestBtn.addEventListener('click', async ()=>{
      hideAuthError();
      guestBtn.disabled = true;
      guestBtn.textContent = 'Starting Guest Mode…';
      try{
        await apiGuestLogin();
        window.location.href = 'dashboard.html';
      }catch(err){
        showAuthError(err.message || 'Guest mode could not be started.');
        guestBtn.disabled = false;
        guestBtn.textContent = 'Continue as Guest';
      }
    });
  }
});
