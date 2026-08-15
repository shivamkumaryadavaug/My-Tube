/* ==========================================================================
   add-content.js — Add Study Content
   ========================================================================== */

const MOCK_PLAYLIST_OPTIONS = [
  { key:'complete-course', title:'Complete Course', videoCount: 30 },
  { key:'interview-prep', title:'Interview Preparation', videoCount: 22 }
];
const MOCK_VIDEO_OPTIONS = [
  'Introduction to the Basics','Setting Up Your Environment','Best Practices','Common Mistakes to Avoid'
];

function extractChannelName(url){
  const handleMatch = url.match(/@([\w-]+)/);
  const pathMatch = url.match(/\/(?:c|channel)\/([\w-]+)/);
  const raw = handleMatch ? handleMatch[1] : (pathMatch ? pathMatch[1] : 'New Channel');
  return raw.replace(/[-_]/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
}

/* ---------------- Add Playlist ---------------- */
function wirePlaylistForm(){
  const form = document.getElementById('playlistForm');
  if(!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const input = document.getElementById('playlistUrl');
    const url = input.value.trim();
    if(!isValidPlaylistUrl(url)){
      showToast('That doesn\'t look like a YouTube playlist link', 'warning');
      return;
    }
    const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
    const title = `Imported Playlist ${playlists.length + 1}`;
    const newPlaylist = {
      id: generateId('pl'),
      title,
      channel: 'Imported Channel',
      channelId: null,
      gradient: gradientFor(title),
      videos: buildVideos(20, 0)
    };
    playlists.push(newPlaylist);
    setData(STORAGE_KEYS.PLAYLISTS, playlists);
    showToast('Playlist added successfully');
    input.value = '';
    setTimeout(()=>{ window.location.href = 'library.html'; }, 900);
  });
}

/* ---------------- Add Channel ---------------- */
let currentChannelName = '';
const selectedPlaylistKeys = new Set();
const selectedVideoTitles = new Set();

function wireChannelForm(){
  const form = document.getElementById('channelForm');
  if(!form) return;
  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const input = document.getElementById('channelUrl');
    const url = input.value.trim();
    if(!isValidChannelUrl(url)){
      showToast('That doesn\'t look like a YouTube channel link', 'warning');
      return;
    }
    currentChannelName = extractChannelName(url);
    renderSelectionPanel();
    document.getElementById('selectionPanel').style.display = 'block';
    document.getElementById('selectionChannelName').textContent = currentChannelName;
    document.getElementById('selectionPanel').scrollIntoView({behavior:'smooth', block:'start'});
  });
}

function renderSelectionPanel(){
  const playlistWrap = document.getElementById('selectPlaylists');
  const videoWrap = document.getElementById('selectVideos');
  selectedPlaylistKeys.clear();
  selectedVideoTitles.clear();

  playlistWrap.innerHTML = MOCK_PLAYLIST_OPTIONS.map(p=>`
    <label class="select-row">
      <input type="checkbox" class="playlist-check" data-key="${p.key}" data-title="${escapeHtml(p.title)}" data-count="${p.videoCount}">
      <span>${escapeHtml(p.title)}</span>
      <span class="select-count">${p.videoCount} videos</span>
    </label>`).join('');

  videoWrap.innerHTML = MOCK_VIDEO_OPTIONS.map(v=>`
    <label class="select-row">
      <input type="checkbox" class="video-check" data-title="${escapeHtml(v)}">
      <span>${escapeHtml(v)}</span>
    </label>`).join('');

  updateSelectedCount();
}

function updateSelectedCount(){
  const count = selectedPlaylistKeys.size + selectedVideoTitles.size;
  const el = document.getElementById('selectedCount');
  if(el) el.textContent = count;
}

function wireSelectionControls(){
  document.addEventListener('change', (e)=>{
    if(e.target.classList.contains('playlist-check')){
      e.target.checked ? selectedPlaylistKeys.add(e.target.dataset.key) : selectedPlaylistKeys.delete(e.target.dataset.key);
      updateSelectedCount();
    }
    if(e.target.classList.contains('video-check')){
      e.target.checked ? selectedVideoTitles.add(e.target.dataset.title) : selectedVideoTitles.delete(e.target.dataset.title);
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

function addSelectedContent(){
  if(selectedPlaylistKeys.size === 0 && selectedVideoTitles.size === 0){
    showToast('Select at least one playlist or video', 'warning');
    return;
  }

  const channels = getData(STORAGE_KEYS.CHANNELS, []);
  const playlists = getData(STORAGE_KEYS.PLAYLISTS, []);
  const channelId = generateId('channel');
  let totalSelected = 0;

  selectedPlaylistKeys.forEach(key=>{
    const opt = MOCK_PLAYLIST_OPTIONS.find(o=>o.key === key);
    if(!opt) return;
    const title = `${currentChannelName}: ${opt.title}`;
    playlists.push({
      id: generateId('pl'),
      title,
      channel: currentChannelName,
      channelId,
      gradient: gradientFor(title),
      videos: buildVideos(opt.videoCount, 0)
    });
    totalSelected += opt.videoCount;
  });

  if(selectedVideoTitles.size > 0){
    const title = `${currentChannelName}: Selected Videos`;
    playlists.push({
      id: generateId('pl'),
      title,
      channel: currentChannelName,
      channelId,
      gradient: gradientFor(title),
      videos: Array.from(selectedVideoTitles).map((t,i)=>({ id:`v${i+1}`, title:t, duration:'10:00', completed:false }))
    });
    totalSelected += selectedVideoTitles.size;
  }

  channels.push({
    id: channelId,
    name: currentChannelName,
    gradient: gradientFor(currentChannelName),
    description: `Selected educational content from ${currentChannelName}.`,
    totalSelected
  });

  setData(STORAGE_KEYS.CHANNELS, channels);
  setData(STORAGE_KEYS.PLAYLISTS, playlists);
  showToast('Channel content added successfully');
  setTimeout(()=>{ window.location.href = 'library.html'; }, 900);
}

document.addEventListener('DOMContentLoaded', ()=>{
  wirePlaylistForm();
  wireChannelForm();
  wireSelectionControls();
});
