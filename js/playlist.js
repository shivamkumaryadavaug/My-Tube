/* ==========================================================================
   playlist.js — Playlist detail page
   ========================================================================== */

function getParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

function findPlaylist(id){
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  return playlists.find(p => p.id === id);
}

function renderPlaylist(){
  const id = getParam('id');
  const playlist = findPlaylist(id);
  const root = document.getElementById('playlistRoot');
  if(!playlist){
    root.innerHTML = `<div class="empty-state"><h3>Playlist not found</h3><p>It may have been removed. <a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return;
  }

  const done = playlist.videos.filter(v=>v.completed).length;
  const total = playlist.videos.length;
  const percent = pct(done, total);
  const firstIncomplete = playlist.videos.find(v=>!v.completed) || playlist.videos[0];

  document.getElementById('playlistThumb').style.background = playlist.gradient;
  document.getElementById('playlistName').textContent = playlist.title;
  document.getElementById('playlistChannel').textContent = playlist.channel;
  document.getElementById('playlistCount').textContent = `${total} videos`;
  document.getElementById('playlistPercent').textContent = `${percent}%`;
  document.getElementById('playlistProgressFill').style.width = `${percent}%`;

  document.getElementById('continueBtn').href = `study.html?id=${playlist.id}&video=${firstIncomplete.id}`;
  document.getElementById('startOverBtn').href = `study.html?id=${playlist.id}&video=${playlist.videos[0].id}`;

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
        <span class="queue-duration">${v.duration}</span>
      </a>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', renderPlaylist);
