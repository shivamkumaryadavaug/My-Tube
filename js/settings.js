/* ==========================================================================
   settings.js — Appearance (theme), study preferences, notifications,
   and full account management (edit name, change password, delete account).
   ========================================================================== */

let __isGuestSession = false;

document.addEventListener('DOMContentLoaded', async () => {
  if(!requireAuth()) return;

  // Wire every control up front, synchronously, so a slow or failed network
  // call (loadAccount/loadSettings) can never prevent buttons like Edit or
  // Change Password from responding to taps.
  try{
    wireThemePicker();
    wireModals();
    wireLogout();
    wireEditName();
    wireChangePassword();
    wireDeleteAccount();
    wireStudyPreferenceControls();
  }catch(err){
    console.error('Settings: failed to wire controls', err);
  }

  loadAccount();
  loadSettings();
});

/* ---------------- Theme picker ---------------- */
function wireThemePicker(){
  const cards = document.querySelectorAll('#themePicker .theme-picker-card');
  const current = getData(STORAGE_KEYS.THEME, 'dark');
  cards.forEach(card=>{
    if(card.dataset.themeOption === current) card.classList.add('active');
    card.addEventListener('click', ()=>{
      if(card.classList.contains('active')) return;
      cards.forEach(c=>c.classList.remove('active'));
      card.classList.add('active');
      setTheme(card.dataset.themeOption);
      showToast(`Switched to ${card.dataset.themeOption} theme`, 'success');
    });
  });
}

/* ---------------- Account header ---------------- */
async function loadAccount(attempt = 0){
  try{
    const [me, isGuest] = await Promise.all([apiGetMe(), apiIsGuest()]);
    if(!me) return;
    __isGuestSession = isGuest;

    document.getElementById('accountName').textContent = me.display_name;
    document.getElementById('accountEmail').textContent = isGuest ? 'Guest session — not saved' : me.email;
    document.getElementById('accountAvatar').textContent = initialsFor(me.display_name);
    document.getElementById('guestBadge').classList.toggle('hidden', !isGuest);
    document.getElementById('editNameInput').value = me.display_name;

    // Guests never set a password, so hide the "current password" field
    // in both the change-password and delete-account flows.
    document.getElementById('currentPasswordField').classList.toggle('hidden', isGuest);
    document.getElementById('deletePasswordField').classList.toggle('hidden', isGuest);
    if(isGuest){
      document.getElementById('changePasswordSub').textContent =
        "You're on a guest session, so just choose a new password to secure this account.";
      document.getElementById('deleteAccountSub').textContent =
        "This permanently removes this guest session, its playlists, channels and study history. This cannot be undone.";
    }
  }catch(err){
    // Account details are essential, not a nice-to-have — a silent toast
    // that's easy to miss would leave the "—" placeholders forever. Retry
    // automatically a couple of times (the free-tier backend can be slow to
    // wake up), then fall back to a visible retry button.
    if(attempt < 2){
      setTimeout(() => loadAccount(attempt + 1), 2000);
      return;
    }
    document.getElementById('accountName').textContent = 'Could not load account';
    document.getElementById('accountEmail').innerHTML =
      '<button type="button" class="btn btn-ghost btn-sm" id="retryAccountBtn" style="padding:4px 10px;">Tap to retry</button>';
    const retryBtn = document.getElementById('retryAccountBtn');
    if(retryBtn) retryBtn.addEventListener('click', () => loadAccount(0));
    showToast(err.message || 'Could not load account details', 'warning');
  }
}

function initialsFor(name){
  if(!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map(p=>p[0]).join('').toUpperCase();
}

/* ---------------- Study preferences + notifications ---------------- */
async function loadSettings(){
  try{
    const settings = await apiGetSettings();
    if(!settings) return;
    document.getElementById('focusDurationSelect').value = String(settings.focus_duration);
    document.getElementById('autoplayToggle').checked = !!settings.autoplay;
    document.getElementById('rememberToggle').checked = !!settings.remember_position;
    document.getElementById('studyRemindersToggle').checked = !!settings.study_reminders;
    document.getElementById('streakRemindersToggle').checked = !!settings.streak_reminders;
  }catch(err){
    showToast(err.message || 'Could not load settings', 'warning');
  }
}

function wireStudyPreferenceControls(){
  const save = async (partial, successMessage)=>{
    try{
      await apiUpdateSettings(partial);
      showToast(successMessage, 'success');
    }catch(err){
      showToast(err.message || 'Could not save setting', 'warning');
    }
  };

  document.getElementById('focusDurationSelect').addEventListener('change', (e)=>{
    save({ focus_duration: parseInt(e.target.value, 10) }, 'Default focus duration updated');
  });
  document.getElementById('autoplayToggle').addEventListener('change', (e)=>{
    save({ autoplay: e.target.checked }, e.target.checked ? 'Autoplay enabled' : 'Autoplay disabled');
  });
  document.getElementById('rememberToggle').addEventListener('change', (e)=>{
    save({ remember_position: e.target.checked }, 'Preference saved');
  });
  document.getElementById('studyRemindersToggle').addEventListener('change', (e)=>{
    save({ study_reminders: e.target.checked }, 'Preference saved');
  });
  document.getElementById('streakRemindersToggle').addEventListener('change', (e)=>{
    save({ streak_reminders: e.target.checked }, 'Preference saved');
  });
}

/* ---------------- Logout ---------------- */
function wireLogout(){
  document.getElementById('logoutBtn').addEventListener('click', ()=>{
    apiLogout();
  });
}

/* ---------------- Modal plumbing ---------------- */
function openModal(id){
  document.getElementById(id).classList.add('show');
}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
}
function wireModals(){
  document.querySelectorAll('[data-close-modal]').forEach(btn=>{
    btn.addEventListener('click', ()=> closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay=>{
    overlay.addEventListener('click', (e)=>{
      if(e.target === overlay) closeModal(overlay.id);
    });
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.show').forEach(o=> closeModal(o.id));
  });
}

function setButtonLoading(btn, loading, loadingLabel){
  if(loading){
    btn.dataset.originalLabel = btn.textContent;
    btn.textContent = loadingLabel || 'Please wait…';
    btn.disabled = true;
  }else{
    btn.textContent = btn.dataset.originalLabel || btn.textContent;
    btn.disabled = false;
  }
}

/* ---------------- Edit display name ---------------- */
function wireEditName(){
  document.getElementById('editNameBtn').addEventListener('click', ()=> openModal('editNameModal'));

  document.getElementById('editNameForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const input = document.getElementById('editNameInput');
    const name = input.value.trim();
    if(!name){
      showToast('Display name cannot be empty', 'warning');
      return;
    }
    const btn = document.getElementById('editNameSaveBtn');
    setButtonLoading(btn, true, 'Saving…');
    try{
      const updated = await apiUpdateProfile(name);
      document.getElementById('accountName').textContent = updated.display_name;
      document.getElementById('accountAvatar').textContent = initialsFor(updated.display_name);
      closeModal('editNameModal');
      showToast('Display name updated', 'success');
    }catch(err){
      showToast(err.message || 'Could not update name', 'warning');
    }finally{
      setButtonLoading(btn, false);
    }
  });
}

/* ---------------- Change password ---------------- */
function wireChangePassword(){
  document.getElementById('changePasswordBtn').addEventListener('click', ()=>{
    document.getElementById('changePasswordForm').reset();
    openModal('changePasswordModal');
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;

    if(newPassword.length < 8){
      showToast('New password must be at least 8 characters', 'warning');
      return;
    }
    if(!__isGuestSession && !currentPassword){
      showToast('Enter your current password', 'warning');
      return;
    }

    const btn = document.getElementById('changePasswordSaveBtn');
    setButtonLoading(btn, true, 'Updating…');
    try{
      await apiChangePassword(currentPassword, newPassword);
      closeModal('changePasswordModal');
      showToast('Password updated', 'success');
    }catch(err){
      showToast(err.message || 'Could not update password', 'warning');
    }finally{
      setButtonLoading(btn, false);
    }
  });
}

/* ---------------- Delete account ---------------- */
function wireDeleteAccount(){
  document.getElementById('deleteAccountBtn').addEventListener('click', ()=>{
    document.getElementById('deleteAccountForm').reset();
    openModal('deleteAccountModal');
  });

  document.getElementById('deleteAccountForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const password = document.getElementById('deletePasswordInput').value;
    if(!__isGuestSession && !password){
      showToast('Enter your password to confirm', 'warning');
      return;
    }

    const btn = document.getElementById('deleteAccountSaveBtn');
    setButtonLoading(btn, true, 'Deleting…');
    try{
      await apiDeleteAccount(password);
      closeModal('deleteAccountModal');
      showToast('Account deleted', 'success');
      clearToken();
      setTimeout(()=>{ window.location.href = 'login.html'; }, 600);
    }catch(err){
      showToast(err.message || 'Could not delete account', 'warning');
      setButtonLoading(btn, false);
    }
  });
}
