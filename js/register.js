/* ==========================================================================
   register.js
   ========================================================================== */

function showAuthError(message){
  const el = document.getElementById('authError');
  const textEl = document.getElementById('authErrorText');
  if(textEl) textEl.textContent = message; else el.textContent = message;
  el.classList.add('show');
}
function hideAuthError(){
  document.getElementById('authError').classList.remove('show');
}

function wirePasswordToggle(inputId, btnId){
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if(!input || !btn) return;
  btn.addEventListener('click', ()=>{
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    btn.classList.toggle('active', !showing);
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  wirePasswordToggle('password', 'togglePassword');
  wirePasswordToggle('confirmPassword', 'toggleConfirmPassword');

  if(isLoggedIn()){
    window.location.href = 'dashboard.html';
    return;
  }

  document.getElementById('registerForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    hideAuthError();

    const displayName = document.getElementById('displayName').value.trim() || 'Student';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if(password !== confirmPassword){
      showAuthError('Passwords do not match.');
      return;
    }
    if(password.length < 8){
      showAuthError('Password must be at least 8 characters.');
      return;
    }

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try{
      await apiRegister(email, password, displayName);
      window.location.href = 'dashboard.html';
    }catch(err){
      showAuthError(err.message || 'Could not create your account.');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});
