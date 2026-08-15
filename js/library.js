/* ==========================================================================
   library.js — My Library: render, search, and tab filtering
   ========================================================================== */

function playlistCardHtml(p){
  const done = p.videos.filter(v=>v.completed).length;
  const total = p.videos.length;
  const percent = pct(done, total);
  return `
    <a class="card content-card" data-type="playlist" data-name="${escapeHtml(p.title.toLowerCase())}" href="playlist.html?id=${p.id}">
      <div class="thumb" style="background:${p.gradient}"><span class="type-tag">Playlist</span></div>
      <h3>${escapeHtml(p.title)}</h3>
      <div class="sub">${escapeHtml(p.channel)} · ${total} videos</div>
      <div class="playlist-meta"><span>${done} / ${total} watched</span><span>${percent}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
    </a>`;
}

function channelCardHtml(c){
  const initials = c.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return `
    <div class="card content-card" data-type="channel" data-name="${escapeHtml(c.name.toLowerCase())}">
      <div class="channel-avatar" style="background:${c.gradient}">${initials}</div>
      <h3>${escapeHtml(c.name)}</h3>
      <div class="sub">${c.totalSelected} selected videos</div>
      <div class="card-footer"><a class="btn btn-secondary btn-sm btn-block" href="channel.html?id=${c.id}">Study</a></div>
    </div>`;
}

function renderLibrary(){
  const grid = document.getElementById('libraryGrid');
  if(!grid) return;
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  const channels = getData(STORAGE_KEYS.CHANNELS, []);

  if(playlists.length === 0 && channels.length === 0){
    grid.innerHTML = `<div class="empty-state"><h3>Your library is empty</h3><p>Add a playlist or channel to start building your focused study space.</p></div>`;
    return;
  }

  grid.innerHTML = playlists.map(playlistCardHtml).join('') + channels.map(channelCardHtml).join('');
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
  renderLibrary();
  wireTabs();
  wireSearch();
});
