/* ==========================================================================
   playlist.js — Playlist detail page, backed by the real API
   ========================================================================== */

function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

async function renderPlaylist(){
  const id = getParam('id');
  const root = document.getElementById('playlistRoot');

  if(!id){
    root.innerHTML = `<div class="empty-state"><h3>No playlist specified</h3><p><a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return;
  }

  let playlist;
  try{
    playlist = await api(`/playlists/${id}`);
  }catch(err){
    root.innerHTML = `<div class="empty-state"><h3>Playlist not found</h3><p>${escapeHtml(err.message)} · <a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return;
  }

  const done = playlist.videos.filter(v=>v.completed).length;
  const total = playlist.videos.length;
  const percent = pct(done, total);
  const firstIncomplete = playlist.videos.find(v=>!v.completed) || playlist.videos[0];

  document.getElementById('playlistThumb').setAttribute('style', `width:160px;height:100px;border-radius:14px;flex-shrink:0;${cardBackground(playlist)}`);
  document.getElementById('playlistName').textContent = playlist.title;
  document.getElementById('playlistChannel').textContent = playlist.channel_name || 'Imported';
  document.getElementById('playlistCount').textContent = `${total} videos`;
  document.getElementById('playlistPercent').textContent = `${percent}%`;
  document.getElementById('playlistProgressFill').style.width = `${percent}%`;

  if(firstIncomplete){
    document.getElementById('continueBtn').href = `study.html?id=${playlist.id}&video=${firstIncomplete.id}`;
  }
  if(playlist.videos[0]){
    document.getElementById('startOverBtn').href = `study.html?id=${playlist.id}&video=${playlist.videos[0].id}`;
  }

  const listEl = document.getElementById('videoList');
  let currentAssigned = false;
  listEl.innerHTML = playlist.videos.map((v, i)=>{
    let state = 'pending', icon = '○';
    if(v.completed){ state = 'done'; icon = '✓'; }
    else if(!currentAssigned){ state = 'current'; icon = '▶'; currentAssigned = true; }
    return `
      <a class="queue-item ${state}" href="study.html?id=${playlist.id}&video=${v.id}">
        <span class="queue-status ${state}">${icon}</span>
        <span class="queue-item-title">${String(i+1).padStart(2,'0')} ${escapeHtml(v.title)}</span>
        <span class="queue-duration">${formatDuration(v.duration_seconds)}</span>
      </a>`;
  }).join('');

  const deleteBtn = document.getElementById('deletePlaylistBtn');
  if(deleteBtn){
    deleteBtn.addEventListener('click', async ()=>{
      if(!confirm('Remove this playlist from your library?')) return;
      try{
        await api(`/playlists/${playlist.id}`, { method: 'DELETE' });
        showToast('Playlist removed');
        window.location.href = 'library.html';
      }catch(err){
        showToast(err.message, 'warning');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(!requireAuth()) return;
  renderPlaylist();
});
