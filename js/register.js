/* ==========================================================================
   register.js
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
