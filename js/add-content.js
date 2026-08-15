/* ==========================================================================
   add-content.js — Add Study Content, backed by the real YouTube-powered API
   ========================================================================== */

let resolvedChannel = null; // full response from POST /channels/resolve
const selectedPlaylistIds = new Set(); // youtube_playlist_id values
const selectedVideoIds = new Set();    // youtube_video_id values

/* ---------------- Add Playlist ---------------- */
function wirePlaylistForm(){
  const form = document.getElementById('playlistForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const input = document.getElementById('playlistUrl');
    const url = input.value.trim();
    if(!isValidPlaylistUrl(url)){
      showToast("That doesn't look like a YouTube playlist link", 'warning');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Adding…';

    try{
      await api('/playlists/from-youtube', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      showToast('Playlist added successfully');
      input.value = '';
      setTimeout(()=>{ window.location.href = 'library.html'; }, 700);
    }catch(err){
      showToast(err.message, 'warning');
      btn.disabled = false;
      btn.textContent = 'Add Playlist';
    }
  });
}

/* ---------------- Add Channel: step 1 — resolve ---------------- */
function wireChannelForm(){
  const form = document.getElementById('channelForm');
  if(!form) return;
  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const input = document.getElementById('channelUrl');
    const url = input.value.trim();
    if(!isValidChannelUrl(url)){
      showToast("That doesn't look like a YouTube channel link", 'warning');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Looking up channel…';

    try{
      resolvedChannel = await api('/channels/resolve', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      renderSelectionPanel();
      document.getElementById('selectionPanel').style.display = 'block';
      document.getElementById('selectionChannelName').textContent = resolvedChannel.name;
      document.getElementById('selectionPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }catch(err){
      showToast(err.message, 'warning');
    }finally{
      btn.disabled = false;
      btn.textContent = 'Add Channel';
    }
  });
}

function renderSelectionPanel(){
  const playlistWrap = document.getElementById('selectPlaylists');
  const videoWrap = document.getElementById('selectVideos');
  selectedPlaylistIds.clear();
  selectedVideoIds.clear();

  if(resolvedChannel.playlist_candidates.length === 0){
    playlistWrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.88rem;">No public playlists found on this channel.</p>`;
  }else{
    playlistWrap.innerHTML = resolvedChannel.playlist_candidates.map(p=>`
      <label class="select-row">
        <input type="checkbox" class="playlist-check" data-id="${escapeHtml(p.youtube_playlist_id)}">
        <span>${escapeHtml(p.title)}</span>
        <span class="select-count">${p.video_count} videos</span>
      </label>`).join('');
  }

  if(resolvedChannel.video_candidates.length === 0){
    videoWrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.88rem;">No recent videos found.</p>`;
  }else{
    videoWrap.innerHTML = resolvedChannel.video_candidates.map(v=>`
      <label class="select-row">
        <input type="checkbox" class="video-check" data-id="${escapeHtml(v.youtube_video_id)}">
        <span>${escapeHtml(v.title)}</span>
        <span class="select-count">${formatDuration(v.duration_seconds)}</span>
      </label>`).join('');
  }

  updateSelectedCount();
}

function updateSelectedCount(){
  const count = selectedPlaylistIds.size + selectedVideoIds.size;
  const el = document.getElementById('selectedCount');
  if(el) el.textContent = count;
}

function wireSelectionControls(){
  document.addEventListener('change', (e)=>{
    if(e.target.classList.contains('playlist-check')){
      e.target.checked ? selectedPlaylistIds.add(e.target.dataset.id) : selectedPlaylistIds.delete(e.target.dataset.id);
      updateSelectedCount();
    }
    if(e.target.classList.contains('video-check')){
      e.target.checked ? selectedVideoIds.add(e.target.dataset.id) : selectedVideoIds.delete(e.target.dataset.id);
      updateSelectedCount();
    }
  });

  const selectAllBtn = document.getElementById('selectAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const addSelectedBtn = document.getElementById('addSelectedBtn');

  if(selectAllBtn) selectAllBtn.addEventListener('click', ()=>{
    document.querySelectorAll('#selectionPanel input[type="checkbox"]').forEach(cb=>{ cb.checked = true; cb.dispatchEvent(new Event('change')); });
  });
  if(clearAllBtn) clearAllBtn.addEventListener('click', ()=>{
    document.querySelectorAll('#selectionPanel input[type="checkbox"]').forEach(cb=>{ cb.checked = false; cb.dispatchEvent(new Event('change')); });
  });
  if(addSelectedBtn) addSelectedBtn.addEventListener('click', addSelectedContent);
}

/* ---------------- Add Channel: step 2 — confirm ---------------- */
async function addSelectedContent(){
  if(selectedPlaylistIds.size === 0 && selectedVideoIds.size === 0){
    showToast('Select at least one playlist or video', 'warning');
    return;
  }

  const btn = document.getElementById('addSelectedBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  try{
    await api('/channels/confirm', {
      method: 'POST',
      body: JSON.stringify({
        youtube_channel_id: resolvedChannel.youtube_channel_id,
        name: resolvedChannel.name,
        description: resolvedChannel.description,
        thumbnail_url: resolvedChannel.thumbnail_url,
        selected_playlist_ids: Array.from(selectedPlaylistIds),
        selected_video_ids: Array.from(selectedVideoIds),
        playlist_candidates: resolvedChannel.playlist_candidates,
        video_candidates: resolvedChannel.video_candidates,
      }),
    });
    showToast('Channel content added successfully');
    setTimeout(()=>{ window.location.href = 'library.html'; }, 700);
  }catch(err){
    showToast(err.message, 'warning');
    btn.disabled = false;
    btn.textContent = 'Add Selected';
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(!requireAuth()) return;
  wirePlaylistForm();
  wireChannelForm();
  wireSelectionControls();
});
