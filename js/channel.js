/* ==========================================================================
   channel.js — Channel detail page, backed by the real API
   ========================================================================== */

function chGetParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

let channel = null;
let resolvedForAddMore = null; // response from POST /channels/resolve, reused for add-more
const addMorePlaylistIds = new Set();
const addMoreVideoIds = new Set();

async function renderChannelHeader(){
  const id = chGetParam('id');
  const root = document.getElementById('channelRoot');

  if(!id){
    root.innerHTML = `<div class="empty-state"><h3>No channel specified</h3><p><a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return false;
  }

  try{
    channel = await api(`/channels/${id}`);
  }catch(err){
    root.innerHTML = `<div class="empty-state"><h3>Channel not found</h3><p>${escapeHtml(err.message)} · <a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return false;
  }

  const initials = channel.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const avatarEl = document.getElementById('channelAvatar');
  avatarEl.textContent = initials;
  avatarEl.setAttribute('style', `width:72px;height:72px;font-size:1.4rem;margin-bottom:0;${cardBackground(channel)}`);
  document.getElementById('channelName').textContent = channel.name;
  document.getElementById('channelDescription').textContent = channel.description || '';
  return true;
}

async function renderExistingPlaylists(){
  const wrap = document.getElementById('channelPlaylists');
  let allPlaylists = [];
  try{
    allPlaylists = await api('/playlists');
  }catch(err){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">Couldn't load playlists: ${escapeHtml(err.message)}</p>`;
    return;
  }

  const playlists = allPlaylists.filter(p => p.channel_id === channel.id);
  const totalVideos = playlists.reduce((sum, p) => sum + p.videos.length, 0);
  document.getElementById('channelSelectedCount').textContent = `${totalVideos} selected videos`;

  if(playlists.length === 0){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">No playlists added yet from this channel.</p>`;
    return;
  }

  wrap.innerHTML = playlists.map(p=>{
    const done = p.videos.filter(v=>v.completed).length;
    const percent = pct(done, p.videos.length);
    return `
      <a class="card content-card" href="playlist.html?id=${p.id}">
        <div class="thumb" style="${cardBackground(p)}"><span class="type-tag">Playlist</span></div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="sub">${p.videos.length} videos · ${percent}% complete</div>
      </a>`;
  }).join('');
}

/* ---------------- Add more content from this channel ---------------- */
function wireAddMoreTrigger(){
  const btn = document.getElementById('findMoreBtn');
  if(!btn) return;
  btn.addEventListener('click', async ()=>{
    btn.disabled = true;
    btn.textContent = 'Looking up channel…';
    try{
      // Rebuild a canonical channel URL from the stored YouTube channel ID —
      // this always resolves correctly regardless of how it was first added.
      const url = channel.youtube_channel_id
        ? `https://www.youtube.com/channel/${channel.youtube_channel_id}`
        : null;
      if(!url) throw new Error('This channel has no linked YouTube ID to look up.');

      resolvedForAddMore = await api('/channels/resolve', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      renderAddMorePanel();
      document.getElementById('chSelectionPanel').style.display = 'block';
      document.getElementById('chSelectionPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }catch(err){
      showToast(err.message, 'warning');
    }finally{
      btn.disabled = false;
      btn.textContent = 'Find More Content';
    }
  });
}

function renderAddMorePanel(){
  const playlistWrap = document.getElementById('chSelectPlaylists');
  const videoWrap = document.getElementById('chSelectVideos');
  addMorePlaylistIds.clear();
  addMoreVideoIds.clear();

  playlistWrap.innerHTML = resolvedForAddMore.playlist_candidates.length
    ? resolvedForAddMore.playlist_candidates.map(p=>`
        <label class="select-row">
          <input type="checkbox" class="ch-playlist-check" data-id="${escapeHtml(p.youtube_playlist_id)}">
          <span>${escapeHtml(p.title)}</span>
          <span class="select-count">${p.video_count} videos</span>
        </label>`).join('')
    : `<p style="color:var(--text-secondary);font-size:.88rem;">No public playlists found.</p>`;

  videoWrap.innerHTML = resolvedForAddMore.video_candidates.length
    ? resolvedForAddMore.video_candidates.map(v=>`
        <label class="select-row">
          <input type="checkbox" class="ch-video-check" data-id="${escapeHtml(v.youtube_video_id)}">
          <span>${escapeHtml(v.title)}</span>
          <span class="select-count">${formatDuration(v.duration_seconds)}</span>
        </label>`).join('')
    : `<p style="color:var(--text-secondary);font-size:.88rem;">No recent videos found.</p>`;

  chUpdateCount();
}

function chUpdateCount(){
  const el = document.getElementById('chSelectedCount');
  if(el) el.textContent = addMorePlaylistIds.size + addMoreVideoIds.size;
}

function wireAddMoreControls(){
  document.addEventListener('change', (e)=>{
    if(e.target.classList.contains('ch-playlist-check')){
      e.target.checked ? addMorePlaylistIds.add(e.target.dataset.id) : addMorePlaylistIds.delete(e.target.dataset.id);
      chUpdateCount();
    }
    if(e.target.classList.contains('ch-video-check')){
      e.target.checked ? addMoreVideoIds.add(e.target.dataset.id) : addMoreVideoIds.delete(e.target.dataset.id);
      chUpdateCount();
    }
  });

  const selectAll = document.getElementById('chSelectAllBtn');
  const clearAll = document.getElementById('chClearAllBtn');
  const addBtn = document.getElementById('chAddSelectedBtn');

  if(selectAll) selectAll.addEventListener('click', ()=>{
    document.querySelectorAll('#chSelectionPanel input[type="checkbox"]').forEach(cb=>{ cb.checked = true; cb.dispatchEvent(new Event('change')); });
  });
  if(clearAll) clearAll.addEventListener('click', ()=>{
    document.querySelectorAll('#chSelectionPanel input[type="checkbox"]').forEach(cb=>{ cb.checked = false; cb.dispatchEvent(new Event('change')); });
  });
  if(addBtn) addBtn.addEventListener('click', addMoreContent);
}

async function addMoreContent(){
  if(addMorePlaylistIds.size === 0 && addMoreVideoIds.size === 0){
    showToast('Select at least one playlist or video', 'warning');
    return;
  }

  const btn = document.getElementById('chAddSelectedBtn');
  btn.disabled = true;
  btn.textContent = 'Adding…';

  try{
    await api(`/channels/${channel.id}/add-content`, {
      method: 'POST',
      body: JSON.stringify({
        selected_playlist_ids: Array.from(addMorePlaylistIds),
        selected_video_ids: Array.from(addMoreVideoIds),
        playlist_candidates: resolvedForAddMore.playlist_candidates,
        video_candidates: resolvedForAddMore.video_candidates,
      }),
    });
    showToast('Selected content added');
    setTimeout(()=> window.location.reload(), 700);
  }catch(err){
    showToast(err.message, 'warning');
    btn.disabled = false;
    btn.textContent = 'Add Selected Content';
  }
}

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth()) return;
  const ok = await renderChannelHeader();
  if(ok){
    renderExistingPlaylists();
    wireAddMoreTrigger();
    wireAddMoreControls();
  }
});
