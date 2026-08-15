/* ==========================================================================
   library.js — My Library, backed by the real API
   ========================================================================== */

function playlistCardHtml(p){
  const done = p.videos.filter(v=>v.completed).length;
  const total = p.videos.length;
  const percent = pct(done, total);
  return `
    <div class="card content-card" data-type="playlist" data-name="${escapeHtml(p.title.toLowerCase())}">
      <button class="card-remove-btn" data-remove-playlist="${p.id}" title="Remove playlist" type="button">✕</button>
      <a href="playlist.html?id=${p.id}" style="display:block;">
        <div class="thumb" style="${cardBackground(p)}"><span class="type-tag">Playlist</span></div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="sub">${escapeHtml(p.channel_name || 'Imported')} · ${total} videos</div>
        <div class="playlist-meta"><span>${done} / ${total} watched</span><span>${percent}%</span></div>
        <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
      </a>
    </div>`;
}

function channelCardHtml(c, selectedCount){
  const initials = c.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return `
    <div class="card content-card" data-type="channel" data-name="${escapeHtml(c.name.toLowerCase())}">
      <button class="card-remove-btn" data-remove-channel="${c.id}" title="Remove channel" type="button">✕</button>
      <div class="channel-avatar" style="${cardBackground(c)}">${initials}</div>
      <h3>${escapeHtml(c.name)}</h3>
      <div class="sub">${selectedCount} selected videos</div>
      <div class="card-footer"><a class="btn btn-secondary btn-sm btn-block" href="channel.html?id=${c.id}">Study</a></div>
    </div>`;
}

async function renderLibrary(){
  const grid = document.getElementById('libraryGrid');
  if(!grid) return;

  let playlists = [], channels = [];
  try{
    [playlists, channels] = await Promise.all([api('/playlists'), api('/channels')]);
  }catch(err){
    grid.innerHTML = `<div class="empty-state"><h3>Couldn't load your library</h3><p>${escapeHtml(err.message)}</p></div>`;
    return;
  }

  if(playlists.length === 0 && channels.length === 0){
    grid.innerHTML = `<div class="empty-state"><h3>Your library is empty</h3><p>Add a playlist or channel to start building your focused study space.</p></div>`;
    return;
  }

  const selectedCountByChannel = {};
  playlists.forEach(p=>{
    if(p.channel_id != null){
      selectedCountByChannel[p.channel_id] = (selectedCountByChannel[p.channel_id] || 0) + p.videos.length;
    }
  });

  grid.innerHTML =
    playlists.map(playlistCardHtml).join('') +
    channels.map(c => channelCardHtml(c, selectedCountByChannel[c.id] || 0)).join('');

  wireRemoveButtons();
}

function wireRemoveButtons(){
  document.querySelectorAll('[data-remove-playlist]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(!confirm('Remove this playlist from your library?')) return;
      try{
        await api(`/playlists/${btn.dataset.removePlaylist}`, { method: 'DELETE' });
        showToast('Playlist removed');
        renderLibrary();
      }catch(err){
        showToast(err.message, 'warning');
      }
    });
  });
  document.querySelectorAll('[data-remove-channel]').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(!confirm('Remove this channel and its playlists?')) return;
      try{
        await api(`/channels/${btn.dataset.removeChannel}`, { method: 'DELETE' });
        showToast('Channel removed');
        renderLibrary();
      }catch(err){
        showToast(err.message, 'warning');
      }
    });
  });
}

function wireTabs(){
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=>{
      tabs.forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      const filter = tab.dataset.filter;
      document.querySelectorAll('.content-card').forEach(card=>{
        const show = filter === 'all' || card.dataset.type === filter;
        card.classList.toggle('hidden', !show);
      });
    });
  });
}

function wireSearch(){
  const input = document.getElementById('librarySearch');
  if(!input) return;
  input.addEventListener('input', debounce(()=>{
    const q = input.value.trim().toLowerCase();
    const activeFilter = document.querySelector('.tab.active')?.dataset.filter || 'all';
    document.querySelectorAll('.content-card').forEach(card=>{
      const matchesType = activeFilter === 'all' || card.dataset.type === activeFilter;
      const matchesQuery = !q || card.dataset.name.includes(q);
      card.classList.toggle('hidden', !(matchesType && matchesQuery));
    });
  }, 150));
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(!requireAuth()) return;
  renderLibrary();
  wireTabs();
  wireSearch();
});
