/* ==========================================================================
   channel.js — Channel detail page: view selected content + add more
   ========================================================================== */

const CH_MOCK_PLAYLIST_OPTIONS = [
  { key:'complete-course', title:'Complete Course', videoCount: 30 },
  { key:'interview-prep', title:'Interview Preparation', videoCount: 22 },
  { key:'projects', title:'Project-Based Learning', videoCount: 16 }
];
const CH_MOCK_VIDEO_OPTIONS = ['Roadmap Overview','Tips for Beginners','Frequently Asked Questions'];

function chGetParam(name){
  return new URLSearchParams(window.location.search).get(name);
}

let channel = null;
const chSelectedPlaylists = new Set();
const chSelectedVideos = new Set();

function renderChannelHeader(){
  const id = chGetParam('id');
  const channels = getData(STORAGE_KEYS.CHANNELS, []);
  channel = channels.find(c => c.id === id);
  const root = document.getElementById('channelRoot');
  if(!channel){
    root.innerHTML = `<div class="empty-state"><h3>Channel not found</h3><p><a href="library.html" style="color:var(--accent-hover)">Back to Library</a></p></div>`;
    return false;
  }
  const initials = channel.name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  document.getElementById('channelAvatar').textContent = initials;
  document.getElementById('channelAvatar').style.background = channel.gradient;
  document.getElementById('channelName').textContent = channel.name;
  document.getElementById('channelDescription').textContent = channel.description;
  document.getElementById('channelSelectedCount').textContent = `${channel.totalSelected} selected videos`;
  return true;
}

function renderExistingPlaylists(){
  const wrap = document.getElementById('channelPlaylists');
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []).filter(p => p.channelId === channel.id);
  if(playlists.length === 0){
    wrap.innerHTML = `<p style="color:var(--text-secondary);font-size:.9rem;">No playlists added yet from this channel.</p>`;
    return;
  }
  wrap.innerHTML = playlists.map(p=>{
    const done = p.videos.filter(v=>v.completed).length;
    const percent = pct(done, p.videos.length);
    return `
      <a class="card content-card" href="playlist.html?id=${p.id}">
        <div class="thumb" style="background:${p.gradient}"><span class="type-tag">Playlist</span></div>
        <h3>${escapeHtml(p.title)}</h3>
        <div class="sub">${p.videos.length} videos · ${percent}% complete</div>
      </a>`;
  }).join('');
}

function renderAddMorePanel(){
  const playlistWrap = document.getElementById('chSelectPlaylists');
  const videoWrap = document.getElementById('chSelectVideos');

  playlistWrap.innerHTML = CH_MOCK_PLAYLIST_OPTIONS.map(p=>`
    <label class="select-row">
      <input type="checkbox" class="ch-playlist-check" data-key="${p.key}" data-title="${escapeHtml(p.title)}" data-count="${p.videoCount}">
      <span>${escapeHtml(p.title)}</span>
      <span class="select-count">${p.videoCount} videos</span>
    </label>`).join('');

  videoWrap.innerHTML = CH_MOCK_VIDEO_OPTIONS.map(v=>`
    <label class="select-row">
      <input type="checkbox" class="ch-video-check" data-title="${escapeHtml(v)}">
      <span>${escapeHtml(v)}</span>
    </label>`).join('');
}

function chUpdateCount(){
  const el = document.getElementById('chSelectedCount');
  if(el) el.textContent = chSelectedPlaylists.size + chSelectedVideos.size;
}

function wireAddMoreControls(){
  document.addEventListener('change', (e)=>{
    if(e.target.classList.contains('ch-playlist-check')){
      e.target.checked ? chSelectedPlaylists.add(e.target.dataset.key) : chSelectedPlaylists.delete(e.target.dataset.key);
      chUpdateCount();
    }
    if(e.target.classList.contains('ch-video-check')){
      e.target.checked ? chSelectedVideos.add(e.target.dataset.title) : chSelectedVideos.delete(e.target.dataset.title);
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

function addMoreContent(){
  if(chSelectedPlaylists.size === 0 && chSelectedVideos.size === 0){
    showToast('Select at least one playlist or video', 'warning');
    return;
  }
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  const channels = getData(STORAGE_KEYS.CHANNELS, []);
  let added = 0;

  chSelectedPlaylists.forEach(key=>{
    const opt = CH_MOCK_PLAYLIST_OPTIONS.find(o=>o.key === key);
    if(!opt) return;
    const title = `${channel.name}: ${opt.title}`;
    playlists.push({
      id: generateId('pl'), title, channel: channel.name, channelId: channel.id,
      gradient: gradientFor(title), videos: buildVideos(opt.videoCount, 0)
    });
    added += opt.videoCount;
  });

  if(chSelectedVideos.size > 0){
    const title = `${channel.name}: More Selected Videos`;
    playlists.push({
      id: generateId('pl'), title, channel: channel.name, channelId: channel.id,
      gradient: gradientFor(title),
      videos: Array.from(chSelectedVideos).map((t,i)=>({ id:`v${i+1}`, title:t, duration:'9:00', completed:false }))
    });
    added += chSelectedVideos.size;
  }

  const idx = channels.findIndex(c=>c.id === channel.id);
  channels[idx].totalSelected += added;
  setData(STORAGE_KEYS.CHANNELS, channels);
  setData(STORAGE_KEYS.PLAYLISTS, playlists);
  showToast('Selected content added');
  setTimeout(()=> window.location.reload(), 900);
}

document.addEventListener('DOMContentLoaded', ()=>{
  if(renderChannelHeader()){
    renderExistingPlaylists();
    renderAddMorePanel();
    wireAddMoreControls();
  }
});
