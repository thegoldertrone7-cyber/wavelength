'use strict';
/* ═════════ helpers ═════════ */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const uid = t => t.spId ? 'sp:' + t.spId : 'yt:' + t.ytId;
const rid = () => Math.random().toString(36).slice(2, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const api = async (url, o = {}) => {
  const h = { 'X-Wavelength': '1', ...o.headers }; let body = o.body;
  if (o.json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
  const r = await fetch(url, { method: o.method || (body !== undefined ? 'POST' : 'GET'), headers: h, body });
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error((j && j.error) || `Request failed (${r.status})`);
  return j;
};

/* ═════════ icons ═════════ */
const P = (d, fill = 'none') => `<svg viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>';
const I = {
  home: P('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  search: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  lib: P('<path d="M5 4v16M10 4v16"/><path d="m15 5 4 15"/>'),
  import: P('<circle cx="12" cy="12" r="9"/><path d="M7.5 9.5c3-1 6.5-.6 9 1M8 12.5c2.5-.8 5.3-.5 7.5.9M8.5 15.3c2-.6 4-.3 5.7.7"/>'),
  dl: P('<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 20h14"/>'),
  gear: P('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  plus: P('<path d="M12 5v14M5 12h14"/>'),
  heart: P(HEART), heartF: P(HEART, 'currentColor'),
  prev: P('<path d="M19 20 9 12l10-8z"/><path d="M5 19V5"/>'), next: P('<path d="m5 4 10 8-10 8z"/><path d="M19 5v14"/>'),
  shuffle: P('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>'),
  repeat: P('<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>'),
  repeat1: P('<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>'),
  queue: P('<path d="M4 6h12M4 12h12M4 18h8"/><circle cx="19" cy="17" r="2.2"/>'),
  expand: P('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
  vol: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
  mute: P('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  more: P('<circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/>'),
  trash: P('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  image: P('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>'),
  pauseS: P('<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z"/>', 'currentColor'),
  playS: P('<path d="m7 4 13 8-13 8z"/>', 'currentColor'),
  check: P('<path d="m5 12 5 5 9-10"/>'),
};
const GENRES = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Lo-Fi', 'Jazz', 'R&B', 'Indie', 'Metal', 'K-Pop', 'Latin', 'Afrobeats', 'Classical', 'Country'];

/* ═════════ state ═════════ */
const DEF = { playlists: [], liked: [], history: [], settings: { theme: 'dark', style: 'nothing', accent: null, viz: true, vizStyle: 'matrix', autoplay: true, quality: 192, volume: 0.8 } };
let S = structuredClone(DEF);
const R = { queue: [], idx: -1, cur: null, playing: false, shuffle: false, repeat: 0, muted: false, results: [], sTok: 0, health: null, sp: undefined, dls: [], seeking: false };
let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => api('/api/state', { method: 'PUT', json: S }).catch(() => {}), 400); };
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); };

/* ═════════ theming ═════════ */
const ACC = {
  nothing:{ dark:'#d71921',light:'#d71921',mocha:'#cba6f7',rose:'#f43f5e',amber:'#f59e0b',teal:'#14b8a6',sky:'#0ea5e9',violet:'#8b5cf6',lime:'#84cc16',slate:'#94a3b8' },
  classic:{ dark:'#7c6af7',light:'#6c5ce7',mocha:'#cba6f7',rose:'#f43f5e',amber:'#f59e0b',teal:'#14b8a6',sky:'#0ea5e9',violet:'#8b5cf6',lime:'#84cc16',slate:'#94a3b8' },
  win11:  { dark:'#0078d4',light:'#0078d4',mocha:'#cba6f7',rose:'#e3008c',amber:'#f59e0b',teal:'#038387',sky:'#0ea5e9',violet:'#8764b8',lime:'#498205',slate:'#69797e' },
  macos:  { dark:'#007aff',light:'#007aff',mocha:'#cba6f7',rose:'#ff375f',amber:'#ff9f0a',teal:'#30d158',sky:'#32ade6',violet:'#bf5af2',lime:'#30d158',slate:'#636366' },
  gnome:  { dark:'#3584e4',light:'#1c71d8',mocha:'#cba6f7',rose:'#e01b24',amber:'#e5a50a',teal:'#26a269',sky:'#29a7e0',violet:'#9141ac',lime:'#26a269',slate:'#77767b' },
  oneui:  { dark:'#1259c3',light:'#1259c3',mocha:'#cba6f7',rose:'#f43f5e',amber:'#f59e0b',teal:'#14b8a6',sky:'#0ea5e9',violet:'#8b5cf6',lime:'#84cc16',slate:'#94a3b8' },
};
const defAccent = () => { const tbl=ACC[S.settings.style]||ACC.nothing; return tbl[S.settings.theme]||tbl.dark||'#d71921'; };
const VC = { accent: '#d71921', dim: 'rgba(255,255,255,.17)' };
function applyTheme() {
  const { theme, accent } = S.settings, root = document.documentElement;
  root.dataset.theme = theme; root.dataset.style = S.settings.style || 'nothing';
  const a = accent || defAccent();
  const [r, g, b] = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  root.style.setProperty('--accent', a);
  root.style.setProperty('--accent-rgb', `${r},${g},${b}`);
  root.style.setProperty('--on-accent', (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000' : '#fff');
  try { localStorage.setItem('wl', JSON.stringify({ theme, style: S.settings.style, accent: a })); } catch {}
  VC.accent = a; VC.dim = getComputedStyle(root).getPropertyValue('--dot').trim() || VC.dim;
  $('meta[name=theme-color]').content = getComputedStyle(root).getPropertyValue('--bg').trim();
}

/* ═════════ dot-matrix play / pause ═════════ */
const PAT = { play: ['#....', '###..', '#####', '###..', '#....'], pause: ['.#.#.', '.#.#.', '.#.#.', '.#.#.', '.#.#.'] };
function buildDm() {
  $$('.dm').forEach(s => {
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const e = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      e.setAttribute('cx', 2.5 + c * 5); e.setAttribute('cy', 2.5 + r * 5); e.setAttribute('r', 2);
      e.style.setProperty('--c', c); e.dataset.r = r; e.dataset.c = c; s.appendChild(e);
    }
  });
  setDm(false);
}
function setDm(playing) {
  const p = PAT[playing ? 'pause' : 'play'];
  $$('.dm circle').forEach(e => e.classList.toggle('on', p[e.dataset.r][e.dataset.c] === '#'));
  $$('.pp-i').forEach(e => { e.innerHTML = playing ? I.pauseS : I.playS; });
}

/* ═════════ builders ═════════ */
const art = (t, c = '') => `<div class="art ${c}">${t && t.art ? `<img src="${esc(t.art)}" loading="lazy" alt="" onerror="this.remove()">` : ''}<span class="art-d"></span></div>`;
const cover = (pl, c = '') => {
  const cv = pl.cover || {};
  return `<div class="cover ${c}">${cv.url ? `<img src="${esc(cv.url)}" alt="" onerror="this.remove()">` : `<b>${esc(cv.emoji || (pl.name || '♪')[0].toUpperCase())}</b>`}</div>`;
};
const isCur = t => R.cur && (R.cur === t || uid(R.cur) === uid(t));
const liked = t => S.liked.some(x => uid(x) === uid(t) || (x.ytId && x.ytId === t.ytId));
const tile = (img, title, sub, attrs, i = 0, fab = '') => `<div class="tile rise" style="--i:${Math.min(i, 18)}" ${attrs}>${img}<div class="tt">${esc(title)}</div><div class="ts">${esc(sub)}</div>${fab}</div>`;
const loader = () => '<div class="loader"><i></i><i></i><i></i></div>';
function rows(list, ctx) {
  return list.map((t, i) => `<div class="row rise${isCur(t) ? ' on' : ''}${t.miss ? ' miss' : ''}" data-ctx="${ctx}" data-i="${i}" style="--i:${Math.min(i, 14)}">
    <div class="n"><span>${i + 1}</span><em class="eq"><i></i><i></i><i></i></em><b class="pl">${I.playS}</b></div>
    <div class="who">${art(t, 'sm')}<div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.miss ? ' · no YouTube match' : ''}</div></div></div>
    <div class="al">${esc(t.album || '')}</div><div class="d">${fmt(t.duration)}</div>
    <button class="ib hrt${liked(t) ? ' on' : ''}" data-act="like" title="Like">${liked(t) ? I.heartF : I.heart}</button>
    <button class="ib" data-act="menu" title="More">${I.more}</button></div>`).join('');
}
function ctxList(c) {
  if (c === 'liked') return S.liked; if (c === 'search') return R.results; if (c === 'history') return S.history; if (c === 'queue') return R.queue;
  return (S.playlists.find(p => p.id === c) || {}).tracks || [];
}

/* ═════════ views ═════════ */
function vHome() {
  const h = S.history.slice(0, 8), pls = S.playlists.slice(0, 6);
  return `<div class="hero rise"><div class="hero-dots"></div><div class="eyebrow">Free · no ads · runs on your computer</div>
    <h1 class="big">WAVE<br>LENGTH</h1><p>Bring your Spotify playlists over, play them ad-free, and download anything as MP3.</p>
    <div class="acts"><button class="btn solid" data-go="import">${I.import}Import from Spotify</button><button class="btn" data-go="search">${I.search}Search music</button></div></div>
    ${h.length ? `<div class="sec"><h2>Jump back in</h2></div><div class="grid">${h.map((t, i) => tile(art(t), t.title, t.artist, `data-act="playhist" data-i="${i}"`, i)).join('')}</div>` : ''}
    ${pls.length ? `<div class="sec"><h2>Your playlists</h2><a data-go="library">See all</a></div><div class="grid">${pls.map((p, i) => plTile(p, i)).join('')}</div>`
      : `<div class="sec"><h2>Start here</h2></div><div class="empty">No playlists yet. Import one from Spotify or create your own from the sidebar.</div>`}`;
}
const plTile = (p, i) => tile(cover(p), p.name, `${p.tracks.length} songs`, `data-go="playlist/${p.id}"`, i, `<button class="fab" data-act="playpl" data-id="${p.id}" title="Play">${I.playS}</button>`);

function vSearch(q) {
  if (!q) return `<h1 class="ttl">Search</h1><div class="grid">${GENRES.map((g, i) => `<div class="tile genre rise" style="--i:${i}" data-act="genre" data-g="${esc(g)}"><div class="tt">${esc(g)}</div></div>`).join('')}</div>`;
  doSearch(q);
  return `<h1 class="ttl">${esc(q)}</h1><div id="sr">${loader()}</div>`;
}
async function doSearch(q) {
  const my = ++R.sTok;
  try {
    const r = await api('/api/search?q=' + encodeURIComponent(q));
    if (my !== R.sTok || !$('#sr')) return;
    R.results = r;
    $('#sr').innerHTML = r.length ? `<div class="list">${rows(r, 'search')}</div>` : '<div class="empty">Nothing found. Try different words.</div>';
  } catch (e) { if (my === R.sTok && $('#sr')) $('#sr').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function vLib() {
  return `<h1 class="ttl">Library</h1><div class="grid">
    ${tile(`<div class="cover liked">${I.heartF}</div>`, 'Liked Songs', `${S.liked.length} songs`, 'data-go="liked"', 0, `<button class="fab" data-act="playliked" title="Play">${I.playS}</button>`)}
    ${S.playlists.map((p, i) => plTile(p, i + 1)).join('')}
    <div class="tile new rise" style="--i:${S.playlists.length + 1}" data-act="newpl">${I.plus}<div>New playlist</div></div></div>`;
}

function vPlaylist(id) {
  const isL = id === 'liked';
  const pl = isL ? { name: 'Liked Songs', tracks: S.liked } : S.playlists.find(p => p.id === id);
  if (!pl) return '<div class="empty">That playlist doesn’t exist anymore.</div>';
  const min = Math.round(pl.tracks.reduce((a, t) => a + (t.duration || 0), 0) / 60);
  const un = pl.tracks.filter(t => !t.ytId && !t.miss).length, miss = pl.tracks.filter(t => t.miss).length;
  return `<div class="ph rise">
    ${isL ? `<div class="cover liked">${I.heartF}</div>` : `<div class="cover" data-act="editpl" data-id="${pl.id}" title="Change cover">${cover(pl).replace(/^<div class="cover ">|<\/div>$/g, '')}<span class="edit">${I.image}</span></div>`}
    <div class="ph-r"><div class="eyebrow">Playlist</div><h1 class="ttl">${esc(pl.name)}</h1>
      <div class="meta">${pl.tracks.length} songs · ${min} min${miss ? ` · ${miss} without a match` : ''}</div>
      <div class="acts"><button class="btn acc" data-act="playall" data-id="${id}">${I.playS}Play</button>
        <button class="btn" data-act="shufflepl" data-id="${id}">${I.shuffle}Shuffle</button>
        <button class="btn" data-act="dlall" data-id="${id}">${I.dl}Download all</button>
        ${isL ? '' : `<button class="btn" data-act="editpl" data-id="${pl.id}">${I.image}Edit</button><button class="btn dng" data-act="delpl" data-id="${pl.id}">${I.trash}Delete</button>`}
        ${un ? `<button class="btn" data-act="matchrest" data-id="${id}">Match ${un} remaining</button>` : ''}</div>
      <div class="matchbar${MQ.total ? ' on' : ''}" id="match-bar"><div class="lbl" id="match-lbl"></div><div class="dtw" style="pointer-events:none"><div class="dt"><i id="match-fill"></i></div></div></div>
    </div></div>
    <div class="list">${pl.tracks.length ? rows(pl.tracks, id) : '<div class="empty">Empty for now. Use the ••• menu on any song to add it here.</div>'}</div>`;
}

function vImport() {
  const h = R.health || {}, sp = R.sp; let adv;
  if (!h.clientId) adv = `<ol class="steps"><li><span>Create an app at <b>developer.spotify.com/dashboard</b> and tick <b>Web API</b>.</span></li>
      <li><span>Add this <b>Redirect URI</b>:<br><span class="code" style="margin-top:8px">${esc(h.redirectUri || '')}</span> <button class="btn sm" data-act="copy-uri">Copy</button></span></li>
      <li><span>Paste the app’s <b>Client ID</b> here.</span></li></ol>
      <div class="inline"><input class="inp" id="cid" placeholder="Client ID" spellcheck="false"><button class="btn solid" data-act="save-client">Save</button></div>`;
  else if (!h.spotifyConnected) adv = `<div class="acts" style="margin-top:0"><a class="btn acc" href="/auth/login">${I.import}Sign in with Spotify</a><button class="btn" data-act="reset-client">Change client ID</button></div>`;
  else {
    if (sp === undefined) spLoad();
    adv = `<p class="mut">${sp && sp.me ? 'Signed in as ' + esc(sp.me.name) + '.' : 'Signed in.'}</p><div class="acts" style="margin-top:0"><button class="btn" data-act="imp-liked">${I.heart}Import liked songs</button><button class="btn" data-act="sp-refresh">Reload list</button><button class="btn dng" data-act="sp-out">Sign out</button></div>
      ${!sp ? loader() : sp.err ? `<p class="meta" style="margin-top:14px">${esc(sp.err)}</p>` : `<div class="list" style="margin-top:12px">${sp.pls.map((p, i) => `<div class="prow">${cover({ name: p.name, cover: { url: p.image } })}<div class="nm"><div>${esc(p.name)}</div><div class="meta">${p.count ?? '?'} songs</div></div><button class="btn sm solid" data-act="imp-pl" data-id="${p.id}">Import</button></div>`).join('')}</div>`}`;
  }
  return `<h1 class="ttl">Import</h1>
    <div class="box rise"><h3>Paste a Spotify link</h3><p class="mut">In Spotify choose Share → Copy link, then paste it here. Wavelength reads the song list and finds every song on YouTube.</p>
      <div class="inline"><input class="inp" id="sp-url" placeholder="https://open.spotify.com/playlist/…" spellcheck="false"><button class="btn solid" data-act="imp-url">Import</button></div>
      <p class="meta" style="margin-top:12px">Works with playlists, albums and songs. The playlist must be public. Without signing in, Spotify shares the first 100 songs of a playlist.</p></div>
    <div class="box rise" style="--i:1"><h3>Or paste a list of songs</h3><p class="mut">One per line, like <b>Artist - Song</b>. Always works, any length.</p>
      <textarea class="inp" id="sp-list" placeholder="Helluva Boss - Hot Goss&#10;JT Music - After Hours" spellcheck="false"></textarea>
      <div class="inline"><input class="inp" id="sp-list-name" placeholder="Playlist name" style="max-width:260px"><button class="btn" data-act="imp-list">Import list</button></div></div>
    <details class="box adv rise" style="--i:2"${h.spotifyConnected ? ' open' : ''}><summary>Sign in with Spotify (optional)</summary>
      <p class="mut">Only needed for playlists over 100 songs and your liked songs. Spotify may refuse some playlists for apps like this.</p>${adv}</details>`;
}

function vDl() {
  return `<h1 class="ttl">Downloads</h1><div class="box rise"><h3>Save any song as MP3</h3><p class="mut">Use the ••• menu on a song, or paste a YouTube link here. Files go to <b>${esc((R.health || {}).downloadDir || '~/Music/Wavelength')}</b>.</p>
    <div class="inline"><input class="inp" id="dl-url" placeholder="https://www.youtube.com/watch?v=…" spellcheck="false"><button class="btn solid" data-act="dl-url">${I.dl}Download</button></div></div>
    <div class="sec"><h2>Queue</h2><a data-act="dl-clear">Clear finished</a></div><div id="dl-list">${dlList()}</div>`;
}
const dlList = () => R.dls.length ? R.dls.map(j => `<div class="dl ${j.status}"><div class="nm"><div class="t">${esc(j.name)}</div><div class="st">${j.status === 'error' ? esc(j.error) : j.status === 'done' ? 'Saved' : j.status === 'queued' ? 'Waiting…' : j.status === 'converting' ? 'Converting to MP3…' : Math.round(j.progress) + '%'}</div>
  <div class="dtw" style="pointer-events:none;padding:6px 0 0"><div class="dt"><i style="width:${j.progress}%"></i></div></div></div>${j.status === 'done' ? I.check.replace('<svg', '<svg style="width:22px;color:var(--accent)"') : ''}</div>`).join('') : '<div class="empty">No downloads yet.</div>';

function vSet() {
  const s = S.settings, h = R.health || {};
  const sw = ['#d71921', '#ff6a00', '#f5c400', '#2fd36b', '#00c2ff', '#6b6bff', '#cba6f7', '#ff4fa3', '#ffffff'];
  const tg = (k, l, sub) => `<div class="line"><div><div class="l">${l}</div><div class="s">${sub}</div></div><button class="tg${s[k] ? ' on' : ''}" data-act="tg" data-k="${k}" aria-label="${l}"></button></div>`;
  return `<h1 class="ttl">Settings</h1><div class="set">
    <div class="box rise" style="--i:0"><h3>Appearance</h3><div class="chips">
      ${[['nothing','Nothing OS'],['classic','Classic'],['win11','Windows 11'],['macos','macOS'],['gnome','Linux / GNOME'],['oneui','Samsung One UI']].map(([k,n])=>`<button class="chip${s.style===k?' on':''}" data-act="style" data-k="${k}">${n}</button>`).join('')}</div>
      <div class="chips" style="margin-top:10px">${[['dark','Dark'],['light','Light'],['mocha','Catppuccin Mocha'],['rose','Rose'],['amber','Amber'],['teal','Teal'],['sky','Sky'],['violet','Violet'],['lime','Lime'],['slate','Slate']].map(([k,n])=>`<button class="chip${s.theme===k?' on':''}" data-act="theme" data-k="${k}">${n}</button>`).join('')}</div>
      <div class="sw">${sw.map(c => `<button style="background:${c}" class="${s.accent === c ? 'on' : ''}" data-act="accent" data-c="${c}" aria-label="Accent ${c}"></button>`).join('')}
      <input type="color" id="accent-pick" value="${s.accent || defAccent()}" title="Custom colour"><button class="btn sm" data-act="accent-reset">Reset</button></div></div>
    <div class="box rise" style="--i:1"><h3>Sound visualizer</h3>${tg('viz', 'Show in full-screen player', 'Reacts to the real audio, not a fake animation.')}
      <div class="line"><div class="l">Style</div><select class="inp" data-set="vizStyle">${['matrix', 'bars', 'wave', 'radial'].map(v => `<option value="${v}"${s.vizStyle === v ? ' selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div></div>
    <div class="box rise" style="--i:2"><h3>Playback</h3>${tg('autoplay', 'Endless playback', 'When your queue ends, keep going with similar songs.')}
      <div class="line"><div><div class="l">Sleep timer</div><div class="s">Pause music after a while.</div></div><select class="inp" data-set="sleep"><option value="0">Off</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></div></div>
    <div class="box rise" style="--i:3"><h3>Downloads</h3>
      <div class="line"><div class="l">MP3 quality</div><select class="inp" data-set="quality">${[128, 192, 256, 320].map(q => `<option${s.quality === q ? ' selected' : ''}>${q}</option>`).join('')}</select></div>
      <div class="line"><div class="l">Folder</div><div class="inline" style="flex:1;justify-content:flex-end"><input class="inp" id="dl-dir" value="${esc(h.downloadDir || '')}"><button class="btn" data-act="save-dir">Save</button></div></div></div>
    <div class="box rise" style="--i:4"><h3>Spotify</h3><div class="line"><div><div class="l">Client ID</div><div class="s">${h.clientId ? esc(h.clientId.slice(0, 6)) + '…' : 'Not set'} · ${h.spotifyConnected ? 'connected' : 'not connected'}</div></div><button class="btn" data-go="import">Manage</button></div></div>
    <div class="box rise" style="--i:5"><h3>Status</h3>
      <div class="line"><div class="l">yt-dlp</div><div class="meta">${h.ytdlp ? esc(h.ytdlp) : 'missing — brew install yt-dlp'}</div></div>
      <div class="line"><div class="l">ffmpeg</div><div class="meta">${h.ffmpeg ? esc(h.ffmpeg) : 'missing — brew install ffmpeg'}</div></div>
      <div class="line"><div class="l">Ads</div><div class="meta">None</div></div><div class="line"><div class="l">Price</div><div class="meta">Free</div></div></div></div>`;
}

/* ═════════ router ═════════ */
let curRoute = 'home', curArg = '', routeTok = 0, drawn = false;
const V = { share: a => { if (R.sharing !== a) { R.sharing = a; importLink(a); } return '<h1 class="ttl">Importing…</h1>' + loader(); }, home: vHome, search: vSearch, library: vLib, playlist: vPlaylist, liked: () => vPlaylist('liked'), import: vImport, downloads: vDl, settings: vSet };
function draw() { $('#view').innerHTML = (V[curRoute] || vHome)(curArg); updMatch(); }
async function route() {
  const [name, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const my = ++routeTok, v = $('#view');
  if (drawn) { v.classList.add('out'); await sleep(140); if (my !== routeTok) return; }
  curRoute = V[name] ? name : 'home'; curArg = decodeURIComponent(rest.join('/'));
  $$('.nav a').forEach(a => a.classList.toggle('on', a.dataset.r === curRoute || (curRoute === 'liked' && a.dataset.r === 'library') || (curRoute === 'playlist' && a.dataset.r === 'library')));
  draw(); v.classList.remove('out'); v.classList.remove('in'); void v.offsetWidth; v.classList.add('in'); drawn = true;
  $('#main').scrollTo({ top: 0 });
  if (curRoute === 'search' && document.activeElement !== $('#q')) $('#q').value = curArg;
  if (curRoute === 'downloads') dlPoll();
}
const nav = h => { if (location.hash.slice(1) === h) route(); else location.hash = h; };
const refreshView = () => { if (curRoute !== 'search') draw(); };

/* ═════════ sidebar ═════════ */
function drawSide() {
  $('#side-pl').innerHTML = `<div class="spl" data-go="liked"><div class="cover liked" style="width:38px;border-radius:12px">${I.heartF}</div><div><div class="n">Liked Songs</div><div class="c">${S.liked.length} songs</div></div></div>` +
    S.playlists.map(p => `<div class="spl" data-go="playlist/${p.id}">${cover(p)}<div><div class="n">${esc(p.name)}</div><div class="c">${p.tracks.length} songs</div></div></div>`).join('');
}

/* ═════════ audio engine + visualizer ═════════ */
const audio = $('#audio');
let actx, analyser, gain, freq, wave;
function ensureGraph() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    const src = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.78;
    gain = actx.createGain(); src.connect(analyser); analyser.connect(gain); gain.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount); wave = new Uint8Array(analyser.fftSize);
    audio.volume = 1; applyVol();
  } catch { actx = null; analyser = null; }
}
function applyVol() {
  const v = R.muted ? 0 : S.settings.volume;
  if (gain) gain.gain.value = v; else audio.volume = v;
  $('#v-fill').style.width = (R.muted ? 0 : S.settings.volume * 100) + '%';
  $('#b-mute').innerHTML = R.muted || S.settings.volume === 0 ? I.mute : I.vol;
}
let vizRaf = 0, phase = 0, disp = [];
const VSTYLES = ['matrix', 'bars', 'wave', 'radial'];
function vizSync() {
  const open = $('#np').classList.contains('open'), on = open && S.settings.viz;
  $('#viz').style.display = S.settings.viz ? '' : 'none';
  $('#b-viz').textContent = S.settings.vizStyle[0].toUpperCase() + S.settings.vizStyle.slice(1);
  if (on && !vizRaf) { const c = $('#viz'), g = c.getContext('2d'); const loop = () => { vizRaf = requestAnimationFrame(loop); drawViz(c, g); }; loop(); }
  if (!on && vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = 0; }
}
function drawViz(c, g) {
  const dpr = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const live = analyser && R.playing; phase += 0.035;
  if (live) { analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave); }
  const level = (i, n) => live ? Math.min(1, (freq[Math.floor(Math.pow(i / n, 1.55) * freq.length * 0.7) + 1] / 255) * 1.12)
    : 0.06 + 0.04 * Math.sin(phase * 2 + i * 0.55);
  const ease = (i, v) => (disp[i] = (disp[i] ?? v) + (v - (disp[i] ?? v)) * 0.32);
  const st = S.settings.vizStyle; g.fillStyle = g.strokeStyle = VC.accent;
  if (st === 'matrix') {
    const cols = 34, rows = 11, cell = Math.min(w / cols, h / rows), ox = (w - cell * cols) / 2, oy = (h - cell * rows) / 2, r = cell * 0.3;
    for (let x = 0; x < cols; x++) {
      const lit = Math.round(ease(x, level(x, cols)) * rows);
      for (let y = 0; y < rows; y++) {
        const on = y >= rows - lit;
        g.fillStyle = on ? VC.accent : VC.dim;
        g.beginPath(); g.arc(ox + x * cell + cell / 2, oy + y * cell + cell / 2, on ? r * 1.08 : r * 0.62, 0, 6.283); g.fill();
      }
    }
  } else if (st === 'bars') {
    const n = 44, bw = w / n;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(6, ease(i, level(i, n)) * h * 0.95), x = i * bw + bw * 0.2, rr = bw * 0.3;
      g.beginPath(); g.roundRect(x, h - bh, bw * 0.6, bh, rr); g.fill();
    }
  } else if (st === 'wave') {
    g.lineWidth = 3; g.lineCap = g.lineJoin = 'round'; g.shadowColor = VC.accent; g.shadowBlur = 14; g.beginPath();
    for (let x = 0; x <= w; x += 3) {
      const v = live ? (wave[Math.floor(x / w * (wave.length - 1))] - 128) / 128 : Math.sin(x / 38 + phase * 2) * 0.08;
      const y = h / 2 + v * h * 0.46; x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.shadowBlur = 0;
  } else {
    const n = 72, cx = w / 2, cy = h / 2, r0 = Math.min(w, h) * 0.26; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283 - 1.5708 + phase * 0.15, l = 4 + ease(i, level(i < n / 2 ? i : n - i, n / 2)) * r0 * 1.15;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); g.stroke();
    }
  }
  g.globalAlpha = 1;
}

/* ═════════ playback ═════════ */
let playTok = 0, fails = 0, errSkips = 0, extending = false;
const pend = new Map();
function resolve(t) {
  const k = uid(t); if (pend.has(k)) return pend.get(k);
  const p = api('/api/match', { json: { key: k, title: t.title, artist: t.artist, duration: t.duration } })
    .then(r => { if (r.ytId) { t.ytId = r.ytId; delete t.miss; if (!t.art) t.art = `https://i.ytimg.com/vi/${r.ytId}/mqdefault.jpg`; } else t.miss = true; save(); return t; })
    .finally(() => pend.delete(k));
  pend.set(k, p); return p;
}
const play = (list, i) => { R.queue = [...list]; renderQueue(); playIdx(i); };
async function playIdx(i) {
  const t = R.queue[i]; if (!t) return;
  const my = ++playTok; R.idx = i; R.cur = t; ensureGraph(); uiNow();
  try { if (!t.ytId) await resolve(t); } catch (e) { if (my === playTok) { toast(e.message); setPlaying(false); } return; }
  if (my !== playTok) return;
  if (!t.ytId) {
    toast(`No YouTube match for “${t.title}”`); uiNow();
    if (++fails < Math.min(R.queue.length, 8)) return next(); setPlaying(false); return;
  }
  fails = 0; audio.src = '/api/stream/' + t.ytId;
  try { if (actx && actx.state === 'suspended') await actx.resume(); await audio.play(); } catch (e) { if (my === playTok && e.name !== 'AbortError') toast('Press play to start'); }
  if (my !== playTok) return;
  S.history = [{ ...t }, ...S.history.filter(x => uid(x) !== uid(t))].slice(0, 40); save();
  mediaSession(); warm();
}
function warm() {
  const n = R.queue[R.idx + 1];
  if (n) (n.ytId ? Promise.resolve(n) : resolve(n)).then(x => x.ytId && api('/api/prefetch/' + x.ytId).catch(() => {})).catch(() => {});
  if (R.queue.length - R.idx <= 2 && S.settings.autoplay && R.repeat !== 1) extend();
}
async function extend() {
  if (extending || !R.cur || !R.cur.ytId) return 0; extending = true;
  try {
    const r = await api('/api/related/' + R.cur.ytId), have = new Set(R.queue.map(t => t.ytId).filter(Boolean));
    const add = r.filter(t => !have.has(t.ytId)).slice(0, 12).map(t => ({ ...t, auto: true }));
    R.queue.push(...add); renderQueue(); return add.length;
  } catch { return 0; } finally { extending = false; }
}
async function next() {
  if (!R.queue.length) return;
  let i;
  if (R.shuffle && R.queue.length > 1) { do { i = Math.floor(Math.random() * R.queue.length); } while (i === R.idx); } else i = R.idx + 1;
  if (i >= R.queue.length) {
    if (R.repeat === 1) i = 0;
    else if (S.settings.autoplay && await extend()) { toast('Endless mode: queued similar songs'); i = R.idx + 1; }
    else { setPlaying(false); return; }
  }
  playIdx(i);
}
function prev() { if (audio.currentTime > 3 || R.idx <= 0) { audio.currentTime = 0; return; } playIdx(R.idx - 1); }
function togglePlay() {
  if (!R.cur) { if (S.history.length) play(S.history, 0); else toast('Search for a song or open a playlist first'); return; }
  if (audio.paused) { ensureGraph(); if (actx && actx.state === 'suspended') actx.resume(); audio.play().catch(() => {}); } else audio.pause();
}
function setPlaying(p) { R.playing = p; document.body.classList.toggle('playing', p); setDm(p); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused'; }
audio.addEventListener('play', () => setPlaying(true));
audio.addEventListener('pause', () => setPlaying(false));
audio.addEventListener('playing', () => { errSkips = 0; setPlaying(true); });
audio.addEventListener('ended', () => R.repeat === 2 ? (audio.currentTime = 0, audio.play()) : next());
audio.addEventListener('error', () => { if (!audio.src) return; toast('This stream failed — skipping'); if (++errSkips < 3) next(); else setPlaying(false); });
audio.addEventListener('timeupdate', () => { if (!R.seeking) uiTime(); });
audio.addEventListener('loadedmetadata', uiTime);
function uiTime() {
  const d = (isFinite(audio.duration) && audio.duration) || (R.cur && R.cur.duration) || 0, c = audio.currentTime || 0;
  $$('.js-fill').forEach(e => e.style.width = (d ? c / d * 100 : 0) + '%');
  $$('.t-cur').forEach(e => e.textContent = fmt(c)); $$('.t-tot').forEach(e => e.textContent = fmt(d)); mediaPos(c, d);
}
function seekPreview(f, final) {
  const d = (isFinite(audio.duration) && audio.duration) || (R.cur && R.cur.duration) || 0; if (!d) return;
  R.seeking = !final; $$('.js-fill').forEach(e => e.style.width = f * 100 + '%'); $$('.t-cur').forEach(e => e.textContent = fmt(f * d));
  if (final) audio.currentTime = f * d;
}
function setVol(f) { S.settings.volume = f; R.muted = false; applyVol(); save(); }
function mediaSession() {
  if (!('mediaSession' in navigator) || !R.cur) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: R.cur.title, artist: R.cur.artist, album: R.cur.album || 'Wavelength', artwork: R.cur.art ? [{ src: R.cur.art, sizes: '512x512' }, { src: R.cur.art, sizes: '256x256' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  const h = {
    play: () => { audio.play(); }, pause: () => audio.pause(), stop: () => audio.pause(),
    previoustrack: prev, nexttrack: () => next(),
    seekbackward: d => { audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 10)); },
    seekforward: d => { audio.currentTime += (d && d.seekOffset) || 10; },
    seekto: d => { audio.currentTime = d.seekTime; },
  };
  for (const k in h) try { ms.setActionHandler(k, h[k]); } catch {}
}
let lastPos = -1;
function mediaPos(c, d) {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !d || !isFinite(d) || Math.floor(c) === lastPos) return;
  lastPos = Math.floor(c); try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: 1, position: Math.min(c, d) }); } catch {}
}

/* ═════════ player UI ═════════ */
function uiNow() {
  const t = R.cur; if (!t) return;
  const m = $('#p-meta'); m.classList.remove('swap'); void m.offsetWidth; m.classList.add('swap');
  $('#p-title').textContent = t.title; $('#p-artist').textContent = t.artist;
  $('#p-art').innerHTML = art(t); $('#np-art').innerHTML = art(t);
  $('#np-title').textContent = t.title; $('#np-artist').textContent = t.artist;
  $('#np').style.setProperty('--np-art', t.art ? `url("${t.art.replace(/"/g, '%22')}")` : 'none');
  document.title = `${t.title} · ${t.artist}`; $$('.t-tot').forEach(e => e.textContent = fmt(t.duration));
  $$('.js-fill').forEach(e => e.style.width = '0%'); hl();
}
function hl() {
  const t = R.cur;
  $('#p-like').innerHTML = t && liked(t) ? I.heartF : I.heart; $('#p-like').classList.toggle('on', !!t && liked(t));
  $$('.row').forEach(r => {
    const x = ctxList(r.dataset.ctx)[+r.dataset.i]; if (!x) return;
    r.classList.toggle('on', isCur(x));
    const h = $('.hrt', r), l = liked(x); h.classList.toggle('on', l); h.innerHTML = l ? I.heartF : I.heart;
  });
  $$('.qi').forEach(q => q.classList.toggle('on', +q.dataset.qi === R.idx));
}
function toggleLike(t) {
  if (liked(t)) S.liked = S.liked.filter(x => !(uid(x) === uid(t) || (x.ytId && x.ytId === t.ytId)));
  else { S.liked.unshift({ ...t }); toast('Added to Liked Songs'); }
  save(); drawSide(); hl(); if (curRoute === 'liked' || curRoute === 'library') draw();
}
function renderQueue() {
  $('#q-list').innerHTML = R.queue.length ? R.queue.map((t, i) => `<div class="qi${i === R.idx ? ' on' : ''}" data-qi="${i}">${art(t, 'sm')}<div class="qm"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.auto ? ' · endless' : ''}</div></div><button class="ib sm" data-act="qrm" data-i="${i}">${I.close}</button></div>`).join('') : '<div class="empty">Nothing queued.</div>';
}
function toggleNP() { $('#np').classList.toggle('open'); vizSync(); }

/* ═════════ menus & modals ═════════ */
function closeMenu() { $('#menu').classList.remove('open'); }
function openMenu(ctx, i, x, y) {
  const t = ctxList(ctx)[i]; if (!t) return;
  const it = [
    ['Play next', 'next', () => { R.queue.splice(R.idx + 1, 0, t); renderQueue(); toast('Playing next'); }],
    ['Add to queue', 'queue', () => { R.queue.push(t); renderQueue(); toast('Added to queue'); }],
    ['Add to playlist', 'plus', () => addToPl(t)],
    [liked(t) ? 'Remove from Liked' : 'Add to Liked', 'heart', () => toggleLike(t)],
    ['Download MP3', 'dl', () => download(t)],
  ];
  if (!['search', 'queue', 'history'].includes(ctx)) it.push(['Remove from this list', 'trash', () => { ctxList(ctx).splice(i, 1); save(); drawSide(); draw(); }]);
  R.menu = it; const m = $('#menu');
  m.innerHTML = it.map((x, k) => `<button data-mi="${k}">${I[x[1]]}${x[0]}</button>`).join('');
  m.style.left = Math.min(x, innerWidth - 250) + 'px'; m.style.top = Math.min(y, innerHeight - 20 - it.length * 44) + 'px'; m.classList.add('open');
}
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${html}</div>`; m.classList.add('open'); }
function closeModal(save_) {
  $('#modal').classList.remove('open');
  if (M && !save_) M.up.forEach(delCover); M = null;
}
const delCover = u => { if (u && u.startsWith('/covers/')) api('/api/cover/' + u.slice(8), { method: 'DELETE' }).catch(() => {}); };

let M = null; const EMO = ['🎧', '🌙', '☀️', '🔥', '🌊', '🌴', '🎸', '🎹', '🥁', '💿', '🖤', '✨', '🚗', '🏋️', '📚', '🎮'];
function plModal(id, addTrack) {
  const pl = id && S.playlists.find(p => p.id === id);
  M = { id, name: pl ? pl.name : '', cover: pl && pl.cover ? { ...pl.cover } : { emoji: '🎧' }, orig: pl && pl.cover && pl.cover.url, up: [], addTrack };
  drawPlModal();
}
function drawPlModal() {
  const c = M.cover;
  modal(`<div class="eyebrow">${M.id ? 'Edit' : 'New'} playlist</div><h3 style="margin-top:8px">${M.id ? 'Edit playlist' : 'Name your playlist'}</h3>
    <div class="pm"><div class="cover" id="pm-cover" data-act="pick-cover">${c.url ? `<img src="${esc(c.url)}" alt="">` : `<b>${esc(c.emoji || '🎧')}</b>`}<span class="edit">${I.image}Click or drop<br>PNG / JPG / WebP</span></div>
    <div class="pm-r"><input class="inp" id="pm-name" placeholder="Playlist name" maxlength="48" value="${esc(M.name)}"><div class="emo">${EMO.map(e => `<button data-act="emoji" data-e="${e}">${e}</button>`).join('')}</div>
    ${c.url ? `<button class="btn sm" data-act="rm-cover">${I.trash}Remove image</button>` : ''}</div></div>
    <div class="acts end"><button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="save-pl">Save</button></div>`);
  const d = $('#pm-cover');
  d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) uploadCover(e.dataTransfer.files[0]); };
  if (!M.id && !M.name) setTimeout(() => $('#pm-name') && $('#pm-name').focus(), 250);
}
const grabName = () => { const n = $('#pm-name'); if (n) M.name = n.value; };
async function prepImage(file) {
  const bmp = await createImageBitmap(file), s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const png = file.type !== 'image/jpeg';
  return { blob: await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', 0.92)) };
}
async function uploadCover(file) {
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) return toast('Use a PNG, JPG, WebP or GIF image');
  try {
    grabName(); const { blob } = await prepImage(file);
    const r = await api('/api/cover', { body: blob, headers: { 'Content-Type': 'application/octet-stream' } });
    M.up.push(r.url); M.cover = { url: r.url }; drawPlModal();
  } catch (e) { toast('Couldn’t use that image: ' + e.message); }
}
function pickFile() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp,image/gif'; i.onchange = () => i.files[0] && uploadCover(i.files[0]); i.click(); }
function savePl() {
  grabName(); const name = M.name.trim(); if (!name) return toast('Give it a name');
  let pl;
  if (M.id) {
    pl = S.playlists.find(p => p.id === M.id); pl.name = name; pl.cover = M.cover;
    if (M.orig && M.orig !== M.cover.url) delCover(M.orig);
  } else { pl = { id: rid(), name, cover: M.cover, tracks: [] }; S.playlists.push(pl); }
  M.up.filter(u => u !== M.cover.url).forEach(delCover);
  if (M.addTrack && !pl.tracks.some(x => uid(x) === uid(M.addTrack))) { pl.tracks.push({ ...M.addTrack }); toast(`Added to ${pl.name}`); } else toast(M.id ? 'Saved' : `“${name}” created`);
  closeModal(true); save(); drawSide(); refreshView();
}
function addToPl(t) {
  modal(`<div class="eyebrow">Add to playlist</div><h3 style="margin-top:8px">${esc(t.title)}</h3><div style="display:grid;gap:2px">
    ${S.playlists.map(p => `<button class="pick" data-act="add-to" data-id="${p.id}">${cover(p)}<div><div style="font-weight:500">${esc(p.name)}</div><div class="meta">${p.tracks.length} songs</div></div></button>`).join('')}
    <button class="pick" data-act="add-new">${`<div class="cover">${I.plus}</div>`}<div style="font-weight:500">New playlist…</div></button></div>`);
  R.addT = t;
}

/* ═════════ spotify import ═════════ */
async function spLoad() {
  R.sp = null;
  try { const [me, pls] = await Promise.all([api('/api/spotify/me'), api('/api/spotify/playlists')]); R.sp = { me, pls }; }
  catch (e) { R.sp = { err: e.message }; if (/Not connected|expired/.test(e.message)) refreshHealth(); }
  if (curRoute === 'import') draw();
}
const firstUrl = x => (String(x).match(/https?:\/\/[^\s<>"]+/) || [])[0];
const isSpUrl = x => /open\.spotify\.com\/(playlist|album|track)\/|spotify\.(app\.)?link\//.test(x);
async function importLink(raw) {
  const url = firstUrl(raw); if (!url) return toast('Paste a Spotify link');
  toast('Reading the song list…');
  try {
    let d = await api('/api/spotify-url?u=' + encodeURIComponent(url));
    if (d.truncated && R.health && R.health.spotifyConnected) {
      try { const f = await api('/api/spotify/playlist/' + d.id); if (f.tracks.length > d.tracks.length) d = { ...d, ...f, truncated: false }; } catch {}
    }
    commitImport(d);
  } catch (e) { toast(e.message); if (curRoute === 'share') nav('import'); }
}
function commitImport(d) {
  if (!d.tracks.length) return toast('No songs found in that link');
  if (d.kind === 'track') { play(d.tracks, 0); nav('home'); return toast('Playing ' + d.tracks[0].title); }
  let pl = S.playlists.find(p => p.spId === d.id);
  const old = new Map(pl ? pl.tracks.filter(t => t.spId).map(t => [t.spId, t]) : []);
  const tracks = d.tracks.map(t => { const o = old.get(t.spId); return o ? { ...t, ytId: o.ytId, miss: o.miss, art: o.art || t.art } : t; });
  if (pl) { pl.tracks = tracks; pl.name = d.name; } else { pl = { id: rid(), spId: d.id, name: d.name, cover: d.image ? { url: d.image } : { emoji: '🟢' }, tracks }; S.playlists.push(pl); }
  save(); drawSide(); startMatching(tracks); nav('playlist/' + pl.id);
  toast(d.truncated ? `Imported ${tracks.length} songs — Spotify only shares the first 100 without signing in` : `Imported ${tracks.length} songs — finding them on YouTube`);
}
function importList() {
  const lines = $('#sp-list').value.split('\n').map(x => x.trim()).filter(Boolean); if (!lines.length) return toast('Paste at least one song');
  const tracks = lines.map(l => { const m = l.split(/\s+[-–—]\s+/), two = m.length > 1; return { spId: 'list-' + rid(), title: two ? m.slice(1).join(' - ') : l, artist: two ? m[0] : '', album: '', duration: 0, art: null }; });
  const pl = { id: rid(), name: $('#sp-list-name').value.trim() || 'My list', cover: { emoji: '📝' }, tracks }; S.playlists.push(pl);
  save(); drawSide(); startMatching(tracks); nav('playlist/' + pl.id); toast(`Imported ${tracks.length} songs — finding them on YouTube`);
}
async function spImport(kind, id) {
  toast('Reading from Spotify…');
  try {
    const d = await api(kind === 'liked' ? '/api/spotify/liked' : '/api/spotify/playlist/' + id);
    if (kind === 'liked') {
      const have = new Set(S.liked.map(t => t.spId).filter(Boolean)), add = d.tracks.filter(t => !have.has(t.spId));
      S.liked = [...add, ...S.liked]; toast(`${add.length} liked songs added`); save(); drawSide(); startMatching(add); nav('liked'); return;
    }
    commitImport({ kind: 'playlist', id, name: d.name, image: d.image, tracks: d.tracks });
  } catch (e) { toast(e.message); }
}
const MQ = { q: [], run: 0, done: 0, total: 0 };
function startMatching(tracks) {
  const todo = tracks.filter(t => !t.ytId && !t.miss && !MQ.q.includes(t));
  MQ.q.push(...todo); MQ.total += todo.length; pump(); updMatch();
}
function pump() {
  while (MQ.run < 3 && MQ.q.length) {
    const t = MQ.q.shift(); MQ.run++;
    resolve(t).catch(() => {}).finally(() => {
      MQ.run--; MQ.done++; updMatch(); pump();
      if (!MQ.q.length && !MQ.run) { MQ.done = MQ.total = 0; save(); toast('Matching finished'); updMatch(); refreshView(); }
    });
  }
}
function updMatch() {
  const bar = $('#match-bar'); if (!bar) return;
  bar.classList.toggle('on', MQ.total > 0);
  if (MQ.total) { $('#match-lbl').textContent = `Finding songs on YouTube… ${MQ.done}/${MQ.total}`; $('#match-fill').style.width = MQ.done / MQ.total * 100 + '%'; }
}

/* ═════════ downloads ═════════ */
async function download(t) {
  if (R.health && !R.health.ffmpeg) return toast('MP3 needs ffmpeg — run: brew install ffmpeg');
  try {
    if (!t.ytId) { toast('Matching on YouTube…'); await resolve(t); }
    if (!t.ytId) return toast('No YouTube match to download');
    await api('/api/download', { json: { ytId: t.ytId, title: t.title, artist: t.artist, quality: S.settings.quality } });
    toast('Download queued'); dlPoll();
  } catch (e) { toast(e.message); }
}
let dlTimer;
function dlPoll() {
  clearTimeout(dlTimer);
  api('/api/downloads').then(l => {
    const was = new Map(R.dls.map(j => [j.id, j.status]));
    l.forEach(j => { if (was.has(j.id) && was.get(j.id) !== 'done' && j.status === 'done') toast('Saved: ' + j.name); });
    R.dls = l; const el = $('#dl-list'); if (el && curRoute === 'downloads') el.innerHTML = dlList();
    if (l.some(j => ['queued', 'downloading', 'converting'].includes(j.status))) dlTimer = setTimeout(dlPoll, 1200);
  }).catch(() => {});
}

/* ═════════ health ═════════ */
async function refreshHealth() {
  R.health = await api('/api/health').catch(() => null); const h = R.health;
  $('#banner').innerHTML = !h ? '<div class="banner"><b>Can’t reach the Wavelength server.</b> Start it again from the terminal.</div>'
    : !h.ytdlp ? '<div class="banner"><b>yt-dlp isn’t installed</b>, so nothing can play yet. Run <b>brew install yt-dlp ffmpeg</b> in Terminal, then reload.</div>'
    : !h.ffmpeg ? '<div class="banner"><b>ffmpeg is missing.</b> Playback works, but MP3 downloads need it: <b>brew install ffmpeg</b></div>' : '';
  if (curRoute === 'import' || curRoute === 'settings') draw();
}

/* ═════════ events ═════════ */
const rowTrack = el => { const r = el.closest('.row'); return r ? ctxList(r.dataset.ctx)[+r.dataset.i] : R.cur; };
const acts = {
  play: togglePlay, prev, next: () => next(),
  shuffle: () => { R.shuffle = !R.shuffle; $$('[data-act=shuffle]').forEach(b => b.classList.toggle('on', R.shuffle)); toast('Shuffle ' + (R.shuffle ? 'on' : 'off')); },
  repeat: () => { R.repeat = (R.repeat + 1) % 3; $$('[data-act=repeat]').forEach(b => { b.innerHTML = R.repeat === 2 ? I.repeat1 : I.repeat; b.classList.toggle('on', R.repeat > 0); }); toast(['Repeat off', 'Repeat all', 'Repeat one'][R.repeat]); },
  mute: () => { R.muted = !R.muted; applyVol(); },
  queue: () => { renderQueue(); $('#queue').classList.toggle('open'); }, qclear: () => { R.queue = R.cur ? [R.cur] : []; R.idx = R.cur ? 0 : -1; renderQueue(); },
  qrm: el => { const i = +el.dataset.i; R.queue.splice(i, 1); if (i <= R.idx) R.idx--; renderQueue(); },
  np: toggleNP,
  'viz-style': () => { S.settings.vizStyle = VSTYLES[(VSTYLES.indexOf(S.settings.vizStyle) + 1) % VSTYLES.length]; save(); vizSync(); },
  like: el => { const t = rowTrack(el); if (t) toggleLike(t); },
  menu: el => { const r = el.closest('.row'), b = el.getBoundingClientRect(); openMenu(r.dataset.ctx, +r.dataset.i, b.left - 190, b.bottom + 6); },
  playhist: el => play(S.history, +el.dataset.i), playliked: () => S.liked.length && play(S.liked, 0),
  playpl: el => { const p = S.playlists.find(x => x.id === el.dataset.id); if (p && p.tracks.length) play(p.tracks, 0); },
  playall: el => { const l = ctxList(el.dataset.id); if (l.length) play(l, 0); },
  shufflepl: el => { const l = ctxList(el.dataset.id); if (!l.length) return; R.shuffle = true; $$('[data-act=shuffle]').forEach(b => b.classList.add('on')); play(l, Math.floor(Math.random() * l.length)); },
  dlall: async el => {
    const l = ctxList(el.dataset.id); if (!l.length) return;
    if (!confirm(`Download ${l.length} songs as MP3? This can take a while.`)) return;
    toast(`Queuing ${l.length} downloads…`); for (const t of l) { await download(t); } nav('downloads');
  },
  matchrest: el => startMatching(ctxList(el.dataset.id)),
  newpl: () => plModal(), editpl: el => plModal(el.dataset.id),
  delpl: el => { const p = S.playlists.find(x => x.id === el.dataset.id); if (p && confirm(`Delete “${p.name}”? The songs stay on Spotify and YouTube.`)) { delCover(p.cover && p.cover.url); S.playlists = S.playlists.filter(x => x !== p); save(); drawSide(); nav('library'); } },
  'pick-cover': pickFile, 'rm-cover': () => { grabName(); M.cover = { emoji: '🎧' }; drawPlModal(); },
  emoji: el => { grabName(); M.cover = { emoji: el.dataset.e }; drawPlModal(); },
  'save-pl': savePl, 'close-modal': () => closeModal(false),
  'add-to': el => { const p = S.playlists.find(x => x.id === el.dataset.id), t = R.addT; closeModal(true); if (p.tracks.some(x => uid(x) === uid(t))) return toast('Already in ' + p.name); p.tracks.push({ ...t }); save(); drawSide(); toast('Added to ' + p.name); refreshView(); },
  'add-new': () => { const t = R.addT; closeModal(true); plModal(null, t); },
  genre: el => nav('search/' + encodeURIComponent(el.dataset.g + ' music')),
  'copy-uri': () => navigator.clipboard.writeText((R.health || {}).redirectUri || '').then(() => toast('Copied')),
  'save-client': async () => { try { await api('/api/config', { method: 'PUT', json: { spotifyClientId: $('#cid').value } }); await refreshHealth(); draw(); toast('Saved'); } catch (e) { toast(e.message); } },
  'reset-client': async () => { await api('/api/config', { method: 'PUT', json: { spotifyClientId: '' } }); await refreshHealth(); draw(); },
  'sp-refresh': () => { R.sp = undefined; draw(); }, 'sp-out': async () => { await api('/api/spotify/logout', { method: 'POST' }); R.sp = undefined; await refreshHealth(); draw(); },
  'imp-pl': el => spImport('pl', el.dataset.id), 'imp-liked': () => spImport('liked'),
  'imp-url': () => importLink($('#sp-url').value), 'imp-list': importList,
  'dl-url': async () => {
    const m = $('#dl-url').value.match(/(?:v=|youtu\.be\/|shorts\/|^)([A-Za-z0-9_-]{11})(?:[?&#]|$)/); if (!m) return toast('Paste a YouTube link');
    try { await api('/api/download', { json: { ytId: m[1], quality: S.settings.quality } }); $('#dl-url').value = ''; dlPoll(); toast('Download queued'); } catch (e) { toast(e.message); }
  },
  'dl-clear': async () => { await api('/api/downloads/clear', { method: 'POST' }); R.dls = R.dls.filter(j => !['done', 'error'].includes(j.status)); $('#dl-list').innerHTML = dlList(); },
  style: el => { S.settings.style = el.dataset.k; S.settings.accent = null; applyTheme(); save(); draw(); },
  theme: el => { S.settings.theme = el.dataset.k; S.settings.accent = null; applyTheme(); save(); draw(); },
  accent: el => { S.settings.accent = el.dataset.c; applyTheme(); save(); draw(); }, 'accent-reset': () => { S.settings.accent = null; applyTheme(); save(); draw(); },
  tg: el => { const k = el.dataset.k; S.settings[k] = !S.settings[k]; el.classList.toggle('on', S.settings[k]); save(); if (k === 'viz') vizSync(); },
  'save-dir': async () => { try { await api('/api/config', { method: 'PUT', json: { downloadDir: $('#dl-dir').value } }); await refreshHealth(); toast('Folder saved'); } catch (e) { toast(e.message); } },
};
document.addEventListener('click', e => {
  const t = e.target;
  if (!t.closest('#menu') && !t.closest('[data-act=menu]')) closeMenu();
  const mi = t.closest('[data-mi]'); if (mi) { const f = R.menu[+mi.dataset.mi][2]; closeMenu(); f(); return; }
  if (t === $('#modal')) return closeModal(false);
  const a = t.closest('[data-act]'); if (a && acts[a.dataset.act]) return acts[a.dataset.act](a, e);
  const g = t.closest('[data-go]'); if (g) return nav(g.dataset.go);
  const q = t.closest('[data-qi]'); if (q) return playIdx(+q.dataset.qi);
  const r = t.closest('.row'); if (r) return play(ctxList(r.dataset.ctx), +r.dataset.i);
});
document.addEventListener('contextmenu', e => { const r = e.target.closest('.row'); if (r) { e.preventDefault(); openMenu(r.dataset.ctx, +r.dataset.i, e.clientX, e.clientY); } });
document.addEventListener('change', e => {
  const el = e.target.closest('[data-set]'); if (!el) return; const k = el.dataset.set;
  if (k === 'sleep') { clearTimeout(R.sleepT); const m = +el.value; if (m) { R.sleepT = setTimeout(() => { audio.pause(); toast('Sleep timer: paused'); }, m * 60000); toast(`Pausing in ${m} minutes`); } return; }
  S.settings[k] = k === 'quality' ? +el.value : el.value; save(); if (k === 'vizStyle') vizSync();
});
document.addEventListener('input', e => { if (e.target.id === 'accent-pick') { S.settings.accent = e.target.value; applyTheme(); save(); } });
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-seek],[data-vol]'); if (!el || el.style.pointerEvents === 'none') return;
  e.preventDefault(); const seek = el.hasAttribute('data-seek');
  const fr = ev => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
  const ap = (f, fin) => seek ? seekPreview(f, fin) : setVol(f);
  ap(fr(e), false);
  const mv = ev => ap(fr(ev), false), up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ap(fr(ev), true); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
let qT;
const goSearch = v => { v = v.trim(); if (isSpUrl(v)) { $('#q').value = ''; return importLink(v); } nav(v ? 'search/' + encodeURIComponent(v) : 'search'); };
$('#q').addEventListener('input', e => { clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => goSearch(v), isSpUrl(v) ? 50 : 550); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qT); goSearch(e.target.value); } });
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowRight' && R.cur) audio.currentTime += 5; else if (e.code === 'ArrowLeft' && R.cur) audio.currentTime -= 5;
  else if (e.code === 'Escape') { closeMenu(); closeModal(false); $('#queue').classList.remove('open'); if ($('#np').classList.contains('open')) toggleNP(); }
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.hidden) api('/api/state', { method: 'PUT', json: S }).catch(() => {}); });

/* ═════════ boot ═════════ */
(async function boot() {
  $$('[data-ic]').forEach(e => e.innerHTML = I[e.dataset.ic]); buildDm();
  try { const st = await api('/api/state'); if (st) S = { ...DEF, ...st, settings: { ...DEF.settings, ...st.settings } }; } catch {}
  if (S.settings.theme === 'nothing') S.settings.theme = 'dark';
  if (!/Electron/.test(navigator.userAgent) && 'serviceWorker' in navigator && (location.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(location.hostname))) navigator.serviceWorker.register('/sw.js').catch(() => {});
  applyTheme(); applyVol(); drawSide(); renderQueue(); vizSync();
  await refreshHealth(); await route();
})();
