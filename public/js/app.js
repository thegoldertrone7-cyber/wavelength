'use strict';
/* ═════════ helpers ═════════ */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const uid = t => t.localId ? 'local:' + t.localId : t.spId ? 'sp:' + t.spId : 'yt:' + t.ytId;
const rid = () => Math.random().toString(36).slice(2, 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bytes = n => {
  n = Math.max(0, +n || 0);
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
  if (n < 1073741824) return (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
  return (n / 1073741824).toFixed(1) + ' GB';
};
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const localQualityText = t => {
  if (!t || !t.localId) return '';
  const bits = t.bitDepth ? `${t.bitDepth}-bit` : '';
  const rate = t.sampleRate ? `${(t.sampleRate / 1000).toFixed(t.sampleRate % 1000 ? 1 : 0)} kHz` : '';
  return [t.lossless ? 'Lossless' : 'Local', t.format || '', bits, rate].filter(Boolean).join(' ');
};
const localBadge = t => t && t.localId
  ? `<span class="qbadge${t.lossless ? ' ll' : ''}">${esc(localQualityText(t))}</span>`
  : '';

const NATIVE = typeof window.AndroidBridge !== 'undefined';
const nativeLockAllowed = () => {
  if (!NATIVE) return true;
  try { return !!window.AndroidBridge.lockScreenAllowed(); } catch { return true; }
};
function syncSystemBars() {
  if (!NATIVE) return;
  const theme = S.settings.theme;
  const light = themeMode() === 'light';
  try { window.AndroidBridge.setLightSystemBars(!!light); } catch {}
}
let nativeSeq = 0;
const nativeCalls = new Map();

window.wlNativeResult = (id, ok, data, error) => {
  const call = nativeCalls.get(id);
  if (!call) return;
  nativeCalls.delete(id);
  clearTimeout(call.timer);
  if (!ok) {
    call.reject(new Error(error || 'The phone could not complete that request'));
    return;
  }
  if (data == null || data === '') { call.resolve(null); return; }
  try { call.resolve(typeof data === 'string' ? JSON.parse(data) : data); }
  catch { call.reject(new Error('The phone returned an invalid response')); }
};

function nativeCall(method, path, body) {
  return new Promise((resolve, reject) => {
    if (!NATIVE) { reject(new Error('Native bridge is unavailable')); return; }
    const id = String(++nativeSeq);
    const timer = setTimeout(() => {
      if (!nativeCalls.has(id)) return;
      nativeCalls.delete(id);
      reject(new Error('The phone took too long to answer'));
    }, 90000);
    nativeCalls.set(id, { resolve, reject, timer });
    try { window.AndroidBridge.request(id, method, path, body || ''); }
    catch (e) {
      clearTimeout(timer);
      nativeCalls.delete(id);
      reject(e);
    }
  });
}

const api = async (url, o = {}) => {
  if (NATIVE && String(url).startsWith('/api/')) {
    const body = o.json !== undefined ? JSON.stringify(o.json) : o.body;
    if (body != null && typeof body !== 'string') throw new Error('That upload is not supported on the phone yet');
    return nativeCall(o.method || (body !== undefined ? 'POST' : 'GET'), url, body || '');
  }
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
  star: P('<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>'),
  sparkles: P('<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path d="M5 14l.6 1.7L7.3 16l-1.7.6L5 18.3l-.6-1.7L2.7 16l1.7-.3z"/>'),
  moon: P('<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z"/>'),
  sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  flame: P('<path d="M12 22c4.4 0 7-2.7 7-6.5 0-3-1.7-5.3-3.6-7.3-.9 1.3-1.7 2.1-2.6 2.5.2-3.2-1.2-6-3.8-8.2.1 3.5-1.3 5.8-2.9 7.7C4.7 11.9 4 13.5 4 15.5 4 19.3 7.6 22 12 22z"/>'),
  wave: P('<path d="M2 12c2.2 0 2.2-5 4.4-5s2.2 10 4.4 10 2.2-10 4.4-10 2.2 5 4.4 5h2.4"/>'),
  disc: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M7 7.5a7 7 0 0 0 0 9M17 16.5a7 7 0 0 0 0-9"/>'),
  cassette: P('<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="8" cy="12" r="2.5"/><circle cx="16" cy="12" r="2.5"/><path d="M7 19l1.5-2h7L17 19"/>'),
  headphones: P('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v7H5a1 1 0 0 1-1-1zM20 14h-3v7h2a1 1 0 0 0 1-1z"/>'),
  coffee: P('<path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M6 3v2M10 3v2M14 3v2"/>'),
  car: P('<path d="m5 11 1.5-4h11L19 11"/><path d="M3 12h18v6H3z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M6 11h12"/>'),
  gamepad: P('<path d="M7 8h10a5 5 0 0 1 4.4 7.4l-.9 1.6a2.4 2.4 0 0 1-4 .3L14.8 15H9.2l-1.7 2.3a2.4 2.4 0 0 1-4-.3l-.9-1.6A5 5 0 0 1 7 8z"/><path d="M7 11v3M5.5 12.5h3M16.5 11.5h.01M18.5 13.5h.01"/>'),
  book: P('<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2zM20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z"/>'),
  rocket: P('<path d="M14 5c2.5-2.5 5-2.5 5-2.5S19 5 16.5 7.5L9 15l-3-3z"/><path d="M6 12 3 15l1.5 1.5L7 14M9 15l1.5 1.5L9 19M6 18h3v3H6z"/><circle cx="15.5" cy="7.5" r="1.5"/>'),
  planet: P('<circle cx="12" cy="12" r="6"/><path d="M3.5 15.5c2.5 3 13.5 2 17-1M4.5 8.5c2-3.5 13-4.5 16-1"/>'),
  flower: P('<circle cx="12" cy="12" r="2.3"/><path d="M12 9.7c-1.2-2.8-.6-5.7 1.5-6.7 1.7 1.3 1.6 4.2.7 6.3M14.3 12c2.8-1.2 5.7-.6 6.7 1.5-1.3 1.7-4.2 1.6-6.3.7M12 14.3c1.2 2.8.6 5.7-1.5 6.7-1.7-1.3-1.6-4.2-.7-6.3M9.7 12c-2.8 1.2-5.7.6-6.7-1.5 1.3-1.7 4.2-1.6 6.3-.7"/>'),
  bolt: P('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  target: P('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>'),
  crown: P('<path d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 12H5z"/><path d="M5 19h14"/>'),
  pin: P('<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>'),
  keyboard: P('<rect x="2" y="6" width="20" height="12" rx="3"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>'),
  copy: P('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
  link: P('<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1-1"/>'),
  search2: P('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  mix: P('<path d="M4 7h4l8 10h4"/><path d="m17 14 3 3-3 3"/><path d="M4 17h4l2-2.5"/><path d="m17 4 3 3-3 3"/><path d="M13 9.5 15 7h1"/>'),
  clock: P('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>'),
  block: P('<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>'),
  check: P('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  edit: P('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>'),
  user: P('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  grip: P('<circle cx="9" cy="6" r="1.1"/><circle cx="15" cy="6" r="1.1"/><circle cx="9" cy="12" r="1.1"/><circle cx="15" cy="12" r="1.1"/><circle cx="9" cy="18" r="1.1"/><circle cx="15" cy="18" r="1.1"/>'),
};
const GENRES = ['Pop', 'Hip-Hop', 'Rock', 'Electronic', 'Lo-Fi', 'Jazz', 'R&B', 'Indie', 'Metal', 'K-Pop', 'Latin', 'Afrobeats', 'Classical', 'Country'];
const RECENT_SEARCH_KEY = 'wl-recent-searches';
function recentSearches() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
    return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, 6) : [];
  } catch { return []; }
}
function rememberSearch(q) {
  const term = String(q || '').trim();
  if (!term) return;
  try {
    const next = [term, ...recentSearches().filter(x => x.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  } catch {}
}

/* ═════════ state ═════════ */
const DEF = { playlists: [], liked: [], history: [], overrides: {}, listening: { v: 1, devices: {} }, settings: { theme: 'dark', style: 'nothing', accent: null, viz: true, vizStyle: 'matrix', vizSize: 'md', vizSizePrev: 'md', lockVisualizer: true, autoplay: true, gapless: true, resume: true, motion: 'system', readSize: 'default', contrast: false, sleepUntil: 0, quality: 192, streamQuality: 'best', volume: 0.8, smartVolume: false, noAi: false, blockedArtists: [], skipCredits: false, skipIntro: 'off', skipOutro: 'off', skipBreaks: 'off', skipSure: 'balanced', skipCrowd: true, skipSilence: true, skipMemory: {}, scrollbar: 'pill', navPos: 'left', dockPos: 'bottom', contentWidth: 'full', dotBg: false, dotOpacity: 22, dotScale: 22, customCss: '', syncOnOpen: false, syncDaily: false, syncControl: false, syncLast: 0, lockLayout: 'art', lockTheme: 'accent', lockControls: true, lockHide: 9, lockHint: true, pinned: [], perf: 'auto', realViz: false, off: [], setupDone: false, vizHidden: [], discord: false, discordId: '', lyrics: true, headphonesPause: true, plSort: 'added', plView: 'list', swipeRows: true, speed: 1 } };

/* ── Pinned playlists: quick access in the sidebar, on Home, with Alt+1..9 and Android launcher shortcuts ── */
const pinnedPls = () => (Array.isArray(S.settings.pinned) ? S.settings.pinned : []).map(id => S.playlists.find(p => p.id === id)).filter(Boolean);
const isPinned = id => (S.settings.pinned || []).includes(id);
function togglePin(id) {
  const a = Array.isArray(S.settings.pinned) ? S.settings.pinned.filter(x => S.playlists.some(p => p.id === x)) : [];
  const i = a.indexOf(id);
  if (i >= 0) a.splice(i, 1); else { if (a.length >= 9) return toast('You can pin up to 9 playlists'); a.push(id); }
  S.settings.pinned = a; save(); drawSide(); syncShortcuts();
  if (curRoute === 'home' || curRoute === 'playlist') draw();
  toast(i >= 0 ? 'Unpinned' : 'Pinned for quick access');
}
function syncShortcuts() {
  if (!NATIVE) return;
  try { window.AndroidBridge.setShortcuts(JSON.stringify(pinnedPls().slice(0, 3).map(p => ({ id: p.id, name: p.name })))); } catch {}
}
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey || !/^[1-9]$/.test(e.key) || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) return;
  const p = pinnedPls()[+e.key - 1]; if (p) { e.preventDefault(); location.hash = '#playlist/' + p.id; }
});

/* ── Automatic sync, cross-device control and the sync folder ── */
const tgl = (k, l, sub) => `<div class="line"><div><div class="l">${l}</div><div class="s">${sub}</div></div><button class="tg${S.settings[k] ? ' on' : ''}" data-act="tg" data-k="${k}" aria-label="${l}"></button></div>`;
const DEVICE_ID = (() => { try { let v = localStorage.getItem('wl-device'); if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('wl-device', v); } return v; } catch { return 'dev' + Math.random().toString(36).slice(2, 8); } })();
const remoteDeviceName = () => NATIVE ? 'Android phone' : /Mac/.test(navigator.platform) ? 'Mac' : /Win/.test(navigator.platform) ? 'Windows PC' : 'Linux PC';
let remoteBusy = false;
async function autoSync() {
  if (!R.sync || R.sync.role !== 'guest' || R.autoSyncing) return;
  R.autoSyncing = true;
  try {
    await api('/api/sync/merge', { method: 'POST', json: {} });
    await refreshLibraryState();
    R.sync = await api('/api/sync/status');
    S.settings.syncLast = Date.now(); save(); syncPaint();
  } catch {}
  R.autoSyncing = false;
}
function syncAutoCheck(opening) {
  if (!R.sync || R.sync.role !== 'guest') return;
  if (opening && S.settings.syncOnOpen) return autoSync();
  if (S.settings.syncDaily && Date.now() - (+S.settings.syncLast || 0) > 864e5) return autoSync();
}
setInterval(() => syncAutoCheck(false), 36e5);
const npSnapshot = () => R.cur ? { title: R.cur.title || '', artist: R.cur.artist || '', art: /^https?:/.test(R.cur.art || '') ? R.cur.art : '', playing: !!R.playing, pos: Math.round(audio.currentTime || 0), dur: Math.round(isFinite(audio.duration) ? audio.duration : (R.cur.duration || 0)) } : null;
async function remoteTick(cmd) {
  if (remoteBusy || !R.sync || R.sync.role === 'off') return;
  remoteBusy = true;
  try {
    const body = { id: DEVICE_ID, name: remoteDeviceName(), np: npSnapshot() }; if (cmd) body.cmd = cmd;
    const r = await api('/api/sync/remote', { method: 'POST', json: body });
    R.devices = (r && r.devices) || [];
    for (const c of (r && r.cmds) || []) runRemoteCmd(c);
  } catch { R.devices = []; }
  remoteBusy = false; paintDevices();
}
function runRemoteCmd(c) {
  if (c.cmd === 'toggle') togglePlay();
  else if (c.cmd === 'play') { if (audio.paused) togglePlay(); }
  else if (c.cmd === 'pause') { if (!audio.paused) togglePlay(); }
  else if (c.cmd === 'next') next();
  else if (c.cmd === 'prev') prev();
  else if (c.cmd === 'seek') audio.currentTime = Math.max(0, +c.arg || 0);
  else if (c.cmd === 'like' && R.cur) toggleLike(R.cur);
}
setInterval(() => { if (S.settings.syncControl && !document.hidden) remoteTick(); }, 3000);
function remoteHTML() {
  if (!S.settings.syncControl) return '<p class="mut">Turn on “Control other devices” to see and control what your paired devices are playing.</p>';
  if (!R.sync || R.sync.role === 'off') return '<p class="mut">Pair this device above first.</p>';
  if (!R.devices.length) return '<p class="mut">No other device is online. Open Wavelength on another paired device.</p>';
  return `<div class="remote-list">${R.devices.map(d => {
    const n = d.np, on = n && n.playing;
    return `<div class="remote-dev"><div class="rd-i"><b>${esc(d.name)}</b><span>${n ? `${esc(n.title)}${n.artist ? ' · ' + esc(n.artist) : ''}` : 'Nothing playing'} · ${n ? (on ? 'Playing' : 'Paused') : 'Idle'}</span></div>
      <div class="rd-b"><button class="ib" data-act="remote" data-to="${esc(d.id)}" data-c="prev" aria-label="Previous">${I.prev}</button><button class="ib" data-act="remote" data-to="${esc(d.id)}" data-c="toggle" aria-label="Play or pause">${on ? I.pause || I.playS : I.playS}</button><button class="ib" data-act="remote" data-to="${esc(d.id)}" data-c="next" aria-label="Next">${I.next}</button></div></div>`;
  }).join('')}</div>`;
}
function paintDevices() { const b = $('#remote-box'); if (b) b.innerHTML = remoteHTML(); }
async function folderLoad() { if (NATIVE) return; try { R.folder = await api('/api/sync/folder'); } catch {} paintFolder(); }
function folderHTML() {
  const f = R.folder; if (!f) return '<p class="mut">Reading folder…</p>';
  return `<div class="line"><div><div class="l">Shared folder</div><div class="s">${f.dir ? `<span class="mono-break">${esc(f.dir)}</span>` : 'Pick a folder that Dropbox, Syncthing, iCloud or OneDrive already shares between your devices. Each device writes its own file there and merges the others, so sync works even when the other device is off.'}</div>${f.error ? `<div class="sync-error">${esc(f.error)}</div>` : ''}</div>
    <div class="inline" style="flex:1;justify-content:flex-end"><input class="inp" id="folder-dir" type="text" placeholder="/path/to/shared/folder" value="${esc(f.dir || '')}" aria-label="Sync folder path"><button class="btn" data-act="folder-set">${f.dir ? 'Change' : 'Use folder'}</button></div></div>
    ${f.dir ? `<div class="line"><div><div class="l">${plural(f.files.length, 'device file')} in the folder</div><div class="s">${f.files.map(x => esc(x.name) + (x.me ? ' (this device)' : '')).join(', ') || 'None yet'}</div></div><div class="acts"><button class="btn" data-act="folder-merge">Merge now</button><button class="btn dng" data-act="folder-clear">Stop</button></div></div>` : ''}`;
}
function paintFolder() { const b = $('#folder-box'); if (b) b.innerHTML = folderHTML(); }
function syncExtras() {
  return `<div class="sync-groups">
    <details class="sg" open><summary>Automatic sync</summary>
      ${tgl('syncOnOpen', 'Sync when Wavelength opens', 'Merges with the host each time the app starts. Additive: nothing is removed.')}
      ${tgl('syncDaily', 'Daily sync', `Merges once a day while the app is open. ${S.settings.syncLast ? 'Last automatic sync ' + esc(new Date(S.settings.syncLast).toLocaleString()) + '.' : 'Has not run yet.'}`)}
      ${S.settings.syncOnOpen || S.settings.syncDaily ? '<p class="meta sync-note">Automatic sync only works while paired as a guest. Listening recap statistics are merged per device along with your library.</p>' : ''}
    </details>
    <details class="sg"><summary>Control other devices</summary>
      ${tgl('syncControl', 'Control other devices', 'See what your paired devices are playing and send play, pause, next and previous. Devices report through the host while the app is open.')}
      <div id="remote-box">${remoteHTML()}</div>
    </details>
    ${NATIVE ? '' : `<details class="sg"><summary>Sync folder · works with devices off</summary><div id="folder-box">${folderHTML()}</div></details>`}
  </div>`;
}

/* ── Optional features ── Switching one off hides its controls and stops its work. */
const FEATURES = [
  ['viz', 'Visualizer', 'Animated visuals in the full-screen player.'],
  ['lyrics', 'Lyrics', 'Synced lyrics from LRCLIB.'],
  ['skipper', 'Intro and outro skipper', 'Skips intros, outros and spoken breaks.'],
  ['recap', 'Listening recap', 'Stats by year, month or custom dates.'],
  ['import', 'Spotify import', 'Bring in playlists, albums and song lists.'],
  ['downloads', 'Downloads', 'MP3 downloads and local files.'],
  ['editor', 'Song editor', 'Change a song’s title, artist and artwork.'],
  ['sync', 'Device sync', 'Keep your library in step across devices.'],
];
const featOn = k => !(S.settings.off || []).includes(k);
const FEAT_SETTING_MAP = { viz: ['viz', 'lockVisualizer', 'vizSize', 'viz-gallery', 'viz-vis'], lyrics: ['lyrics'], skipper: ['skipIntro', 'skipOutro', 'skipBreaks', 'skipSure', 'skipCrowd', 'skipSilence', 'skip-forget'], editor: [], downloads: ['quality'] };
function hideOffSettings() {
  if (!$('#set-playback')) return;
  for (const [f, keys] of Object.entries(FEAT_SETTING_MAP)) {
    const off = !featOn(f);
    for (const k of keys) $$(`[data-k="${k}"],[data-set="${k}"],[data-act="${k}"]`).forEach(el => { const l = el.closest('.line'); if (l) l.hidden = off; });
  }
}
function applyFeatures() {
  const valid = new Set(FEATURES.map(f => f[0]));
  S.settings.off = (Array.isArray(S.settings.off) ? S.settings.off : []).filter(k => valid.has(k));
  document.documentElement.dataset.off = S.settings.off.join(' ');
  if (!featOn('lyrics') && R.lyr && R.lyr.on) lyricsToggle(false);
  if (!featOn('skipper')) { hideSkipChip(); R.skip = null; }
  vizSync(); syncNativePrefs(); hideOffSettings();
}
let featDraft = new Set();
function featureSetup() {
  featDraft = new Set(S.settings.off || []);
  modal(`<h2>Make Wavelength yours</h2><p class="mut">Choose what you want. Anything you switch off is hidden and stops running, which saves memory and battery. Bring it all back any time in Settings → Features.</p>
    <div class="feat-list">${FEATURES.map(([k, n, d]) => `<button class="feat${featDraft.has(k) ? '' : ' on'}" data-act="feat-pick" data-k="${k}" aria-pressed="${!featDraft.has(k)}"><span class="feat-c"></span><span><b>${esc(n)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>
    <div class="acts end"><button class="btn" data-act="feat-all">Keep everything</button><button class="btn solid" data-act="feat-done">Continue</button></div>`, 'feat-sheet');
}
const vizHiddenList = () => Array.isArray(S.settings.vizHidden) ? S.settings.vizHidden.filter(i => WLViz.has(i)) : [];
const vizVisible = () => WLViz.styles.filter(x => !vizHiddenList().includes(x.id));
let S = structuredClone(DEF);
const R = { queue: [], idx: -1, cur: null, playing: false, shuffle: false, shuffleOrder: [], shufflePos: -1, repeat: 0, muted: false, results: [], sTok: 0, health: null, stats: null, sp: undefined, dls: [], local: [], localReady: false, localLoading: false, localError: '', localFolder: '', seeking: false, sleepT: 0, sleepTick: 0, listPreviewT: 0, sync: null, playCtx: '', viewList: null, recapYear: new Date().getFullYear(), recapFrom: '', recapTo: '', infoCache: {}, credits: null, creditDone: '', listenTick: 0, normGain: 1, normReady: 0, remix: null };
R.devices = []; R.folder = null;
let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => api('/api/state', { method: 'PUT', json: S }).catch(() => {}), 400); };
let toastT;
const toast = (m, undo) => {
  const t = $('#toast');
  t.textContent = m;
  R.undo = typeof undo === 'function' ? undo : null;
  t.classList.toggle('has-undo', !!R.undo);
  if (R.undo) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'toast-undo'; b.dataset.act = 'toast-undo'; b.textContent = 'Undo';
    t.appendChild(b);
  }
  t.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => { t.classList.remove('show'); R.undo = null; }, R.undo ? 7000 : 2800);
};
/* Destructive actions apply immediately and can be taken back for a few
   seconds. `commit` runs once the window closes (for example, deleting an
   uploaded cover file that an undo would still need). */
function flushUndo(only) {
  const rec = R.undoRec;
  if (!rec || (only && rec !== only)) return;
  clearTimeout(rec.timer); R.undoRec = null;
  if (!rec.done) { rec.done = true; if (rec.commit) rec.commit(); }
}
function undoable(msg, undo, commit) {
  flushUndo();
  const rec = { done: false, commit, timer: 0 };
  R.undoRec = rec;
  toast(msg, () => {
    if (rec.done) return;
    rec.done = true; clearTimeout(rec.timer); R.undoRec = null;
    undo();
  });
  rec.timer = setTimeout(() => flushUndo(rec), 7200);
}
function runUndo() {
  const u = R.undo; if (!u) return false;
  R.undo = null; $('#toast').classList.remove('show'); u();
  return true;
}

/* ═════════ device identity & listening stats ═════════ */
/* Listening time is counted on the device that actually played the song, then
   merged by device id during sync. That avoids double-counting when the same
   track exists in several libraries. */
const DEVICE_KEY = 'wl-device-id';
function deviceId() {
  let id = '';
  try { id = localStorage.getItem(DEVICE_KEY) || ''; } catch {}
  if (!id) {
    id = 'dev-' + rid() + rid();
    try { localStorage.setItem(DEVICE_KEY, id); } catch {}
  }
  return id;
}
function deviceName() {
  if (NATIVE) return 'Android';
  const p = navigator.userAgentData && navigator.userAgentData.platform;
  if (p) return p;
  if (/Mac/i.test(navigator.platform || '')) return 'Mac';
  if (/Win/i.test(navigator.platform || '')) return 'Windows';
  if (/Linux/i.test(navigator.platform || '')) return 'Linux';
  return 'Browser';
}
const yearStr = (d = new Date()) => String(d.getFullYear());
const dayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function listenDevice() {
  if (!S.listening || typeof S.listening !== 'object') S.listening = { v: 1, devices: {} };
  if (!S.listening.devices || typeof S.listening.devices !== 'object') S.listening.devices = {};
  const id = deviceId();
  let d = S.listening.devices[id];
  if (!d || typeof d !== 'object') d = S.listening.devices[id] = { name: deviceName(), updatedAt: Date.now(), days: {}, years: {} };
  if (!d.days || typeof d.days !== 'object') d.days = {};
  if (!d.years || typeof d.years !== 'object') d.years = {};
  d.name = deviceName();
  return d;
}
function yearBucket(d, y) {
  if (!d.years[y]) d.years[y] = { seconds: 0, tracks: {}, playlists: {}, artists: {} };
  const b = d.years[y];
  for (const k of ['tracks', 'playlists', 'artists']) if (!b[k] || typeof b[k] !== 'object') b[k] = {};
  if (!+b.seconds) b.seconds = 0;
  return b;
}
/* Daily detail makes arbitrary date ranges possible. It is stored compactly as
   [seconds, plays] pairs so a busy year does not balloon the library file. */
function dayBucket(d, day) {
  if (!d.daily || typeof d.daily !== 'object') d.daily = {};
  let b = d.daily[day];
  if (!b || typeof b !== 'object') b = d.daily[day] = {};
  for (const k of ['t', 'a', 'p']) if (!b[k] || typeof b[k] !== 'object') b[k] = {};
  return b;
}
function bumpStat(map, key, sec, plays) {
  const a = Array.isArray(map[key]) ? map[key] : (map[key] = [0, 0]);
  a[0] = (+a[0] || 0) + (+sec || 0);
  a[1] = (+a[1] || 0) + (+plays || 0);
  return a;
}
function bumpDay(d, day, pool, key, sec, plays) {
  const b = dayBucket(d, day);
  bumpStat(b[pool], key, sec, plays);
}
function countListen(sec = 1) {
  if (!R.cur || !sec) return;
  const d = listenDevice(), now = new Date(), day = dayStr(now), y = yearStr(now), b = yearBucket(d, y);
  d.updatedAt = Date.now();
  d.days[day] = (+d.days[day] || 0) + sec;
  b.seconds += sec;
  const k = uid(R.cur);
  const t = b.tracks[k] || (b.tracks[k] = { title: R.cur.title || 'Untitled', artist: R.cur.artist || '', art: R.cur.art || '', seconds: 0, plays: 0 });
  t.seconds = (+t.seconds || 0) + sec;
  t.title = R.cur.title || t.title; t.artist = R.cur.artist || t.artist; t.art = R.cur.art || t.art;
  bumpDay(d, day, 't', k, sec, 0);
  const an = (R.cur.artist || 'Unknown artist').trim() || 'Unknown artist';
  const a = b.artists[an] || (b.artists[an] = { seconds: 0, plays: 0 });
  a.seconds = (+a.seconds || 0) + sec;
  bumpDay(d, day, 'a', an, sec, 0);
  if (R.playCtx) {
    const p = b.playlists[R.playCtx] || (b.playlists[R.playCtx] = { seconds: 0, plays: 0 });
    p.seconds = (+p.seconds || 0) + sec;
    bumpDay(d, day, 'p', R.playCtx, sec, 0);
  }
}
function countPlay() {
  if (!R.cur) return;
  const d = listenDevice(), now = new Date(), day = dayStr(now), b = yearBucket(d, yearStr(now));
  d.updatedAt = Date.now();
  const k = uid(R.cur);
  const t = b.tracks[k] || (b.tracks[k] = { title: R.cur.title || 'Untitled', artist: R.cur.artist || '', art: R.cur.art || '', seconds: 0, plays: 0 });
  t.plays = (+t.plays || 0) + 1;
  t.title = R.cur.title || t.title; t.artist = R.cur.artist || t.artist; t.art = R.cur.art || t.art;
  bumpDay(d, day, 't', k, 0, 1);
  const an = (R.cur.artist || 'Unknown artist').trim() || 'Unknown artist';
  const a = b.artists[an] || (b.artists[an] = { seconds: 0, plays: 0 });
  a.plays = (+a.plays || 0) + 1;
  bumpDay(d, day, 'a', an, 0, 1);
  if (R.playCtx) {
    const p = b.playlists[R.playCtx] || (b.playlists[R.playCtx] = { seconds: 0, plays: 0 });
    p.plays = (+p.plays || 0) + 1;
    bumpDay(d, day, 'p', R.playCtx, 0, 1);
  }
}
function startListening() {
  clearInterval(R.listenTick);
  R.listenTick = setInterval(() => {
    if (!R.playing || audio.paused || document.hidden) return;
    countListen(1);
    R.listenDirty = true;
    if (!R.listenSaved || Date.now() - R.listenSaved > 12000) { R.listenSaved = Date.now(); save(); }
  }, 1000);
}
function flushListening() {
  clearInterval(R.listenTick); R.listenTick = 0;
  if (R.listenDirty) { R.listenDirty = false; api('/api/state', { method: 'PUT', json: S }).catch(() => {}); }
}
const ctxName = c => {
  if (!c) return '';
  if (c === 'liked') return 'Liked Songs';
  if (c === 'history') return 'History';
  if (c === 'local') return 'Local files';
  if (c === 'search') return 'Search';
  if (c === 'queue') return 'Queue';
  const p = S.playlists.find(x => x.id === c);
  return p ? p.name : '';
};
/* A recap can cover a whole year or any start/end date. Year buckets are
   accurate for complete years (including libraries recorded before daily stats
   existed); daily detail fills in the edges of a custom range. */
function parseRecapRange(arg) {
  const raw = String(arg || '');
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})~(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    let from = `${m[1]}-${m[2]}-${m[3]}`, to = `${m[4]}-${m[5]}-${m[6]}`;
    if (from > to) [from, to] = [to, from];
    return { from, to };
  }
  const y = /^\d{4}$/.test(raw) ? raw : String(new Date().getFullYear());
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
function wholeYearsIn(from, to) {
  const out = [];
  const first = +from.slice(0, 4), last = +to.slice(0, 4);
  for (let y = first; y <= last; y++) {
    const year = String(y);
    if (from <= `${year}-01-01` && to >= `${year}-12-31`) out.push(year);
  }
  return out;
}
const dayLabel = key => {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
function recapData(from, to) {
  const out = { from, to, seconds: 0, plays: 0, tracks: {}, artists: {}, playlists: {}, days: {}, devices: 0, detailed: false };
  const devices = Object.values((S.listening && S.listening.devices) || {});
  const whole = wholeYearsIn(from, to);
  const wholeSet = new Set(whole);
  out.partial = !(whole.length && from === `${whole[0]}-01-01` && to === `${whole[whole.length - 1]}-12-31`);

  // Song metadata lives in year buckets and the library. Build it first so a
  // daily [seconds, plays] pair can still show a title and cover.
  const meta = new Map();
  const addMeta = t => { const k = t && uid(t); if (k && !meta.has(k)) meta.set(k, t); };
  S.liked.forEach(addMeta);
  S.playlists.forEach(p => (p.tracks || []).forEach(addMeta));
  for (const d of devices) {
    if (!d || typeof d !== 'object') continue;
    for (const b of Object.values(d.years || {})) {
      if (!b || typeof b !== 'object') continue;
      for (const [k, t] of Object.entries(b.tracks || {})) if (!meta.has(k)) meta.set(k, t);
    }
  }

  const addTrack = (key, t, sec, plays) => {
    const x = out.tracks[key] || (out.tracks[key] = {
      title: (t && t.title) || 'Untitled', artist: (t && t.artist) || '', art: (t && t.art) || '', seconds: 0, plays: 0
    });
    x.seconds += +sec || 0; x.plays += +plays || 0;
    if (t && t.art) x.art = t.art;
  };
  const addNamed = (kind, name, sec, plays) => {
    const x = out[kind][name] || (out[kind][name] = { seconds: 0, plays: 0 });
    x.seconds += +sec || 0; x.plays += +plays || 0;
  };

  for (const d of devices) {
    if (!d || typeof d !== 'object') continue;
    let used = false;
    for (const [day, sec] of Object.entries(d.days || {})) {
      if (day >= from && day <= to) {
        out.days[day] = (+out.days[day] || 0) + (+sec || 0);
        out.seconds += +sec || 0;
        used = true;
      }
    }
    for (const [y, b] of Object.entries(d.years || {})) {
      if (!b || typeof b !== 'object' || !wholeSet.has(y)) continue;
      used = true;
      for (const [k, t] of Object.entries(b.tracks || {})) addTrack(k, t, t.seconds, t.plays);
      for (const [name, a] of Object.entries(b.artists || {})) addNamed('artists', name, a.seconds, a.plays);
      for (const [name, p] of Object.entries(b.playlists || {})) addNamed('playlists', name, p.seconds, p.plays);
    }
    for (const [day, b] of Object.entries(d.daily || {})) {
      if (day < from || day > to || wholeSet.has(day.slice(0, 4)) || !b || typeof b !== 'object') continue;
      for (const [k, arr] of Object.entries(b.t || {})) {
        if (!Array.isArray(arr)) continue;
        addTrack(k, meta.get(k) || {}, arr[0], arr[1]);
        out.detailed = true;
      }
      for (const [name, arr] of Object.entries(b.a || {})) if (Array.isArray(arr)) { addNamed('artists', name, arr[0], arr[1]); out.detailed = true; }
      for (const [name, arr] of Object.entries(b.p || {})) if (Array.isArray(arr)) { addNamed('playlists', name, arr[0], arr[1]); out.detailed = true; }
    }
    if (used) out.devices++;
  }
  out.plays = Object.values(out.tracks).reduce((n, t) => n + (+t.plays || 0), 0);
  out.topTracks = Object.entries(out.tracks).map(([k, t]) => ({ key: k, ...t })).sort((a, b) => b.seconds - a.seconds).slice(0, 10);
  out.topArtists = Object.entries(out.artists).map(([name, a]) => ({ name, ...a })).sort((a, b) => b.seconds - a.seconds).slice(0, 6);
  out.topPlaylists = Object.entries(out.playlists).map(([name, p]) => ({ name, ...p })).sort((a, b) => b.seconds - a.seconds).slice(0, 6);
  return out;
}
const recapYears = () => {
  const set = new Set([new Date().getFullYear(), new Date().getFullYear() - 1]);
  for (const d of Object.values((S.listening && S.listening.devices) || {})) for (const y of Object.keys((d && d.years) || {})) set.add(+y);
  return [...set].filter(y => Number.isFinite(y)).sort((a, b) => b - a);
};

/* ═════════ No AI + artist blocking (best-effort text matching) ═════════ */
/* There is no reliable way to detect AI music from YouTube metadata. This is
   deliberately a conservative keyword filter, not a classifier. */
const AI_RE = /(?:\bA\.?I\.?\b|artificial intelligence|\bai[- ]?(?:generated|powered|cover|version|vocals?|music|song|artist|remix)\b|\b(?:generated|made) (?:by|with) ai\b|\bsuno\b|\budio\b|\brvc\b|deepfake|voice ?clone|neural (?:network|vocals?)|\bllm\b|chatgpt)/i;
const looksAI = t => !!t && AI_RE.test([t.title, t.artist, t.album].filter(Boolean).join(' '));
const normArtist = s => String(s || '').toLowerCase().replace(/\s*-\s*topic$/, '').replace(/\s+/g, ' ').trim();
function isBlocked(t) {
  const a = normArtist(t && t.artist);
  if (!a) return false;
  return (S.settings.blockedArtists || []).some(b => { const n = normArtist(b); return n && (a === n || a.startsWith(n + ' ') || a.startsWith(n + ',') || a.includes(' feat ' + n)); });
}
const allowed = t => !(S.settings.noAi && looksAI(t)) && !isBlocked(t);
const filterAllowed = list => ovApply(list.filter(allowed));

/* ═════════ theming ═════════ */
/* Official Catppuccin palettes. The four flavours are complete themes;
   their 14 accent colours are also exposed as swatches. */
const CTP = {
  latte: {
    name: 'Latte', mode: 'light', bg: '#eff1f5', card: '#e6e9ef', surface: '#ccd0da', text: '#4c4f69',
    accents: { rosewater: '#dc8a78', flamingo: '#dd7878', pink: '#ea76cb', mauve: '#8839ef', red: '#d20f39', maroon: '#e64553', peach: '#fe640b', yellow: '#df8e1d', green: '#40a02b', teal: '#179299', sky: '#04a5e5', sapphire: '#209fb5', blue: '#1e66f5', lavender: '#7287fd' }
  },
  frappe: {
    name: 'Frappé', mode: 'dark', bg: '#303446', card: '#292c3c', surface: '#414559', text: '#c6d0f5',
    accents: { rosewater: '#f2d5cf', flamingo: '#eebebe', pink: '#f4b8e4', mauve: '#ca9ee6', red: '#e78284', maroon: '#ea999c', peach: '#ef9f76', yellow: '#e5c890', green: '#a6d189', teal: '#81c8be', sky: '#99d1db', sapphire: '#85c1dc', blue: '#8caaee', lavender: '#babbf1' }
  },
  macchiato: {
    name: 'Macchiato', mode: 'dark', bg: '#24273a', card: '#1e2030', surface: '#363a4f', text: '#cad3f5',
    accents: { rosewater: '#f4dbd6', flamingo: '#f0c6c6', pink: '#f5bde6', mauve: '#c6a0f6', red: '#ed8796', maroon: '#ee99a0', peach: '#f5a97f', yellow: '#eed49f', green: '#a6da95', teal: '#8bd5ca', sky: '#91d7e3', sapphire: '#7dc4e4', blue: '#8aadf4', lavender: '#b7bdf8' }
  },
  mocha: {
    name: 'Mocha', mode: 'dark', bg: '#1e1e2e', card: '#181825', surface: '#313244', text: '#cdd6f4',
    accents: { rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7', mauve: '#cba6f7', red: '#f38ba8', maroon: '#eba0ac', peach: '#fab387', yellow: '#f9e2af', green: '#a6e3a1', teal: '#94e2d5', sky: '#89dceb', sapphire: '#74c7ec', blue: '#89b4fa', lavender: '#b4befe' }
  }
};
const ACCENT_ORDER = ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender'];
/* The theme owns the palette. Interface styles only change shape and layout,
   so switching styles never changes a single colour. */
const THEME_ACCENTS = { dark: '#d71921', light: '#d71921', auto: '#d71921', rose: '#f43f5e', amber: '#f59e0b', teal: '#14b8a6', sky: '#0ea5e9', violet: '#8b5cf6', lime: '#84cc16', slate: '#94a3b8' };
const STYLES = ['nothing', 'classic', 'win11', 'macos', 'glass', 'gnome', 'kde', 'oneui'];
const STYLE_INFO = {
  nothing: ['Nothing OS', 'Wavelength’s signature monochrome, dot-matrix look. Minimal and brand-first.'],
  classic: ['Classic', 'Familiar rounded music-app layout with bold headings. Easiest everyday option.'],
  win11: ['Windows 11', 'Fluent surfaces, tighter corners and desktop controls. Feels native on Windows.'],
  macos: ['macOS', 'Compact controls, translucent panels and SF-style type. Feels native on a Mac.'],
  glass: ['macOS Glass', 'Liquid-glass surfaces with blurred cards and stronger accent lighting. The most atmospheric option.'],
  gnome: ['Linux / GNOME', 'Soft cards, restrained accents and simple controls. Fits GNOME desktops.'],
  kde: ['KDE Plasma', 'Dense rows, square-ish corners and technical type. Compact and information-first.'],
  oneui: ['Samsung One UI', 'Large pill controls and generous touch targets. Best for phones and tablets.']
};
const autoLight = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
let autoWatcher = false;
function themeMode() {
  if (S.settings.theme === 'auto') return autoLight && autoLight.matches ? 'light' : 'dark';
  if (S.settings.theme === 'light' || S.settings.theme === 'latte') return 'light';
  const extra = WLThemes.byId[S.settings.theme];
  return extra ? extra.mode : 'dark';
}
const paletteFor = () => CTP[S.settings.theme] || CTP[themeMode() === 'light' ? 'latte' : 'mocha'];
const defAccent = () => {
  const ctp = CTP[S.settings.theme];
  if (ctp) return ctp.accents.mauve;
  if (WLThemes.byId[S.settings.theme]) return WLThemes.byId[S.settings.theme].accent;
  return THEME_ACCENTS[S.settings.theme] || THEME_ACCENTS.dark;
};
const hexRgb = value => {
  let h = String(value || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) h = '#' + h.slice(1).split('').map(c => c + c).join('');
  if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) };
};
const VC = { accent: '#d71921', dim: 'rgba(255,255,255,.17)' };
function cachePrefs() {
  try {
    const old = JSON.parse(localStorage.getItem('wl') || '{}');
    localStorage.setItem('wl', JSON.stringify({
      ...old, theme: S.settings.theme, style: S.settings.style,
      accent: S.settings.accent || '', read: S.settings.readSize || 'default',
      contrast: !!S.settings.contrast, motion: S.settings.motion || 'system',
      nav: S.settings.navPos || 'left', dock: S.settings.dockPos || 'bottom', cw: S.settings.contentWidth || 'full', sb: S.settings.scrollbar || 'pill'
    }));
  } catch {}
}
/* ═════════ layout ═════════
   Where things sit. Sidebar position, player position and content width are
   independent, so any combination works; the presets are just named combos.
   Only wide windows are affected: phones keep their own layout. */
const NAV_POS = [['left', 'Left'], ['right', 'Right'], ['top', 'Top bar'], ['rail', 'Slim rail'], ['none', 'Hidden']];
const DOCK_POS = [['bottom', 'Bottom'], ['top', 'Top'], ['float', 'Floating']];
const CONTENT_W = [['full', 'Full width'], ['centered', 'Centered']];
const LAYOUT_PRESETS = [
  { id: 'classic', name: 'Classic', nav: 'left', dock: 'bottom', cw: 'full', hint: 'Sidebar on the left, player along the bottom.' },
  { id: 'mirror', name: 'Mirrored', nav: 'right', dock: 'bottom', cw: 'full', hint: 'Sidebar on the right. The queue opens on the left.' },
  { id: 'topbar', name: 'Top bar', nav: 'top', dock: 'bottom', cw: 'full', hint: 'Navigation and playlists run across the top.' },
  { id: 'rail', name: 'Slim rail', nav: 'rail', dock: 'bottom', cw: 'full', hint: 'Icons only, so the music gets the room.' },
  { id: 'focus', name: 'Focus', nav: 'none', dock: 'bottom', cw: 'centered', hint: 'No sidebar. Navigate from the header, content centred.' },
  { id: 'playertop', name: 'Player on top', nav: 'left', dock: 'top', cw: 'full', hint: 'Controls up top, within easy reach.' },
  { id: 'float', name: 'Floating dock', nav: 'left', dock: 'float', cw: 'full', hint: 'A compact player floating over the content.' },
  { id: 'minimal', name: 'Minimal', nav: 'rail', dock: 'float', cw: 'centered', hint: 'Slim rail, floating player, centred content.' },
];
const pick = (list, v, d) => list.some(x => x[0] === v) ? v : d;
const layoutNow = () => ({
  nav: pick(NAV_POS, S.settings.navPos, 'left'),
  dock: pick(DOCK_POS, S.settings.dockPos, 'bottom'),
  cw: pick(CONTENT_W, S.settings.contentWidth, 'full'),
});
function applyLayout() {
  const L = layoutNow(), r = document.documentElement;
  r.dataset.nav = L.nav; r.dataset.dock = L.dock; r.dataset.cw = L.cw;
  // Highlights and sliding indicators measure the page, so measure again once it has moved.
  requestAnimationFrame(() => requestAnimationFrame(() => dispatchEvent(new Event('resize'))));
}
const layoutLabel = () => {
  const L = layoutNow(), hit = LAYOUT_PRESETS.find(p => p.nav === L.nav && p.dock === L.dock && p.cw === L.cw);
  return hit ? hit.name : 'Custom';
};
/* A tiny drawing of a layout, used for every preview. */
function layoutWire(nav, dock, cw) {
  const W = 160, H = 100, m = 5, ph = 12, gap = 4;
  let top = m, bot = H - m;
  const player = dock === 'top' ? { x: m, y: m, w: W - 2 * m, h: ph }
    : dock === 'float' ? { x: 38, y: H - m - ph, w: W - 76, h: ph }
    : { x: m, y: H - m - ph, w: W - 2 * m, h: ph };
  if (dock === 'top') top = m + ph + gap; else if (dock === 'bottom') bot = H - m - ph - gap;
  const h = bot - top;
  let side = null, mx = m, mw = W - 2 * m, my = top, mh = h;
  if (nav === 'left') { side = { x: m, y: top, w: 34, h }; mx = m + 34 + gap; mw = W - 2 * m - 34 - gap; }
  else if (nav === 'right') { side = { x: W - m - 34, y: top, w: 34, h }; mw = W - 2 * m - 34 - gap; }
  else if (nav === 'rail') { side = { x: m, y: top, w: 12, h }; mx = m + 12 + gap; mw = W - 2 * m - 12 - gap; }
  else if (nav === 'top') { side = { x: m, y: top, w: W - 2 * m, h: 13 }; my = top + 13 + gap; mh = h - 13 - gap; }
  const r = (o, c, rx = 3) => `<rect class="${c}" x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="${rx}"/>`;
  let out = `<rect class="wf-win" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="6"/>`;
  if (side) {
    out += r(side, 'wf-side');
    if (nav === 'top') for (let i = 0; i < 5; i++) out += `<rect class="wf-ink" x="${side.x + 6 + i * 13}" y="${side.y + 5}" width="9" height="3" rx="1.5"/>`;
    else if (nav === 'rail') for (let i = 0; i < 4; i++) out += `<circle class="wf-ink" cx="${side.x + 6}" cy="${side.y + 9 + i * 9}" r="2.2"/>`;
    else for (let i = 0; i < 5; i++) out += `<rect class="wf-ink" x="${side.x + 5}" y="${side.y + 7 + i * 7}" width="${i < 3 ? 22 : 16}" height="3" rx="1.5"/>`;
  }
  out += r({ x: mx, y: my, w: mw, h: mh }, 'wf-main');
  const cwid = cw === 'centered' ? mw * 0.56 : mw - 12, cx = mx + (mw - cwid) / 2;
  if (nav === 'none') for (let i = 0; i < 4; i++) out += `<circle class="wf-ink" cx="${mx + mw - 8 - i * 6}" cy="${my + 6}" r="1.8"/>`;
  out += `<rect class="wf-ink wf-dim" x="${cx}" y="${my + 5}" width="${cwid * 0.45}" height="3" rx="1.5"/>`;
  for (let i = 0; i < 4; i++) out += `<rect class="wf-line" x="${cx}" y="${my + 14 + i * 7}" width="${cwid}" height="4" rx="2"/>`;
  out += r(player, 'wf-play', 6);
  out += `<circle class="wf-dot" cx="${player.x + player.w / 2}" cy="${player.y + ph / 2}" r="2.4"/>`;
  return `<svg class="wire" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out}</svg>`;
}
function layoutGallery() {
  const L = layoutNow();
  const seg = (key, list, cur, label) => `<div class="lay-seg"><span class="lay-lbl">${label}</span><div class="chips" role="group" aria-label="${label}">${list.map(([v, l]) => `<button class="chip${v === cur ? ' on' : ''}" data-act="layout-set" data-k="${key}" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</div></div>`;
  modal(`<div class="eyebrow">Layout</div><h3 class="imp-title">Arrange the app</h3>
    <p class="mut">Pick a ready-made arrangement, or set each part yourself. It changes right away. Phones and narrow windows keep their own layout.</p>
    <div class="lay-gal" id="lay-gal">${LAYOUT_PRESETS.map(p => `<button class="lay-card${p.nav === L.nav && p.dock === L.dock && p.cw === L.cw ? ' on' : ''}" data-act="layout-pick" data-id="${p.id}" aria-pressed="${p.nav === L.nav && p.dock === L.dock && p.cw === L.cw}">${layoutWire(p.nav, p.dock, p.cw)}<span class="lc-n">${esc(p.name)}</span><span class="lc-h">${esc(p.hint)}</span></button>`).join('')}</div>
    <div class="lay-custom"><div class="lay-now"><span class="lay-lbl">Your layout</span><div id="lay-now">${layoutWire(L.nav, L.dock, L.cw)}</div></div>
      <div class="lay-opts">${seg('navPos', NAV_POS, L.nav, 'Sidebar')}${seg('dockPos', DOCK_POS, L.dock, 'Player')}${seg('contentWidth', CONTENT_W, L.cw, 'Content')}</div></div>
    <div class="acts end"><button class="btn" data-act="layout-reset">Reset to Classic</button><button class="btn solid" data-act="close-modal">Done</button></div>`, 'layout-sheet');
}
function layoutRefresh() {
  const L = layoutNow();
  $$('.lay-card').forEach(b => { const p = LAYOUT_PRESETS.find(x => x.id === b.dataset.id), on = p.nav === L.nav && p.dock === L.dock && p.cw === L.cw; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $$('.lay-seg .chip').forEach(c => { const key = c.dataset.k, cur = key === 'navPos' ? L.nav : key === 'dockPos' ? L.dock : L.cw, on = c.dataset.v === cur; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const now = $('#lay-now'); if (now) now.innerHTML = layoutWire(L.nav, L.dock, L.cw);
  const name = $('#layout-name'); if (name) name.textContent = layoutLabel();
}

/* ═════════ lyrics ═════════
   Looked up on demand from lrclib.net, a free lyrics database, only when the
   lyrics view is opened. Time-synced lyrics follow the song and a tapped line
   jumps to it; plain lyrics just scroll. */
const LRC_TAG = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
function parseLrc(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(LRC_TAG)]; if (!tags.length) continue;
    const body = raw.replace(LRC_TAG, '').trim();
    for (const m of tags) out.push({ t: (+m[1]) * 60 + (+m[2]) + (m[3] ? (+m[3]) / Math.pow(10, m[3].length) : 0), text: body });
  }
  return out.sort((a, b) => a.t - b.t);
}
/* "Artist - Song (Official Video) [HD]" -> "Song" */
function cleanSongTitle(title, artist) {
  let t = String(title || '')
    .replace(/[\(\[][^\)\]]*(official|video|audio|lyrics?|visuali[sz]er|remaster|hd|hq|4k|mv|clip|live|explicit)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+(ft\.?|feat\.?|featuring)\s+.*$/i, '').replace(/\s{2,}/g, ' ').trim();
  const a = normArtist(artist);
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(t);
  if (m && a && normArtist(m[1]).includes(a.split(',')[0])) t = m[2].trim();
  return t || String(title || '');
}
R.lyrCache = new Map();
async function lyricsFor(t) {
  const key = uid(t);
  if (R.lyrCache.has(key)) return R.lyrCache.get(key);
  const title = cleanSongTitle(t.title, t.artist), artist = String(t.artist || '').replace(/\s*-\s*topic$/i, '').split(',')[0].trim();
  const dur = Math.round((isFinite(audio.duration) && audio.duration && R.cur && uid(R.cur) === key ? audio.duration : +t.duration) || 0);
  const get = async url => {
    const ctl = new AbortController(), kill = setTimeout(() => ctl.abort(), 8000);
    try { return await fetch(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' }); } finally { clearTimeout(kill); }
  };
  const q = o => Object.entries(o).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  let hit = null;
  let r = await get('https://lrclib.net/api/get?' + q({ track_name: title, artist_name: artist, album_name: t.album, duration: dur }));
  if (r.ok) hit = await r.json();
  else if (r.status === 404) {
    // Fall back to a search and take the closest match by length.
    const sr = await get('https://lrclib.net/api/search?' + q({ track_name: title, artist_name: artist }));
    if (sr.ok) {
      const list = (await sr.json()).filter(x => x && (x.syncedLyrics || x.plainLyrics || x.instrumental));
      list.sort((a, b) => Math.abs((a.duration || 0) - dur) - Math.abs((b.duration || 0) - dur));
      if (list[0] && (!dur || Math.abs((list[0].duration || 0) - dur) <= 6)) hit = list[0];
    }
  } else throw new Error('status ' + r.status);
  const res = hit ? { synced: parseLrc(hit.syncedLyrics), plain: String(hit.plainLyrics || '').trim(), instrumental: !!hit.instrumental } : { synced: [], plain: '', instrumental: false };
  R.lyrCache.set(key, res);
  if (R.lyrCache.size > 80) R.lyrCache.delete(R.lyrCache.keys().next().value);
  return res;
}
R.lyr = { on: false, key: '', data: null, idx: -1, state: 'idle' };
function lyricsToggle(force) {
  const on = typeof force === 'boolean' ? force : !R.lyr.on;
  if (on && (S.settings.lyrics === false || !featOn('lyrics'))) return toast('Lyrics are turned off in Settings');
  R.lyr.on = on; $('#np').classList.toggle('lyr', on);
  const b = $('#b-lyr'); if (b) b.classList.toggle('on', on);
  if (on) lyricsLoad(); else lyricsStop();
}
async function lyricsLoad() {
  const t = R.cur, box = $('#np-lyrics'); if (!box) return;
  if (!t) { box.innerHTML = '<p class="lyr-msg">Play a song to see its lyrics.</p>'; return; }
  const key = uid(t); R.lyr.key = key; R.lyr.idx = -1; R.lyr.data = null;
  box.innerHTML = '<p class="lyr-msg"><span class="lyr-dots"><i></i><i></i><i></i></span>Finding lyrics…</p>';
  try {
    const d = await lyricsFor(t);
    if (!R.lyr.on || R.lyr.key !== key) return;
    R.lyr.data = d; lyricsRender(d, t);
  } catch (e) {
    if (R.lyr.key !== key) return;
    box.innerHTML = `<p class="lyr-msg">Couldn’t reach the lyrics service.</p><button class="btn sm" data-act="lyr-retry">Try again</button>`;
  }
}
function lyricsRender(d, t) {
  const box = $('#np-lyrics'); if (!box) return;
  if (d.instrumental) { box.innerHTML = '<p class="lyr-msg">Instrumental. No lyrics for this one.</p>'; return; }
  if (d.synced.length) {
    box.innerHTML = `<div class="lyr-scroll synced" id="lyr-scroll"><div class="lyr-pad"></div>${d.synced.map((l, i) => `<p class="ll" data-i="${i}" data-t="${l.t}">${l.text ? esc(l.text) : '♪'}</p>`).join('')}<div class="lyr-pad"></div></div><div class="lyr-src">Lyrics from LRCLIB · tap a line to jump</div>`;
    lyricsSync(true); return;
  }
  if (d.plain) { box.innerHTML = `<div class="lyr-scroll" id="lyr-scroll"><div class="lyr-pad sm"></div>${d.plain.split(/\n{2,}/).map(par => `<p class="lp">${esc(par).replace(/\n/g, '<br>')}</p>`).join('')}<div class="lyr-pad sm"></div></div><div class="lyr-src">Lyrics from LRCLIB · not time-synced</div>`; return; }
  box.innerHTML = `<p class="lyr-msg">No lyrics found for “${esc(t.title)}”.</p><p class="lyr-sub">They are matched by title, artist and length. Fixing the song’s title or artist can help.</p><button class="btn sm" data-act="edit-song">${I.edit}Edit song details</button>`;
}
/* Binary search for the line being sung at `pos` seconds. */
function lyricsIndex(lines, pos) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (lines[mid].t <= pos) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans;
}
function lyricsSync(force) {
  const d = R.lyr.data; if (!R.lyr.on || !d || !d.synced.length) return;
  const i = lyricsIndex(d.synced, (audio.currentTime || 0) + 0.12);
  if (i === R.lyr.idx && !force) return;
  R.lyr.idx = i;
  const sc = $('#lyr-scroll'); if (!sc) return;
  const prev = sc.querySelector('.ll.on'); if (prev) prev.classList.remove('on');
  sc.querySelectorAll('.ll.past').forEach(n => n.classList.remove('past'));
  const cur = i >= 0 ? sc.querySelector(`.ll[data-i="${i}"]`) : null;
  if (cur) {
    cur.classList.add('on');
    for (let k = Math.max(0, i - 3); k < i; k++) { const n = sc.querySelector(`.ll[data-i="${k}"]`); if (n) n.classList.add('past'); }
    const target = cur.offsetTop - sc.clientHeight / 2 + cur.offsetHeight / 2;
    sc.scrollTo({ top: Math.max(0, target), behavior: force || motionReduced() ? 'auto' : 'smooth' });
  }
}
function lyricsStop() { R.lyr.key = ''; R.lyr.data = null; }

/* ═════════ dotted background and custom CSS ═════════ */
function applyDots() {
  const r = document.documentElement, on = !!S.settings.dotBg;
  r.dataset.dots = on ? 'on' : 'off';
  const op = Math.max(4, Math.min(60, +S.settings.dotOpacity || 22)), sc = Math.max(10, Math.min(44, +S.settings.dotScale || 22));
  r.style.setProperty('--dbg-pct', op + '%'); r.style.setProperty('--dbg-size', sc + 'px');
}
/* Custom CSS is the person's own and stays on this device, but a stray @import
   would reach out to another server, so those are dropped. */
const cleanCss = css => String(css || '').replace(/@import[^;]*;?/gi, '').replace(/<\/?style[^>]*>/gi, '').slice(0, 20000);
function applyCustomCss() {
  let el = $('#wl-custom-css');
  if (!el) { el = document.createElement('style'); el.id = 'wl-custom-css'; document.head.appendChild(el); }
  el.textContent = cleanCss(S.settings.customCss);
}
const CSS_STARTER = `/* Wavelength custom CSS. Everything here is applied on top of your theme.
   Change any colour token, or restyle anything you like. */
:root {
  /* --bg: #0b0b10;        page behind the panels */
  /* --card: #14141c;      panels */
  /* --card2: #1e1e2a;     raised rows and inputs */
  /* --text: #f2f2f7;      main text */
  /* --text2: #a0a0b0;     secondary text */
  /* --text3: #62626f;     faint text */
  /* --accent: #ff4d6d;    accent colour (also set in Settings) */
  /* --line: rgba(255,255,255,.09);  borders */
}

/* Example: rounder panels */
/* .main, .side, .player { border-radius: 40px; } */

/* Tip: interface styles use specific selectors. If a rule does not take effect,
   make yours stronger, for example  html[data-style] .ttl { ... }  */
`;

/* Scrollbars follow the rounded shape of the interface. */
const SCROLLBARS = [['pill', 'Rounded (default)'], ['autohide', 'Rounded, only when hovering'], ['hidden', 'Hidden'], ['system', 'System default']];
function applyScrollbar() {
  const v = SCROLLBARS.some(x => x[0] === S.settings.scrollbar) ? S.settings.scrollbar : 'pill';
  document.documentElement.dataset.sb = v;
}
function applyMotion() {
  const mode = S.settings.motion === 'reduced' ? 'reduced' : 'system';
  document.documentElement.dataset.motion = mode;
  cachePrefs();
}
function motionReduced() {
  return S.settings.motion === 'reduced' || (S.settings.motion !== 'full' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function applyReading() {
  const root = document.documentElement;
  const size = ['large', 'xl'].includes(S.settings.readSize) ? S.settings.readSize : 'default';
  root.dataset.read = size;
  root.dataset.contrast = S.settings.contrast ? 'high' : 'normal';
  cachePrefs();
}
function applyTheme() {
  const { theme, accent } = S.settings, root = document.documentElement;
  root.dataset.theme = theme; root.dataset.style = S.settings.style || 'nothing'; root.dataset.mode = themeMode();
  const a = accent || defAccent();
  const rgb = hexRgb(a) || { r: 215, g: 25, b: 33 };
  root.style.setProperty('--accent', a);
  root.style.setProperty('--accent-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
  // Whichever of black or white reads better on the accent.
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = 0.2126 * lin(rgb.r) + 0.7152 * lin(rgb.g) + 0.0722 * lin(rgb.b);
  root.style.setProperty('--on-accent', (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#000' : '#fff');
  cachePrefs();
  VC.accent = a;
  VC.dim = getComputedStyle(root).getPropertyValue('--dot').trim() || VC.dim;
  syncNativePrefs();
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
  syncSystemBars();
  if (!autoWatcher && autoLight) {
    autoWatcher = true;
    const onScheme = () => { if (S.settings.theme === 'auto') applyTheme(); };
    if (autoLight.addEventListener) autoLight.addEventListener('change', onScheme);
    else if (autoLight.addListener) autoLight.addListener(onScheme);
  }
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
const art = (t, c = '') => `<div class="art ${c}">${t && t.art ? `<img src="${esc(t.art)}" loading="lazy" decoding="async" alt="" onerror="this.remove()">` : ''}<span class="art-d"></span></div>`;

/* Playlist covers intentionally stay small and serialisable: a logo (emoji,
   icon or monogram), an uploaded/pulled picture, and an optional tone. Older
   covers with just `emoji` or `url` keep rendering exactly as before. */
const TONES = [
  ['ember', 'Ember'], ['rose', 'Rose'], ['ocean', 'Ocean'], ['moss', 'Moss'],
  ['violet', 'Violet'], ['sunset', 'Sunset'], ['mono', 'Mono'], ['noir', 'Noir']
];
const TONE_IDS = new Set(TONES.map(([id]) => id));
const CICONS = {
  wave: I.wave, spark: I.sparkles, moon: I.moon, sun: I.sun, flame: I.flame,
  disc: I.disc, cassette: I.cassette, headphones: I.headphones, star: I.star,
  heart: I.heart, bolt: I.bolt, flower: I.flower, planet: I.planet, rocket: I.rocket,
  coffee: I.coffee, car: I.car, gamepad: I.gamepad, book: I.book, crown: I.crown,
  pin: I.pin
};
const ICON_KEYS = Object.keys(CICONS);
const coverContent = pl => {
  const cv = (pl && pl.cover) || {};
  const name = String((pl && pl.name) || '♪');
  if (cv.icon && CICONS[cv.icon]) return `<span class="ci">${CICONS[cv.icon]}</span>`;
  return `<b>${esc(cv.emoji || name[0].toUpperCase())}</b>`;
};
const cover = (pl, c = '') => {
  const cv = (pl && pl.cover) || {};
  const tone = TONE_IDS.has(cv.tone) ? ` tone-${cv.tone}` : '';
  return `<div class="cover ${c}${tone}">${coverContent(pl)}${cv.url ? `<img src="${esc(cv.url)}" loading="lazy" decoding="async" alt="" onerror="this.remove()">` : ''}</div>`;
};
const isCur = t => R.cur && (R.cur === t || uid(R.cur) === uid(t));
const liked = t => S.liked.some(x => uid(x) === uid(t) || (x.ytId && x.ytId === t.ytId));
const tile = (img, title, sub, attrs, i = 0, fab = '') => `<div class="tile rise" style="--i:${Math.min(i, 18)}" ${attrs}>${img}<div class="tt">${esc(title)}</div><div class="ts">${esc(sub)}</div>${fab}</div>`;
const loader = () => '<div class="loader"><i></i><i></i><i></i></div>';
function rows(list, ctx, offset = 0) {
  return list.map((t, i) => `<div class="row rise${isCur(t) ? ' on' : ''}${t.miss ? ' miss' : ''}" data-ctx="${ctx}" data-i="${i + offset}" data-k="${esc(uid(t))}" style="--i:${Math.min(i, 14)}">
    <div class="n"><span>${i + offset + 1}</span><em class="eq"><i></i><i></i><i></i></em><b class="pl">${I.playS}</b></div>
    <div class="who">${art(t, 'sm')}<div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.localId ? ' ' + localBadge(t) : ''}${t.miss ? ' · no YouTube match' : ''}</div></div></div>
    <div class="al">${esc(t.album || '')}</div><div class="d">${fmt(t.duration)}</div>
    <button class="ib hrt${liked(t) ? ' on' : ''}" data-act="like" title="Like">${liked(t) ? I.heartF : I.heart}</button>
    <button class="ib" data-act="menu" title="More">${I.more}</button></div>`).join('');
}
/* The in-playlist filter keeps row indexes consistent: every row looks its song
   up through ctxList(), so the filter lives here instead of in the markup. */
const filterActive = c => !!R.plFilter && (c === 'liked' ? curRoute === 'liked' : curRoute === 'playlist' && c === curArg);
const matchesFilter = t => {
  const hay = `${t.title || ''} ${t.artist || ''} ${t.album || ''}`.toLowerCase();
  return R.plFilter.split(/\s+/).every(w => hay.includes(w));
};
function ctxList(c) {
  const clean0 = l => (S.settings.noAi || (S.settings.blockedArtists || []).length) ? l.filter(allowed) : l;
  const clean = l => filterActive(c) ? clean0(l).filter(matchesFilter) : clean0(l);
  if (c === 'liked') return sortTracks(clean(S.liked));
  if (c === 'search') return R.results;
  if (c === 'history') return clean(S.history);
  if (c === 'queue') return R.queue;
  if (c === 'local') return R.local;
  return sortTracks(clean((S.playlists.find(p => p.id === c) || {}).tracks || []));
}
const SORT_KEYS = [['added', 'Recently added'], ['title', 'A–Z'], ['artist', 'Artist'], ['duration', 'Duration'], ['album', 'Album']];
function sortTracks(list, key = S.settings.plSort || 'added') {
  const arr = list.slice();
  const byText = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base', numeric: true });
  const cmp = {
    added: (a, b) => (+b.addedAt || 0) - (+a.addedAt || 0),
    title: (a, b) => byText(a.title, b.title),
    artist: (a, b) => byText(a.artist, b.artist) || byText(a.title, b.title),
    album: (a, b) => byText(a.album, b.album) || byText(a.title, b.title),
    duration: (a, b) => (+a.duration || 0) - (+b.duration || 0),
  }[key];
  return cmp ? arr.sort(cmp) : arr;
}
/* ═════════ edited song details ═════════
   A song's title, artist and thumbnail can be changed. The edit is stored once
   in S.overrides (with the original, so it can be undone) and written into every
   copy of the song: playlists, Liked Songs, history, the queue and search. It is
   also re-applied whenever songs arrive from search, radio or a sync. */
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];
const ovKey = t => uid(t);
function ovApply(list) {
  const ov = S.overrides, keys = Object.keys(ov || {});
  if (!keys.length || !Array.isArray(list)) return list;
  const byYt = {};
  for (const k of keys) if (ov[k].yt) byYt[ov[k].yt] = ov[k];
  for (const x of list) {
    if (!x) continue;
    const e = ov[uid(x)] || (x.ytId && byYt[x.ytId]);
    if (!e) continue;
    if (e.title != null) x.title = e.title;
    if (e.artist != null) x.artist = e.artist;
    if (e.art != null) x.art = e.art;
  }
  return list;
}
function allTrackLists() {
  return [...S.playlists.map(p => p.tracks || []), S.liked, S.history, R.queue, R.results, R.local, R.cur ? [R.cur] : []];
}
function ovApplyAll() { for (const l of allTrackLists()) ovApply(l); }
/* Writes `to` ({title, artist, art}) into every copy of the song. */
function ovWrite(key, yt, to) {
  const hit = x => x && (uid(x) === key || (yt && x.ytId === yt));
  for (const l of allTrackLists()) for (const x of l) {
    if (!hit(x)) continue;
    if (to.title != null) x.title = to.title;
    if (to.artist != null) x.artist = to.artist;
    if (to.art != null) x.art = to.art;
  }
}
function afterSongEdit() {
  save(); drawSide(); saveSession(true);
  if (R.cur) { uiNow(); mediaSession(); }
  renderQueue(); hl();
  if (curRoute === 'search') { const root = $('#sr'); if (root && R.results.length) root.innerHTML = searchHTML(R.results); observeRows(); }
  else draw();
}
let SE = null;
const imgOk = u => /^(https?:\/\/|data:image\/|\/covers\/)/i.test(String(u || '').trim());
async function songImage(file) {
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or GIF image');
  if (!NATIVE) return uploadImage(file);
  // The phone has no upload endpoint, so the picture travels inside the library.
  const bmp = await createImageBitmap(file), sc = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.82);
}
function editSong(t) {
  if (!featOn('editor')) return toast('Song editor is switched off in Settings → Features');
  t = t || R.cur;
  if (!t) return toast('Play or pick a song first');
  const key = ovKey(t), e = S.overrides[key];
  SE = { key, sp: t.spId || '', spArt: t.spArt || '', yt: t.ytId || '', title: t.title || '', artist: t.artist || '', art: t.art || '', up: [],
    orig: e ? { ...e.o } : { title: t.title || '', artist: t.artist || '', art: t.art || '' }, had: e ? { ...e } : null };
  const u = SE.art.startsWith('http') ? SE.art : '';
  modal(`<div class="eyebrow">Edit song</div><h3 class="imp-title">Song details</h3>
    <div class="se-top"><div class="se-art" id="se-art">${art({ art: SE.art })}</div>
      <div class="se-tools"><button class="btn sm" data-act="se-pick">${I.image}Upload image</button>
        <button class="btn sm" data-act="se-orig-art">Original image</button>
        <button class="btn sm" data-act="se-no-art">No image</button>
        ${t.spId || t.spArt ? '<button class="btn sm" data-act="se-spotify">Spotify image</button>' : ''}</div></div>
    <label class="set-label" for="se-title">Title</label>
    <input class="inp" id="se-title" value="${esc(SE.title)}" autocomplete="off" maxlength="200">
    <label class="set-label" for="se-artist">Artist</label>
    <input class="inp" id="se-artist" value="${esc(SE.artist)}" autocomplete="off" maxlength="200">
    <label class="set-label" for="se-art-url">Image link</label>
    <input class="inp" id="se-art-url" value="${esc(u)}" placeholder="Paste an image link, or upload one above" autocomplete="off" spellcheck="false">
    <p class="mut se-note">Changes apply everywhere this song appears on this device${e ? '' : ', and you can restore the original any time'}.</p>
    <div class="acts end">${e ? '<button class="btn dng" data-act="se-reset">Restore original</button>' : ''}<button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="se-save">Save</button></div>`, 'song-edit');
}
/* After a helper button, put the cursor back in the title so Enter confirms the edit. */
const seFocus = () => { const t = $('#se-title'); if (t) { t.focus(); const n = t.value.length; try { t.setSelectionRange(n, n); } catch {} } };
function sePreview() { const el = $('#se-art'); if (el && SE) el.innerHTML = art({ art: SE.art }); }
function seSave() {
  if (!SE) return;
  const title = ($('#se-title')?.value || '').trim(), artist = ($('#se-artist')?.value || '').trim();
  if (!title) return toast('A song needs a title');
  const key = SE.key, o = SE.orig, prev = S.overrides[key] ? { ...S.overrides[key] } : null;
  const to = { title, artist, art: SE.art || '' };
  const e = { yt: SE.yt, o: { ...o } };
  if (to.title !== o.title) e.title = to.title;
  if (to.artist !== o.artist) e.artist = to.artist;
  if ((to.art || '') !== (o.art || '')) e.art = to.art;
  const changed = e.title != null || e.artist != null || e.art != null;
  const before = { title: SE.had ? (SE.had.title ?? o.title) : o.title, artist: SE.had ? (SE.had.artist ?? o.artist) : o.artist, art: SE.had ? (SE.had.art ?? o.art) : o.art };
  if (changed) S.overrides[key] = e; else delete S.overrides[key];
  ovWrite(key, SE.yt, { title: to.title, artist: to.artist, art: to.art });
  const newArt = to.art, oldArt = prev && prev.art;
  closeModal(true); afterSongEdit();
  undoable(changed ? 'Song details updated' : 'Back to the original details', () => {
    if (prev) S.overrides[key] = prev; else delete S.overrides[key];
    ovWrite(key, SE_yt(prev, e), before);
    if (newArt && newArt.startsWith('/covers/') && newArt !== before.art) delCover(newArt);
    afterSongEdit();
  }, () => { if (oldArt && oldArt !== newArt && oldArt.startsWith('/covers/')) delCover(oldArt); });
}
const SE_yt = (prev, e) => (prev && prev.yt) || e.yt || '';
function songRestore(key) {
  const e = S.overrides[key]; if (!e) return;
  const was = { ...e }, back = { ...e.o };
  delete S.overrides[key];
  ovWrite(key, e.yt, back);
  closeModal(true); afterSongEdit();
  undoable('Original details restored', () => {
    S.overrides[key] = was; ovWrite(key, was.yt, { title: was.title ?? back.title, artist: was.artist ?? back.artist, art: was.art ?? back.art });
    afterSongEdit();
  }, () => { if (was.art && was.art.startsWith('/covers/')) delCover(was.art); });
}
function applySpeed() {
  const v = SPEEDS.includes(+S.settings.speed) ? +S.settings.speed : 1;
  for (const el of audioEls) { try { el.defaultPlaybackRate = v; el.playbackRate = v; } catch {} }
  const b = $('#b-speed'); if (b) { b.textContent = `${v}×`; b.classList.toggle('on', v !== 1); }
}
function setSpeed(v) { S.settings.speed = v; save(); applySpeed(); toast(v === 1 ? 'Normal speed' : `Speed ${v}×`); }
function speedMenu(x, y) { showMenuItems(SPEEDS.map(v => [v === 1 ? 'Normal (1×)' : `${v}×`, v === +S.settings.speed ? 'check' : 'wave', () => setSpeed(v)]), x, y); }
function queueRemove(i) {
  if (i < 0 || i >= R.queue.length) return;
  const [gone] = R.queue.splice(i, 1), oldIdx = R.idx, lenAfter = R.queue.length;
  if (i <= R.idx) R.idx--;
  refreshQueue(); renderQueueSmooth(); saveSession(true);
  undoable(`Removed “${gone.title}” from the queue`, () => {
    R.queue.splice(Math.min(i, R.queue.length), 0, gone);
    R.idx = R.queue.length - 1 === lenAfter ? oldIdx : (i <= R.idx ? R.idx + 1 : R.idx);
    refreshQueue(); renderQueueSmooth(); saveSession(true);
  });
}
function moveQueue(from, to) {
  if (from === to || from < 0 || to < 0 || from >= R.queue.length || to >= R.queue.length) return;
  const [it] = R.queue.splice(from, 1); R.queue.splice(to, 0, it);
  if (R.idx === from) R.idx = to;
  else if (from < R.idx && to >= R.idx) R.idx--;
  else if (from > R.idx && to <= R.idx) R.idx++;
  refreshQueue(); renderQueueSmooth(); saveSession(true);
}
function removeFromCtx(c, t) {
  const same = x => uid(x) === uid(t);
  if (c === 'queue') return queueRemove(R.queue.findIndex(same));
  if (c === 'local') return deleteLocalTrack(t);
  // Find the row on screen first: it folds away before the list is redrawn.
  const rowEl = $$('.row:not(.flip-ghost)').find(r => r.dataset.ctx === c && ctxList(c)[+r.dataset.i] && same(ctxList(c)[+r.dataset.i]));
  let undo = null;
  if (c === 'liked') { const prev = S.liked; S.liked = prev.filter(x => !same(x)); undo = () => { S.liked = prev; }; }
  else if (c === 'history') { const prev = S.history; S.history = prev.filter(x => !same(x)); undo = () => { S.history = prev; }; }
  else {
    const pl = S.playlists.find(p => p.id === c);
    if (pl) { const prev = pl.tracks; pl.tracks = prev.filter(x => !same(x)); undo = () => { pl.tracks = prev; }; }
  }
  save(); saveSession(true);
  const finish = () => { drawSide(); hl(); if (curRoute !== 'search') draw(); };
  if (rowEl && !motionReduced()) {
    rowEl.style.maxHeight = rowEl.offsetHeight + 'px'; void rowEl.offsetHeight;
    rowEl.classList.add('leaving'); rowEl.closest('.list')?.classList.add('busy');
    setTimeout(finish, 260);
  } else finish();
  if (undo) undoable(`Removed “${t.title}”`, () => { undo(); save(); drawSide(); hl(); if (curRoute !== 'search') draw(); saveSession(true); });
}

/* ═════════ views ═════════ */
function vHome() {
  const h = S.history.slice(0, 8), pls = S.playlists.slice(0, 6);
  return `<div class="hero rise"><div class="hero-dots"></div><div class="eyebrow">${NATIVE ? 'On this phone · no ads · standalone' : 'Free · no ads · runs on your computer'}</div>
    <h1 class="big">WAVE<br>LENGTH</h1><p>${NATIVE ? 'Search YouTube, play ad-free, and keep your playlists on this phone. A computer is optional.' : 'Bring your Spotify playlists over, play them ad-free, and download anything as MP3.'}</p>
    <div class="acts">${NATIVE
      ? `<button class="btn solid" data-go="search">${I.search}Search music</button><button class="btn" data-go="import">${I.import}Import a list</button>`
      : `<button class="btn solid" data-go="import">${I.import}Import from Spotify</button><button class="btn" data-go="search">${I.search}Search music</button>`}
      ${R.cur && !R.playing ? `<button class="btn acc" data-act="resume">${I.playS}Resume</button>` : ''}
      ${S.liked.length ? `<button class="btn" data-act="playliked">${I.heartF}Play liked</button>` : ''}
      ${S.playlists.some(p => p.tracks.length) ? `<button class="btn" data-act="smartshuffle">${I.shuffle}Smart shuffle</button>` : ''}</div></div>
    ${pinnedPls().length ? `<div class="sec"><h2>Pinned</h2></div><div class="grid">${pinnedPls().map((p, i) => plTile(p, i)).join('')}</div>` : ''}
    ${h.length ? `<div class="sec"><h2>Jump back in</h2></div><div class="grid">${h.map((t, i) => tile(art(t), t.title, t.artist, `data-act="playhist" data-i="${i}"`, i)).join('')}</div>` : ''}
    ${pls.length ? `<div class="sec"><h2>Your playlists</h2><a data-go="library">See all</a></div><div class="grid">${pls.map((p, i) => plTile(p, i)).join('')}</div>`
      : `<div class="sec"><h2>Start here</h2></div><div class="empty">No playlists yet. Import one from Spotify or create your own from the sidebar.</div>`}`;
}
const plTile = (p, i) => tile(cover(p), p.name, `${p.tracks.length} songs`, `data-go="playlist/${p.id}"`, i, `<button class="fab" data-act="playpl" data-id="${p.id}" title="Play">${I.playS}</button>`);

const SEARCH_CACHE = new Map(), SEARCH_CACHE_TTL = 5 * 60 * 1000, SEARCH_CACHE_MAX = 30;
const searchKey = q => q.toLowerCase().replace(/\s+/g, ' ').trim();
const searchTop = t => {
  const l = liked(t);
  return `<div class="search-top rise" data-act="playsearch" data-i="0">
  <div class="st-art">${art(t)}</div>
  <div class="st-copy"><div class="eyebrow">Top result</div><div class="st-title">${esc(t.title)}</div><div class="st-meta">${esc(t.artist)}${t.album ? ' · ' + esc(t.album) : ''}${t.duration ? ' · ' + fmt(t.duration) : ''}</div></div>
  <div class="st-actions">
    <button class="ib sm${l ? ' on' : ''}" data-act="top-like" title="${l ? 'Remove from Liked Songs' : 'Add to Liked Songs'}" aria-label="${l ? 'Remove from Liked Songs' : 'Add to Liked Songs'}">${l ? I.heartF : I.heart}</button>
    <button class="ib sm" data-act="top-add" title="Add to playlist" aria-label="Add to playlist">${I.plus}</button>
    <button class="ib sm" data-act="top-menu" title="More options" aria-label="More options">${I.more}</button>
  </div>
  <span class="st-play">${I.playS}</span></div>`;
};
const searchHTML = r => {
  if (!r.length) return `<div class="empty search-empty"><b>No matches yet.</b><span>Try a song title, an artist, or a mood — for example “lo-fi”.</span></div>`;
  const [top, ...rest] = r;
  return searchTop(top) + (rest.length ? `<div class="sec search-sec"><h2>Songs</h2><span class="meta">${plural(r.length, 'result')}</span></div><div class="list">${rows(rest, 'search', 1)}</div>` : '');
};
const searchSkeleton = () => `<div class="search-top sk-top" aria-hidden="true"><i class="sk-art"></i><span class="sk-copy"><i></i><i></i><i></i></span></div><div class="list sk-list" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<div class="sk-row" style="--i:${i}"><i class="sk-art"></i><span class="sk-copy"><i></i><i></i></span><i class="sk-time"></i></div>`).join('')}</div>`;
const recentSearchHTML = () => recentSearches().map(q => `<button class="recent-search" data-act="search-recent" data-q="${esc(q)}">${I.search}<span>${esc(q)}</span></button>`).join('');

function searchLanding() {
  const recent = recentSearches();
  return `<div class="search-landing rise"><div><div class="eyebrow">Search</div><h1 class="search-title">Find your next<br>favourite.</h1><p class="mut">Search any song or artist. Your library, history and imports always stay one step away.</p></div><div class="search-hint"><kbd>⌘</kbd><kbd>K</kbd><span>focus search</span></div></div>
    ${recent.length ? `<div class="sec"><h2>Recent searches</h2><button class="linkbtn" data-act="search-clear-recent">Clear</button></div><div class="recent-row">${recentSearchHTML()}</div>` : ''}
    <div class="sec"><h2>Browse by genre</h2><span class="meta">${GENRES.length} starting points</span></div><div class="grid">${GENRES.map((g, i) => `<div class="tile genre rise" style="--i:${i}" data-act="genre" data-g="${esc(g)}"><div class="tt">${esc(g)}</div></div>`).join('')}</div>`;
}

function updateSearchClear() {
  const q = $('#q'), box = $('#searchbox'), clear = $('#search-clear');
  if (!q || !box || !clear) return;
  const has = !!q.value;
  box.classList.toggle('has-q', has);
  clear.classList.toggle('show', has);
}

function vSearch(q) {
  if (!q) return searchLanding();
  const hit = SEARCH_CACHE.get(searchKey(q));
  if (hit) R.results = filterAllowed(hit.items);
  doSearch(q);
  return `<div class="search-head rise"><div><div class="eyebrow">Search results</div><h1 class="search-title">${esc(q)}</h1></div><div class="search-head-side"><span class="meta" id="search-count">${hit ? plural(R.results.length, 'song') : 'Searching…'}</span><button class="btn sm" data-act="search-clear">Clear</button></div></div><div id="sr">${hit ? searchHTML(R.results) : searchSkeleton()}</div>`;
}
function renderSearch(r) {
  R.results = filterAllowed(r);
  const root = $('#sr');
  if (!root) return;
  const count = $('#search-count'); if (count) count.textContent = plural(R.results.length, 'song');
  root.innerHTML = searchHTML(R.results);
  observeRows();
}
function doSearch(q) {
  const key = searchKey(q);
  const my = ++R.sTok;
  const hit = SEARCH_CACHE.get(key);
  const warm = r => {
    clearTimeout(R.warmT);
    if (r[0]) R.warmT = setTimeout(() => { if (my === R.sTok) warmTrack(r[0]); }, 300);
  };
  // Revalidate in the background, but show known results immediately.
  api('/api/search?q=' + encodeURIComponent(q) + (S.settings.noAi ? '&noAi=1' : '')).then(r => {
    if (my !== R.sTok || !$('#sr')) return;
    SEARCH_CACHE.delete(key); SEARCH_CACHE.set(key, { at: Date.now(), items: r });
    while (SEARCH_CACHE.size > SEARCH_CACHE_MAX) SEARCH_CACHE.delete(SEARCH_CACHE.keys().next().value);
    const same = hit && hit.items.length === r.length && (!r.length ||
      (hit.items[0].ytId === r[0].ytId && hit.items[r.length - 1].ytId === r[r.length - 1].ytId));
    if (!same) renderSearch(r);
    warm(r);
  }).catch(e => {
    if (my !== R.sTok || hit || !$('#sr')) return;
    $('#sr').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  });
  if (hit && Date.now() - hit.at < SEARCH_CACHE_TTL) warm(hit.items);
}

function vLib() {
  const lossless = R.local.filter(t => t.lossless).length;
  return `<div class="lib-head rise"><div><div class="eyebrow">Your music</div><h1 class="ttl">Library</h1><p class="mut">${plural(S.playlists.length, 'playlist')} · ${plural(S.liked.length, 'liked song')}</p></div>
    <div class="acts"><button class="btn" data-act="smartshuffle" title="Balanced shuffle across every playlist">${I.shuffle}Smart shuffle</button><button class="btn" data-act="remix">${I.mix}Remix playlists</button></div></div><div class="grid">
    ${tile(`<div class="cover liked">${I.heartF}</div>`, 'Liked Songs', `${S.liked.length} songs`, 'data-go="liked"', 0, `<button class="fab" data-act="playliked" title="Play">${I.playS}</button>`)}
    ${tile(`<div class="cover local-cover">${I.disc}</div>`, 'Local files', R.localReady ? `${R.local.length} songs${lossless ? ' · ' + lossless + ' lossless' : ''}` : 'FLAC, WAV, ALAC', 'data-go="local"', 1)}
    ${S.playlists.map((p, i) => plTile(p, i + 2)).join('')}
    <div class="tile new rise" style="--i:${S.playlists.length + 2}" data-act="newpl">${I.plus}<div>New playlist</div></div></div>`;
}

function vPlaylist(id) {
  const isL = id === 'liked';
  const pl = isL ? { name: 'Liked Songs', tracks: S.liked } : S.playlists.find(p => p.id === id);
  if (!pl) return '<div class="empty">That playlist doesn’t exist anymore.</div>';
  const tracks = ctxList(id);
  const min = Math.round(pl.tracks.reduce((a, t) => a + (t.duration || 0), 0) / 60);
  const un = pl.tracks.filter(t => !t.ytId && !t.miss).length, miss = pl.tracks.filter(t => t.miss).length;
  const hidden = pl.tracks.length - tracks.length;
  return `<div class="ph rise">
    ${isL ? `<div class="cover liked">${I.heartF}</div>` : `<div class="cover${TONE_IDS.has(pl.cover && pl.cover.tone) ? ' tone-' + pl.cover.tone : ''}" data-act="editpl" data-id="${pl.id}" title="Change cover">${coverContent(pl)}${pl.cover && pl.cover.url ? `<img src="${esc(pl.cover.url)}" alt="" onerror="this.remove()">` : ''}<span class="edit">${I.image}</span></div>`}
    <div class="ph-r"><div class="eyebrow">Playlist</div><h1 class="ttl">${esc(pl.name)}</h1>
      <div class="meta">${pl.tracks.length} songs · ${min} min${miss ? ` · ${miss} without a match` : ''}${hidden ? ` · ${hidden} hidden by filters` : ''}</div>
      <div class="acts"><button class="btn acc" data-act="playall" data-id="${id}">${I.playS}Play</button>
        <button class="btn" data-act="shufflepl" data-id="${id}">${I.shuffle}Shuffle</button>
        ${NATIVE ? '' : `<button class="btn" data-act="dlall" data-id="${id}">${I.dl}Download all</button>`}
        <button class="btn" data-act="plmore" data-id="${id}" aria-haspopup="menu">${I.more}More</button>
        ${isL ? '' : `<button class="btn${isPinned(pl.id) ? ' on' : ''}" data-act="pinpl" data-id="${pl.id}" aria-pressed="${isPinned(pl.id)}">${isPinned(pl.id) ? 'Unpin' : 'Pin'}</button><button class="btn" data-act="editpl" data-id="${pl.id}">${I.image}Edit</button><button class="btn dng" data-act="delpl" data-id="${pl.id}">${I.trash}Delete</button>`}
        ${un ? `<button class="btn" data-act="matchrest" data-id="${id}">Match ${un} remaining</button>` : ''}</div>
      <div class="matchbar${MQ.total ? ' on' : ''}" id="match-bar"><div class="lbl" id="match-lbl"></div><div class="dtw" style="pointer-events:none"><div class="dt"><i id="match-fill"></i></div></div></div>
    </div></div>
    <div class="list-tools">
      ${pl.tracks.length > 6 ? `<input class="inp pl-find" id="pl-find" type="search" placeholder="Filter this ${isL ? 'list' : 'playlist'}" value="${esc(R.plFilter)}" autocomplete="off" spellcheck="false" aria-label="Filter songs">` : ''}
      <div class="chips sort-chips" aria-label="Sort songs">${SORT_KEYS.map(([k, n]) => `<button class="chip${(S.settings.plSort || 'added') === k ? ' on' : ''}" data-act="pl-sort" data-k="${k}">${n}</button>`).join('')}</div>
      <div class="view-switch" role="group" aria-label="View"><button class="chip${(S.settings.plView || 'list') === 'list' ? ' on' : ''}" data-act="pl-view" data-k="list">List</button><button class="chip${S.settings.plView === 'grid' ? ' on' : ''}" data-act="pl-view" data-k="grid">Grid</button></div>
    </div>
    <div class="list${S.settings.plView === 'grid' ? ' grid' : ''}" id="pl-list">${plRowsHTML(tracks, id)}</div>`;
}
const plRowsHTML = (tracks, id) => tracks.length ? rows(tracks, id)
  : R.plFilter ? `<div class="empty">No songs match “${esc(R.plFilter)}”.</div>`
  : '<div class="empty">Empty for now. Use the ••• menu on any song to add it here.</div>';
function repaintPlaylist() {
  const box = $('#pl-list'); if (!box) return;
  const id = curRoute === 'liked' ? 'liked' : curArg;
  WLMotion.flip(box, () => { box.innerHTML = plRowsHTML(ctxList(id), id); });
  hl(); requestAnimationFrame(observeRows);
}
function playlistTracks(id) {
  return id === 'liked' ? S.liked : ((S.playlists.find(p => p.id === id) || {}).tracks || []);
}
const dupKey = t => t.localId ? 'l:' + t.localId : t.ytId ? 'y:' + t.ytId : t.spId ? 's:' + t.spId
  : 'n:' + String(t.title || '').toLowerCase().replace(/\W+/g, '') + '|' + String(t.artist || '').toLowerCase().replace(/\W+/g, '');
function playlistMore(el) {
  const id = el.dataset.id, b = el.getBoundingClientRect();
  const visible = ctxList(id);
  const live = () => visible.filter(t => !t.miss);
  const items = [
    ['Add to queue', 'queue', () => {
      const l = live(); if (!l.length) return toast('Nothing playable here');
      if (!R.cur) return play(l, 0, id);
      R.queue.push(...l.map(t => ({ ...t, auto: false }))); refreshQueue(); renderQueueSmooth(); saveSession(true);
      toast(`Added ${plural(l.length, 'song')} to the queue`);
    }],
    ['Play next', 'next', () => {
      const l = live(); if (!l.length) return toast('Nothing playable here');
      if (!R.cur) return play(l, 0, id);
      R.queue.splice(R.idx + 1, 0, ...l.map(t => ({ ...t, auto: false }))); refreshQueue(); renderQueueSmooth(); saveSession(true);
      toast(`Playing ${plural(l.length, 'song')} next`);
    }],
    ['Remove duplicates', 'trash', () => {
      const all = playlistTracks(id), seen = new Set(), keep = [];
      for (const t of all) { const k = dupKey(t); if (seen.has(k)) continue; seen.add(k); keep.push(t); }
      const gone = all.length - keep.length;
      if (!gone) return toast('No duplicates found');
      const apply = list => { if (id === 'liked') S.liked = list; else { const p = S.playlists.find(x => x.id === id); if (p) p.tracks = list; } save(); drawSide(); refreshView(); };
      apply(keep);
      undoable(`Removed ${plural(gone, 'duplicate')}`, () => apply(all));
    }],
    ...(id === 'liked' ? [] : [['Duplicate playlist', 'copy', () => {
      const pl = S.playlists.find(x => x.id === id); if (!pl) return;
      const cover = pl.cover && pl.cover.url && pl.cover.url.startsWith('/covers/') ? { emoji: '🎧', tone: 'ember' } : { ...(pl.cover || {}) };
      const copy = { ...structuredClone(pl), id: rid(), name: `${pl.name} copy`, cover, createdAt: Date.now() };
      S.playlists.push(copy); save(); drawSide(); nav('playlist/' + copy.id); toast(`Duplicated “${pl.name}”`);
    }]]),
    ['Copy song list', 'copy', () => {
      const l = playlistTracks(id);
      copyText(l.map(t => `${t.title} — ${t.artist || 'Unknown artist'}`).join('\n'));
    }],
  ];
  showMenuItems(items, b.left, b.bottom + 6);
}

const fmtDuration = sec => {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m ? m + 'm' : ''}`.trim();
  if (m) return `${m}m`;
  return `${sec}s`;
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function recapBuckets(days, view, from, to, months) {
  if (view === 'months') return months.map((v, i) => ({ v, label: MONTHS[i][0], title: MONTHS[i] }));
  const end = new Date(to + 'T12:00:00'), start = new Date(from + 'T12:00:00');
  if (isNaN(end) || isNaN(start)) return [];
  if (view === 'days') {
    const out = []; const cap = new Date(end); cap.setDate(cap.getDate() - 59);
    for (let d = new Date(start > cap ? start : cap); d <= end; d.setDate(d.getDate() + 1)) { const k = isoDay(d); out.push({ v: +days[k] || 0, label: String(d.getDate()), title: k }); }
    return out;
  }
  const out = []; const d = new Date(start); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  while (d <= end && out.length < 60) {
    let v = 0; const w = new Date(d);
    for (let i = 0; i < 7; i++, w.setDate(w.getDate() + 1)) { const k = isoDay(w); if (k >= from && k <= to) v += +days[k] || 0; }
    out.push({ v, label: String(d.getDate()), title: 'Week of ' + isoDay(d) }); d.setDate(d.getDate() + 7);
  }
  return out;
}
function vRecap(arg) {
  const range = parseRecapRange(arg);
  const from = range.from, to = range.to;
  R.recapFrom = from; R.recapTo = to;
  const r = recapData(from, to);
  const years = recapYears();
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const wholeYear = sameYear && from === `${from.slice(0, 4)}-01-01` && to === `${to.slice(0, 4)}-12-31`;
  const headline = wholeYear ? from.slice(0, 4) : sameYear ? from.slice(0, 4) : `${from.slice(0, 4)}–${to.slice(0, 4)}`;
  const months = Array(12).fill(0);
  for (const [day, sec] of Object.entries(r.days)) {
    const m = +String(day).slice(5, 7) - 1;
    if (m >= 0 && m < 12) months[m] += +sec || 0;
  }
  const peak = Math.max(1, ...months);
  const view = ['days', 'weeks', 'months'].includes(R.recapView) ? R.recapView : (wholeYear ? 'months' : 'days');
  const buckets = recapBuckets(r.days, view, from, to, months);
  const bpeak = Math.max(1, ...buckets.map(b => b.v));
  const totalHours = r.seconds / 3600;
  const top = r.topTracks[0];
  const rank = (list, kind) => list.length ? `<div class="recap-list">${list.map((x, i) => `<div class="recap-row">
      <span class="rk">${String(i + 1).padStart(2, '0')}</span>
      ${kind === 'track' ? art({ art: x.art, title: x.title }, 'sm') : `<span class="recap-dot">${esc((x.name || x.title || '?')[0].toUpperCase())}</span>`}
      <span class="rm"><b>${esc(x.title || x.name)}</b><small>${kind === 'track' ? esc(x.artist || '') : kind === 'artist' ? `${plural(x.plays, 'play')}` : `${plural(x.plays, 'play')}`}</small></span>
      <span class="rv">${esc(fmtDuration(x.seconds))}</span></div>`).join('')}</div>` : `<div class="empty">Nothing here yet.</div>`;
  return `<div class="recap rise">
    <div class="recap-hero">
      <div class="eyebrow">Listening recap</div>
      <h1 class="recap-big">${headline}<span>WAVELENGTH</span></h1>
      <p class="mut">${r.seconds ? `You listened for <b>${esc(fmtDuration(r.seconds))}</b> across ${plural(r.devices, 'device')}.` : 'Start playing music and your recap appears here. Listening time is counted on each device, then combined through sync.'}</p>
      <div class="recap-range-label">${esc(dayLabel(from))} – ${esc(dayLabel(to))}${wholeYear ? '' : ' · custom range'}</div>
      <div class="recap-controls">
        <div class="chips recap-years">${years.map(v => `<button class="chip${wholeYear && v === +from.slice(0, 4) ? ' on' : ''}" data-act="recap-year" data-y="${v}">${v}</button>`).join('')}</div>
        <div class="recap-dates">
          <label><span>From</span><input type="date" id="recap-from" value="${from}" aria-label="Recap start date"></label>
          <label><span>To</span><input type="date" id="recap-to" value="${to}" aria-label="Recap end date"></label>
          <button class="btn solid" data-act="recap-range">${I.chart}Apply</button>
        </div>
      </div>
    </div>
    ${r.seconds && r.partial && !r.detailed ? `<div class="banner"><b>This range has older listening without daily detail.</b> Total time is complete, but song, artist and playlist rankings for part of a year start with this version. Pick a whole year to see full rankings.</div>` : ''}
    ${r.seconds ? `<div class="recap-stats">
      <div class="recap-stat"><small>Total time</small><b>${totalHours >= 10 ? Math.round(totalHours) : totalHours.toFixed(1)}h</b><span>${esc(plural(Math.round(r.seconds / 60), 'minute'))}</span></div>
      <div class="recap-stat"><small>Songs played</small><b>${r.plays}</b><span>${plural(r.topTracks.length, 'song')} ranked</span></div>
      <div class="recap-stat"><small>Top artist</small><b>${esc(r.topArtists[0] ? r.topArtists[0].name : '—')}</b><span>${r.topArtists[0] ? esc(fmtDuration(r.topArtists[0].seconds)) : 'No plays yet'}</span></div>
      <div class="recap-stat"><small>Devices</small><b>${r.devices}</b><span>Merged by device</span></div>
    </div>
    ${top ? `<div class="recap-feature"><div class="recap-feature-art">${art({ art: top.art, title: top.title }, 'lg')}</div><div><div class="eyebrow">Most played song</div><h2>${esc(top.title)}</h2><p class="mut">${esc(top.artist || '')} · ${esc(fmtDuration(top.seconds))} · ${plural(top.plays, 'play')}</p></div></div>` : ''}
    <div class="recap-months"><div class="sec"><h2>${wholeYear ? 'Across the year' : 'Across this range'}</h2><span class="meta">Listening time by ${view.slice(0, -1)}</span></div>
      <div class="chips recap-views" role="group" aria-label="Chart detail">${[['days', 'Days'], ['weeks', 'Weeks'], ['months', 'Months']].map(([k, n]) => `<button class="chip${view === k ? ' on' : ''}" data-act="recap-view" data-v="${k}" aria-pressed="${view === k}">${n}</button>`).join('')}<span class="recap-sep"></span>${[['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['week', 'This week'], ['month', 'This month']].map(([k, n]) => `<button class="chip" data-act="recap-preset" data-n="${k}">${n}</button>`).join('')}</div>
      <div class="recap-chart${view === 'days' ? ' dense' : ''}">${buckets.map(b => `<div class="rc-bar" title="${esc(b.title)}: ${esc(fmtDuration(b.v))}"><i style="height:${Math.max(2, Math.round(b.v / bpeak * 100))}%"></i><span>${esc(b.label)}</span></div>`).join('')}</div></div>
    <div class="recap-cols">
      <div><div class="sec"><h2>Top songs</h2><span class="meta">Per song</span></div>${rank(r.topTracks.slice(0, 8), 'track')}</div>
      <div><div class="sec"><h2>Top playlists</h2><span class="meta">Per playlist</span></div>${rank(r.topPlaylists, 'playlist')}</div>
    </div>
    <div class="recap-cols"><div><div class="sec"><h2>Top artists</h2><span class="meta">Most time</span></div>${rank(r.topArtists, 'artist')}</div>
      <div class="recap-note"><h2>About this recap</h2><p class="mut">Pick any start and end date, or jump to a year. Complete years use full-year totals; partial ranges use daily listening recorded from this version onward. Total time is complete either way. Wavelength merges devices without counting the same device twice, and YouTube does not provide reliable genre metadata, so this recap ranks artists, playlists and songs instead of inventing a genre.</p></div></div>` : ''}
  </div>`;
}

function vLocal() {
  if (NATIVE) {
    return `<h1 class="ttl">Local files</h1><div class="box rise"><h2>Your own music is coming next</h2><p class="mut">YouTube search, playlists, sync and lock-screen controls work on this phone now. Playing files stored on the phone is the next standalone step.</p></div>`;
  }
  if (!R.localReady && !R.localLoading) localLoad();
  if (!R.localReady) return `<h1 class="ttl">Local files</h1>${R.localError ? `<div class="empty">${esc(R.localError)}</div>` : loader()}`;
  const tracks = R.local;
  const lossless = tracks.filter(t => t.lossless).length;
  const totalBytes = tracks.reduce((sum, t) => sum + (+t.size || 0), 0);
  const totalSecs = tracks.reduce((sum, t) => sum + (+t.duration || 0), 0);
  const lengthText = totalSecs < 60 ? `${Math.max(1, Math.round(totalSecs))} sec` : `${Math.round(totalSecs / 60)} min`;
  return `${R.localError ? `<div class="banner"><b>Could not scan local files.</b> ${esc(R.localError)}</div>` : ''}<div class="ph rise">
    <div class="cover local-cover">${I.disc}</div>
    <div class="ph-r"><div class="eyebrow">Local library</div><h1 class="ttl">Local files</h1>
      <div class="meta">${tracks.length ? `${tracks.length} songs · ${lengthText} · ${lossless} lossless · streamed at native quality` : 'Your own music, untouched'}</div>
      <div class="acts"><button class="btn acc" data-act="playall" data-id="local"${tracks.length ? '' : ' disabled'}>${I.playS}Play</button>
        <button class="btn" data-act="shufflepl" data-id="local"${tracks.length ? '' : ' disabled'}>${I.shuffle}Shuffle</button>
        <button class="btn solid" data-act="local-pick">${I.plus}Add audio files</button>
        <button class="btn" data-act="local-scan">${I.search2}Rescan</button></div>
    </div></div>
    <div class="box rise local-note"><h2>Original quality, not a stream</h2><p class="mut">FLAC, WAV, AIFF and ALAC are copied into Wavelength and played at their original bit depth and sample rate. Nothing is transcoded. YouTube-sourced songs remain lossy.</p>
      <p class="meta">Files: <b>${esc(R.localFolder || (R.health || {}).localDir || 'Wavelength data folder')}</b>${totalBytes ? ` · ${(totalBytes / 1048576).toFixed(totalBytes < 10485760 ? 1 : 0)} MB` : ''}</p></div>
    <div class="list">${tracks.length ? rows(tracks, 'local') : `<div class="empty">No local music yet. Add FLAC, WAV, AIFF, ALAC, M4A, MP3, OGG or Opus files. Lossless files stay lossless.<div class="acts"><button class="btn solid" data-act="local-pick">${I.plus}Add audio files</button></div></div>`}</div>`;
}

function vImport() {
  if (NATIVE) {
    return `<h1 class="ttl">Import</h1>
      <div class="imp-status" id="imp-status" role="status" aria-live="polite"></div>
      <div class="box rise"><h2>Paste a list of songs</h2><p class="mut">One per line. Numbered lists, bullets, CSV rows and M3U files work too. Wavelength matches each song on YouTube before saving.</p>
        <textarea class="inp" id="sp-list" placeholder="Helluva Boss - Hot Goss&#10;JT Music - After Hours" spellcheck="false" aria-label="Songs list"></textarea>
        <div class="list-tools"><span class="meta" id="sp-list-count">Songs appear here as you paste</span><select class="inp" id="sp-order" aria-label="List format"><option value="artist">Artist – Song</option><option value="title">Song – Artist</option></select></div>
        <div class="inline"><input class="inp" id="sp-list-name" placeholder="Playlist name" style="max-width:260px" aria-label="Playlist name"><button class="btn solid" data-act="imp-list">Preview list</button></div></div>
      <p class="meta" style="margin-top:14px">Direct Spotify links and account import run on the computer for now. On the phone, paste the song names above.</p>`;
  }
  const h = R.health || {}, sp = R.sp; let adv;
  if (!h.clientId) adv = `<ol class="steps"><li><span>Create an app at <b>developer.spotify.com/dashboard</b> and tick <b>Web API</b>.</span></li>
      <li><span>Add this <b>Redirect URI</b>:<br><span class="code" style="margin-top:8px">${esc(h.redirectUri || '')}</span> <button class="btn sm" data-act="copy-uri">Copy</button></span></li>
      <li><span>Paste the app’s <b>Client ID</b> here.</span></li></ol>
      <div class="inline"><input class="inp" id="cid" placeholder="Client ID" spellcheck="false"><button class="btn solid" data-act="save-client">Save</button></div>`;
  else if (!h.spotifyConnected) adv = `<div class="acts" style="margin-top:0"><a class="btn acc" href="/auth/login">${I.import}Sign in with Spotify</a><button class="btn" data-act="reset-client">Change client ID</button></div>`;
  else {
    if (sp === undefined) spLoad();
    adv = `<p class="mut">${sp && sp.me ? 'Signed in as ' + esc(sp.me.name) + '.' : 'Signed in.'}</p><div class="acts" style="margin-top:0"><button class="btn" data-act="imp-liked">${I.heart}Import liked songs</button><button class="btn" data-act="sp-refresh">Reload list</button><button class="btn dng" data-act="sp-out">Sign out</button></div>
      ${!sp ? loader() : sp.err ? `<p class="meta" style="margin-top:14px">${esc(sp.err)}</p>` : `<div class="list" style="margin-top:12px">${sp.pls.map((p, i) => {
        const imported = S.playlists.some(x => x.spId === p.id);
        return `<div class="prow">${cover({ name: p.name, cover: { url: p.image } })}<div class="nm"><div>${esc(p.name)}</div><div class="meta">${p.count ?? '?'} songs${imported ? ' · already in your library' : ''}</div></div><button class="btn sm${imported ? '' : ' solid'}" data-act="imp-pl" data-id="${p.id}">${imported ? 'Update' : 'Import'}</button></div>`;
      }).join('')}</div>`}`;
  }
  return `<h1 class="ttl">Import</h1>
    <div class="imp-status" id="imp-status" role="status" aria-live="polite"></div>
    <div class="box rise"><h2>Paste a Spotify link</h2><p class="mut">In Spotify choose Share → Copy link, then paste it here. Wavelength reads the song list and finds every song on YouTube.</p>
      <div class="inline"><input class="inp" id="sp-url" placeholder="https://open.spotify.com/playlist/…" spellcheck="false" aria-label="Spotify link"><button class="btn solid" data-act="imp-url">Import</button><button class="btn" data-act="paste-link" title="Read a Spotify link from the clipboard">Paste link</button></div>
      <p class="meta" style="margin-top:12px">Works with playlists, albums and songs. The playlist must be public. Without signing in, Spotify shares the first 100 songs of a playlist.</p></div>
    <div class="box rise" style="--i:1"><h2>Or paste a list of songs</h2><p class="mut">One per line. Numbered lists, bullets, CSV rows and M3U files work too. Preview before anything is saved.</p>
      <textarea class="inp" id="sp-list" placeholder="Helluva Boss - Hot Goss&#10;JT Music - After Hours" spellcheck="false" aria-label="Songs list"></textarea>
      <div class="list-tools"><span class="meta" id="sp-list-count">Songs appear here as you paste</span><select class="inp" id="sp-order" aria-label="List format"><option value="artist">Artist – Song</option><option value="title">Song – Artist</option></select></div>
      <div class="inline"><input class="inp" id="sp-list-name" placeholder="Playlist name" style="max-width:260px" aria-label="Playlist name"><button class="btn" data-act="imp-list">Preview list</button></div></div>
    <details class="box adv rise" style="--i:2"${h.spotifyConnected ? ' open' : ''}><summary>Sign in with Spotify (optional)</summary>
      <p class="mut">Only needed for playlists over 100 songs and your liked songs. Spotify may refuse some playlists for apps like this.</p>${adv}</details>`;
}

function vDl() {
  if (NATIVE) {
    return `<h1 class="ttl">Downloads</h1><div class="box rise"><h2>Offline downloads</h2><p class="mut">Streaming, playlists, sync and lock-screen controls work on this phone now. Saving songs for offline listening is the next standalone step.</p></div>`;
  }
  return `<h1 class="ttl">Downloads</h1><div class="box rise"><h2>Save any song as MP3</h2><p class="mut">Use the ••• menu on a song, or paste a YouTube link here. Files go to <b>${esc((R.health || {}).downloadDir || '~/Music/Wavelength')}</b>.</p>
    <div class="inline"><input class="inp" id="dl-url" placeholder="https://www.youtube.com/watch?v=…" spellcheck="false" aria-label="YouTube link"><button class="btn solid" data-act="dl-url">${I.dl}Download</button></div></div>
    <div class="sec"><h2>Queue</h2><a data-act="dl-clear">Clear finished</a></div><div id="dl-list">${dlList()}</div>`;
}
const dlList = () => R.dls.length ? R.dls.map(j => `<div class="dl ${j.status}"><div class="nm"><div class="t">${esc(j.name)}</div><div class="st">${j.status === 'error' ? esc(j.error) : j.status === 'done' ? 'Saved' : j.status === 'queued' ? 'Waiting…' : j.status === 'converting' ? 'Converting to MP3…' : Math.round(j.progress) + '%'}</div>
  <div class="dtw" style="pointer-events:none;padding:6px 0 0"><div class="dt"><i style="width:${j.progress}%"></i></div></div></div>${j.status === 'done' ? I.check.replace('<svg', '<svg style="width:22px;color:var(--accent)"') : ''}</div>`).join('') : '<div class="empty">No downloads yet.</div>';

const THEME_GROUPS = [
  { name: 'Essentials', items: [['dark', 'Dark', 'Black'], ['light', 'Light', 'Bright'], ['auto', 'System', 'Follows your Mac']] },
  { name: 'Color themes', items: [['rose', 'Rose', 'Pink'], ['amber', 'Amber', 'Warm gold'], ['teal', 'Teal', 'Green-blue'], ['sky', 'Sky', 'Bright blue'], ['violet', 'Violet', 'Purple'], ['lime', 'Lime', 'Green'], ['slate', 'Slate', 'Neutral']] },
  { name: 'Catppuccin', items: [['latte', 'Latte', 'Light · Mauve'], ['frappe', 'Frappé', 'Dark · Mauve'], ['macchiato', 'Macchiato', 'Dark · Mauve'], ['mocha', 'Mocha', 'Dark · Mauve']] },
  ...WLThemes.groups.map(g => ({ name: g.name, items: g.items.map(t => [t.id, t.name, t.sub]) })),
];
function themePreview(k) {
  if (k === 'dark') return { bg: '#000', card: '#171718', accent: THEME_ACCENTS.dark, text: '#f4f4f4' };
  if (k === 'light') return { bg: '#e6e6e8', card: '#ebebed', accent: THEME_ACCENTS.light, text: '#0e0e10' };
  if (k === 'auto') return { bg: 'linear-gradient(90deg,#181825 50%,#eff1f5 50%)', card: '#313244', accent: THEME_ACCENTS.dark, text: '#cdd6f4' };
  if (CTP[k]) return { bg: CTP[k].bg, card: CTP[k].surface, accent: CTP[k].accents.mauve, text: CTP[k].text };
  const x = WLThemes.byId[k]; if (x) return { bg: x.bg, card: x.card2, accent: x.accent, text: x.text };
  return { bg: '#000', card: '#171718', accent: THEME_ACCENTS[k] || THEME_ACCENTS.dark, text: '#f4f4f4' };
}
function themeCard(k, label, sub) {
  const p = themePreview(k), on = S.settings.theme === k;
  return `<button class="theme-card${on ? ' on' : ''}" data-act="theme" data-k="${k}">
    <span class="tp" style="--tp-bg:${p.bg};--tp-card:${p.card};--tp-accent:${p.accent};--tp-text:${p.text}"><i></i><i></i><i></i></span>
    <span class="tx"><b>${label}</b><small>${sub}</small></span><span class="tick">${I.check}</span></button>`;
}

function storageHTML() {
  const st = R.stats;
  if (!st) return '<div class="storage-line"><span>Reading local storage…</span></div>';
  const pct = st.cacheLimit ? Math.min(100, st.cacheBytes / st.cacheLimit * 100) : 0;
  return `<div class="storage-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    <div class="storage-line"><span>${plural(st.cacheCount, 'cached song')} · ${bytes(st.cacheBytes)} of ${bytes(st.cacheLimit)}</span><span>${st.coverCount ? plural(st.coverCount, 'cover') + ' · ' + bytes(st.coverBytes) : 'No custom covers'}</span></div>
    <div class="storage-line"><span>${plural(st.localCount || 0, 'local file')} · ${bytes(st.localBytes || 0)}</span><span>${plural(st.resolutionCount || 0, 'ready link')} · ${bytes(st.dataBytes)} data</span></div>
    <div class="storage-line"><span>${plural(st.matchedCount || 0, 'YouTube match', 'YouTube matches')}</span><span>Local music is never cached twice</span></div>`;
}
async function statsLoad(force = false) {
  if (!force && R.stats) return;
  R.stats = await api('/api/stats').catch(() => null);
  const box = $('#storage-stats'); if (box) box.innerHTML = storageHTML();
  const ver = $('#set-version'); if (ver && R.stats && R.stats.version) ver.textContent = 'v' + R.stats.version;
}
async function localLoad(force = false) {
  if (R.localLoading) return;
  R.localLoading = true;
  try {
    const d = await api('/api/local' + (force ? '?force=1' : ''));
    R.local = ovApply(Array.isArray(d) ? d : (d.tracks || []));
    R.localFolder = d.folder || R.localFolder;
    R.localError = '';
    R.localReady = true;
    drawSide();
    if (['local', 'library', 'settings'].includes(curRoute)) draw();
  } catch (e) {
    R.localError = e.message;
    R.localReady = true;
  } finally {
    R.localLoading = false;
  }
}
async function deleteLocalTrack(t) {
  if (!t || !t.localId) return;
  if (!confirm(`Delete “${t.title}” from local files? This removes the file from Wavelength.`)) return;
  try {
    await api('/api/local/' + encodeURIComponent(t.localId), { method: 'DELETE' });
    const current = R.cur && uid(R.cur) === uid(t);
    R.local = R.local.filter(x => x.localId !== t.localId);
    R.queue = R.queue.filter(x => uid(x) !== uid(t));
    S.liked = S.liked.filter(x => x.localId !== t.localId);
    S.history = S.history.filter(x => x.localId !== t.localId);
    S.playlists.forEach(p => { p.tracks = p.tracks.filter(x => x.localId !== t.localId); });
    if (current) {
      try { audio.pause(); } catch {}
      setBuffering(false); setPlaying(false);
      R.cur = null; R.idx = -1; cancelPrepared(); clearStall(); uiNow();
    } else if (R.cur) R.idx = R.queue.findIndex(x => uid(x) === uid(R.cur));
    renderQueue();
    save(); drawSide(); saveSession(true); refreshView();
    toast('Local file deleted');
  } catch (e) { toast(e.message); }
}
function pickLocalFiles() {
  const i = document.createElement('input');
  i.type = 'file';
  i.multiple = true;
  i.accept = 'audio/*,.flac,.wav,.aiff,.aif,.alac,.m4a,.mp3,.ogg,.oga,.opus,.aac,.webm';
  i.onchange = () => i.files && i.files.length && uploadLocalFiles([...i.files]);
  i.click();
}
async function uploadLocalFiles(files) {
  const list = (files || []).filter(Boolean);
  if (!list.length) return;
  if (NATIVE) return toast('Local file import is not in this build yet; YouTube search and playlists work.');
  if (R.health && !R.health.ffprobe) return toast('Local files need ffprobe — run: brew install ffmpeg');
  let added = 0, failed = 0;
  for (const file of list) {
    toast(`Adding ${file.name}…`);
    try {
      const res = await fetch('/api/local/upload', {
        method: 'POST',
        headers: {
          'X-Wavelength': '1',
          'X-Filename': encodeURIComponent(file.name),
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
      });
      if (!res.ok) {
        let msg = 'Could not add file';
        try { msg = (await res.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      added++;
    } catch (e) {
      failed++;
      toast(`${file.name}: ${e.message}`);
    }
  }
  R.localReady = false;
  await localLoad(true);
  toast(added ? `Added ${plural(added, 'file')}${failed ? ` · ${failed} failed` : ''}` : 'No files added');
}
const themeLabel = () => (THEME_GROUPS.flatMap(g => g.items).find(([k]) => k === S.settings.theme) || ['Dark', 'Dark'])[1];
function syncStatusLabel() {
  const s = R.sync;
  if (!s) return 'Checking…';
  if (s.role === 'host') return 'Hosting';
  if (s.role === 'guest') return 'Connected';
  return 'Off';
}
function syncWhen(ts) {
  if (!ts) return 'Not synced yet';
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (sec < 30) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
let mergeBusy = false, mergePreview = null;
/* ── device finding ──────────────────────────────────────────────────
   The Android bridge answers asynchronously through wlDiscovery(); browser
   and desktop mode ask the local server, which runs the same UDP probe. */
let finding = false, findTimer = null;
function endSyncFind() {
  finding = false;
  clearTimeout(findTimer); findTimer = null;
  const btn = document.querySelector('[data-act="sync-find"]');
  if (btn) btn.disabled = false;
}
function showSyncHosts(hosts, note) {
  const box = $('#sync-found'); if (!box) return;
  const list = Array.isArray(hosts) ? hosts.filter(h => h && h.url) : [];
  if (!list.length) {
    box.innerHTML = `<div class="sync-found-empty">${esc(note || 'No devices found. Make sure the computer is hosting and both devices are on the same Wi-Fi.')}</div>`;
    return;
  }
  box.innerHTML = `<div class="set-label">Found on this network</div>${list.map(h => `<button class="sync-url found" data-act="sync-pick" data-url="${esc(h.url)}"><span><b>${esc(h.name || 'Wavelength')}</b><small>${esc(h.url)}${h.version ? ' · v' + esc(String(h.version).replace(/^v/, '')) : ''}</small></span>${I.link}</button>`).join('')}`;
}
window.wlDiscovery = raw => {
  endSyncFind();
  let data = null;
  try { data = JSON.parse(raw); } catch {}
  if (!data) { showSyncHosts([], 'The search did not return a result. Try again, or paste the address by hand.'); return; }
  showSyncHosts(data.hosts);
};
function syncHTML() {
  const s = R.sync;
  if (!s) return '<div class="sync-loading"><i></i>Reading device sync…</div>';
  const pc = s.counts?.playlists ?? 0, tc = s.counts?.tracks ?? 0, lc = s.counts?.liked ?? 0;
  const countLine = `<div class="sync-counts"><span><b>${pc}</b> ${pc === 1 ? 'playlist' : 'playlists'}</span><span><b>${tc}</b> ${tc === 1 ? 'song' : 'songs'}</span><span><b>${lc}</b> liked</span></div>`;
  const err = s.error ? `<div class="sync-error" role="status">${esc(s.error)}</div>` : '';
  const joinPort = s.port > 1 ? s.port : 38422;
  const joinForm = `<div class="sync-form"><input class="inp" id="sync-url" placeholder="http://192.168.1.20:${joinPort}" spellcheck="false" aria-label="Host address"><input class="inp" id="sync-code" placeholder="Pairing code" spellcheck="false" aria-label="Pairing code" autocomplete="off"><div class="sync-actions"><button class="btn" data-act="sync-join">Connect</button><button class="btn" data-act="sync-find">${I.search}Find devices</button></div></div>
    <div class="sync-found" id="sync-found" aria-live="polite"></div>`;
  if (s.role === 'host') {
    const urls = s.urls || [];
    return `<div class="sync-hero"><div><span class="sync-badge on"><i></i>Hosting on this device</span><h3>Your library is available to paired devices.</h3><p class="mut">Keep Wavelength open while other devices sync. Use Tailscale on both devices, or join over the same Wi-Fi.</p></div><button class="btn" data-act="sync-stop">Stop hosting</button></div>
      ${err}
      <div class="sync-pair"><div><div class="set-label">Pairing code</div><code class="sync-code">${esc(s.code)}</code></div><button class="btn sm" data-act="sync-copy" data-copy="${esc(s.code)}">${I.copy}Copy</button></div>
      <div class="set-label">Host address</div>
      <div class="sync-urls">${urls.length ? urls.map(u => `<button class="sync-url" data-act="sync-copy" data-copy="${esc(u)}"><span>${esc(u)}</span>${I.copy}</button>`).join('') : '<div class="sync-url empty-url">No network address found. Connect Wi-Fi or Tailscale, then try again.</div>'}</div>
      <p class="meta sync-note">Pair any device with the address and code above. Merge data combines both libraries; Send changes still replaces the host copy, so use it only when you mean to.</p>
      <div class="line"><div><div class="l">Merge data</div><div class="s">${s.mergeReady ? `Combine this host with the last libraries sent by ${s.mergeCount === 1 ? esc(s.mergePeer || 'a paired device') : `${s.mergeCount} paired devices`}. New items are added; anything removed here is shown in a checklist first.` : 'A paired device must send its library first. On that device, open Devices and choose Merge data.'}</div></div><button class="btn" data-act="sync-merge"${s.mergeReady ? '' : ' disabled'}>Merge data</button></div>
      ${countLine}`;
  }
  if (s.role === 'guest') {
    return `<div class="sync-hero"><div><span class="sync-badge on"><i></i>Connected to ${esc(s.peer || 'host')}</span><h3>This device follows a shared library.</h3><p class="mut">Merge to combine both libraries. Pull when you want the host's copy to replace this device. Send when you want this device to replace the host.</p></div><button class="btn" data-act="sync-disconnect">Disconnect</button></div>
      ${err}
      <div class="sync-peer"><span class="meta">Host</span><code>${esc(s.hostUrl)}</code><span class="meta">Last sync · ${syncWhen(s.lastSync)}</span></div>
      <div class="line"><div><div class="l">Merge data</div><div class="s">Combine this device and the host. New items are added automatically; anything removed here but still on the host is shown in a checklist first.</div></div><button class="btn solid" data-act="sync-merge">Merge data</button></div>
      <div class="line"><div><div class="l">Pull the host library</div><div class="s">Playlists, liked songs and history replace this device's copy. Settings stay local.</div></div><button class="btn" data-act="sync-pull">Pull now</button></div>
      <div class="line"><div><div class="l">Send this library</div><div class="s">Replace the host's playlists, liked songs and history with this device's copy.</div></div><button class="btn" data-act="sync-push">Send changes</button></div>
      ${countLine}`;
  }
  if (NATIVE) {
    return `<div class="sync-hero"><div><span class="sync-badge"><i></i>Not set up</span><h3>This phone is its own music player.</h3><p class="mut">Join your computer's Wavelength host when you want to carry a library across devices. The computer is only needed during a sync.</p></div></div>
      ${err}
      <div class="sync-panel"><div class="eyebrow">Join a host</div><h3>Use the computer's library</h3><p class="mut">In Wavelength on the computer, open Settings → Devices, start hosting, then tap Find devices. You can also type the address and pairing code below.</p>${joinForm}
      <p class="meta sync-note">Find devices works over the same Wi‑Fi. For Tailscale, paste the computer's <code>100.x</code> address instead.</p></div></div>
      <p class="meta sync-note">Songs stream directly on the phone. Syncing only copies playlists, liked songs and history; it does not need the computer to stay on.</p>`;
  }
  return `<div class="sync-hero"><div><span class="sync-badge"><i></i>Not set up</span><h3>Keep your library in step across Mac, Linux and Android.</h3><p class="mut">Choose one always-on device as the host. No account, no central server — just a short pairing code and your local network or Tailscale.</p></div></div>
    ${err}
    <div class="sync-options">
      <div class="sync-panel"><div class="eyebrow">Option one</div><h3>Host here</h3><p class="mut">Publish this device's playlists to a paired device. The host only runs while Wavelength is open.</p><button class="btn solid" data-act="sync-host">${I.link}Start hosting</button></div>
      <div class="sync-panel"><div class="eyebrow">Option two</div><h3>Join a host</h3><p class="mut">Paste the host address and pairing code, or find a host on this network. Connecting merges this device with the host so neither library is replaced.</p>${joinForm}</div>
    </div>`;
}
async function applyMerge(selected) {
  try {
    const host = R.sync?.role === 'host';
    R.sync = await api('/api/sync/merge', { json: selected ? { selected } : {} });
    await refreshLibraryState();
    syncPaint();
    mergePreview = null;
    toast(host ? 'Device data merged into this host' : 'Both libraries merged');
    return true;
  } catch (e) {
    toast(e.message);
    await syncLoad(true);
    return false;
  }
}
function mergeModal(p) {
  const rp = (p.removed && p.removed.playlists) || [];
  const rs = (p.removed && p.removed.songs) || [];
  const rl = (p.removed && p.removed.liked) || [];
  const rn = rp.length + rs.length + rl.length;
  const src = (p.sources || []).filter(Boolean).join(', ') || (p.role === 'host' ? 'the paired devices' : 'the host');
  const addN = (p.add.playlists || []).length + (p.add.songs || []).length + (p.add.liked || []).length;
  const chip = (n, one, many) => n ? `<span><b>${n}</b> ${n === 1 ? one : many}</span>` : '';
  const row = (kind, i, title, sub) => `<label class="merge-pick"><input type="checkbox" data-mk="${kind}" data-mi="${i}" checked><span class="mm"><span class="mt">${esc(title)}</span><span class="ms">${esc(sub)}</span></span></label>`;
  const group = (label, items) => items ? `<div class="merge-h"><div class="set-label">${label}</div></div><div class="merge-list">${items}</div>` : '';
  const playlists = rp.map((x, i) => row('p', i, x.name || 'Untitled playlist', plural(x.count || 0, 'song'))).join('');
  const songs = rs.map((x, i) => row('s', i, x.title || 'Untitled song', `${x.artist || 'Unknown artist'} · ${x.playlist || 'Playlist'}`)).join('');
  const liked = rl.map((x, i) => row('l', i, x.title || 'Untitled song', `${x.artist || 'Unknown artist'} · Liked Songs`)).join('');
  modal(`<div class="eyebrow">Merge data</div>
    <h3 class="imp-title">Keep new, choose what returns</h3>
    <p class="mut">${addN ? `${plural(addN, 'new item')} from ${esc(src)} will be added automatically.` : `Nothing new is waiting from ${esc(src)}.`} ${plural(rn, 'item')} still ${rn === 1 ? 'exists' : 'exist'} there but ${rn === 1 ? 'was' : 'were'} removed here. Tick the ones to add back; unchecked items stay only on the other copy.</p>
    ${addN ? `<div class="merge-summary">${chip((p.add.playlists || []).length, 'new playlist', 'new playlists')}${chip((p.add.songs || []).length, 'new song', 'new songs')}${chip((p.add.liked || []).length, 'new liked song', 'new liked songs')}${chip(p.add.history || 0, 'history entry', 'history entries')}</div>` : ''}
    <div class="merge-h"><div class="set-label">Removed from this device</div><div class="merge-tools"><button class="btn sm" data-act="merge-all">Select all</button><button class="btn sm" data-act="merge-none">Clear</button></div></div>
    ${group('Playlists', playlists)}
    ${group('Songs', songs)}
    ${group('Liked songs', liked)}
    <div class="acts end"><button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="merge-apply">Merge with selected</button></div>`, 'merge-sheet');
}
function accessHTML() {
  if (NATIVE) {
    return `<div class="access-box">
      <div class="set-label">This phone</div>
      <p class="mut">The library, search and playback all run on this device. Songs stream from YouTube over the internet; your playlists are stored in the app.</p>
      <p class="meta sync-note">A computer is optional. Use <b>Devices</b> above to merge or pull a library from a Wavelength host, then disconnect and keep listening with the computer off.</p>
    </div>`;
  }
  const h = R.health || {};
  const urls = Array.isArray(h.urls) ? h.urls : [];
  const enabled = urls.length > 0;
  return `<div class="access-box">
    <div class="set-label">Phone &amp; browser access</div>
    ${enabled
      ? `<p class="mut">Open one of these addresses on a phone or another computer on the same network. In the Android app, open Settings → Devices and tap <b>Find devices</b>.</p>
        <div class="sync-urls">${urls.map(u => `<button class="sync-url" data-act="sync-copy" data-copy="${esc(u)}"><span>${esc(u)}</span>${I.copy}</button>`).join('')}</div>`
      : `<p class="mut">This player is only listening on this computer (127.0.0.1), so a phone cannot reach it yet.</p>
        <p class="mut">In the <b>desktop app</b>, this switches on automatically — reopen Settings → Devices once it has restarted. In browser mode, start the server with <code>HOST=0.0.0.0 ./start.sh</code>.</p>`}
    <p class="meta sync-note"><b>Only use a network you trust.</b> Anyone who can reach this address can use your library. On Android, <code>127.0.0.1</code> means the phone itself, not your computer.</p>
  </div>`;
}
async function syncLoad(force = false) {
  if (R.sync && !force) return;
  try { R.sync = await api('/api/sync/status'); }
  catch (e) { R.sync = { role: 'off', error: e.message, counts: {} }; }
  syncPaint();
}
function syncPoll() {
  setTimeout(async () => {
    try {
      if (!NATIVE) { const f = await api('/api/sync/folder'); if (R.folder && f.rev !== R.folder.rev) { R.folder = f; await refreshLibraryState(); toast('Library updated from the sync folder'); } else R.folder = f; paintFolder(); }
      if (R.sync && R.sync.role === 'host') {
        const next = await api('/api/sync/status');
        if (next && next.rev !== R.sync.rev) {
          R.sync = next;
          await refreshLibraryState();
          if (curRoute === 'settings') syncPaint();
          toast('Library updated from another device');
        }
      } else if (!R.sync) {
        R.sync = await api('/api/sync/status');
        if (curRoute === 'settings') syncPaint();
      }
    } catch {}
    syncPoll();
  }, 20000);
}
function syncPaint() {
  const box = $('#sync-box'); if (box) box.innerHTML = syncHTML();
  const access = $('#access-box'); if (access) access.innerHTML = accessHTML();
  const sum = $('#sync-summary'); if (sum) sum.textContent = syncStatusLabel();
}
async function refreshLibraryState() {
  const st = await api('/api/state').catch(() => null);
  if (!st) return;
  if (Array.isArray(st.playlists)) S.playlists = st.playlists;
  if (Array.isArray(st.liked)) S.liked = st.liked;
  if (Array.isArray(st.history)) S.history = st.history;
  if (st.listening && typeof st.listening === 'object' && st.listening.devices) S.listening = st.listening;
  ovApplyAll();
  drawSide();
  if (['home', 'library', 'playlist', 'liked', 'local', 'settings', 'recap'].includes(curRoute)) draw();
}
function filterSettings() {
  const q = ($('#set-find')?.value || '').toLowerCase().trim();
  let shown = 0;
  $$('.set > .box').forEach(box => {
    const on = !q || box.textContent.toLowerCase().includes(q);
    box.classList.toggle('filtered-out', !on);
    if (on) shown++;
  });
  $$('.set-jump button').forEach(b => {
    const target = $('#' + b.dataset.scroll);
    b.classList.toggle('filtered-out', !!q && (!target || target.classList.contains('filtered-out')));
  });
  const empty = $('#set-empty'); if (empty) empty.hidden = !q || shown > 0;
}

function vSet() {
  const s = S.settings, h = R.health || {};
  if (!R.stats) statsLoad();
  if (!R.sync) syncLoad();
  const sw = ['#d71921', '#ff6a00', '#f5c400', '#2fd36b', '#00c2ff', '#6b6bff', '#cba6f7', '#ff4fa3', '#ffffff'];
  const pal = paletteFor();
  const tg = (k, l, sub) => `<div class="line"><div><div class="l">${l}</div><div class="s">${sub}</div></div><button class="tg${s[k] ? ' on' : ''}" data-act="tg" data-k="${k}" aria-label="${l}"></button></div>`;
  const rem = sleepLeft();
  const sleepOpts = [15, 30, 45, 60, 90].map(m => `<option value="${m}">${sleepLabel(m * 60000)}</option>`).join('');
  return `<div class="set-head rise"><div><div class="eyebrow">Preferences</div><h1 class="ttl">Settings</h1><p class="set-sub">Tune how Wavelength looks, sounds, stores music and talks to your other devices.</p></div><div class="set-head-icon">${I.gear}</div></div>
    <div class="set-overview rise" style="--i:0">
      <button data-scroll="set-appearance"><span class="so-ic">${I.sun}</span><span><small>Theme</small><b>${esc(themeLabel())}</b></span></button>
      <button data-scroll="set-playback"><span class="so-ic">${I.wave}</span><span><small>Streaming</small><b>${s.streamQuality === 'saver' ? 'Data saver' : 'Best available'}</b></span></button>
      <button data-scroll="set-sync"><span class="so-ic">${I.link}</span><span><small>Devices</small><b id="sync-summary">${syncStatusLabel()}</b></span></button>
      <button data-scroll="set-filters"><span class="so-ic">${I.block}</span><span><small>Library filters</small><b>${s.noAi || (s.blockedArtists || []).length ? 'On' : 'Off'}</b></span></button>
    </div>
    <div class="set-find rise" style="--i:1">${I.search}<input id="set-find" type="search" placeholder="Find a setting — theme, audio, sync…" autocomplete="off" aria-label="Find a setting"><button class="set-find-clear" data-act="set-clear" title="Clear filter" aria-label="Clear filter">${I.close}</button></div>
    <nav class="set-jump rise" aria-label="Settings sections">
      <button data-scroll="set-appearance">Appearance</button><button data-scroll="set-reading">Reading</button><button data-scroll="set-feel">Motion</button><button data-scroll="set-playback">Playback</button><button data-scroll="set-filters">Filters</button><button data-scroll="set-sync">Devices</button><button data-scroll="set-storage">Storage</button><button data-scroll="set-import">Spotify</button>${NATIVE ? '<button data-scroll="set-lock">Lock screen</button>' : ''}<button data-scroll="set-features">Features</button><button data-scroll="set-status">Status</button>
    </nav>
    <div id="set-empty" class="empty set-empty" hidden>No setting matches that search.</div><div class="set">
    <div class="box rise" style="--i:0" id="set-appearance"><h2>Appearance</h2><p class="mut">Choose a palette, then tune the accent. Interface styles are layered on top without changing your colors.</p>
      ${THEME_GROUPS.map(g => `<div class="set-label">${g.name}</div><div class="theme-grid">${g.items.map(([k, n, sub]) => themeCard(k, n, sub)).join('')}</div>`).join('')}
      <div class="set-label">Accent <button class="reset-accent${s.accent ? '' : ' on'}" data-act="accent-reset">${s.accent ? 'Use theme default' : 'Theme default'}</button></div>
      <div class="swatch-row"><span class="swatch-label">Classic</span><div class="sw">${sw.map(c => `<button style="background:${c}" class="${s.accent === c ? 'on' : ''}" data-act="accent" data-c="${c}" aria-label="Accent ${c}" title="${c}"></button>`).join('')}</div></div>
      <div class="swatch-row"><span class="swatch-label">Catppuccin</span><div class="sw">${ACCENT_ORDER.map(k => `<button style="background:${pal.accents[k]}" class="${s.accent === pal.accents[k] ? 'on' : ''}" data-act="accent" data-c="${pal.accents[k]}" aria-label="${k}" title="${k[0].toUpperCase() + k.slice(1)}"></button>`).join('')}</div></div>
      <div class="swatch-row"><span class="swatch-label">Custom</span><div class="sw"><input type="color" id="accent-pick" value="${s.accent || defAccent()}" title="Custom colour"></div><span class="meta" style="margin-left:8px">${esc(s.accent || 'From theme')}</span></div>
      <div class="set-label">Interface style</div>
      <div class="chips">${STYLES.map(k => { const [n, d] = STYLE_INFO[k]; return `<button class="chip${s.style === k ? ' on' : ''}" data-act="style" data-k="${k}" title="${esc(d)}" aria-label="${esc(n)}: ${esc(d)}">${esc(n)}</button>`; }).join('')}</div>
      <details class="style-guide"><summary>What each interface style is for</summary><div class="style-guide-list">${STYLES.map(k => { const [n, d] = STYLE_INFO[k]; return `<div><b>${esc(n)}</b><span>${esc(d)}</span></div>`; }).join('')}</div></details></div>
    <div class="box rise" style="--i:1" id="set-reading"><h2>Reading comfort</h2><p class="mut">Larger type and stronger contrast without changing the layout or colours you picked.</p>
      <div class="line"><div><div class="l">Text size</div><div class="s">Scales titles, labels and controls throughout Wavelength.</div></div><div class="chips"><button class="chip${(s.readSize || 'default') === 'default' ? ' on' : ''}" data-act="read-size" data-k="default">Default</button><button class="chip${s.readSize === 'large' ? ' on' : ''}" data-act="read-size" data-k="large">Large</button><button class="chip${s.readSize === 'xl' ? ' on' : ''}" data-act="read-size" data-k="xl">Extra large</button></div></div>
      ${tg('contrast', 'Stronger contrast', 'Darkens secondary text and strengthens borders and focus rings.')}
      <div class="read-demo"><b>Readable by default</b><span>Artist names, labels and small print get extra breathing room at larger sizes.</span></div></div>
    <div class="box rise" style="--i:2" id="set-feel"><h2>Motion &amp; sound</h2><p class="mut">Keep movement fluid without leaving effects running in the background.</p>
      <div class="line"><div><div class="l">Motion</div><div class="s">Reduce transitions and visual movement across the app.</div></div><select class="inp" data-set="motion" aria-label="Motion preference"><option value="system"${s.motion === 'reduced' ? '' : ' selected'}>Match system</option><option value="reduced"${s.motion === 'reduced' ? ' selected' : ''}>Reduced</option></select></div>
      ${tg('dotBg', 'Dotted background', 'A fine dot grid behind everything, in the style of the rest of the app.')}
      <div class="line sl"><div><div class="l">Dot opacity</div><div class="s">How visible the dots are. <b id="dotOpacity-v">${s.dotOpacity || 22}%</b></div></div><input class="range" type="range" min="4" max="60" step="1" value="${s.dotOpacity || 22}" data-dots="dotOpacity" aria-label="Dot opacity"></div>
      <div class="line sl"><div><div class="l">Dot spacing</div><div class="s">Distance between dots. <b id="dotScale-v">${s.dotScale || 22} px</b></div></div><input class="range" type="range" min="10" max="44" step="1" value="${s.dotScale || 22}" data-dots="dotScale" aria-label="Dot spacing"></div>
      <div class="line"><div><div class="l">Layout</div><div class="s">Where the sidebar, player and content sit. Currently <b id="layout-name">${layoutLabel()}</b>.</div></div><button class="btn" data-act="layout-gallery">Change layout</button></div>
      <div class="line csswrap"><div><div class="l">Custom CSS</div><div class="s">Your own styles, applied on top of the theme and kept on this device. Start from the template to see every colour token you can change.</div>
        <textarea class="inp css-box" id="custom-css" rows="7" spellcheck="false" autocomplete="off" aria-label="Custom CSS" placeholder="/* Paste or write CSS here */">${esc(s.customCss || '')}</textarea>
        <div class="acts"><button class="btn sm" data-act="css-starter">Insert template</button><button class="btn sm" data-act="css-clear">Clear</button></div></div></div>
      <div class="line"><div><div class="l">Performance</div><div class="s">Lite removes blur, glow drift and extra animation to keep scrolling and playback smooth on phones. Automatic uses Lite on Android.</div></div><select class="inp" data-set="perf" aria-label="Performance mode">${[['auto', 'Automatic'], ['lite', 'Lite'], ['full', 'Full effects']].map(([v, n]) => `<option value="${v}"${(s.perf || 'auto') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="line"><div><div class="l">Scrollbars</div><div class="s">Slim bars that follow the rounded shape of each panel. They can also stay out of sight until you hover.</div></div><select class="inp" data-set="scrollbar" aria-label="Scrollbar style">${SCROLLBARS.map(([v, l]) => `<option value="${v}"${(s.scrollbar || 'pill') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      ${tg('viz', 'Show visualizer', NATIVE
        ? 'Follows playback on the phone. Android does not expose the WebView’s audio samples, so the motion is generated from the track and the playback clock.'
        : 'Reacts to the real audio, not a fake animation.')}
      <div class="line"><div><div class="l">Visualizer style</div><div class="s" id="viz-style-name">${esc(WLViz.name(vizStyleId()))} · ${plural(vizVisible().length, 'style')}</div></div><button class="btn" data-act="viz-gallery">Preview styles</button></div>
      <details class="style-guide viz-vis"><summary>Choose which styles appear</summary><p class="mut">Hidden styles disappear from the gallery. At least one stays on.</p><div class="chips">${WLViz.styles.map(x => `<button class="chip${vizHiddenList().includes(x.id) ? '' : ' on'}" data-act="viz-vis" data-id="${x.id}" aria-pressed="${!vizHiddenList().includes(x.id)}">${esc(x.name)}</button>`).join('')}</div></details>
      <div class="line"><div><div class="l">Visualizer size</div><div class="s">Full screen turns the visualizer into the backdrop of the player.</div></div><select class="inp" data-set="vizSize" aria-label="Visualizer size">${[['sm', 'Small'], ['md', 'Medium'], ['lg', 'Large'], ['full', 'Full screen']].map(([v, n]) => `<option value="${v}"${(s.vizSize || 'md') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      ${NATIVE ? tg('realViz', 'Real audio visualizer', 'Reacts to what the phone is actually playing. Android only exposes the output mix, so this asks for the Record Audio permission. Nothing is recorded or stored, and other apps’ sound is included while it plays. If the phone refuses, the generated visualizer is used.') : ''}
      ${NATIVE ? `${tg('lockVisualizer', 'Lock-screen now playing', 'When you lock the phone during playback, Wavelength briefly shows the artwork, the song and a visualizer over the lock screen.')}
      <div class="line"><div><div class="l">Lock-screen preview</div><div class="s">Open the brief now-playing screen without locking the phone.</div></div><button class="btn" data-act="preview-lock">Preview</button></div>
      ${nativeLockAllowed() ? '' : `<div class="line"><div><div class="l">Allow lock-screen display</div><div class="s">Android needs permission before an app can appear over the lock screen.</div></div><button class="btn" data-act="allow-lockscreen">Allow</button></div>`}` : ''}</div>
    <div class="box rise" style="--i:2" id="set-playback"><h2>Playback</h2>${tg('autoplay', 'Endless playback', 'When your queue ends, keep going with similar songs. Never used while shuffle is on.')}
      ${NATIVE ? '' : tg('gapless', 'Gapless transitions', 'Prepares the next track early for a smoother change.')}
      ${tg('resume', 'Resume last session', 'Restore your queue and position next time you open Wavelength.')}
      ${NATIVE ? `<div class="line"><div><div class="l">Volume</div><div class="s">Controls the phone’s media volume, the same stream the hardware keys change.</div></div><input class="inp range" type="range" min="0" max="100" step="1" value="${Math.round((s.volume || 0) * 100)}" data-volset aria-label="Volume"></div>` : ''}
      ${tg('smartVolume', 'Smart volume', NATIVE
        ? 'Samples the start of each song and turns loud songs down a little. It never boosts above your volume, so quiet songs stay quiet. Best-effort, not a studio master.'
        : 'Nudges quiet songs up and loud songs down while they play. Best-effort loudness balancing, not a studio master.')}
      <div class="line"><div><div class="l">Skip intros</div><div class="s">Quiet lead-ins, spoken intros and skits at the start of a song.</div></div><select class="inp" data-set="skipIntro" aria-label="Skip intros">${skipOpts(s.skipIntro)}</select></div>
      <div class="line"><div><div class="l">Skip outros &amp; credits</div><div class="s">Credits, dead air and talking at the end. Moves on to the next song.</div></div><select class="inp" data-set="skipOutro" aria-label="Skip outros">${skipOpts(s.skipOutro)}</select></div>
      <div class="line"><div><div class="l">Skip spoken breaks</div><div class="s">Ads, sponsor reads and long silent gaps in the middle of a song or mix.</div></div><select class="inp" data-set="skipBreaks" aria-label="Skip spoken breaks">${skipOpts(s.skipBreaks)}</select></div>
      <div class="line"><div><div class="l">How sure before skipping</div><div class="s">Careful only acts on strong evidence. Eager acts on weaker hints and will sometimes be wrong. Automatic skips always have Undo.</div></div><select class="inp" data-set="skipSure" aria-label="How sure before skipping">${[['careful', 'Careful'], ['balanced', 'Balanced'], ['eager', 'Eager']].map(([v, l]) => `<option value="${v}"${(s.skipSure || 'balanced') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      ${tg('lyrics', 'Lyrics from LRCLIB', 'Adds a Lyrics button to the full-screen player. Only when you open it, the song’s title, artist and length are sent to lrclib.net to find matching lyrics.')}
      ${tg('skipCrowd', 'Use SponsorBlock community data', 'Asks sponsor.ajay.app whether people have marked an intro or outro. It is sent a 4-character fingerprint of the video, never the video itself.')}
      ${NATIVE ? '' : tg('skipSilence', 'Detect silence in the audio', 'After a song is saved, ffmpeg finds quiet lead-ins, dead air and long gaps. Needs ffmpeg and runs only on this computer.')}
      <div class="line"><div><div class="l">What it has learned</div><div class="s">${Object.keys(s.skipMemory || {}).length ? `Remembers ${plural(Object.keys(s.skipMemory).length, 'song')} where you undid a skip.` : 'When you undo or rewind an automatic skip, it stops doing that for the song.'}</div></div><button class="btn" data-act="skip-forget">Forget</button></div>
      ${tg('swipeRows', 'Swipe songs for quick actions', 'On touch screens, swipe a song right to play it next or left to like it.')}
      ${tg('headphonesPause', 'Pause when headphones disconnect', NATIVE ? 'Android pauses playback when Bluetooth or wired audio disconnects.' : 'Best effort in the browser. Android handles this natively.')}
      <div class="line"><div><div class="l">Streaming quality</div><div class="s">Best available takes the highest-bitrate YouTube stream. YouTube audio is lossy; lossless playback comes from local files.</div></div><select class="inp" data-set="streamQuality" aria-label="Streaming quality"><option value="best"${s.streamQuality === 'saver' ? '' : ' selected'}>Best available</option><option value="saver"${s.streamQuality === 'saver' ? ' selected' : ''}>Data saver</option></select></div>
      <div class="line"><div><div class="l">Sleep timer</div><div class="s" id="sleep-status">${sleepText()}</div></div><select class="inp" data-set="sleep" aria-label="Sleep timer">${rem ? `<option value="active" selected>${sleepLabel(rem)} left</option>` : ''}<option value="0">Off</option>${sleepOpts}</select></div></div>
    <div class="box rise" style="--i:2" id="set-filters"><h2>Library filters</h2><p class="mut">Hide songs you do not want to see. These filters apply to search, playlists and history on this device.</p>
      ${tg('noAi', 'No AI', 'Best-effort keyword filter for titles and artists that mention AI, generated music, Suno, Udio and similar. It cannot reliably detect AI music.')}
      <div class="line"><div><div class="l">Blocked artists</div><div class="s">${(s.blockedArtists || []).length ? 'Songs by these artists are hidden.' : 'No artists blocked yet.'}</div></div></div>
      ${(s.blockedArtists || []).length ? `<div class="chips block-chips">${s.blockedArtists.map(a => `<button class="chip on" data-act="unblock-artist" data-a="${esc(a)}" title="Unblock ${esc(a)}">${esc(a)} ${I.close}</button>`).join('')}</div>` : ''}
      <div class="line"><div class="inline" style="flex:1;justify-content:flex-end"><input class="inp" id="block-artist" type="text" placeholder="Artist name" aria-label="Artist name to block"><button class="btn" data-act="block-artist">Block</button></div></div>
      <div class="line"><div class="l">Listening recap</div><button class="btn" data-go="recap">${I.chart}Open recap</button></div></div>
    <div class="box rise" style="--i:3" id="set-sync"><h2>Devices</h2><p class="mut">Sync playlists, liked songs and listening history between Wavelength installations. Settings and downloads stay on each device.</p><div id="sync-box">${syncHTML()}</div>${syncExtras()}<div id="access-box">${accessHTML()}</div></div>
    ${NATIVE ? `<div class="box rise" style="--i:3" id="set-storage"><h2>Storage</h2>
      <p class="mut">Playlists, liked songs and history live on this phone. Songs stream on demand and are not saved for offline listening yet.</p>
      <div class="storage-box" id="storage-stats">${storageHTML()}</div>
      <div class="line"><div><div class="l">Offline downloads</div><div class="s">Coming next. Streaming, sync and lock-screen controls work now.</div></div><button class="btn" data-go="downloads">Details</button></div></div>` : `<div class="box rise" style="--i:3" id="set-storage"><h2>Downloads &amp; storage</h2>
      <div class="line"><div class="l">MP3 quality</div><select class="inp" data-set="quality" aria-label="MP3 quality">${[128, 192, 256, 320].map(q => `<option${s.quality === q ? ' selected' : ''}>${q}</option>`).join('')}</select></div>
      <div class="line"><div class="l">Folder</div><div class="inline" style="flex:1;justify-content:flex-end"><input class="inp" id="dl-dir" value="${esc(h.downloadDir || '')}" aria-label="Download folder"><button class="btn" data-act="save-dir">Save</button></div></div>
      <div class="line"><div><div class="l">Lossless local files</div><div class="s">FLAC, WAV, AIFF and ALAC play untouched at their original quality.${R.localReady ? ` ${plural(R.local.length, 'file')} added.` : ''}</div></div><div class="acts" style="margin:0"><button class="btn solid" data-act="local-pick">${I.plus}Add files</button><button class="btn" data-act="local-scan">Rescan</button></div></div>
      ${h.localDir ? `<div class="line"><div><div class="l">Local folder</div><div class="s mono-break">${esc(h.localDir)}</div></div><button class="btn" data-go="local">Open</button></div>` : ''}
      <div class="storage-box" id="storage-stats">${storageHTML()}</div>
      <div class="line"><div><div class="l">Playback cache</div><div class="s">Downloaded songs and covers stay. Only temporary stream files are cleared.</div></div><button class="btn" data-act="clear-cache">Clear cache</button></div></div>`}
    ${NATIVE ? `<div class="box rise" style="--i:4" id="set-import"><h2>Spotify import</h2><p class="mut">Spotify account import runs on the computer for now. On the phone you can paste a list of songs and match it on YouTube.</p><button class="btn" data-go="import">Paste a song list</button></div>` : `<div class="box rise" style="--i:4" id="set-import"><h2>Spotify</h2><div class="line"><div><div class="l">Client ID</div><div class="s">${h.clientId ? esc(h.clientId.slice(0, 6)) + '…' : 'Not set'} · ${h.spotifyConnected ? 'connected' : 'not connected'}</div></div><button class="btn" data-go="import">Manage</button></div>
      <div class="line"><div><div class="l">Importing</div><div class="s">Preview playlists, keep matched songs, and choose a cover before saving.</div></div><button class="btn" data-go="import">Open import</button></div></div>`}
    ${NATIVE ? `<div class="box rise" style="--i:5" id="set-lock"><h2>Lock screen</h2><p class="mut">What appears over the lock screen while music plays. Open Preview to try changes.</p>
      <div class="line"><div><div class="l">Layout</div><div class="s">Artwork first, compact, visualizer first, or just the title.</div></div><select class="inp" data-set="lockLayout" aria-label="Lock-screen layout">${[['art', 'Artwork'], ['compact', 'Compact'], ['viz', 'Visualizer first'], ['minimal', 'Title only']].map(([v, n]) => `<option value="${v}"${(s.lockLayout || 'art') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="line"><div><div class="l">Look</div><div class="s">Accent keeps your theme colour. Album tints the background with the cover. Black is pure black for OLED screens.</div></div><select class="inp" data-set="lockTheme" aria-label="Lock-screen look">${[['accent', 'Accent'], ['album', 'Album'], ['amoled', 'Black']].map(([v, n]) => `<option value="${v}"${(s.lockTheme || 'accent') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      ${tg('lockControls', 'Playback buttons', 'Previous, play or pause, and next.')}
      <div class="line"><div><div class="l">Stay visible</div><div class="s">How long it stays before fading out. Always stays until you unlock.</div></div><select class="inp" data-set="lockHide" aria-label="Lock-screen duration">${[[5, '5 seconds'], [9, '9 seconds'], [15, '15 seconds'], [0, 'Always']].map(([v, n]) => `<option value="${v}"${+(s.lockHide ?? 9) === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      ${tg('lockHint', 'Show the hint line', 'The small “tap to keep” text at the bottom.')}</div>` : ''}
    <div class="box rise" style="--i:5" id="set-features"><h2>Features</h2><p class="mut">Switch off what you do not use. Hidden features stop running and their screens and buttons disappear.</p>
      ${FEATURES.map(([k, n, d]) => `<div class="line"><div><div class="l">${esc(n)}</div><div class="s">${esc(d)}</div></div><button class="tg${featOn(k) ? ' on' : ''}" data-act="feat-toggle" data-k="${k}" aria-label="${esc(n)}" aria-pressed="${featOn(k)}"></button></div>`).join('')}
      ${NATIVE ? '' : `<div class="line"><div><div class="l">Discord Rich Presence</div><div class="s">Shows the song you are playing on your Discord profile. Needs the Discord desktop app open and an Application ID from discord.com/developers. Sends the title, artist and cover only to your local Discord.</div></div><button class="tg${s.discord ? ' on' : ''}" data-act="discord-toggle" aria-label="Discord Rich Presence" aria-pressed="${!!s.discord}"><i></i></button></div>
      <div class="line"><div><div class="l">Discord Application ID</div><div class="s" id="discord-status">${discordStatusText()}</div></div><input class="inp" id="discord-id" type="text" inputmode="numeric" placeholder="Application ID" value="${esc(s.discordId || '')}" aria-label="Discord Application ID"></div>`}
      <div class="line"><div><div class="l">Restore all features</div><div class="s">Turns everything back on.</div></div><button class="btn" data-act="feat-all-settings">Restore</button></div>
      <div class="line"><div><div class="l">Opening screen</div><div class="s">Run the feature picker again.</div></div><button class="btn" data-act="feat-setup">Open</button></div></div>
    <div class="box rise" style="--i:5" id="set-status"><h2>Status</h2>
      <div class="line"><div><div class="l">Keyboard shortcuts</div><div class="s">Open the full list with <b>?</b>.</div></div><button class="btn" data-act="shortcuts">${I.keyboard}Shortcuts</button></div>
      <div class="line"><div class="l">Version</div><div class="meta" id="set-version">${h.version ? 'v' + esc(h.version) : (R.stats && R.stats.version ? 'v' + esc(R.stats.version) : '—')}</div></div>
      <div class="line"><div class="l">${NATIVE ? 'Playback engine' : 'yt-dlp'}</div><div class="meta">${NATIVE ? 'NewPipeExtractor · direct YouTube audio' : (h.ytdlp ? esc(h.ytdlp) : 'missing — brew install yt-dlp')}</div></div>
      ${NATIVE ? `<div class="line"><div class="l">Background audio</div><div class="meta">MediaSession + foreground notification</div></div>` : `
      <div class="line"><div class="l">ffmpeg</div><div class="meta">${h.ffmpeg ? esc(h.ffmpeg) : 'missing — brew install ffmpeg'}</div></div>
      <div class="line"><div class="l">ffprobe</div><div class="meta">${h.ffprobe ? esc(h.ffprobe) : 'missing — brew install ffmpeg'}</div></div>`}
      <div class="line"><div class="l">Ads</div><div class="meta">None</div></div><div class="line"><div class="l">Price</div><div class="meta">Free</div></div></div></div>`;
}

/* ═════════ router ═════════ */
let curRoute = 'home', curArg = '', routeTok = 0, drawn = false;
const V = { share: a => { if (R.sharing !== a) { R.sharing = a; importLink(a); } return '<h1 class="ttl">Importing…</h1>' + loader(); }, home: vHome, search: vSearch, library: vLib, local: vLocal, playlist: vPlaylist, liked: () => vPlaylist('liked'), import: vImport, downloads: vDl, settings: vSet, recap: vRecap };
/* A redraw caused by a change (a like, a sort, an undo) keeps the rows still;
   only arriving at a page plays the entrance. */
let drawKey = '';
function draw() {
  const v = $('#view'), key = curRoute + '/' + curArg;
  v.classList.toggle('still', key === drawKey); drawKey = key;
  v.innerHTML = (V[curRoute] || vHome)(curArg); updMatch(); WLMotion.glideAll();
  requestAnimationFrame(() => { observeRows(); WLMotion.sweepImages(v); });
}

/* Resolve visible rows before they are clicked. IntersectionObserver keeps
   this cheap on long playlists; the server queues at most two extractions. */
let rowObserver;
function observeRows() {
  if (rowObserver) rowObserver.disconnect();
  const rows = $$('.row:not(.flip-ghost)');
  if (!rows.length) return;
  if (!('IntersectionObserver' in window)) {
    rows.slice(0, 4).forEach(r => warmTrack(ctxList(r.dataset.ctx)[+r.dataset.i]));
    return;
  }
  rowObserver = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      rowObserver.unobserve(e.target);
      const r = e.target;
      const t = ctxList(r.dataset.ctx)[+r.dataset.i];
      if (t) warmTrack(t);
    }
  }, { root: $('#main'), rootMargin: '260px 0px' });
  rows.forEach(r => rowObserver.observe(r));
}
let lastRoute = '', lastArg = '';
/* The cover on the current page that belongs to a page we just left. */
function tileFor(r, a) {
  const go = r === 'playlist' ? `playlist/${a}` : r;
  const hit = $$('#view [data-go]').find(e => e.dataset.go === go);
  return hit ? hit.querySelector('.cover, .art') : null;
}
async function route() {
  const [name, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const my = ++routeTok, v = $('#view');
  curRoute = V[name] && featOn(name) ? name : 'home'; curArg = decodeURIComponent(rest.join('/'));
  R.plFilter = ''; drawKey = '';
  $$('.nav a,.mnav a').forEach(a => {
    const r = a.dataset.r || (a.dataset.go || '').split('/')[0];
    const on = r === curRoute || ((curRoute === 'liked' || curRoute === 'playlist' || curRoute === 'local') && r === 'library');
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const mark = WLMotion.takeMark(), oldHdr = drawn ? $('#view .ph .cover') : null;
  const prevRoute = lastRoute, prevArg = lastArg; lastRoute = curRoute; lastArg = curArg;
  const swap = () => {
    v.classList.remove('out', 'in'); draw();
    $('#main').scrollTo({ top: 0 });
    if (curRoute === 'search' && document.activeElement !== $('#q')) $('#q').value = curArg;
    updateSearchClear();
    if (curRoute === 'downloads') dlPoll();
    WLMotion.glideAll();
  };
  WLMotion.glideAll();
  // Only morph when a cover really exists on both sides; a plain page change
  // is cheaper and just as smooth as the CSS entrance.
  const pair = mark ? ['playlist', 'liked', 'local'].includes(curRoute)
    : !!oldHdr && ['home', 'library'].includes(curRoute);
  if (drawn && pair && WLMotion.canVT()) {
    // The clicked cover (or, going back, the header cover) travels to the matching cover on the new page.
    WLMotion.page(swap, { from: mark || oldHdr, dest: () => mark ? $('#view .ph .cover') : tileFor(prevRoute, prevArg) });
  } else {
    swap();
    requestAnimationFrame(() => { if (my === routeTok) v.classList.add('in'); });
  }
  drawn = true;

  // Warm the first likely click in this view while the user reads the page.
  clearTimeout(R.warmViewT);
  let first = null;
  if (curRoute === 'home') first = S.history[0];
  else if (curRoute === 'liked') first = S.liked[0];
  else if (curRoute === 'local') first = R.local[0];
  else if (curRoute === 'playlist') first = (S.playlists.find(p => p.id === curArg) || {}).tracks?.[0];
  if (first) R.warmViewT = setTimeout(() => { if (my === routeTok) warmTrack(first); }, 700);
}
const nav = h => { if (location.hash.slice(1) === h) route(); else location.hash = h; };
const refreshView = () => { if (curRoute !== 'search') draw(); };

/* ═════════ sidebar ═════════ */
function drawSide() {
  $('#side-pl').innerHTML = `<div class="spl" data-go="liked" title="Liked Songs"><div class="cover liked" style="width:38px;border-radius:12px">${I.heartF}</div><div><div class="n">Liked Songs</div><div class="c">${S.liked.length} songs</div></div></div>` +
    `<div class="spl" data-go="local" title="Local files"><div class="cover local-cover" style="width:38px;border-radius:12px">${I.disc}</div><div><div class="n">Local files</div><div class="c">${R.localReady ? plural(R.local.length, 'song') : 'Lossless audio'}</div></div></div>` +
    [...pinnedPls(), ...S.playlists.filter(p => !isPinned(p.id))].map(p => `<div class="spl${isPinned(p.id) ? ' pinned' : ''}" data-go="playlist/${p.id}" title="${esc(p.name)}${isPinned(p.id) ? ' (pinned)' : ''}">${cover(p)}<div><div class="n">${esc(p.name)}</div><div class="c">${p.tracks.length} songs</div></div></div>`).join('');
  syncShortcuts();
}

/* ═════════ audio engine + visualizer ═════════ */
const audioA = $('#audio'), audioB = $('#audio-b');
let audio = audioA, spareAudio = audioB;
const audioEls = [audioA, audioB];
let preparedNext = null;
let actx, analyser, gain, normGain, limiter, freq, wave;
function ensureGraph() {
  if (NATIVE) return;
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.78;
    gain = actx.createGain();
    normGain = actx.createGain(); normGain.gain.value = 1;
    limiter = actx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.knee.value = 8;
    limiter.ratio.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    for (const el of audioEls) {
      if (el.__wlSource) continue;
      const src = actx.createMediaElementSource(el);
      src.connect(analyser);
      el.__wlSource = src;
    }
    analyser.connect(normGain); normGain.connect(limiter); limiter.connect(gain); gain.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount); wave = new Uint8Array(analyser.fftSize);
    for (const el of audioEls) el.volume = 1;
    applyVol();
  } catch { actx = null; analyser = null; }
}
/* Loudness balancing uses the actual waveform, not a lookup table. It nudges
   the gain toward a comfortable RMS while a compressor catches peaks. This is
   best-effort. Android cannot read Web Audio samples for the remote stream, so
   it samples the same file natively and only attenuates (see smartGain). */
function smartVolumeTick() {
  if (NATIVE || !analyser || !normGain || !R.playing || !S.settings.smartVolume) return;
  const now = performance.now();
  if (now - (R.normAt || 0) < 700) return;
  R.normAt = now;
  try {
    analyser.getByteTimeDomainData(wave);
    let sum = 0;
    for (let i = 0; i < wave.length; i += 2) { const v = (wave[i] - 128) / 128; sum += v * v; }
    const rms = Math.sqrt(sum / Math.max(1, wave.length / 2));
    if (rms < 0.012) return; // silence / near-silence
    const target = 0.15;
    const want = Math.max(0.45, Math.min(1.65, target / rms));
    R.normGain += (want - R.normGain) * 0.22;
    normGain.gain.setTargetAtTime(R.normGain, actx.currentTime, 0.3);
  } catch {}
}
/* Android smart volume. The native side decodes the first few seconds of the
   song and answers with a gain in [0.55, 1]. Element volume carries only that
   attenuation; the phone's media stream stays the user's own volume. */
const smartGains = new Map();
let smartGain = 1, smartFade = null;
function setSmartGain(g, animate = true) {
  const target = Math.max(0.1, Math.min(1, Number(g) || 1));
  smartGain = target;
  if (!NATIVE) return;
  if (smartFade) { clearInterval(smartFade); smartFade = null; }
  const apply = v => audioEls.forEach(el => { el.volume = v; });
  if (!S.settings.smartVolume || R.muted) { apply(1); return; }
  if (!animate) { apply(target); return; }
  const from = audio.volume || 1, steps = 6;
  let step = 0;
  smartFade = setInterval(() => {
    step++;
    apply(from + (target - from) * Math.min(1, step / steps));
    if (step >= steps) { clearInterval(smartFade); smartFade = null; }
  }, 60);
}
function requestSmartGain(t) {
  if (!NATIVE || !t || !t.ytId) return;
  const id = t.ytId;
  if (!S.settings.smartVolume) { setSmartGain(1, false); return; }
  if (smartGains.has(id)) { setSmartGain(smartGains.get(id), false); return; }
  setSmartGain(1, false);
  setTimeout(() => {
    if (!S.settings.smartVolume || !R.cur || R.cur.ytId !== id) return;
    try { window.AndroidBridge.analyzeLoudness(id, S.settings.streamQuality || 'best'); }
    catch {}
  }, 900);
}
window.wlLoudness = (id, gain) => {
  if (!id) return;
  const g = Math.max(0.1, Math.min(1, Number(gain) || 1));
  smartGains.set(id, g);
  if (!S.settings.smartVolume || !R.cur || R.cur.ytId !== id) return;
  setSmartGain(g);
};
/* ── volume ─────────────────────────────────────────────────────────── */
/* Desktop and the browser attenuate the graph. Android uses the phone's media
   stream instead, so the slider, hardware keys and the system panel all agree.
   `mediaMax` is the phone's step count, used to round fractions to real levels. */
let mediaMax = 0;
function readMediaVolume() {
  if (!NATIVE) return null;
  try {
    const raw = window.AndroidBridge.mediaVolume();
    if (!raw) return null;
    const info = JSON.parse(raw);
    if (!info || !(info.max > 0)) return null;
    mediaMax = info.max;
    return Math.min(1, Math.max(0, info.level / info.max));
  } catch { return null; }
}
function writeMediaVolume(f) {
  if (!NATIVE) return false;
  try { return window.AndroidBridge.setMediaVolume(f) === true; } catch { return false; }
}
/* Hardware keys reach us here. Do not call applyVol(): that would write the
   same level back to the system and fight the key press. */
window.wlMediaVolume = (level, max) => {
  if (!NATIVE || !(max > 0)) return;
  mediaMax = max;
  const f = Math.min(1, Math.max(0, level / max));
  S.settings.volume = f;
  R.muted = f === 0;
  paintVol();
};
function paintVol() {
  const pct = Math.round((R.muted ? 0 : S.settings.volume) * 100);
  $$('.js-vol-fill').forEach(el => { el.style.width = pct + '%'; });
  $$('[data-vol]').forEach(el => {
    el.setAttribute('aria-valuenow', pct);
    el.setAttribute('aria-valuetext', pct + ' percent');
  });
  $$('.js-vol-icon').forEach(el => { el.innerHTML = R.muted || S.settings.volume === 0 ? I.mute : I.vol; });
  $$('[data-volset]').forEach(el => { el.value = pct; });
  if (S.settings.volume > 0) lastVolume = S.settings.volume;
}
function applyVol() {
  const v = R.muted ? 0 : S.settings.volume;
  if (NATIVE) {
    // The phone's media stream is the single volume control. The element stays
    // at full scale except for smart-volume attenuation, so the two do not
    // multiply the user's slider twice.
    if (smartFade) { clearInterval(smartFade); smartFade = null; }
    const g = S.settings.smartVolume ? smartGain : 1;
    audioEls.forEach(el => { if (Math.abs(el.volume - g) > 0.0001) el.volume = g; });
    writeMediaVolume(v);
  } else if (gain) gain.gain.value = v;
  else audioEls.forEach(el => el.volume = v);
  paintVol();
}

/* Sleep timer state lives in settings so it survives reloads and Settings
   redraws. The timeout does the pause; a slow tick only refreshes the label. */
const sleepLeft = () => Math.max(0, (+S.settings.sleepUntil || 0) - Date.now());
const sleepLabel = ms => {
  const min = Math.ceil(ms / 60000);
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60 ? (min % 60) + 'm' : ''}`.trim() : `${min} min`;
};
function sleepText() {
  const rem = sleepLeft();
  return rem ? `Pausing in ${sleepLabel(rem)}` : 'Off';
}
function updateSleepBtn() {
  const b = $('#b-sleep'); if (!b) return;
  const rem = sleepLeft();
  b.textContent = R.sleepAfterSong ? 'Sleep · end of song' : rem ? `Sleep · ${sleepLabel(rem)}` : 'Sleep';
  b.classList.toggle('on', !!(R.sleepAfterSong || rem));
}
function setSleep(min) {
  R.sleepAfterSong = false;
  S.settings.sleepUntil = min ? Date.now() + min * 60000 : 0;
  save(); syncSleep();
  toast(min ? `Sleep timer: pausing in ${sleepLabel(min * 60000)}` : 'Sleep timer off');
  if (curRoute === 'settings') draw();
}
function sleepMenu(x, y) {
  const items = [15, 30, 45, 60].map(m => [sleepLabel(m * 60000), 'clock', () => setSleep(m)]);
  items.push(['After this song', 'clock', () => {
    S.settings.sleepUntil = 0; save(); syncSleep();
    R.sleepAfterSong = true; updateSleepBtn(); toast('Sleep timer: stopping after this song');
  }]);
  if (sleepLeft() || R.sleepAfterSong) items.push(['Turn timer off', 'close', () => setSleep(0)]);
  showMenuItems(items, x, y);
}
function syncSleep() {
  clearTimeout(R.sleepT); clearInterval(R.sleepTick);
  const el = $('#sleep-status'); if (el) el.textContent = sleepText();
  updateSleepBtn();
  const rem = sleepLeft();
  if (!rem) {
    if (S.settings.sleepUntil) { S.settings.sleepUntil = 0; save(); }
    return;
  }
  R.sleepT = setTimeout(() => {
    audio.pause();
    S.settings.sleepUntil = 0; save(); syncSleep();
    toast('Sleep timer: paused');
    if (curRoute === 'settings') draw();
  }, rem);
  R.sleepTick = setInterval(() => {
    const node = $('#sleep-status'); if (node) node.textContent = sleepText();
    updateSleepBtn();
    if (!sleepLeft()) syncSleep();
  }, 15000);
}

/* Android real-audio tap: native Visualizer on the output mix, polled once per frame.
   Falls back to the generated spectrum whenever it is off, denied or stale. */
let tapState = 'off', tapSpec = new Float32Array(32), tapWave = new Float32Array(64), tapAt = 0;
const tapLive = () => NATIVE && tapState === 'ok' && performance.now() - tapAt < 500 && R.playing;
function tapPoll() {
  if (tapState !== 'ok') return;
  let b64 = ''; try { b64 = window.AndroidBridge.readAudioTap(); } catch {}
  if (!b64) return;
  try {
    const bin = atob(b64); if (bin.length < 96) return;
    for (let i = 0; i < 32; i++) tapSpec[i] = bin.charCodeAt(i) / 255;
    for (let i = 0; i < 64; i++) { const c = bin.charCodeAt(32 + i); tapWave[i] = ((c > 127 ? c - 256 : c)) / 128; }
    tapAt = performance.now();
  } catch {}
}
function tapSync() {
  if (!NATIVE) return;
  const want = !!S.settings.realViz && !!S.settings.viz && featOn('viz') && $('#np').classList.contains('open');
  if (!want) { if (tapState !== 'off') { try { window.AndroidBridge.stopAudioTap(); } catch {} tapState = 'off'; } return; }
  if (tapState === 'ok') return;
  let r = 'unavailable'; try { r = window.AndroidBridge.startAudioTap(); } catch {}
  if (r === 'denied') { tapState = 'denied'; try { window.AndroidBridge.requestAudioPermission(); } catch {} }
  else tapState = r === 'ok' ? 'ok' : 'unavailable';
  if (tapState === 'unavailable') toast('This phone does not allow real audio capture. Using the generated visualizer.');
}
window.wlAudioPerm = ok => {
  if (!ok) { S.settings.realViz = false; save(); tapState = 'off'; $$('[data-k="realViz"]').forEach(b => b.classList.remove('on')); toast('Permission denied. Using the generated visualizer.'); return; }
  tapState = 'off'; tapSync();
};
const perfLite = () => document.documentElement.dataset.perf === 'lite';
function applyPerf() {
  const m = S.settings.perf; document.documentElement.dataset.perf = m === 'lite' || (m !== 'full' && NATIVE) ? 'lite' : 'full';
}
let vizRaf = 0, vizLast = 0, vizPrev = 0, vizStep = 0.035, phase = 0, disp = [];
let vizW = 0, vizH = 0, vizDpr = 1, vizRO = null;
const VSTYLES = WLViz.ids;
const VIZ_SIZES = ['sm', 'md', 'lg', 'full'];
/* Android plays through the WebView's native player, which never exposes
   samples to Web Audio. Instead of freezing, the phone draws a track-seeded
   spectrum that runs off the playback clock: it moves only while audio plays,
   changes per song, and stops flat on pause. Desktop/browser still use real
   analyser data. */
let vizSeed = 0.31, vizSeedKey = '';
function vizSeedFor(t) {
  const key = String((t && (t.ytId || t.localId || t.id || t.title)) || '');
  if (key === vizSeedKey) return;
  vizSeedKey = key;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  vizSeed = ((h >>> 0) % 10007) / 10007;
  disp = [];
}
function synthLevelAt(i, n, t, s) {
  const tilt = Math.pow(Math.max(0, 1 - i / n), 0.72);
  const beat = Math.pow(0.5 + 0.5 * Math.sin(t * 3.05 + s), 3);
  const body = 0.5 + 0.5 * Math.sin(t * 1.31 + i * 0.52 + s * 1.7);
  const air = 0.5 + 0.5 * Math.sin(t * 2.63 + i * 1.17 + s * 3.1);
  const dip = 0.5 + 0.5 * Math.sin(t * 0.47 + i * 0.09 + s * 0.8);
  return Math.min(1, 0.1 + tilt * (0.34 * body + 0.3 * beat) * (0.55 + 0.45 * dip) + 0.16 * air * tilt + 0.06 * beat);
}
function synthLevel(i, n) {
  return synthLevelAt(i, n, phase, vizSeed * 6.283);
}
function vizResize() {
  const c = $('#viz'); if (!c) return;
  const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
  const dpr = Math.min(NATIVE ? 1.5 : 2, devicePixelRatio || 1);
  vizW = w; vizH = h; vizDpr = dpr;
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
}
function vizLoop(ts) {
  vizRaf = requestAnimationFrame(vizLoop);
  if (document.hidden) return;
  const active = R.playing && (analyser || NATIVE);
  const fps = motionReduced() ? 15 : active ? (NATIVE ? (perfLite() ? 24 : 30) : 30) : 10;
  if (ts - vizLast < 1000 / fps - 1) return;
  const dt = Math.min(0.09, (ts - (vizPrev || ts)) / 1000);
  vizPrev = ts; vizLast = ts; vizStep = Math.max(0.012, dt * 2.1); vizRealDt = Math.max(0.008, dt);
  const c = $('#viz'); if (!c || !vizW || !vizH) return;
  if (NATIVE) tapPoll();
  drawViz(c, c.getContext('2d'));
}
function vizSync() {
  const open = $('#np').classList.contains('open'), on = open && S.settings.viz && featOn('viz');
  meterSync(open);
  const size = VIZ_SIZES.includes(S.settings.vizSize) ? S.settings.vizSize : 'md';
  document.documentElement.dataset.vizSize = size;
  $('#viz').style.display = S.settings.viz ? '' : 'none';
  $('#b-viz').textContent = WLViz.name(vizStyleId());
  const full = $('#b-viz-full');
  if (full) {
    full.textContent = size === 'full' ? 'Exit full screen' : 'Full screen';
    full.classList.toggle('solid', size === 'full');
  }
  if (on && !vizRaf) {
    vizResize();
    if (!vizRO && 'ResizeObserver' in window) { vizRO = new ResizeObserver(vizResize); vizRO.observe($('#viz')); }
    vizRaf = requestAnimationFrame(vizLoop);
    vizLast = 0; vizPrev = 0;
  }
  if (!on && vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = 0; }
  tapSync();
}
/* Every style lives in viz.js and draws through one shared context. This
   file only decides where the numbers come from: the live analyser on
   desktop, or the track-seeded model on Android. */
const vizSource = {
  level: (i, n) => {
    if (!NATIVE && analyser && R.playing) return Math.min(1, (freq[Math.floor(Math.pow(i / n, 1.55) * freq.length * 0.7) + 1] / 255) * 1.12);
    if (tapLive()) return tapSpec[Math.min(31, Math.floor(i / n * 32))];
    if (tapLive()) return tapSpec[Math.min(31, Math.floor(i / n * 32))];
    if (NATIVE && R.playing) return WLViz.synthLevelAt(i, n, phase, vizSeed * 6.283);
    return 0.06 + 0.04 * Math.sin(phase * 2 + i * 0.55);
  },
  wave: u => {
    if (!NATIVE && analyser && R.playing) return (wave[Math.floor(u * (wave.length - 1))] - 128) / 128;
    if (tapLive()) return tapWave[Math.min(63, Math.floor(u * 63))];
    if (NATIVE && R.playing) return WLViz.synthWaveAt(u, phase, vizSeed * 6.283);
    return Math.sin(u * vizW / 38 + phase * 2) * 0.08;
  },
};
const vizCtx = WLViz.makeCtx(vizSource);
let vizCtxStyle = '', vizRealDt = 0.033;
const vizStyleId = () => { const h = vizHiddenList(), v = S.settings.vizStyle; if (WLViz.has(v) && !h.includes(v)) return v; return WLViz.ids.find(i => !h.includes(i)) || 'matrix'; };
function drawViz(c, g) {
  const w = vizW, h = vizH, dpr = vizDpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const real = !NATIVE && analyser && R.playing;
  vizSeedFor(R.cur);
  phase += vizStep;
  if (real) { analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(wave); }
  const st = vizStyleId();
  if (st !== vizCtxStyle) { vizCtxStyle = st; vizCtx.state = {}; }
  vizCtx.begin(w, h, phase, vizRealDt, VC.accent, VC.dim);
  g.fillStyle = g.strokeStyle = VC.accent;
  WLViz.draw(st, g, vizCtx);
  g.globalAlpha = 1;
}

/* ── style gallery: every style previewed live ────────────────────────── */
let galRaf = 0, galCards = [];
function stopVizGallery() { if (galRaf) cancelAnimationFrame(galRaf); galRaf = 0; galCards = []; }
function vizGallery() {
  const cur = vizStyleId();
  modal(`<div class="eyebrow">Visualizer</div><h3 class="imp-title">Choose a style</h3>
    <p class="mut">${plural(WLViz.styles.length, 'style')}, previewed live in your accent colour. Tap one to use it.${NATIVE ? ' The lock screen draws the closest of the four classic looks.' : ''}</p>
    <div class="viz-gal" id="viz-gal">${vizVisible().map(s => `<button class="viz-card${s.id === cur ? ' on' : ''}" data-act="viz-pick" data-id="${s.id}" aria-pressed="${s.id === cur}" aria-label="${esc(s.name)}. ${esc(s.hint)}"><canvas aria-hidden="true"></canvas><span class="vc-n">${esc(s.name)}</span><span class="vc-h">${esc(s.hint)}</span></button>`).join('')}</div>
    <div class="acts end"><button class="btn solid" data-act="close-modal">Done</button></div>`, 'viz-sheet');
  startVizGallery();
}
function startVizGallery() {
  stopVizGallery();
  const grid = $('#viz-gal'); if (!grid) return;
  galCards = $$('.viz-card', grid).map(el => {
    let ctx;
    const seed = 2.1;
    ctx = WLViz.makeCtx({
      level: (i, n) => Math.min(1, Math.pow(WLViz.synthLevelAt(i, n, ctx.t, seed), 0.8) * 1.28),
      wave: u => WLViz.synthWaveAt(u, ctx.t, seed),
    });
    return { el, cv: $('canvas', el), id: el.dataset.id, ctx };
  });
  let last = 0, t = 0;
  const tick = ts => {
    galRaf = requestAnimationFrame(tick);
    if (!$('#modal').classList.contains('open') || !$('#viz-gal')) { stopVizGallery(); return; }
    const fps = motionReduced() ? 10 : NATIVE ? 20 : 30;
    if (ts - last < 1000 / fps - 1) return;
    const dt = Math.min(0.09, last ? (ts - last) / 1000 : 0.033); last = ts; t += dt * 2.1;
    const view = $('#modal .sheet').getBoundingClientRect(), dpr = Math.min(NATIVE ? 1.25 : 2, devicePixelRatio || 1);
    for (const k of galCards) {
      const r = k.cv.getBoundingClientRect();
      if (r.bottom < view.top || r.top > view.bottom) continue;
      const w = k.cv.clientWidth, h = k.cv.clientHeight; if (!w || !h) continue;
      if (k.cv.width !== Math.round(w * dpr) || k.cv.height !== Math.round(h * dpr)) { k.cv.width = Math.round(w * dpr); k.cv.height = Math.round(h * dpr); }
      const g = k.cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      g.fillStyle = g.strokeStyle = VC.accent;
      k.ctx.begin(w, h, t, dt, VC.accent, VC.dim);
      WLViz.draw(k.id, g, k.ctx);
      g.globalAlpha = 1;
    }
  };
  galRaf = requestAnimationFrame(tick);
}

/* ── fullscreen output meter ───────────────────────────────────────────── */
/* Sits under the volume slider in the full-screen player on every build.
   Desktop and the browser read the live Web Audio analyser. Android cannot
   expose decoded samples to the WebView, so the meter follows the playback
   clock for the current track instead of claiming to measure the stream. */
const METER_SEGS = 24;
let meterEls = [], meterRaf = 0, meterLast = 0, meterVal = 0, meterPeak = 0, meterPeakAt = 0, meterWave = null;
function buildMeter() {
  const host = $('#np-meter'); if (!host) return;
  if (!host.childElementCount) host.innerHTML = '<i></i>'.repeat(METER_SEGS);
  meterEls = [...host.children];
}
function meterTarget() {
  const vol = R.muted ? 0 : Math.max(0, Math.min(1, S.settings.volume));
  if (!R.playing || vol <= 0.001) return 0;
  if (!NATIVE && analyser) {
    try {
      const n = analyser.fftSize;
      if (!meterWave || meterWave.length !== n) meterWave = new Uint8Array(n);
      analyser.getByteTimeDomainData(meterWave);
      let sum = 0;
      for (let i = 0; i < n; i += 2) { const v = (meterWave[i] - 128) / 128; sum += v * v; }
      let out = Math.sqrt(sum / Math.max(1, n / 2)) * vol;
      if (S.settings.smartVolume) out *= Math.max(0.45, Math.min(1.65, R.normGain || 1));
      const db = 20 * Math.log10(Math.max(1e-6, out));
      return Math.max(0, Math.min(1, (db + 48) / 42));
    } catch {}
  }
  // Playback-driven estimate: moves only while audio plays and freezes on pause.
  vizSeedFor(R.cur);
  const t = (audio.currentTime || 0) * 0.85, s = vizSeed * 6.283, n = 18;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += synthLevelAt(i, n, t, s);
  return Math.max(0, Math.min(1, (sum / n) * 1.6 * (0.18 + 0.82 * vol)));
}
function paintMeter() {
  const total = meterEls.length; if (!total) return;
  const lit = Math.round(meterVal * total);
  const peak = Math.max(-1, Math.min(total - 1, Math.round(meterPeak * total) - 1));
  for (let i = 0; i < total; i++) {
    meterEls[i].classList.toggle('on', i < lit);
    meterEls[i].classList.toggle('peak', i >= lit && i === peak);
  }
}
function meterLoop(ts) {
  meterRaf = requestAnimationFrame(meterLoop);
  if (document.hidden) return;
  if (ts - meterLast < 50) return;
  meterLast = ts;
  const target = meterTarget();
  meterVal += (target - meterVal) * (target > meterVal ? 0.58 : 0.16);
  if (meterVal < 0.012) meterVal = 0;
  if (target >= meterPeak) { meterPeak = target; meterPeakAt = ts; }
  else if (ts - meterPeakAt > 450) meterPeak = Math.max(target, meterPeak - 0.02);
  paintMeter();
}
function meterSync(on) {
  buildMeter();
  if (!on) {
    if (meterRaf) cancelAnimationFrame(meterRaf);
    meterRaf = 0; meterVal = 0; meterPeak = 0; paintMeter();
    return;
  }
  if (!meterRaf) { meterLast = 0; meterRaf = requestAnimationFrame(meterLoop); }
}

/* ═════════ playback ═════════ */
/* ═══════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════
   PLAYBACK ENGINE v5 — simplest possible, robust

   1. Resolve YouTube ID (match API).
   2. Set audio.src directly — no /api/ready needed.
      Electron has autoplay-policy=no-user-gesture-required
      and webSecurity:false so there are zero restrictions.
   3. Call audio.load() to start buffering.
   4. Call audio.play() immediately — Electron allows it.
   5. On error: retry once with a fresh URL, then skip.
   ═══════════════════════════════════════════════════ */
let playTok = 0, fails = 0, errSkips = 0, extending = false;
let stallTimer = null, stallLastTime = -1, prepareTimer = 0;
let loadingTrack = 0, mediaErrRetries = 0, skipTimer = 0, skipPending = false;
const pend = new Map();

/* Loading failures have two owners: doPlayTrack's retry ladder and the media
   element's error event. Without coordination both can call next(), which
   makes one bad stream look like a burst of skipped songs. */
function clearSkip() {
  clearTimeout(skipTimer);
  skipTimer = 0;
  skipPending = false;
  updateTransport();
}
function skipBroken(reason) {
  if (skipPending) return;
  skipPending = true;
  updateTransport();
  const tok = playTok;
  clearTimeout(skipTimer);
  skipTimer = setTimeout(() => {
    skipTimer = 0;
    if (tok !== playTok) { skipPending = false; updateTransport(); return; }
    skipPending = false;
    if (++errSkips > 3) {
      errSkips = 0; loadingTrack = 0; setBuffering(false); setPlaying(false);
      toast(reason ? reason + ' — stopped after several failures' : 'Several songs in a row could not play');
      return;
    }
    if (reason) toast(reason);
    next();
  }, 700);
}

function resolve(t) {
  const k = uid(t);
  if (pend.has(k)) return pend.get(k);
  const p = api('/api/match', { json: { key: k, title: t.title, artist: t.artist, duration: t.duration } })
    .then(r => {
      if (r.ytId) {
        t.ytId = r.ytId; delete t.miss;
        if (!t.art) t.art = 'https://i.ytimg.com/vi/' + r.ytId + '/mqdefault.jpg';
      } else { t.miss = true; }
      save(); return t;
    })
    .finally(() => pend.delete(k));
  pend.set(k, p); return p;
}

function setBuffering(on) {
  document.body.classList.toggle('buffering', !!on);
  updateTransport();
}

/* Next is a transport action for the loaded song, not a way to cut off a
   track that is still resolving. Keep it visibly disabled until the current
   media is ready, then restore it for normal playback and paused playback. */
function canNext() {
  return !!R.cur
    && R.queue.length > 0
    && !loadingTrack
    && !skipPending
    && !document.body.classList.contains('buffering')
    && audio.readyState >= 2;
}
function updateTransport() {
  const on = canNext();
  for (const b of $$('[data-act=next]')) {
    b.disabled = !on;
    b.setAttribute('aria-disabled', String(!on));
  }
}

const qualityParam = () => S.settings.streamQuality === 'saver' ? 'saver' : 'best';
async function trackSrc(t, attempt = 0, preload = false) {
  if (!t) return '';
  if (t.localId) return '/api/local/' + encodeURIComponent(t.localId) + '/stream' + (attempt ? '?r=' + attempt : '');
  if (NATIVE) {
    try {
      const r = await api('/api/stream/' + encodeURIComponent(t.ytId) + '?q=' + encodeURIComponent(qualityParam()) + (attempt ? '&r=' + attempt : ''));
      if (!r || !r.url) throw new Error('No audio stream available');
      return r.url;
    } catch (e) {
      if (attempt < 2) {
        await sleep(700);
        return trackSrc(t, attempt + 1, preload);
      }
      throw e;
    }
  }
  const u = new URL('/api/stream/' + encodeURIComponent(t.ytId), location.origin);
  u.searchParams.set('q', qualityParam());
  if (preload) u.searchParams.set('preload', '1');
  if (attempt) u.searchParams.set('r', attempt);
  return u.pathname + u.search;
}

function cancelPrepared() {
  clearTimeout(prepareTimer);
  if (!preparedNext) return;
  const p = preparedNext; preparedNext = null;
  try { p.el.pause(); } catch {}
  try { p.el.removeAttribute('src'); p.el.load(); } catch {}
}

function schedulePrepare(delay = 1800) {
  clearTimeout(prepareTimer);
  if (!S.settings.gapless) return;
  prepareTimer = setTimeout(() => { prepareNext(); }, delay);
}

/* A shuffled queue needs a stable order so preloading, gapless transitions
   and manual Next agree on the same track. The current song always sits at
   the front of a fresh cycle, then every other song plays exactly once. */
function shuffleIndices(len, first = -1) {
  const rest = [];
  for (let i = 0; i < len; i++) if (i !== first) rest.push(i);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return first >= 0 ? [first, ...rest] : rest;
}

function resetShuffleOrder() {
  R.shuffleOrder = [];
  R.shufflePos = -1;
}

function syncShuffleOrder() {
  if (!R.shuffle || !R.queue.length) { resetShuffleOrder(); return; }
  const valid = R.shuffleOrder.length === R.queue.length && R.shuffleOrder.includes(R.idx);
  if (!valid) {
    R.shuffleOrder = shuffleIndices(R.queue.length, R.idx >= 0 ? R.idx : -1);
    R.shufflePos = R.idx >= 0 ? 0 : -1;
  } else {
    R.shufflePos = R.shuffleOrder.indexOf(R.idx);
  }
}

function peekNextIdx() {
  if (!R.queue.length) return -1;
  if (!R.shuffle) return R.idx + 1 < R.queue.length ? R.idx + 1 : -1;
  if (R.queue.length < 2) return -1;
  syncShuffleOrder();
  if (R.shufflePos + 1 >= R.shuffleOrder.length) {
    // A shuffle cycle plays every song once. Only repeat-all starts another.
    if (R.repeat !== 1) return -1;
    R.shuffleOrder = shuffleIndices(R.queue.length, -1);
    R.shufflePos = -1;
  }
  return R.shuffleOrder[R.shufflePos + 1] ?? -1;
}

function previousIdx() {
  if (!R.shuffle) return R.idx - 1;
  if (R.queue.length < 2) return -1;
  syncShuffleOrder();
  return R.shufflePos > 0 ? R.shuffleOrder[R.shufflePos - 1] : -1;
}

function shuffleNearEnd() {
  if (!R.cur || R.queue.length < 2) return false;
  syncShuffleOrder();
  return R.shufflePos >= R.shuffleOrder.length - 2;
}

/* Queue edits invalidate the shuffle permutation and any audio buffered for
   the old "next" track. Warm the newly chosen next immediately. */
function refreshQueue() {
  resetShuffleOrder();
  cancelPrepared();
  if (!R.cur || !R.queue.length) return;
  const ni = peekNextIdx();
  if (ni >= 0 && R.queue[ni]) warmTrack(R.queue[ni]);
  schedulePrepare(300);
}

function prepareNext() {
  cancelPrepared();
  if (NATIVE) return;
  if (!S.settings.gapless || !R.cur || R.repeat === 2) return;
  const idx = peekNextIdx(), t = R.queue[idx];
  if (!t) return;
  if (!t.localId && !t.ytId) {
    resolve(t).then(() => {
      if (R.cur && peekNextIdx() === idx && R.queue[idx] === t) schedulePrepare(80);
    }).catch(() => {});
    return;
  }
  const el = spareAudio;
  if (!el) return;
  // This is a short buffer, not a full download. The stream proxy sends only
  // the ranges the media element asks for.
  try { el.pause(); el.removeAttribute('src'); el.load(); } catch {}
  el.src = trackSrc(t, 0, true);
  el.preload = 'auto';
  try { el.load(); } catch {}
  preparedNext = { el, uid: uid(t), idx, t };
}

function usePrepared(p) {
  const old = audio;
  preparedNext = null;
  audio = p.el;
  spareAudio = old;
  try { old.pause(); old.removeAttribute('src'); old.load(); } catch {}
  R.idx = p.idx; R.cur = p.t; R.resumeTime = 0;
  smartPlanFor(p.t);
  const my = ++playTok;
  clearSkip();
  loadingTrack = my;
  mediaErrRetries = 0;
  ensureGraph(); uiNow(); setBuffering(true);
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  audio.play().then(() => {
    if (my !== playTok) return;
    S.history = [{ ...R.cur }, ...S.history.filter(x => uid(x) !== uid(R.cur))].slice(0, 40);
    countPlay();
    save(); saveSession(true); mediaSession(); warmNext(); startStall();
  }).catch(e => {
    if (my !== playTok || e.name === 'AbortError') return;
    doPlayTrack(p.t, my, 1);
  });
}

const play = (list, i, ctx) => {
  R.queue = [...list];
  if (ctx) R.playCtx = ctxName(ctx);
  resetShuffleOrder(); renderQueue(); playIdx(i);
};

async function playIdx(i, startAt = 0) {
  const t = R.queue[i]; if (!t) return;
  if (!allowed(t)) {
    let j = i + 1;
    while (j < R.queue.length && !allowed(R.queue[j])) j++;
    if (j < R.queue.length) return playIdx(j, startAt);
    setPlaying(false); toast('Everything left is hidden by your filters'); return;
  }
  const my = ++playTok;
  R.idx = i; R.cur = t; R.resumeTime = 0;
  clearStall(); ensureGraph(); uiNow(); setBuffering(true);
  cancelPrepared();
  clearSkip();
  smartPlanFor(t);
  mediaErrRetries = 0;

  // Step 1: resolve YouTube ID if missing. Local files are already ready.
  if (!t.localId && !t.ytId) {
    try { await resolve(t); }
    catch (e) { if (my === playTok) { setBuffering(false); toast(e.message); setPlaying(false); } return; }
  }
  if (my !== playTok) return;

  if (!t.localId && !t.ytId) {
    setBuffering(false); toast('No YouTube match for "' + t.title + '"'); uiNow();
    if (++fails < Math.min(R.queue.length, 8)) { skipBroken('Could not match "' + t.title + '"'); return; }
    setPlaying(false); return;
  }
  fails = 0;

  // Step 2: load and play
  await doPlayTrack(t, my, 0, startAt);
}

function doPlay(ytId, my, attempt, startAt = 0) {
  const t = R.cur && R.cur.ytId === ytId ? R.cur : { ytId };
  return doPlayTrack(t, my, attempt, startAt);
}

async function doPlayTrack(t, my, attempt, startAt = 0) {
  if (my !== playTok) return;
  clearSkip();
  loadingTrack = my;
  cancelPrepared();

  // Offline: only YouTube tracks already cached can play. Local files are
  // served by Wavelength itself and remain available without a connection.
  if (!t.localId && navigator.onLine === false) {
    try {
      const r = await api('/api/cached/' + t.ytId);
      if (!r.cached) {
        loadingTrack = 0;
        setBuffering(false);
        toast('Offline — this song isn’t saved');
        setPlaying(false);
        skipBroken('Skipping offline track');
        return;
      }
    } catch {}
  }
  if (my !== playTok) return;

  // Stop whatever is playing
  for (const el of audioEls) {
    try { el.pause(); } catch {}
    try { el.removeAttribute('src'); el.load(); } catch {}
  }
  audio = audioA; spareAudio = audioB;
  setBuffering(true);

  // Resolve the direct audio URL. On Android this is an asynchronous bridge
  // call into NewPipeExtractor; in the browser it is the local proxy path.
  let src;
  try {
    src = await trackSrc(t, attempt);
  } catch (e) {
    if (my !== playTok) return;
    loadingTrack = 0;
    setBuffering(false);
    toast(e.message || 'Could not find an audio stream');
    skipBroken('Skipping "' + (R.cur && R.cur.title || t.title || 'this track') + '"');
    return;
  }
  if (my !== playTok || !src) return;

  // Set new source — cache-bust on retry
  audio.src = src;
  try { audio.load(); } catch {}
  requestSmartGain(t);
  if (startAt > 0.5) {
    const seek = () => { try { if (!isFinite(audio.duration) || startAt < audio.duration - 1) audio.currentTime = startAt; } catch {} };
    if (audio.readyState >= 1) seek();
    else audio.addEventListener('loadedmetadata', seek, { once: true });
  }

  // In Electron with no-user-gesture-required, play() works immediately.
  // In a browser it may need canplay first — handle both.
  let played = false;
  try {
    if (actx && actx.state === 'suspended') { try { await actx.resume(); } catch {} }
    await audio.play();
    played = true;
  } catch (e) {
    if (my !== playTok) return;
    if (e.name === 'NotAllowedError') {
      // Browser autoplay blocked — wait for canplay then retry play
      await new Promise(ok => {
        const onCan = () => { audio.removeEventListener('canplay', onCan); ok(); };
        audio.addEventListener('canplay', onCan, { once: true });
        setTimeout(ok, 8000); // don't wait forever
      });
      if (my !== playTok) return;
      try { await audio.play(); played = true; } catch {}
    } else if (e.name === 'AbortError') {
      // Aborted by a subsequent load — ignore, let the new playIdx handle it
      return;
    }
  }

  if (!played) {
    if (my !== playTok) return;
    if (attempt < 2) {
      await sleep(1200);
      return doPlayTrack(t, my, attempt + 1, startAt);
    }
    loadingTrack = 0;
    setBuffering(false);
    skipBroken('Skipping "' + (R.cur && R.cur.title || t.title || 'this track') + '" — could not play');
    return;
  }

  if (my !== playTok) return;
  S.history = [{ ...R.cur }, ...S.history.filter(x => uid(x) !== uid(R.cur))].slice(0, 40);
  countPlay();
  save(); saveSession(true); mediaSession(); warmNext(); startStall();
}

function startStall() {
  clearStall(); stallLastTime = audio.currentTime;
  stallTimer = setInterval(() => {
    if (!R.playing || audio.paused) return;
    if (Math.abs(audio.currentTime - stallLastTime) < 0.1) {
      // Stalled — reload stream
      if (R.cur && R.cur.ytId) doPlay(R.cur.ytId, playTok, 1);
    }
    stallLastTime = audio.currentTime;
  }, 10000);
}
function clearStall() { clearInterval(stallTimer); stallTimer = null; }

function warmNext() {
  const nearEnd = R.shuffle ? shuffleNearEnd() : R.queue.length - R.idx <= 2;
  const ni = peekNextIdx();
  const n = ni >= 0 ? R.queue[ni] : null;
  if (n) warmTrack(n);
  schedulePrepare(1800);
  if (nearEnd && S.settings.autoplay && R.repeat !== 1) extend();
}

/* Warm a track before the user commits to it. Extractions are the slow part
   (several seconds), so starting one on hover / for the top search result
   hides that latency. This only resolves the direct audio URL; it never
   downloads a whole song. */
const warmQ = [], WARM_MAX = 6;
const warmSeen = new Map();
let warmBusy = false;

function warmTrack(t) {
  smartWarm(t);
  if (!t || t.miss || t.localId) return;
  if (t.ytId) return warmId(t.ytId);
  resolve(t).then(() => { if (t.ytId) warmId(t.ytId); }).catch(() => {});
}

function warmId(ytId) {
  const key = ytId + ':' + qualityParam();
  if (!ytId || warmQ.includes(key)) return;
  const at = warmSeen.get(key);
  if (at && Date.now() - at < 8 * 60 * 1000) return;
  if (warmQ.length >= WARM_MAX) return;
  warmQ.push(key); pumpWarm();
}

function pumpWarm() {
  if (warmBusy || !warmQ.length) return;
  const key = warmQ.shift(), [id, q] = key.split(':');
  warmBusy = true;
  api('/api/warm/' + id + '?q=' + encodeURIComponent(q || 'best'))
    .catch(() => {})
    .finally(() => {
      warmSeen.set(key, Date.now());
      warmBusy = false;
      setTimeout(pumpWarm, 120);
    });
}

async function extend() {
  // Shuffle is a closed set: it must never pull in songs from outside the
  // playlist/search the user started. A shuffled queue simply ends.
  if (R.shuffle) return 0;
  if (extending || !R.cur || !R.cur.ytId) return 0; extending = true;
  try {
    const r = await api('/api/related/' + R.cur.ytId + (S.settings.noAi ? '?noAi=1' : ''));
    const have = new Set(R.queue.map(t => t.ytId).filter(Boolean));
    const add = ovApply(r.filter(t => !have.has(t.ytId)).slice(0, 12).map(t => ({ ...t, auto: true })));
    R.queue.push(...add); refreshQueue(); renderQueue(); return add.length;
  } catch { return 0; } finally { extending = false; }
}

async function next() {
  if (!R.queue.length) return;
  if (R.shuffle) {
    const i = peekNextIdx();
    if (i < 0) { setPlaying(false); return; }
    playIdx(i);
    return;
  }
  let i = R.idx + 1;
  if (i < 0 || i >= R.queue.length) {
    if (R.repeat === 1) { i = 0; }
    else if (S.settings.autoplay && await extend()) { toast('Endless: queued similar songs'); i = R.idx + 1; }
    else { setPlaying(false); return; }
  }
  playIdx(i);
}

function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const i = previousIdx();
  if (i < 0) { audio.currentTime = 0; return; }
  playIdx(i);
}

function togglePlay() {
  if (!R.cur) {
    if (S.history.length) play(S.history, 0, 'history');
    else toast('Pick a song to start');
    return;
  }
  if (audio.paused) {
    ensureGraph();
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    if (R.resumeTime > 0 && !audio.src) {
      const at = R.resumeTime; R.resumeTime = 0;
      playIdx(R.idx, at);
    } else if (audio.src && audio.readyState >= 2) {
      audio.play().catch(e => {
        if (e.name !== 'AbortError') {
          if (R.cur.localId) playIdx(R.idx);
          else doPlay(R.cur.ytId, ++playTok, 0);
        }
      });
    } else {
      // Reload from scratch
      playIdx(R.idx);
    }
  } else {
    audio.pause();
  }
}

function setPlaying(p) {
  R.playing = p;
  document.body.classList.toggle('playing', p);
  setDm(p);
  if (p) { startListening(); startSmooth(); }
  if (!p) { clearStall(); setBuffering(false); flushListening(); saveSession(true); }
  if (NATIVE) {
    try { window.AndroidBridge.setPlaybackState(!!p, audio.currentTime || 0, isFinite(audio.duration) ? audio.duration : (R.cur && R.cur.duration) || 0); } catch {}
  } else if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  updateTransport();
}

function onEnded() {
  if (R.sleepAfterSong) {
    R.sleepAfterSong = false; updateSleepBtn(); toast('Sleep timer: stopped after the song');
    return;
  }
  if (R.repeat === 2) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  const wantIdx = peekNextIdx();
  const want = wantIdx >= 0 ? R.queue[wantIdx] : null;
  if (preparedNext && want && preparedNext.idx === wantIdx && preparedNext.uid === uid(want)) {
    usePrepared(preparedNext);
    return;
  }
  next();
}

/* ═════════ smart intro / outro skipping ═════════
   public/js/skipper.js decides what is skippable and how sure it is; this is
   the part that talks to the player. Four kinds of evidence feed it: the
   video's chapters, timestamps in its description, SponsorBlock community
   data, and (on desktop) real silence analysis from ffmpeg.

   Each of intros, outros and spoken breaks is Off, a "Skip" button, or
   automatic. Automatic skips only happen when the evidence is strong enough,
   always come with Undo, and the app learns from that Undo. */
const SKIP_MODE_KEY = { intro: 'skipIntro', outro: 'skipOutro', break: 'skipBreaks' };
const skipMode = kind => featOn('skipper') ? (S.settings[SKIP_MODE_KEY[kind]] || 'off') : 'off';
function skipOpts(v) {
  return [['off', 'Off'], ['button', 'Show a Skip button'], ['auto', 'Skip automatically']]
    .map(([k, l]) => `<option value="${k}"${(v || 'off') === k ? ' selected' : ''}>${l}</option>`).join('');
}
const skipAny = () => Object.values(SKIP_MODE_KEY).some(k => (S.settings[k] || 'off') !== 'off');
R.crowdCache = new Map(); R.silCache = new Map(); R.skip = null; R.noSilence = false;

const skipInfo = id => R.infoCache[id] ? Promise.resolve(R.infoCache[id])
  : api('/api/info/' + encodeURIComponent(id)).then(i => (R.infoCache[id] = i || {}));

/* SponsorBlock is asked about a 4-character fingerprint of the video id, never the id itself. */
async function skipCrowd(id) {
  if (!S.settings.skipCrowd || !id) return null;
  const hit = R.crowdCache.get(id);
  if (hit && (hit.ok || Date.now() - hit.at < 5 * 60e3)) return hit.segs;
  try {
    const ctl = new AbortController(), kill = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(WLSkip.crowdUrl(await WLSkip.hashPrefix(id)), { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    clearTimeout(kill);
    let segs;
    if (r.status === 404) segs = [];
    else if (r.ok) segs = WLSkip.pickCrowd(await r.json(), id);
    else throw new Error('status ' + r.status);
    R.crowdCache.set(id, { ok: true, segs, at: Date.now() });
    if (R.crowdCache.size > 300) R.crowdCache.delete(R.crowdCache.keys().next().value);
    return segs;
  } catch { R.crowdCache.set(id, { ok: false, segs: null, at: Date.now() }); return null; }
}

/* Silence analysis needs ffmpeg and the finished audio file, so it is desktop
   only and may not be ready the first time a song plays. */
async function skipSilence(t) {
  if (NATIVE || R.noSilence || !S.settings.skipSilence) return null;
  const key = t.localId ? 'local/' + t.localId : t.ytId; if (!key) return null;
  const hit = R.silCache.get(key); if (hit) return hit;
  try {
    const r = await api('/api/silence/' + (t.localId ? 'local/' + encodeURIComponent(t.localId) : encodeURIComponent(t.ytId)));
    if (r && r.ready) { R.silCache.set(key, r); return r; }
    if (r && r.unavailable) R.noSilence = true;
  } catch {}
  return null;
}

const smartDur = t => (isFinite(audio.duration) && audio.duration) || (t && +t.duration) || (R.skip && R.skip.info && +R.skip.info.duration) || 0;
const smartMemory = u => (S.settings.skipMemory || {})[u] || null;
function smartRemember(u, kind, value) {
  const m = S.settings.skipMemory || (S.settings.skipMemory = {});
  const e = m[u] || (m[u] = {}); e[kind] = value; e.at = Date.now();
  const keys = Object.keys(m);
  if (keys.length > 400) for (const k of keys.sort((a, b) => (m[a].at || 0) - (m[b].at || 0)).slice(0, keys.length - 400)) delete m[k];
  save();
}

function smartPlanFor(t) {
  hideSkipChip(); R.skip = null;
  if (!t || !skipAny()) { renderSkipMarks(); return; }
  const k = R.skip = { uid: uid(t), t, plan: null, dur: 0, info: null, crowd: null, sil: null, fired: {}, honored: {}, oursAt: 0, lastAuto: null, chip: null };
  const live = () => R.skip === k;
  if (t.ytId) {
    skipCrowd(t.ytId).then(c => { if (live() && c) { k.crowd = c; smartRebuild(); } });
    // Chapters come from yt-dlp, which is slow, so wait until the song is underway.
    setTimeout(() => { if (live()) skipInfo(t.ytId).then(i => { if (live()) { k.info = i; smartRebuild(); } }).catch(() => {}); }, 1800);
  }
  const trySilence = n => skipSilence(t).then(r => {
    if (!live()) return;
    if (r) { k.sil = r; smartRebuild(); }
    else if (n < 3 && !R.noSilence) setTimeout(() => { if (live()) trySilence(n + 1); }, [7000, 22000, 60000][n]);
  });
  trySilence(0);
}
function smartRebuild() {
  const k = R.skip; if (!k || !R.cur || k.uid !== uid(R.cur)) return;
  const dur = smartDur(R.cur), segs = [];
  if (k.info) {
    const ch = Array.isArray(k.info.chapters) ? k.info.chapters : [];
    segs.push(...(ch.length ? WLSkip.fromChapters(ch, dur) : WLSkip.fromChapters(WLSkip.parseTimestamps(k.info.description, dur), dur, 'desc')));
  }
  if (k.crowd) segs.push(...WLSkip.fromCrowd(k.crowd, dur));
  if (k.sil) segs.push(...WLSkip.fromSilence(k.sil, dur));
  k.plan = WLSkip.plan(segs, dur); k.dur = dur;
  renderSkipMarks(); smartTick(audio.currentTime || 0, dur);
}
const smartOpts = k => ({ intro: skipMode('intro'), outro: skipMode('outro'), breaks: skipMode('break'), sure: S.settings.skipSure, fired: k.fired, honored: k.honored, remembered: smartMemory(k.uid) });
const smartSegs = k => (k && k.plan ? [k.plan.intro, ...k.plan.breaks, k.plan.outro].filter(Boolean) : []);
const smartKey = seg => seg.kind + '@' + Math.round(seg.start);

function smartTick(c, d) {
  const k = R.skip; if (!k || !k.plan || !R.cur || k.uid !== uid(R.cur) || !d || d < 25) return;
  if (k.chip && Date.now() - k.chip.at > 15000) { k.honored[k.chip.key] = true; hideSkipChip(); }
  const hit = WLSkip.due(k.plan, c, smartOpts(k));
  if (!hit) { if (k.chip) hideSkipChip(); return; }
  if (hit.act === 'auto') smartDo(hit.seg, hit.key, true); else showSkipChip(hit);
}

function smartDo(seg, key, auto) {
  const k = R.skip; if (!k) return;
  k.fired[key] = true; hideSkipChip();
  const from = audio.currentTime || 0, d = smartDur(R.cur), t0 = R.cur, idx0 = R.idx;
  const word = seg.kind === 'break' ? 'break' : seg.kind;
  if (seg.toEnd) {
    if (R.repeat === 2) return;                       // looping one song: never skip its ending
    k.oursAt = Date.now();
    if (canNext()) next(); else { try { audio.currentTime = Math.max(0, d - 0.8); } catch {} }
  } else {
    k.oursAt = Date.now();
    try { audio.currentTime = Math.min(seg.to, Math.max(0, d - 0.5)); } catch {}
  }
  if (!auto) return;
  k.lastAuto = { key, kind: seg.kind, to: seg.to, at: Date.now() };
  undoable(`Skipped ${word}`, () => {
    k.honored[key] = true;
    smartRemember(k.uid, seg.kind, (smartMemory(k.uid) || {})[seg.kind] === 'button' ? 'none' : 'button');
    if (seg.toEnd) { if (R.queue[idx0] && uid(R.queue[idx0]) === uid(t0)) playIdx(idx0, from); }
    else { k.oursAt = Date.now(); try { audio.currentTime = from; } catch {} }
  });
}

/* The person moved the playhead themselves. */
function smartSeeking() {
  const k = R.skip; if (!k || !k.plan || Date.now() - k.oursAt < 700) return;
  const c = audio.currentTime || 0;
  // Rewinding straight after an automatic skip means "I wanted that part".
  if (k.lastAuto && Date.now() - k.lastAuto.at < 9000 && c < k.lastAuto.to - 1) {
    k.honored[k.lastAuto.key] = true;
    smartRemember(k.uid, k.lastAuto.kind, (smartMemory(k.uid) || {})[k.lastAuto.kind] === 'button' ? 'none' : 'button');
    k.lastAuto = null;
  }
  // Seeking into a section means they want to hear it.
  for (const seg of smartSegs(k)) if (c >= seg.start + 0.4 && c < seg.end - 0.3) k.honored[smartKey(seg)] = true;
  hideSkipChip();
}

/* ── the Skip button ── */
function chipEl() {
  let el = $('#skipchip');
  if (!el) {
    el = document.createElement('div'); el.id = 'skipchip'; el.className = 'skipchip'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Skip suggestion');
    el.innerHTML = '<button class="skipchip-go" data-act="skip-now"><span class="sk-l"></span><span class="sk-t"></span></button><button class="skipchip-x" data-act="skip-dismiss" aria-label="Dismiss" title="Not now">×</button>';
    document.body.appendChild(el);
  }
  return el;
}
function showSkipChip(hit) {
  const k = R.skip; if (!k) return;
  if (k.chip && k.chip.key === hit.key) return;
  k.chip = { key: hit.key, seg: hit.seg, at: Date.now() };
  const seg = hit.seg, el = chipEl();
  const left = Math.max(0, (seg.toEnd ? smartDur(R.cur) : seg.to) - (audio.currentTime || 0));
  $('.sk-l', el).textContent = seg.kind === 'intro' ? 'Skip intro' : seg.kind === 'break' ? 'Skip break' : (seg.toEnd ? 'Skip outro' : 'Skip');
  $('.sk-t', el).textContent = left >= 1 ? fmt(left) : '';
  el.classList.add('show');
}
function hideSkipChip() { if (R.skip) R.skip.chip = null; const el = $('#skipchip'); if (el) el.classList.remove('show'); }
function skipNow() {
  const k = R.skip;
  if (k && k.chip) { smartDo(k.chip.seg, k.chip.key, false); return true; }
  toast('Nothing to skip here');
  return false;
}

/* Faint marks on the seek bar show what was detected. */
function renderSkipMarks() {
  const k = R.skip, segs = smartSegs(k).filter(seg => WLSkip.actionFor(seg, skipMode(seg.kind), S.settings.skipSure) !== 'none');
  $$('.dtw[data-seek] .dt').forEach(dt => {
    dt.querySelectorAll('.skm').forEach(n => n.remove());
    if (!k || !k.dur) return;
    for (const seg of segs) {
      const a = Math.max(0, seg.start / k.dur * 100), w = Math.max(0.8, (Math.min(seg.end, k.dur) - seg.start) / k.dur * 100);
      dt.insertAdjacentHTML('beforeend', `<b class="skm skm-${seg.kind}" style="left:${a.toFixed(2)}%;width:${w.toFixed(2)}%" title="${esc(seg.kind)} · ${esc(seg.why.join(' + '))}"></b>`);
    }
  });
}
function smartSettingsChanged() { smartPlanFor(R.cur); if (R.cur && audio.currentTime > 0) smartRebuild(); }
/* Warm what is cheap for the next song so its Skip button is instant. */
function smartWarm(t) { if (skipAny() && t && t.ytId && S.settings.skipCrowd) skipCrowd(t.ytId); }

for (const el of audioEls) {
  el.addEventListener('play',    () => { if (el === audio) setPlaying(true); });
  el.addEventListener('pause',   () => { if (el === audio) setPlaying(false); });
  el.addEventListener('playing', () => { if (el === audio) {
    errSkips = 0; mediaErrRetries = 0; loadingTrack = 0; clearSkip();
    setBuffering(false); setPlaying(true);
  } });
  el.addEventListener('canplay', () => { if (el === audio) setBuffering(false); });
  el.addEventListener('ended',   () => { if (el === audio) onEnded(); });
  el.addEventListener('error',   () => {
    if (el !== audio || !audio.src || !R.cur) return;
    const err = audio.error;
    const msg = err ? ('MediaError ' + err.code + ': ' + err.message) : 'unknown';
    console.error('[audio error]', msg, audio.src);
    // doPlayTrack owns the initial load and its retry ladder. Only step in
    // when playback was already running, and then try one fresh URL first.
    if (loadingTrack === playTok || skipPending) return;
    if (!R.playing) return;
    const at = audio.currentTime || 0;
    setBuffering(false);
    if (mediaErrRetries < 1) {
      mediaErrRetries++;
      setPlaying(false);
      setBuffering(true);
      doPlayTrack(R.cur, playTok, 1, at);
      return;
    }
    setPlaying(false);
    skipBroken('Skipping "' + (R.cur && R.cur.title || 'this track') + '" after a playback error');
  });
  el.addEventListener('timeupdate', () => { if (el === audio && !R.seeking) queueTime(); });
  el.addEventListener('loadedmetadata', () => { if (el === audio) { uiTime(); smartRebuild(); } });
  el.addEventListener('seeking', () => { if (el === audio) smartSeeking(); });
  el.addEventListener('stalled',  () => { if (el === audio) console.warn('[audio] stalled'); });
  el.addEventListener('waiting',  () => { if (el === audio) { console.warn('[audio] waiting/buffering'); setBuffering(true); } });
}
addEventListener('offline', () => toast('Offline — saved songs will still play'));
addEventListener('online',  () => toast('Back online'));



/* The player lives outside the view, so cache these once instead of walking
   the document on every four-per-second timeupdate. */
const fillEls = $$('.js-fill'), curEls = $$('.t-cur'), totEls = $$('.t-tot');
let timeRaf = 0;
function queueTime() {
  if (timeRaf) return;
  timeRaf = requestAnimationFrame(() => { timeRaf = 0; uiTime(); saveSession(); });
}
function uiTime() {
  const d = (isFinite(audio.duration) && audio.duration) || (R.cur && R.cur.duration) || 0, c = audio.currentTime || 0;
  const pct = (d ? c / d * 100 : 0) + '%', cur = fmt(c), tot = fmt(d);
  for (const e of fillEls) e.style.width = pct;
  for (const e of curEls) if (e.textContent !== cur) e.textContent = cur;
  for (const e of totEls) if (e.textContent !== tot) e.textContent = tot;
  $$('[data-seek]').forEach(el => { el.setAttribute('aria-valuenow', d ? Math.round(c / d * 100) : 0); el.setAttribute('aria-valuetext', `${fmt(c)} of ${fmt(d)}`); });
  mediaPos(c, d);
  smartVolumeTick();
  smartTick(c, d);
  if (R.lyr.on) lyricsSync();
}
function seekPreview(f, final) {
  const d = (isFinite(audio.duration) && audio.duration) || (R.cur && R.cur.duration) || 0; if (!d) return;
  R.seeking = !final;
  const pct = f * 100 + '%', cur = fmt(f * d);
  for (const e of fillEls) e.style.width = pct;
  for (const e of curEls) e.textContent = cur;
  if (final) audio.currentTime = f * d;
}
let lastVolume = 0.8;
function setVol(f) {
  f = Math.min(1, Math.max(0, +f || 0));
  // Match the phone's real step count so the slider never claims a level the
  // media stream cannot hold.
  if (NATIVE && mediaMax > 0) f = f === 0 ? 0 : Math.max(1 / mediaMax, Math.round(f * mediaMax) / mediaMax);
  if (f > 0) lastVolume = f;
  S.settings.volume = f; R.muted = false; applyVol(); save();
}
function toggleMute() {
  if (R.muted || S.settings.volume === 0) {
    R.muted = false;
    S.settings.volume = lastVolume || 0.8;
  } else {
    R.muted = true;
  }
  applyVol(); save(); haptic(10);
}
function mediaSession() {
  if (!R.cur) return;
  if (NATIVE) {
    try {
      window.AndroidBridge.setMediaMetadata(JSON.stringify({
        title: R.cur.title || 'Wavelength',
        artist: R.cur.artist || '',
        album: R.cur.album || 'Wavelength',
        art: R.cur.art || '',
        liked: !!liked(R.cur)
      }));
    } catch {}
    return;
  }
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: R.cur.title, artist: R.cur.artist, album: R.cur.album || 'Wavelength', artwork: R.cur.art ? [{ src: R.cur.art, sizes: '512x512' }, { src: R.cur.art, sizes: '256x256' }] : [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  const h = {
    play: () => { audio.play(); }, pause: () => audio.pause(), stop: () => audio.pause(),
    previoustrack: prev, nexttrack: () => { if (canNext()) next(); },
    seekbackward: d => { audio.currentTime = Math.max(0, audio.currentTime - ((d && d.seekOffset) || 10)); },
    seekforward: d => { audio.currentTime += (d && d.seekOffset) || 10; },
    seekto: d => { audio.currentTime = d.seekTime; },
  };
  for (const k in h) try { ms.setActionHandler(k, h[k]); } catch {}
}
let lastPos = -1;
function mediaPos(c, d) {
  if (NATIVE) {
    if (!R.cur || Math.floor(c) === lastPos) return;
    lastPos = Math.floor(c);
    try { window.AndroidBridge.setPlaybackState(!!R.playing, c, d || 0); } catch {}
    return;
  }
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !d || !isFinite(d) || Math.floor(c) === lastPos) return;
  lastPos = Math.floor(c); try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: 1, position: Math.min(c, d) }); } catch {}
}

/* Best-effort web/desktop headphone detection. Android does this natively via
   ACTION_AUDIO_BECOMING_NOISY; browsers only expose coarse devicechange
   events, and some only after microphone permission. */
let outputWatch = false;
async function outputSnapshot() {
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    return new Set(list.filter(d => d.kind === 'audiooutput').map(d => d.deviceId || d.label).filter(Boolean));
  } catch { return null; }
}
async function watchAudioOutputs() {
  if (NATIVE || outputWatch || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  outputWatch = true;
  let known = await outputSnapshot();
  const onChange = async () => {
    const now = await outputSnapshot();
    const gone = known && now ? [...known].filter(id => !now.has(id)) : [];
    known = now;
    if (gone.length && S.settings.headphonesPause && R.playing && audio && !audio.paused) {
      audio.pause();
      toast('Audio output disconnected — paused');
    }
  };
  try { navigator.mediaDevices.addEventListener('devicechange', onChange); }
  catch { try { navigator.mediaDevices.ondevicechange = onChange; } catch {} }
}

function syncNativePrefs() {
  if (!NATIVE) return;
  try { window.AndroidBridge.setHeadphonesPause(!!S.settings.headphonesPause); } catch {}
  try { window.AndroidBridge.setLockPrefs(S.settings.lockLayout || 'art', S.settings.lockTheme || 'accent', S.settings.lockControls !== false, Math.round((+(S.settings.lockHide ?? 9)) * 1000), S.settings.lockHint !== false); } catch {}
  try {
    window.AndroidBridge.setVisualizerPrefs(
      vizStyleId(),
      S.settings.vizSize || 'md',
      !!S.settings.viz && featOn('viz'),
      !!S.settings.lockVisualizer && featOn('viz'),
      VC.accent || '#d71921'
    );
  } catch {}
}

/* Commands from the lock screen, Bluetooth headset and notification. */
window.wlNativeCmd = (cmd, arg) => {
  if (cmd === 'play') {
    if (!R.cur) { if (S.history.length) play(S.history, 0, 'history'); return; }
    if (audio.paused) togglePlay();
  } else if (cmd === 'pause') {
    audio.pause();
  } else if (cmd === 'toggle') {
    togglePlay();
  } else if (cmd === 'next') {
    next();
  } else if (cmd === 'prev') {
    prev();
  } else if (cmd === 'seek') {
    const d = isFinite(audio.duration) ? audio.duration : (R.cur && R.cur.duration) || 0;
    audio.currentTime = Math.max(0, Math.min(+arg || 0, d || Infinity));
    mediaPos(audio.currentTime, d);
  } else if (cmd === 'like') {
    if (R.cur) toggleLike(R.cur);
  }
};

/* Android Back button: close whatever is on top before leaving the page.
   Returns true when the page handled it. */
window.wlBack = () => {
  if ($('#modal').classList.contains('open')) { closeModal(false); return true; }
  if ($('#menu').classList.contains('open')) { closeMenu(); return true; }
  if ($('#queue').classList.contains('open')) { $('#queue').classList.remove('open'); return true; }
  if (npIsOpen()) { toggleNP(false); return true; }
  return false;
};

/* Launch commands from the widget or an app shortcut. The page may still be
   booting when Android asks, so they wait for the first render. */
let launchQueue = [], booted = false;
window.wlLaunch = (cmd, arg) => {
  if (!booted) { launchQueue.push([cmd, arg]); return; }
  if (cmd === 'route') { if (arg) nav(String(arg)); }
  else if (cmd === 'playliked') acts.playliked();
  else if (cmd === 'smartshuffle') acts.smartshuffle();
  else window.wlNativeCmd(cmd, arg);
};

/* ═════════ player UI ═════════ */
/* ═════════ session memory ═════════ */
const SESSION_KEY = 'wl-session';
function saveSession(force = false) {
  if (!S.settings.resume) return;
  if (!R.cur || !R.queue.length) { try { localStorage.removeItem(SESSION_KEY); } catch {} return; }
  const now = Date.now();
  if (!force && now - (R.sessSaved || 0) < 4000) return;
  R.sessSaved = now;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      queue: R.queue.slice(0, 250), idx: R.idx, cur: R.cur,
      time: R.resumeTime || audio.currentTime || 0, ctx: R.playCtx || '',
      shuffle: R.shuffle, repeat: R.repeat, at: now
    }));
  } catch {}
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function restoreSession() {
  if (!S.settings.resume) return;
  let st; try { st = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch {}
  if (!st || !st.cur || !Array.isArray(st.queue) || !st.queue.length) return;
  R.queue = ovApply(st.queue.slice(0, 250));
  R.idx = Math.max(0, Math.min(+st.idx || 0, R.queue.length - 1));
  R.cur = R.queue[R.idx] || ovApply([st.cur])[0];
  if (!R.cur) return;
  R.playCtx = typeof st.ctx === 'string' ? st.ctx : '';
  R.shuffle = !!st.shuffle;
  R.repeat = [0, 1, 2].includes(+st.repeat) ? +st.repeat : 0;
  R.resumeTime = Math.max(0, +st.time || 0);
  $$('[data-act=shuffle]').forEach(b => b.classList.toggle('on', R.shuffle));
  $$('[data-act=repeat]').forEach(b => {
    b.innerHTML = R.repeat === 2 ? I.repeat1 : I.repeat;
    b.classList.toggle('on', R.repeat > 0);
  });
  renderQueue(); uiNow(); hl();
  const d = +R.cur.duration || 0, p = d ? Math.min(1, R.resumeTime / d) : 0;
  for (const e of fillEls) e.style.width = p * 100 + '%';
  for (const e of curEls) e.textContent = fmt(R.resumeTime);
}

/* The previous artwork stays underneath and fades out as the new one fades in. */
function swapArt(el, html) {
  if (!el) return;
  const old = el.querySelector(':scope > .art:not(.art-out)');
  el.querySelectorAll(':scope > .art-out').forEach(n => n.remove());
  el.innerHTML = html;
  if (old && old.querySelector('img') && !motionReduced()) {
    old.classList.add('art-out'); el.appendChild(old);
    old.addEventListener('animationend', () => old.remove(), { once: true });
  }
}
/* The seek bar is moved every frame while playing. timeupdate only fires a few
   times a second, which reads as stepping. */
let lastPct = '';
function startSmooth() {
  WLMotion.smooth(() => {
    if (!R.playing) return false;
    if (R.seeking) return true;
    const d = (isFinite(audio.duration) && audio.duration) || (R.cur && R.cur.duration) || 0; if (!d) return true;
    const c = audio.currentTime || 0, pct = Math.min(100, c / d * 100).toFixed(2) + '%';
    if (pct !== lastPct) { lastPct = pct; for (const e of fillEls) e.style.width = pct; }
    const cur = fmt(c); for (const e of curEls) if (e.textContent !== cur) e.textContent = cur;
    return true;
  });
}
function uiNow() {
  if (R.lyr && R.lyr.on && R.cur && uid(R.cur) !== R.lyr.key) lyricsLoad();
  const t = R.cur; if (!t) { updateTransport(); return; }
  const artist = t.artist + (t.localId ? ' · ' + localQualityText(t) : '');
  for (const sel of ['#p-meta', '#np-art', '.np-meta']) { const n = $(sel); if (n) { n.classList.remove('swap'); void n.offsetWidth; n.classList.add('swap'); } }
  $('#p-title').textContent = t.title; $('#p-artist').textContent = artist;
  swapArt($('#p-art'), art(t)); swapArt($('#np-art'), art(t));
  $('#np-title').textContent = t.title; $('#np-artist').textContent = artist;
  $('#np').style.setProperty('--np-art', t.art ? `url("${t.art.replace(/"/g, '%22')}")` : 'none');
  document.title = `${t.title} · ${t.artist}`;
  for (const e of totEls) e.textContent = fmt(t.duration);
  for (const e of fillEls) e.style.width = '0%';
  hl();
  updateTransport();
}
function hl() {
  const t = R.cur;
  const lk = t && liked(t);
  $('#p-like').innerHTML = lk ? I.heartF : I.heart; $('#p-like').classList.toggle('on', !!lk);
  $$('.np-like').forEach(b => { b.innerHTML = lk ? I.heartF : I.heart; b.classList.toggle('on', !!lk); });
  $$('.row:not(.flip-ghost)').forEach(r => {
    const x = ctxList(r.dataset.ctx)[+r.dataset.i]; if (!x) return;
    r.classList.toggle('on', isCur(x));
    const h = $('.hrt', r), l = liked(x); h.classList.toggle('on', l); h.innerHTML = l ? I.heartF : I.heart;
  });
  $$('.qi').forEach(q => q.classList.toggle('on', +q.dataset.qi === R.idx));
}
function toggleLike(t) {
  if (liked(t)) S.liked = S.liked.filter(x => !(uid(x) === uid(t) || (x.ytId && x.ytId === t.ytId)));
  else { S.liked.unshift({ ...t, addedAt: Date.now() }); toast('Added to Liked Songs'); }
  save(); drawSide(); hl(); if (curRoute === 'liked' || curRoute === 'library') draw();
  if (NATIVE && R.cur && uid(R.cur) === uid(t)) { try { window.AndroidBridge.setLiked(!!liked(t)); } catch {} }
}
const renderQueueSmooth = () => WLMotion.flip($('#q-list'), renderQueue, { sel: ':scope > .qi' });
function renderQueue() {
  $('#q-list').innerHTML = R.queue.length ? R.queue.map((t, i) => `<div class="qi${i === R.idx ? ' on' : ''}" data-qi="${i}" data-k="${esc(uid(t))}"><span class="qgrip" title="Drag to reorder" aria-hidden="true">${I.grip}</span>${art(t, 'sm')}<div class="qm"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.localId ? ' ' + localBadge(t) : ''}${t.auto ? ' · endless' : ''}</div></div><button class="ib sm" data-act="qrm" data-i="${i}" title="Remove from queue" aria-label="Remove ${esc(t.title)} from queue">${I.close}</button></div>`).join('') : '<div class="empty">Nothing queued.</div>';
}
/* The full-screen player animates, so "is it open" has to mean "will it be
   open once the pending change lands". Two quick Back presses then close it
   once instead of reopening it. */
let npTarget = null;
const npIsOpen = () => npTarget ?? $('#np').classList.contains('open');
function toggleNP(force) {
  const cur = npIsOpen(), want = typeof force === 'boolean' ? force : !cur;
  if (want === cur) return;
  npTarget = want;
  WLMotion.player(() => {
    $('#np').classList.toggle('open', want); vizSync();
    if (npTarget === want) npTarget = null;
  }, want);
}
function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch {} }
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => toast('Clipboard is blocked'));
}
async function startRadio(t) {
  try {
    if (t.localId) return toast('Start radio works with YouTube-sourced songs');
    if (!t.ytId) { toast('Finding the song first…'); await resolve(t); }
    if (!t.ytId) return toast('No YouTube match for that song');
    toast('Starting a station…');
    const list = await api('/api/related/' + t.ytId + (S.settings.noAi ? '?noAi=1' : ''));
    R.shuffle = false;
    R.queue = [{ ...t }, ...ovApply(list.filter(x => x.ytId !== t.ytId).map(x => ({ ...x, auto: true })))];
    R.idx = 0; refreshQueue(); renderQueue(); playIdx(0); nav('home'); saveSession(true);
  } catch (e) { toast(e.message); }
}

/* ═════════ menus & modals ═════════ */
function closeMenu() { $('#menu').classList.remove('open'); }
function openMenu(ctx, i, x, y) {
  const t = ctxList(ctx)[i]; if (!t) return;
  const it = [
    ['Play next', 'next', () => { R.queue.splice(R.idx + 1, 0, t); refreshQueue(); renderQueue(); saveSession(true); toast('Playing next'); }],
    ['Add to queue', 'queue', () => { R.queue.push(t); refreshQueue(); renderQueue(); saveSession(true); toast('Added to queue'); }],
    ['Add to playlist', 'plus', () => addToPl(t)],
    ['Start radio', 'wave', () => startRadio(t)],
    [liked(t) ? 'Remove from Liked' : 'Add to Liked', 'heart', () => toggleLike(t)],
    ...(t.localId ? [] : [['Download MP3', 'dl', () => download(t)]]),
    ['Edit song details', 'edit', () => editSong(t)],
    ...(t.artist ? [['More by this artist', 'user', () => nav('search/' + encodeURIComponent(t.artist))]] : []),
    ['Copy song details', 'copy', () => copyText(`${t.title} — ${t.artist || 'Unknown artist'}`)],
  ];
  if (t.artist && !isBlocked(t)) it.push(['Block this artist', 'block', () => {
    const name = t.artist.trim();
    if (!(S.settings.blockedArtists || []).some(a => normArtist(a) === normArtist(name))) {
      S.settings.blockedArtists = [...(S.settings.blockedArtists || []), name].slice(0, 200);
      save(); draw(); hl(); toast(`Blocked ${name}`);
    }
  }]);
  if (t.ytId && !t.localId) it.push(['Copy YouTube link', 'link', () => copyText('https://www.youtube.com/watch?v=' + t.ytId)]);
  if (ctx === 'queue') it.push(['Remove from queue', 'trash', () => queueRemove(i)]);
  else if (ctx === 'local') it.push(['Delete local file', 'trash', () => deleteLocalTrack(t)]);
  else if (!['search', 'history'].includes(ctx)) it.push(['Remove from this list', 'trash', () => removeFromCtx(ctx, t)]);
  showMenuItems(it, x, y);
}
function showMenuItems(it, x, y) {
  R.menu = it; const m = $('#menu');
  m.innerHTML = it.map((x, k) => `<button data-mi="${k}">${I[x[1]]}${x[0]}</button>`).join('');
  m.style.left = Math.max(8, Math.min(x, innerWidth - 250)) + 'px';
  m.style.top = Math.max(8, Math.min(y, innerHeight - 20 - it.length * 44)) + 'px';
  m.classList.add('open');
}
let modalReturn = null;
function modal(html, cls = '') {
  const m = $('#modal');
  if (!m.classList.contains('open')) modalReturn = document.activeElement;
  m.innerHTML = `<div class="sheet ${cls}" role="document">${html}</div>`;
  m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
  setTimeout(() => {
    const first = m.querySelector('input:not([type=hidden]),button');
    if (first) first.focus({ preventScroll: true });
  }, 80);
}
function closeModal(save_) {
  stopVizGallery();
  if (SE) { if (!save_) SE.up.forEach(delCover); SE = null; }
  const m = $('#modal');
  m.classList.remove('open'); m.setAttribute('aria-hidden', 'true');
  if (!save_) {
    if (M) M.up.forEach(delCover);
    if (IMPORT) IMPORT.up.forEach(delCover);
  }
  M = null; IMPORT = null;
  mergePreview = null;
  const back = modalReturn; modalReturn = null;
  if (back && document.contains(back) && back.focus) back.focus({ preventScroll: true });
}
const delCover = u => { if (u && u.startsWith('/covers/')) api('/api/cover/' + u.slice(8), { method: 'DELETE' }).catch(() => {}); };

const EMO_GROUPS = [
  ['Music', ['🎧', '🎸', '🎹', '🥁', '🎤', '💿', '📀', '🎼', '🎵', '🎶', '🎷', '🎺', '🪕', '🪘']],
  ['Mood', ['🖤', '🤍', '❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '✨', '🌙', '☀️', '🔥', '🌊']],
  ['Life', ['🌴', '🌵', '🌱', '🍀', '🌸', '🌹', '🍄', '☕', '🍕', '🚗', '✈️', '🏋️', '📚', '🎮', '🎬', '🛸']],
  ['Symbols', ['⚡', '💫', '⭐', '🌐', '♾️', '🎯', '🧿', '🪩', '🕹️', '💎']]
];
const EMO = EMO_GROUPS.flatMap(x => x[1]).slice(0, 16);
const defaultCover = (name = '') => ({ emoji: '🎧', tone: 'ember' });

let M = null, IMPORT = null;
function plModal(id, addTrack) {
  const pl = id && S.playlists.find(p => p.id === id);
  const firstArt = pl && pl.tracks ? (pl.tracks.find(t => t.art) || {}).art : null;
  M = {
    id, name: pl ? pl.name : '',
    cover: pl && pl.cover ? { ...pl.cover } : defaultCover(),
    orig: pl && pl.cover && pl.cover.url, up: [], addTrack, tab: 'logo',
    spImage: pl && pl.spImage || null, firstArt
  };
  drawPlModal();
}
function coverPreview(c, name) {
  const tone = TONE_IDS.has(c.tone) ? ` tone-${c.tone}` : '';
  return `<div class="cover cs-cover${tone}" id="pm-cover" title="Click or drop an image">${coverContent({ name, cover: c })}${c.url ? `<img src="${esc(c.url)}" alt="" onerror="this.remove()">` : ''}<span class="edit">${I.image}<br>Click or drop</span></div>`;
}
function drawPlModal() {
  const c = M.cover || (M.cover = defaultCover()), tab = M.tab || 'logo';
  const picBtns = [
    `<button class="btn sm" data-act="pick-cover">${I.image}${c.url ? 'Replace picture' : 'Upload picture'}</button>`,
    M.spImage ? `<button class="btn sm" data-act="pm-spotify">Spotify artwork</button>` : '',
    M.firstArt ? `<button class="btn sm" data-act="pm-first-art">First song artwork</button>` : '',
    c.url ? `<button class="btn sm dng" data-act="rm-cover">${I.trash}Remove picture</button>` : ''
  ].join('');
  modal(`<div class="eyebrow">${M.id ? 'Edit' : 'New'} playlist</div><div class="cs-head"><h3>${M.id ? 'Playlist cover' : 'Name your playlist'}</h3><span class="meta">${M.name ? esc(M.name) : 'Give it a look'}</span></div>
    <div class="cover-studio">
      <div class="cs-left">
        ${coverPreview(c, M.name || 'Playlist')}
        <div class="meta" style="text-align:center;margin-top:8px">${plural(c.url ? 1 : 0, 'picture')} · drag &amp; drop supported</div>
        <div class="cs-actions">${picBtns}</div>
      </div>
      <div class="cs-right">
        <input class="inp" id="pm-name" placeholder="Playlist name" maxlength="48" value="${esc(M.name)}">
        <div class="cs-tabs"><button class="${tab === 'logo' ? 'on' : ''}" data-act="pm-tab" data-k="logo">${I.star}Logo</button><button class="${tab === 'image' ? 'on' : ''}" data-act="pm-tab" data-k="image">${I.image}Picture</button></div>
        <div class="cs-panel">${tab === 'logo' ? `
          <div class="set-label">Tone</div><div class="tone-row">${TONES.map(([id, name]) => `<button class="tone-dot tone-${id}${c.tone === id ? ' on' : ''}" data-act="pm-tone" data-k="${id}" title="${name}" aria-label="${name}"></button>`).join('')}<button class="tone-dot tone-none${!c.tone ? ' on' : ''}" data-act="pm-tone" data-k="" title="No tone" aria-label="No tone"></button></div>
          <div class="set-label">Icons</div><div class="icon-grid">${ICON_KEYS.map(k => `<button class="${c.icon === k ? 'on' : ''}" data-act="pm-icon" data-k="${k}" title="${k}" aria-label="${k}">${CICONS[k]}</button>`).join('')}</div>
          ${EMO_GROUPS.map(([g, list]) => `<div class="set-label">${g}</div><div class="emo emo-wide">${list.map(e => `<button class="${c.emoji === e && !c.icon ? 'on' : ''}" data-act="pm-emoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`).join('')}
        ` : `<p class="mut" style="margin-bottom:12px">Use a picture instead of a logo, or keep both as a fallback. Pictures are stored locally and work offline.</p><div class="cs-pic-list">${picBtns}</div>
          <div class="cs-pic-tip">For the cleanest result use a square image. The cover is cropped to fit.</div>`}
        </div>
      </div>
    </div>
    <div class="acts end"><button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="save-pl">Save</button></div>`, 'cover-sheet');
  const d = $('#pm-cover');
  if (d) {
    d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
    d.ondragleave = () => d.classList.remove('over');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) uploadCover(e.dataTransfer.files[0]); };
  }
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
async function uploadImage(file) {
  if (!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or GIF image');
  const { blob } = await prepImage(file);
  const r = await api('/api/cover', { body: blob, headers: { 'Content-Type': 'application/octet-stream' } });
  return r.url;
}
async function uploadCover(file) {
  try {
    grabName();
    const url = await uploadImage(file);
    M.up.push(url); M.cover = { ...M.cover, url }; drawPlModal();
  } catch (e) { toast('Couldn’t use that image: ' + e.message); }
}
function pickFile() { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp,image/gif'; i.onchange = () => i.files[0] && uploadCover(i.files[0]); i.click(); }
function savePl() {
  grabName(); const name = M.name.trim(); if (!name) return toast('Give it a name');
  const cover = { ...M.cover };
  if (!cover.url) delete cover.url;
  let pl;
  if (M.id) {
    pl = S.playlists.find(p => p.id === M.id);
    const oldUrl = pl.cover && pl.cover.url;
    pl.name = name; pl.cover = cover;
    if (oldUrl && oldUrl !== cover.url) delCover(oldUrl);
  } else { pl = { id: rid(), name, cover, tracks: [] }; S.playlists.push(pl); }
  M.up.filter(u => u !== cover.url).forEach(delCover);
  if (M.addTrack && !pl.tracks.some(x => uid(x) === uid(M.addTrack))) { pl.tracks.push({ ...M.addTrack, addedAt: Date.now() }); toast(`Added to ${pl.name}`); } else toast(M.id ? 'Saved' : `“${name}” created`);
  save(); closeModal(true); drawSide(); refreshView(); saveSession();
}
function addToPl(t) {
  modal(`<div class="eyebrow">Add to playlist</div><h3 style="margin-top:8px">${esc(t.title)}</h3><div style="display:grid;gap:2px">
    ${S.playlists.map(p => `<button class="pick" data-act="add-to" data-id="${p.id}">${cover(p)}<div><div style="font-weight:500">${esc(p.name)}</div><div class="meta">${p.tracks.length} songs</div></div></button>`).join('')}
    <button class="pick" data-act="add-new">${`<div class="cover">${I.plus}</div>`}<div style="font-weight:500">New playlist…</div></button></div>`);
  R.addT = t;
}

/* ═════════ spotify import ═════════ */
let impStatusT;
function setImpStatus(text, tone = 'busy') {
  const el = $('#imp-status'); if (!el) return;
  clearTimeout(impStatusT);
  el.className = `imp-status on ${tone}`;
  el.innerHTML = `<span class="imp-dot"></span><span>${esc(text)}</span>`;
  if (tone !== 'busy') impStatusT = setTimeout(() => el.classList.remove('on'), 5000);
}
function impBusy(on) {
  $$('[data-act="imp-url"],[data-act="imp-pl"],[data-act="imp-liked"],[data-act="paste-link"]').forEach(b => b.disabled = on);
}
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
  setImpStatus('Reading the song list from Spotify…'); impBusy(true);
  try {
    let d = await api('/api/spotify-url?u=' + encodeURIComponent(url));
    if (d.truncated && R.health && R.health.spotifyConnected) {
      try { const f = await api('/api/spotify/playlist/' + d.id); if (f.tracks.length > d.tracks.length) d = { ...d, ...f, truncated: false }; } catch {}
    }
    if (curRoute === 'share') nav('import');
    setImpStatus(`Found ${plural(d.tracks.length, 'song')} — preview the import below.`, 'ok');
    openImportPreview(d, 'link');
  } catch (e) {
    setImpStatus(e.message, 'error'); toast(e.message);
    if (curRoute === 'share') nav('import');
  } finally { impBusy(false); }
}

const importCover = (d, existing) => existing && existing.cover ? { ...existing.cover } : d.image ? { url: d.image } : d.kind === 'liked' ? { emoji: '❤️', tone: 'rose' } : d.kind === 'list' ? { emoji: '📝', tone: 'sunset' } : { emoji: '🟢', tone: 'moss' };
function openImportPreview(d, source = 'link') {
  if (!d || !d.tracks || !d.tracks.length) return toast('No songs found in that link');
  const existing = d.kind === 'playlist' && d.id ? S.playlists.find(p => p.spId === d.id) : null;
  IMPORT = { d: { ...d }, source, existing, name: d.name || 'Imported playlist', cover: importCover(d, existing), up: [] };
  drawImportPreview();
}
function importDiff() {
  const d = IMPORT.d, ex = IMPORT.existing;
  if (d.kind === 'liked') {
    const have = new Set(S.liked.map(t => t.spId).filter(Boolean));
    const add = d.tracks.filter(t => !have.has(t.spId)).length;
    return { add, removed: 0, kept: d.tracks.length - add };
  }
  if (!ex) return { add: d.tracks.length, removed: 0, kept: 0 };
  const old = new Set(ex.tracks.map(t => t.spId).filter(Boolean)), now = new Set(d.tracks.map(t => t.spId).filter(Boolean));
  return { add: d.tracks.filter(t => !old.has(t.spId)).length, removed: ex.tracks.filter(t => !now.has(t.spId)).length, kept: d.tracks.filter(t => old.has(t.spId)).length };
}
function drawImportPreview() {
  if (!IMPORT) return;
  const d = IMPORT.d, c = IMPORT.cover, editable = d.kind !== 'track' && d.kind !== 'liked';
  const diff = importDiff(), dur = d.tracks.reduce((n, t) => n + (+t.duration || 0), 0);
  const kind = d.kind === 'track' ? 'Song' : d.kind === 'liked' ? 'Liked songs' : IMPORT.existing ? 'Update playlist' : d.kind === 'album' ? 'Import album' : 'Import playlist';
  const tone = TONE_IDS.has(c.tone) ? ` tone-${c.tone}` : '';
  const coverHtml = `<div class="cover cs-cover${tone}" id="imp-cover">${coverContent({ name: IMPORT.name, cover: c })}${c.url ? `<img src="${esc(c.url)}" alt="" onerror="this.remove()">` : ''}<span class="edit">${I.image}<br>Click or drop</span></div>`;
  const detail = d.kind === 'liked'
    ? `<b>${plural(diff.add, 'new liked song')}</b><span>${diff.kept ? `${diff.kept} already in your library will be kept.` : 'Added to the top of your Liked Songs.'}</span>`
    : IMPORT.existing
      ? `<b>${diff.add} new · ${diff.kept} kept${diff.removed ? ` · ${diff.removed} removed` : ''}</b><span>Existing YouTube matches are preserved. ${d.truncated ? 'Spotify only shares the first 100 songs without signing in.' : ''}</span>`
      : `<b>${plural(d.tracks.length, 'song')}${dur ? ' · ' + Math.round(dur / 60) + ' min' : ''}</b><span>${d.truncated ? 'Spotify only shares the first 100 songs without signing in.' : 'Wavelength will find each one on YouTube after saving.'}</span>`;
  const coverControls = editable ? `
    <div class="imp-cover-tools">
      <div class="tone-row">${TONES.map(([id, n]) => `<button class="tone-dot tone-${id}${c.tone === id ? ' on' : ''}" data-act="imp-tone" data-k="${id}" title="${n}" aria-label="${n}"></button>`).join('')}</div>
      <div class="emo emo-quick">${EMO.slice(0, 8).map(e => `<button class="${c.emoji === e && !c.icon ? 'on' : ''}" data-act="imp-emoji" data-e="${e}" aria-label="${e}">${e}</button>`).join('')}</div>
      <div class="acts" style="margin-top:10px"><button class="btn sm" data-act="imp-pick">${I.image}Picture</button>
        ${d.image ? `<button class="btn sm" data-act="imp-spotify">Spotify art</button>` : ''}
        ${d.tracks.find(t => t.art) ? `<button class="btn sm" data-act="imp-first">First song art</button>` : ''}
        ${c.url ? `<button class="btn sm dng" data-act="imp-rm-pic">${I.trash}Remove</button>` : ''}
      </div>
    </div>` : '';
  modal(`<div class="eyebrow">${kind}</div><h3 class="imp-title">${d.kind === 'track' ? esc(d.tracks[0].title) : editable ? 'Check before importing' : esc(IMPORT.name)}</h3>
    <div class="imp-preview ${editable ? '' : 'compact'}">
      ${editable ? `<div class="imp-cover-col">${coverHtml}<div class="meta" style="text-align:center;margin-top:7px">Cover</div></div>` : ''}
      <div class="imp-detail">
        ${editable ? `<input class="inp" id="imp-name" maxlength="64" value="${esc(IMPORT.name)}" placeholder="Playlist name" aria-label="Playlist name">` : ''}
        <div class="imp-summary">${detail}</div>
        ${d.kind === 'track' ? `<div class="imp-sum-line"><span>${esc(d.tracks[0].artist || 'Unknown artist')}</span><span>${d.tracks[0].duration ? fmt(d.tracks[0].duration) : ''}</span></div>` : ''}
        ${IMPORT.existing ? `<div class="imp-warn">${I.check}<span>This playlist already exists. The import updates it in place — nothing is duplicated.</span></div>` : ''}
        ${coverControls}
      </div>
    </div>
    <div class="acts end"><button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="imp-commit">${d.kind === 'track' ? I.playS + 'Play now' : d.kind === 'liked' ? 'Add liked songs' : IMPORT.existing ? 'Update playlist' : 'Import playlist'}</button></div>`, 'import-sheet');
  const cc = $('#imp-cover');
  if (cc) {
    cc.ondragover = e => { e.preventDefault(); cc.classList.add('over'); };
    cc.ondragleave = () => cc.classList.remove('over');
    cc.ondrop = e => { e.preventDefault(); cc.classList.remove('over'); if (e.dataTransfer.files[0]) uploadImportCover(e.dataTransfer.files[0]); };
  }
}
const grabImportName = () => { const n = $('#imp-name'); if (n && IMPORT) IMPORT.name = n.value; };
async function uploadImportCover(file) {
  if (!IMPORT) return;
  try {
    grabImportName();
    const url = await uploadImage(file);
    IMPORT.up.push(url); IMPORT.cover = { ...IMPORT.cover, url };
    drawImportPreview();
  } catch (e) { toast('Couldn’t use that image: ' + e.message); }
}
function commitImport(d, cover) {
  if (!d.tracks.length) return toast('No songs found in that link');
  if (d.kind === 'track') { closeModal(true); play(d.tracks, 0, 'search'); nav('home'); return toast('Playing ' + d.tracks[0].title); }
  if (d.kind === 'liked') {
    const have = new Set(S.liked.map(t => t.spId).filter(Boolean));
    const add = d.tracks.filter(t => !have.has(t.spId)).map(t => ({ ...t, addedAt: Date.now() }));
    S.liked = [...add, ...S.liked]; save(); closeModal(true); drawSide(); startMatching(add); nav('liked');
    toast(`${add.length} liked songs added`); return;
  }
  let pl = d.kind === 'playlist' && d.id ? S.playlists.find(p => p.spId === d.id) : null;
  const existed = !!pl;
  const old = new Map(pl ? pl.tracks.filter(t => t.spId).map(t => [t.spId, t]) : []);
  const now = Date.now();
  const tracks = d.tracks.map(t => {
    const o = old.get(t.spId);
    return o ? { ...t, ytId: o.ytId, miss: o.miss, art: o.art || t.art, addedAt: o.addedAt || now } : { ...t, addedAt: now };
  });
  const nextCover = cover || (pl && pl.cover) || (d.image ? { url: d.image } : { emoji: '🟢', tone: 'moss' });
  const oldCover = pl && pl.cover && pl.cover.url;
  if (pl) {
    pl.tracks = tracks; pl.name = d.name || pl.name; pl.cover = nextCover;
    if (d.image) pl.spImage = d.image;
  } else {
    pl = { id: rid(), spId: d.kind === 'playlist' ? d.id : undefined, name: d.name || 'Imported playlist', cover: nextCover, spImage: d.image || null, tracks };
    S.playlists.push(pl);
  }
  if (oldCover && oldCover !== nextCover.url) delCover(oldCover);
  save(); closeModal(true); drawSide(); startMatching(tracks); nav('playlist/' + pl.id);
  const msg = d.truncated ? `${existed ? 'Updated' : 'Imported'} ${tracks.length} songs — Spotify only shares the first 100 without signing in` : `${existed ? 'Updated' : 'Imported'} ${plural(tracks.length, 'song')} — finding them on YouTube`;
  toast(msg);
}
function impCommit() {
  if (!IMPORT) return;
  grabImportName();
  const imp = IMPORT, d = { ...imp.d, name: (imp.name || imp.d.name || 'Imported playlist').trim() || imp.d.name };
  if (d.kind !== 'track' && d.kind !== 'liked' && !d.name) return toast('Give the playlist a name');
  const cover = { ...imp.cover };
  if (!cover.url) delete cover.url;
  imp.up.filter(u => u !== cover.url).forEach(delCover);
  commitImport(d, cover);
}

function parseTrackList(text, order = 'artist') {
  const clean = x => String(x || '').trim().replace(/^["']|["']$/g, '').trim();
  const csv = l => {
    const out = []; let cur = '', q = false;
    for (const ch of l) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out.map(clean);
  };
  const seen = new Set(), tracks = [];
  for (let raw of String(text || '').replace(/\r/g, '').split('\n')) {
    let l = raw.trim(); if (!l || /^#EXTM3U/i.test(l) || /^#EXT-X/i.test(l)) continue;
    let duration = 0;
    const ext = l.match(/^#EXTINF:\s*([\d.]+)\s*,\s*(.*)$/i);
    if (ext) { duration = Math.round(+ext[1]) || 0; l = ext[2].trim(); }
    l = l.replace(/^\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*[-–—]?\s*/, '');
    l = l.replace(/^\s*(?:\d{1,3}[.)]|[-*•])\s+/, '').trim();
    if (!l) continue;
    let artist = '', title = '';
    if (l.includes('\t')) {
      const p = l.split('\t').map(clean).filter(Boolean);
      if (p.length > 1) { artist = p[0]; title = p.slice(1).join(' - '); }
      else title = p[0] || '';
    } else {
      const parts = l.split(/\s+[-–—]\s+/);
      if (parts.length > 1) {
        const a = clean(parts[0]), b = clean(parts.slice(1).join(' - '));
        if (order === 'title') { title = a; artist = b; } else { artist = a; title = b; }
      } else if ((l.match(/,/g) || []).length >= 2 || /^".*",/.test(l)) {
        const p = csv(l);
        if (p.length > 1) { if (order === 'title') { title = p[0]; artist = p[1]; } else { artist = p[0]; title = p[1]; } }
        else title = clean(l);
      } else title = clean(l);
    }
    artist = clean(artist); title = clean(title);
    if (!title) continue;
    const key = (artist + '\u0000' + title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push({ spId: 'list-' + rid(), title, artist, album: '', duration, art: null });
  }
  return tracks;
}
function importList() {
  const raw = $('#sp-list');
  const order = ($('#sp-order') || {}).value || 'artist';
  const tracks = parseTrackList(raw.value, order);
  if (!tracks.length) return toast('Paste at least one song');
  const name = ($('#sp-list-name').value.trim() || 'My list');
  openImportPreview({ kind: 'list', id: 'list-' + rid(), name, tracks, image: null, truncated: false }, 'list');
}
function updateListCount() {
  const box = $('#sp-list-count'), raw = $('#sp-list');
  if (!box || !raw) return;
  const order = ($('#sp-order') || {}).value || 'artist';
  const tracks = parseTrackList(raw.value, order);
  box.textContent = tracks.length ? `${plural(tracks.length, 'song')} ready to preview` : 'Songs appear here as you paste';
}
async function spImport(kind, id) {
  setImpStatus(kind === 'liked' ? 'Reading your liked songs from Spotify…' : 'Reading that playlist from Spotify…'); impBusy(true);
  try {
    const d = await api(kind === 'liked' ? '/api/spotify/liked' : '/api/spotify/playlist/' + id);
    if (kind === 'liked') openImportPreview({ kind: 'liked', name: 'Liked Songs', image: null, tracks: d.tracks }, 'liked');
    else openImportPreview({ kind: 'playlist', id, name: d.name, image: d.image, tracks: d.tracks, truncated: false }, 'spotify');
    setImpStatus(`Found ${plural(d.tracks.length, 'song')} — preview the import.`, 'ok');
  } catch (e) { setImpStatus(e.message, 'error'); toast(e.message); }
  finally { impBusy(false); }
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
  if (NATIVE) return toast('Streaming works now. Offline downloads are the next standalone step.');
  if (t.localId) return toast('This file is already saved locally and plays at its original quality');
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
const KEY_ROWS = [
  ['Play / pause', ['Space', 'K']], ['Next / previous', ['N', 'P']], ['Seek 5 seconds', ['←', '→']],
  ['Volume', ['↑', '↓']], ['Mute', ['M']], ['Like current song', ['L']],
  ['Shuffle', ['S']], ['Repeat mode', ['R']], ['Full-screen player', ['F']], ['Queue', ['Q']],
  ['Skip intro / outro', ['K']], ['Lyrics', ['Y']], ['Sleep timer', ['T']], ['Visualizer styles', ['V']], ['Edit current song', ['E']], ['Playback speed', ['[', ']']], ['Undo last remove', ['⌘Z', 'Ctrl Z']],
  ['Focus search', ['/', '⌘K']], ['Shortcuts', ['?']], ['Close overlays', ['Esc']]
];
function showShortcuts() {
  modal(`<div class="eyebrow">Keyboard</div><h3 class="imp-title">Move without the mouse</h3>
    <p class="mut" style="margin-bottom:14px">These work anywhere except while you’re typing in a field.</p>
    <div class="key-list">${KEY_ROWS.map(([label, keys]) => `<div class="key-row"><span>${label}</span><span class="keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span></div>`).join('')}</div>
    <div class="acts end"><button class="btn solid" data-act="close-modal">Done</button></div>`, 'shortcut-sheet');
}
const rowTrack = el => { const r = el.closest('.row'); return r ? ctxList(r.dataset.ctx)[+r.dataset.i] : R.cur; };
function libraryTracks() {
  const seen = new Set(), out = [];
  const add = t => {
    if (!t || !allowed(t)) return;
    const k = uid(t); if (!k || seen.has(k)) return;
    seen.add(k); out.push(t);
  };
  S.liked.forEach(add);
  S.playlists.forEach(p => (p.tracks || []).forEach(add));
  return out;
}
const shuffled = list => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
/* Balance by artist: round-robin artists so one artist cannot dominate a run.
   Then avoid placing the same artist twice in a row when another is available. */
function balancedQueue(tracks) {
  const groups = new Map();
  for (const t of tracks) {
    const k = normArtist(t.artist) || 'unknown';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const keys = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length);
  for (const k of keys) groups.set(k, shuffled(groups.get(k)));
  const out = [];
  let last = '';
  while (out.length < tracks.length) {
    let pick = keys.find(k => groups.get(k).length && k !== last) || keys.find(k => groups.get(k).length);
    if (!pick) break;
    out.push(groups.get(pick).shift());
    last = pick;
  }
  return out;
}
function smartQueue() { return balancedQueue(libraryTracks()); }
function remixQueue(size, includeLiked) {
  const sources = S.playlists.filter(p => p.tracks && p.tracks.length).map(p => ({ name: p.name, list: shuffled(p.tracks.filter(allowed)) }));
  if (includeLiked && S.liked.length) sources.unshift({ name: 'Liked Songs', list: shuffled(S.liked.filter(allowed)) });
  if (!sources.length) return [];
  const out = [], seen = new Set();
  const cap = size > 0 ? size : Infinity;
  while (out.length < cap && sources.some(s => s.list.length)) {
    for (const s of sources) {
      if (out.length >= cap) break;
      while (s.list.length) {
        const t = s.list.shift(), k = uid(t);
        if (seen.has(k)) continue;
        seen.add(k); out.push({ ...t, addedAt: Date.now() }); break;
      }
    }
  }
  return out;
}
function remixModal() {
  const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  modal(`<div class="eyebrow">Remix</div><h3 class="imp-title">Mix your playlists</h3>
    <p class="mut" style="margin-bottom:16px">Round-robins through your playlists and creates a new one. Duplicates are removed, and nothing leaves the original playlists.</p>
    <label class="set-label" for="remix-name">Playlist name</label>
    <input class="inp" id="remix-name" value="Remix · ${esc(stamp)}" autocomplete="off">
    <label class="set-label" for="remix-size">Length</label>
    <select class="inp" id="remix-size"><option value="20">20 songs</option><option value="40" selected>40 songs</option><option value="60">60 songs</option><option value="0">Everything</option></select>
    <label class="line check-line"><input type="checkbox" id="remix-liked" checked> <span><b>Include Liked Songs</b><small>Pull liked songs into the rotation too.</small></span></label>
    <div class="acts end"><button class="btn" data-act="close-modal">Cancel</button><button class="btn solid" data-act="remix-go">${I.mix}Create remix</button></div>`, 'remix-sheet');
}
const acts = {
  play: togglePlay, prev, next: () => { if (canNext()) next(); },
  shuffle: () => {
    R.shuffle = !R.shuffle;
    if (R.shuffle) {
      // Endless/radio tracks were added for sequential playback. Shuffle is a
      // closed set, so drop them instead of mixing in songs from elsewhere.
      const keep = R.cur;
      R.queue = R.queue.filter(t => !t.auto || (keep && uid(t) === uid(keep)));
      R.idx = keep ? Math.max(0, R.queue.findIndex(t => uid(t) === uid(keep))) : -1;
    }
    $$('[data-act=shuffle]').forEach(b => b.classList.toggle('on', R.shuffle));
    refreshQueue(); renderQueue();
    toast(R.shuffle ? 'Shuffle on · stays inside this list' : 'Shuffle off');
  },
  repeat: () => { R.repeat = (R.repeat + 1) % 3; $$('[data-act=repeat]').forEach(b => { b.innerHTML = R.repeat === 2 ? I.repeat1 : I.repeat; b.classList.toggle('on', R.repeat > 0); }); toast(['Repeat off', 'Repeat all', 'Repeat one'][R.repeat]); },
  mute: () => toggleMute(),
  queue: () => { renderQueue(); $('#queue').classList.toggle('open'); },
  qclear: () => {
    if (R.queue.length < 2) return;
    const prevQ = R.queue, prevIdx = R.idx;
    R.queue = R.cur ? [R.cur] : []; R.idx = R.cur ? 0 : -1; refreshQueue(); renderQueue(); saveSession(true);
    undoable('Queue cleared', () => { R.queue = prevQ; R.idx = prevIdx; refreshQueue(); renderQueue(); saveSession(true); });
  },
  qrm: el => queueRemove(+el.dataset.i),
  qshuf: () => {
    const head = R.queue.slice(0, R.idx + 1), tail = R.queue.slice(R.idx + 1);
    if (tail.length < 2) return toast('Nothing to shuffle in Up next');
    for (let i = tail.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tail[i], tail[j]] = [tail[j], tail[i]]; }
    R.queue = head.concat(tail); refreshQueue(); renderQueueSmooth(); saveSession(true); toast('Up next shuffled');
  },
  qsave: () => {
    const seen = new Set(), tracks = [];
    for (const t of R.queue) { const k = dupKey(t); if (seen.has(k)) continue; seen.add(k); const { auto, ...rest } = t; tracks.push({ ...rest, addedAt: Date.now() }); }
    if (!tracks.length) return toast('The queue is empty');
    const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const pl = { id: rid(), name: `Queue · ${stamp}`, cover: { emoji: '🎶', tone: 'violet' }, tracks, createdAt: Date.now() };
    S.playlists.push(pl); save(); drawSide();
    toast(`Saved ${plural(tracks.length, 'song')} as “${pl.name}”`);
  },
  remote: el => { remoteTick({ to: el.dataset.to, cmd: el.dataset.c }); setTimeout(() => remoteTick(), 700); },
  'folder-set': async () => {
    const dir = ($('#folder-dir') || {}).value || '';
    try { R.folder = await api('/api/sync/folder', { method: 'POST', json: { dir } }); await refreshLibraryState(); toast(dir ? 'Sync folder set' : 'Sync folder removed'); } catch (e) { toast(e.message || 'Could not use that folder'); }
    paintFolder();
  },
  'folder-merge': async () => { try { const r = await api('/api/sync/folder/merge', { method: 'POST', json: {} }); R.folder = r; await refreshLibraryState(); toast(r.merged ? `Merged ${plural(r.merged, 'device file')}` : 'Already up to date'); } catch (e) { toast(e.message || 'Merge failed'); } paintFolder(); },
  'folder-clear': async () => { try { R.folder = await api('/api/sync/folder', { method: 'POST', json: { dir: '' } }); } catch {} paintFolder(); },
  'recap-view': el => { R.recapView = el.dataset.v; draw(); },
  'recap-preset': el => {
    const f = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const to = new Date(), from = new Date(); const n = el.dataset.n;
    if (n === 'month') from.setDate(1); else if (n === 'week') from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); else from.setDate(from.getDate() - (+n - 1));
    R.recapView = n === '90' ? 'weeks' : 'days';
    nav('recap/' + f(from) + '~' + f(to));
  },
  pinpl: el => togglePin(el.dataset.id),
  'feat-pick': el => {
    const k = el.dataset.k; featDraft.has(k) ? featDraft.delete(k) : featDraft.add(k);
    const on = !featDraft.has(k); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
  },
  'feat-all': () => { S.settings.off = []; save(); applyFeatures(); closeModal(false); toast('Everything is on'); },
  'feat-done': () => { S.settings.off = [...featDraft]; save(); applyFeatures(); closeModal(false); drawSide(); if (!featOn(curRoute)) location.hash = '#home'; else if (curRoute === 'settings') draw(); toast(S.settings.off.length ? `${plural(S.settings.off.length, 'feature')} switched off` : 'Everything is on'); },
  'feat-setup': () => featureSetup(),
  'feat-toggle': el => {
    const k = el.dataset.k, off = new Set(S.settings.off || []);
    off.has(k) ? off.delete(k) : off.add(k); S.settings.off = [...off]; save();
    const on = featOn(k); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); applyFeatures();
    if (!featOn(curRoute)) location.hash = '#home';
  },
  'feat-all-settings': () => { S.settings.off = []; save(); applyFeatures(); $$('[data-act="feat-toggle"]').forEach(b => { b.classList.add('on'); b.setAttribute('aria-pressed', 'true'); }); toast('All features restored'); },
  'viz-vis': el => {
    const id = el.dataset.id, h = new Set(vizHiddenList());
    if (h.has(id)) h.delete(id);
    else { if (WLViz.ids.length - h.size <= 1) return toast('Keep at least one style on'); h.add(id); }
    S.settings.vizHidden = [...h]; save();
    const on = !h.has(id); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (h.has(S.settings.vizStyle)) S.settings.vizStyle = vizStyleId();
    vizSync(); syncNativePrefs();
    const label = $('#viz-style-name'); if (label) label.textContent = `${WLViz.name(vizStyleId())} · ${plural(vizVisible().length, 'style')}`;
  },
  'discord-toggle': el => {
    S.settings.discord = !S.settings.discord; save(); el.classList.toggle('on', S.settings.discord); el.setAttribute('aria-pressed', S.settings.discord ? 'true' : 'false');
    if (S.settings.discord && !S.settings.discordId) toast('Add your Discord Application ID below'); discordPush(true);
  },
  np: toggleNP,
  'viz-style': () => vizGallery(),
  'viz-gallery': () => vizGallery(),
  'viz-pick': el => {
    const id = el.dataset.id; if (!WLViz.has(id)) return;
    S.settings.vizStyle = id; save(); vizSync(); syncNativePrefs();
    $$('.viz-card').forEach(b => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const label = $('#viz-style-name'); if (label) label.textContent = `${WLViz.name(id)} · ${plural(WLViz.styles.length, 'style')}`;
  },
  'viz-full': () => {
    if (S.settings.vizSize === 'full') S.settings.vizSize = S.settings.vizSizePrev || 'md';
    else { S.settings.vizSizePrev = VIZ_SIZES.includes(S.settings.vizSize) ? S.settings.vizSize : 'md'; S.settings.vizSize = 'full'; S.settings.viz = true; }
    save(); vizSync(); syncNativePrefs();
  },
  'preview-lock': () => {
    try { window.AndroidBridge.previewLockScreen(); }
    catch { toast('The lock-screen view is Android only'); }
  },
  'allow-lockscreen': () => {
    try { window.AndroidBridge.openLockScreenSettings(); }
    catch { toast('Open Android settings to allow lock-screen display'); }
  },
  like: el => { const t = rowTrack(el); if (t) toggleLike(t); },
  menu: el => { const r = el.closest('.row'), b = el.getBoundingClientRect(); openMenu(r.dataset.ctx, +r.dataset.i, b.left - 190, b.bottom + 6); },
  playhist: el => play(S.history, +el.dataset.i, 'history'), playliked: () => S.liked.length && play(S.liked, 0, 'liked'),
  playpl: el => { const p = S.playlists.find(x => x.id === el.dataset.id); if (p && p.tracks.length) play(p.tracks, 0, p.id); },
  playall: el => { const l = ctxList(el.dataset.id); if (l.length) play(l, 0, el.dataset.id); },
  shufflepl: el => { const l = ctxList(el.dataset.id); if (!l.length) return; R.shuffle = true; $$('[data-act=shuffle]').forEach(b => b.classList.add('on')); play(l, Math.floor(Math.random() * l.length), el.dataset.id); },
  smartshuffle: () => {
    const q = smartQueue();
    if (!q.length) return toast('Add songs to a playlist first');
    R.shuffle = false;
    $$('[data-act=shuffle]').forEach(b => b.classList.remove('on'));
    play(q, 0, 'library');
    R.playCtx = 'Smart shuffle';
    toast(`Smart shuffle · ${plural(q.length, 'song')} balanced across your playlists`);
  },
  remix: remixModal,
  'remix-go': () => {
    const name = ($('#remix-name')?.value || '').trim() || 'Remix';
    const size = +($('#remix-size')?.value || 40);
    const liked = !!($('#remix-liked')?.checked);
    const tracks = remixQueue(size, liked);
    if (!tracks.length) return toast('There are no songs to remix yet');
    const pl = { id: rid(), name, cover: { emoji: '🎛️', tone: 'violet' }, tracks, createdAt: Date.now() };
    S.playlists.push(pl); save(); closeModal(true); drawSide(); nav('playlist/' + pl.id);
    toast(`“${name}” created · ${plural(tracks.length, 'song')}`);
  },
  'pl-sort': el => {
    S.settings.plSort = el.dataset.k; save();
    if (($('#pl-list')) && (curRoute === 'playlist' || curRoute === 'liked')) {
      $$('.sort-chips .chip').forEach(c => c.classList.toggle('on', c.dataset.k === el.dataset.k));
      WLMotion.glideAll(); repaintPlaylist();
    } else refreshView();
  },
  'pl-view': el => { S.settings.plView = el.dataset.k; save(); refreshView(); },
  'recap-year': el => nav('recap/' + el.dataset.y),
  'recap-range': () => {
    const from = ($('#recap-from') || {}).value || '';
    const to = ($('#recap-to') || {}).value || '';
    if (!from || !to) return toast('Choose both dates');
    if (from > to) return toast('The start date must come before the end date');
    nav(`recap/${from}~${to}`);
  },
  'block-artist': () => {
    const input = $('#block-artist'); const name = (input?.value || '').trim();
    if (!name) return toast('Enter an artist name');
    if (!(S.settings.blockedArtists || []).some(a => normArtist(a) === normArtist(name))) {
      S.settings.blockedArtists = [...(S.settings.blockedArtists || []), name].slice(0, 200);
      save(); toast(`Blocked ${name}`);
    }
    if (input) input.value = '';
    if (curRoute === 'settings') draw();
  },
  'unblock-artist': el => {
    const name = el.dataset.a;
    S.settings.blockedArtists = (S.settings.blockedArtists || []).filter(a => a !== name);
    save(); if (curRoute === 'settings') draw();
  },
  'local-pick': pickLocalFiles,
  'local-scan': async () => { R.localReady = false; await localLoad(true); toast('Local files refreshed'); },
  dlall: async el => {
    const l = ctxList(el.dataset.id); if (!l.length) return;
    if (!confirm(`Download ${l.length} songs as MP3? This can take a while.`)) return;
    toast(`Queuing ${l.length} downloads…`); for (const t of l) { await download(t); } nav('downloads');
  },
  matchrest: el => startMatching(ctxList(el.dataset.id)),
  newpl: () => plModal(), editpl: el => plModal(el.dataset.id),
  delpl: el => {
    const p = S.playlists.find(x => x.id === el.dataset.id); if (!p) return;
    const at = S.playlists.indexOf(p);
    S.playlists = S.playlists.filter(x => x !== p); save(); closeModal(true); drawSide(); nav('library');
    undoable(`Deleted “${p.name}”`, () => {
      S.playlists.splice(Math.min(at, S.playlists.length), 0, p);
      save(); drawSide(); refreshView();
    }, () => delCover(p.cover && p.cover.url));
  },
  'toast-undo': () => { runUndo(); },
  'layout-gallery': () => layoutGallery(),
  'layout-pick': el => {
    const p = LAYOUT_PRESETS.find(x => x.id === el.dataset.id); if (!p) return;
    S.settings.navPos = p.nav; S.settings.dockPos = p.dock; S.settings.contentWidth = p.cw;
    save(); applyLayout(); layoutRefresh();
  },
  'layout-set': el => {
    const k = el.dataset.k; if (!['navPos', 'dockPos', 'contentWidth'].includes(k)) return;
    S.settings[k] = el.dataset.v; save(); applyLayout(); layoutRefresh();
  },
  'layout-reset': () => { S.settings.navPos = 'left'; S.settings.dockPos = 'bottom'; S.settings.contentWidth = 'full'; save(); applyLayout(); layoutRefresh(); },
  'css-starter': () => { const t = $('#custom-css'); if (!t) return; if (!t.value.trim()) t.value = CSS_STARTER; else t.value = t.value.replace(/\s*$/, '\n\n') + CSS_STARTER; S.settings.customCss = t.value; save(); applyCustomCss(); },
  'css-clear': () => { const t = $('#custom-css'); if (t) t.value = ''; S.settings.customCss = ''; save(); applyCustomCss(); toast('Custom CSS cleared'); },
  lyrics: () => lyricsToggle(),
  'lyr-retry': () => lyricsLoad(),
  'lyr-line': el => { const t = +el.dataset.t; if (isFinite(t)) { audio.currentTime = Math.max(0, t); R.lyr.idx = -1; lyricsSync(true); } },
  'skip-now': () => { skipNow(); },
  'skip-dismiss': () => { const k = R.skip; if (k && k.chip) { k.honored[k.chip.key] = true; } hideSkipChip(); },
  'skip-forget': () => { S.settings.skipMemory = {}; save(); toast('Forgot what it learned from your Undo taps'); },
  'edit-song': () => editSong(R.cur),
  'speed-menu': el => { const b = el.getBoundingClientRect(); speedMenu(b.left, b.top - 14 - SPEEDS.length * 44); },
  'se-pick': () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp,image/gif';
    i.onchange = async () => {
      if (!i.files[0] || !SE) return;
      try {
        const url = await songImage(i.files[0]);
        if (!SE) { if (url.startsWith('/covers/')) delCover(url); return; }
        if (url.startsWith('/covers/')) SE.up.push(url);
        SE.art = url; const f = $('#se-art-url'); if (f) f.value = url.startsWith('http') ? url : ''; sePreview(); seFocus();
      } catch (e) { toast('Couldn’t use that image: ' + e.message); }
    };
    i.click();
  },
  'se-orig-art': () => { if (!SE) return; SE.art = SE.orig.art || ''; const f = $('#se-art-url'); if (f) f.value = SE.art.startsWith('http') ? SE.art : ''; sePreview(); seFocus(); },
  'se-no-art': () => { if (!SE) return; SE.art = ''; const f = $('#se-art-url'); if (f) f.value = ''; sePreview(); seFocus(); },
  'se-spotify': async el => {
    if (!SE) return;
    try {
      let url = SE.spArt;
      if (!url) {
        el.disabled = true;
        const r = await fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent('https://open.spotify.com/track/' + SE.sp), { credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!r.ok) throw new Error('not found');
        url = (await r.json()).thumbnail_url || '';
      }
      if (!url) throw new Error('no image');
      if (!SE) return;
      SE.spArt = url; SE.art = url; const f = $('#se-art-url'); if (f) f.value = url; sePreview(); seFocus();
    } catch { toast('Couldn’t get the Spotify image for this song'); }
    finally { el.disabled = false; }
  },
  'se-save': seSave,
  'se-reset': () => { if (SE) songRestore(SE.key); },
  plmore: playlistMore,
  resume: () => { if (R.cur && audio.paused) togglePlay(); },
  'sleep-menu': el => { const b = el.getBoundingClientRect(); sleepMenu(b.left, b.top - 14 - 6 * 44); },
  'pick-cover': pickFile,
  'rm-cover': () => { grabName(); const { url, ...rest } = M.cover; M.cover = rest; M.tab = 'logo'; drawPlModal(); },
  'pm-tab': el => { grabName(); M.tab = el.dataset.k; drawPlModal(); },
  'pm-tone': el => { grabName(); if (el.dataset.k) M.cover = { ...M.cover, tone: el.dataset.k }; else { const { tone, ...rest } = M.cover; M.cover = rest; } drawPlModal(); },
  'pm-icon': el => { grabName(); M.cover = { ...M.cover, icon: el.dataset.k, emoji: null, url: null }; drawPlModal(); },
  'pm-emoji': el => { grabName(); M.cover = { ...M.cover, emoji: el.dataset.e, icon: null, url: null }; drawPlModal(); },
  'pm-spotify': () => { if (!M.spImage) return; grabName(); M.cover = { ...M.cover, url: M.spImage }; drawPlModal(); },
  'pm-first-art': () => { if (!M.firstArt) return; grabName(); M.cover = { ...M.cover, url: M.firstArt }; drawPlModal(); },
  'save-pl': savePl, 'close-modal': () => closeModal(false),
  'read-size': el => {
    S.settings.readSize = el.dataset.k; applyReading(); save();
    $$('[data-act=read-size]').forEach(b => b.classList.toggle('on', b.dataset.k === S.settings.readSize));
  },
  shortcuts: showShortcuts,
  'search-clear': () => { const q = $('#q'); if (q) { q.value = ''; updateSearchClear(); q.focus(); } if (curRoute === 'search') nav('search'); },
  'search-recent': el => goSearch(el.dataset.q || ''),
  'search-clear-recent': () => { try { localStorage.removeItem(RECENT_SEARCH_KEY); } catch {} if (curRoute === 'search' && !curArg) draw(); toast('Recent searches cleared'); },
  playsearch: el => { if (R.results.length) play(R.results, +el.dataset.i || 0, 'search'); },
  'top-like': el => {
    const t = R.results[0]; if (!t) return;
    toggleLike(t);
    const on = liked(t);
    el.classList.toggle('on', on);
    el.innerHTML = on ? I.heartF : I.heart;
    el.title = on ? 'Remove from Liked Songs' : 'Add to Liked Songs';
    el.setAttribute('aria-label', el.title);
  },
  'top-add': () => { const t = R.results[0]; if (t) addToPl(t); },
  'top-menu': el => {
    if (!R.results.length) return;
    const b = el.getBoundingClientRect();
    openMenu('search', 0, b.left - 190, b.bottom + 6);
  },
  'set-clear': () => { const f = $('#set-find'); if (f) { f.value = ''; filterSettings(); f.focus(); } },
  'sync-host': async () => {
    try { R.sync = await api('/api/sync/host', { method: 'POST' }); syncPaint(); toast('Hosting on this device'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-stop': async () => {
    if (!confirm('Stop hosting? Devices using this host will lose access until you start it again.')) return;
    try { R.sync = await api('/api/sync/stop', { method: 'POST' }); syncPaint(); toast('Sync host stopped'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-join': async () => {
    const url = ($('#sync-url')?.value || '').trim(), code = ($('#sync-code')?.value || '').trim();
    if (!url || !code) return toast('Enter the host address and pairing code');
    try {
      R.sync = await api('/api/sync/join', { json: { url, code } });
      endSyncFind();
      await refreshLibraryState();
      syncPaint();
      toast(`Connected to ${R.sync.peer || 'host'}`);
    } catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-find': async () => {
    if (finding) return;
    const box = $('#sync-found');
    const btn = document.querySelector('[data-act="sync-find"]');
    finding = true;
    if (btn) btn.disabled = true;
    if (box) box.innerHTML = '<div class="sync-scan"><i></i>Looking for Wavelength on this network…</div>';
    if (NATIVE) {
      try {
        window.AndroidBridge.startDiscovery($('#sync-url')?.value || '');
        findTimer = setTimeout(() => window.wlDiscovery('{"hosts":[]}'), 22000);
      } catch {
        endSyncFind();
        showSyncHosts([], 'This build cannot search the network. Paste the computer address instead.');
      }
      return;
    }
    try {
      const r = await api('/api/sync/find');
      endSyncFind();
      showSyncHosts(r.hosts, 'No hosts answered. Start hosting on the other device and keep both on the same network.');
    } catch (e) {
      endSyncFind();
      showSyncHosts([], e.message || 'Could not search this network');
    }
  },
  'sync-pick': el => {
    const url = el.dataset.url || '';
    const input = $('#sync-url');
    if (input) { input.value = url; input.dispatchEvent(new Event('input', { bubbles: true })); }
    const code = $('#sync-code'); if (code) code.focus();
    const box = $('#sync-found');
    if (box) box.innerHTML = `<div class="sync-found-note">Selected <b>${esc(url)}</b>. Enter the pairing code from the computer.</div>`;
  },
  'sync-pull': async () => {
    try { R.sync = await api('/api/sync/pull', { method: 'POST' }); await refreshLibraryState(); syncPaint(); toast('Library pulled from host'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-push': async () => {
    try { R.sync = await api('/api/sync/push', { method: 'POST' }); syncPaint(); toast('Library sent to host'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-merge': async () => {
    if (mergeBusy) return;
    mergeBusy = true;
    try {
      let p = null;
      try { p = await api('/api/sync/merge/preview', { method: 'POST' }); } catch {}
      if (!p || !p.add || !p.removed) {
        await applyMerge(null);
        return;
      }
      const addN = (p.add.playlists || []).length + (p.add.songs || []).length + (p.add.liked || []).length;
      const rn = (p.removed.playlists || []).length + (p.removed.songs || []).length + (p.removed.liked || []).length;
      if (!rn) {
        if (!addN && !p.add.history) { toast('Both libraries already match'); return; }
        await applyMerge(p.selected);
        return;
      }
      mergePreview = p;
      mergeModal(p);
    } finally { mergeBusy = false; }
  },
  'merge-all': () => document.querySelectorAll('#modal [data-mk]').forEach(el => { el.checked = true; }),
  'merge-none': () => document.querySelectorAll('#modal [data-mk]').forEach(el => { el.checked = false; }),
  'merge-apply': async () => {
    const p = mergePreview;
    if (!p) { closeModal(true); return; }
    const selected = {
      playlists: [...((p.selected && p.selected.playlists) || [])],
      songs: ((p.selected && p.selected.songs) || []).map(x => [x[0], x[1]]),
      liked: [...((p.selected && p.selected.liked) || [])],
    };
    document.querySelectorAll('#modal [data-mk]').forEach(el => {
      if (!el.checked) return;
      const i = +el.dataset.mi;
      if (el.dataset.mk === 'p') {
        const x = (p.removed.playlists || [])[i];
        if (x) selected.playlists.push(x.key);
      } else if (el.dataset.mk === 's') {
        const x = (p.removed.songs || [])[i];
        if (x) selected.songs.push([x.pkey, x.key]);
      } else {
        const x = (p.removed.liked || [])[i];
        if (x) selected.liked.push(x.key);
      }
    });
    closeModal(true);
    await applyMerge(selected);
  },
  'sync-disconnect': async () => {
    if (!confirm('Disconnect this device? The local library stays here.')) return;
    try { R.sync = await api('/api/sync/disconnect', { method: 'POST' }); syncPaint(); toast('Device sync disconnected'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-copy': el => {
    const value = el.dataset.copy || '';
    navigator.clipboard.writeText(value).then(() => toast('Copied')).catch(() => toast(value));
  },
  'data-scroll': el => { const sec = $('#' + el.dataset.scroll); if (sec) sec.scrollIntoView({ behavior: motionReduced() ? 'auto' : 'smooth', block: 'start' }); },
  'clear-cache': async () => {
    if (!confirm('Clear temporary playback cache? Downloaded songs and custom covers stay.')) return;
    try { const r = await api('/api/cache/clear', { method: 'POST' }); R.stats = r; const box = $('#storage-stats'); if (box) box.innerHTML = storageHTML(); toast(`Cleared ${bytes(r.freed)}`); }
    catch (e) { toast(e.message); }
  },
  'imp-commit': impCommit,
  'imp-tone': el => { if (!IMPORT) return; grabImportName(); if (el.dataset.k) IMPORT.cover = { ...IMPORT.cover, tone: el.dataset.k }; else { const { tone, ...rest } = IMPORT.cover; IMPORT.cover = rest; } drawImportPreview(); },
  'imp-emoji': el => { if (!IMPORT) return; grabImportName(); IMPORT.cover = { ...IMPORT.cover, emoji: el.dataset.e, icon: null, url: null }; drawImportPreview(); },
  'imp-spotify': () => { if (!IMPORT || !IMPORT.d.image) return; grabImportName(); IMPORT.cover = { ...IMPORT.cover, url: IMPORT.d.image }; drawImportPreview(); },
  'imp-first': () => { if (!IMPORT) return; const art = IMPORT.d.tracks.find(t => t.art); if (!art) return; grabImportName(); IMPORT.cover = { ...IMPORT.cover, url: art.art }; drawImportPreview(); },
  'imp-rm-pic': () => { if (!IMPORT) return; grabImportName(); const { url, ...rest } = IMPORT.cover; IMPORT.cover = rest; drawImportPreview(); },
  'imp-pick': () => {
    if (!IMPORT) return; grabImportName();
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/png,image/jpeg,image/webp,image/gif';
    i.onchange = () => i.files[0] && uploadImportCover(i.files[0]); i.click();
  },
  'add-to': el => { const p = S.playlists.find(x => x.id === el.dataset.id), t = R.addT; closeModal(true); if (p.tracks.some(x => uid(x) === uid(t))) return toast('Already in ' + p.name); p.tracks.push({ ...t, addedAt: Date.now() }); save(); drawSide(); toast('Added to ' + p.name); refreshView(); },
  'add-new': () => { const t = R.addT; closeModal(true); plModal(null, t); },
  genre: el => nav('search/' + encodeURIComponent(el.dataset.g + ' music')),
  'copy-uri': () => navigator.clipboard.writeText((R.health || {}).redirectUri || '').then(() => toast('Copied')),
  'save-client': async () => { try { await api('/api/config', { method: 'PUT', json: { spotifyClientId: $('#cid').value } }); await refreshHealth(); draw(); toast('Saved'); } catch (e) { toast(e.message); } },
  'reset-client': async () => { await api('/api/config', { method: 'PUT', json: { spotifyClientId: '' } }); await refreshHealth(); draw(); },
  'sp-refresh': () => { R.sp = undefined; draw(); }, 'sp-out': async () => { await api('/api/spotify/logout', { method: 'POST' }); R.sp = undefined; await refreshHealth(); draw(); },
  'imp-pl': el => spImport('pl', el.dataset.id), 'imp-liked': () => spImport('liked'),
  'imp-url': () => importLink($('#sp-url').value), 'imp-list': importList,
  'paste-link': async () => {
    try {
      const text = await navigator.clipboard.readText(), url = firstUrl(text);
      if (!url) return toast('Your clipboard has no link');
      $('#sp-url').value = url;
      importLink(url);
    } catch { toast('Clipboard is blocked — use ⌘V in the field'); }
  },
  'dl-url': async () => {
    const m = $('#dl-url').value.match(/(?:v=|youtu\.be\/|shorts\/|^)([A-Za-z0-9_-]{11})(?:[?&#]|$)/); if (!m) return toast('Paste a YouTube link');
    try { await api('/api/download', { json: { ytId: m[1], quality: S.settings.quality } }); $('#dl-url').value = ''; dlPoll(); toast('Download queued'); } catch (e) { toast(e.message); }
  },
  'dl-clear': async () => { await api('/api/downloads/clear', { method: 'POST' }); R.dls = R.dls.filter(j => !['done', 'error'].includes(j.status)); $('#dl-list').innerHTML = dlList(); },
  style: el => { S.settings.style = el.dataset.k; S.settings.accent = null; applyTheme(); save(); draw(); },
  theme: el => { S.settings.theme = el.dataset.k; S.settings.accent = null; applyTheme(); save(); draw(); },
  accent: el => { S.settings.accent = el.dataset.c; applyTheme(); save(); draw(); }, 'accent-reset': () => { S.settings.accent = null; applyTheme(); save(); draw(); },
  tg: el => {
    const k = el.dataset.k; S.settings[k] = !S.settings[k]; el.classList.toggle('on', S.settings[k]); save();
    if (k === 'viz' || k === 'realViz') { vizSync(); syncNativePrefs(); }
    if (k === 'lockVisualizer' || k === 'lockControls' || k === 'lockHint') syncNativePrefs();
    if (k === 'syncControl') { remoteTick(); paintDevices(); }
    if (k === 'syncOnOpen' || k === 'syncDaily') syncPaint();
    if (k === 'contrast') applyReading();
    if (k === 'resume' && !S.settings.resume) clearSession();
    if (k === 'gapless') { if (S.settings.gapless) schedulePrepare(500); else cancelPrepared(); }
    if (k === 'smartVolume') {
      if (NATIVE) {
        if (S.settings.smartVolume) requestSmartGain(R.cur);
        else setSmartGain(1, false);
      } else {
        if (S.settings.smartVolume) ensureGraph();
        if (!S.settings.smartVolume && normGain && actx) { R.normGain = 1; normGain.gain.setValueAtTime(1, actx.currentTime); }
      }
    }
    if (k === 'skipCrowd' || k === 'skipSilence') smartSettingsChanged();
    if (k === 'lyrics' && S.settings.lyrics === false && R.lyr.on) lyricsToggle(false);
    if (k === 'dotBg') applyDots();
    if (k === 'headphonesPause') syncNativePrefs();
    if (k === 'noAi') { refreshView(); toast(S.settings.noAi ? 'No AI filter on · keyword based' : 'No AI filter off'); }
  },
  'save-dir': async () => { try { await api('/api/config', { method: 'PUT', json: { downloadDir: $('#dl-dir').value } }); await refreshHealth(); toast('Folder saved'); } catch (e) { toast(e.message); } },
};
document.addEventListener('pointerdown', () => { delete document.documentElement.dataset.kbd; }, true);
document.addEventListener('click', e => {
  const t = e.target;
  { const ll = t.closest && t.closest('.ll'); if (ll) { acts['lyr-line'](ll); return; } }
  if (t.closest('.qgrip') || Date.now() - (R.dragAt || 0) < 400) { e.preventDefault(); return; }
  if (t.closest('.row') && Date.now() - (R.longPressAt || 0) < 650) { e.preventDefault(); return; }
  if (!t.closest('#menu') && !t.closest('[data-act=menu]')) closeMenu();
  const mi = t.closest('[data-mi]'); if (mi) { const f = R.menu[+mi.dataset.mi][2]; closeMenu(); f(); return; }
  if (t === $('#modal')) return closeModal(false);
  const a = t.closest('[data-act]'); if (a && acts[a.dataset.act]) return acts[a.dataset.act](a, e);
  const sc = t.closest('[data-scroll]'); if (sc) return acts['data-scroll'](sc);
  const g = t.closest('[data-go]'); if (g) { WLMotion.markFrom(g); return nav(g.dataset.go); }
  const q = t.closest('[data-qi]'); if (q) return playIdx(+q.dataset.qi);
  const r = t.closest('.row'); if (r) return play(ctxList(r.dataset.ctx), +r.dataset.i, r.dataset.ctx);
});
document.addEventListener('contextmenu', e => {
  const r = e.target.closest('.row'); if (!r) return;
  e.preventDefault();
  if (e.pointerType === 'touch') { clearTimeout(holdT); holdAt = null; R.longPressAt = Date.now(); haptic(14); }
  openMenu(r.dataset.ctx, +r.dataset.i, e.clientX, e.clientY);
});

/* Hover intent: start fetching the track they are about to click. */
let hoverT = null, hoverRow = null;
document.addEventListener('pointerover', e => {
  const r = e.target.closest('.row');
  if (!r || r === hoverRow) return;
  hoverRow = r;
  clearTimeout(hoverT);
  const t = ctxList(r.dataset.ctx)[+r.dataset.i];
  if (!t || t.miss) return;
  hoverT = setTimeout(() => { if (hoverRow === r) warmTrack(t); }, 140);
});
document.addEventListener('pointerout', e => {
  const r = e.target.closest('.row');
  if (r && r === hoverRow && !r.contains(e.relatedTarget)) { hoverRow = null; clearTimeout(hoverT); }
});

document.addEventListener('input', e => {
  const el = e.target.closest('[data-volset]'); if (!el) return;
  setVol(+el.value / 100);
});

document.addEventListener('change', e => {
  if (e.target.id === 'sp-order') { updateListCount(); return; }
  const el = e.target.closest('[data-set]'); if (!el) return; const k = el.dataset.set;
  if (k === 'sleep') {
    const m = +el.value;
    if (el.value === 'active') return;
    R.sleepAfterSong = false;
    S.settings.sleepUntil = m ? Date.now() + m * 60000 : 0;
    save(); syncSleep();
    if (m) toast(`Sleep timer: pausing in ${sleepLabel(m * 60000)}`);
    return;
  }
  if (k === 'motion') { S.settings.motion = el.value; applyMotion(); save(); vizSync(); return; }
  S.settings[k] = k === 'quality' ? +el.value : el.value; save();
  if (k.startsWith('skip')) smartSettingsChanged();
  if (k === 'scrollbar') applyScrollbar();
  if (k === 'perf') applyPerf();
  if (k === 'lockLayout' || k === 'lockTheme' || k === 'lockHide') { if (k === 'lockHide') { S.settings.lockHide = +S.settings.lockHide; save(); } syncNativePrefs(); }
  if (k === 'vizStyle' || k === 'vizSize') { vizSync(); syncNativePrefs(); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'accent-pick') { S.settings.accent = e.target.value; applyTheme(); save(); }
  if (e.target.id === 'set-find') filterSettings();
  if (e.target.id === 'se-art-url' && SE) { const v = e.target.value.trim(); if (!v || imgOk(v)) { SE.art = v; sePreview(); } }
  if (e.target.dataset && e.target.dataset.dots) {
    S.settings[e.target.dataset.dots] = +e.target.value; applyDots();
    const lab = $('#' + e.target.dataset.dots + '-v'); if (lab) lab.textContent = e.target.dataset.dots === 'dotOpacity' ? e.target.value + '%' : e.target.value + ' px';
    clearTimeout(R.dotSave); R.dotSave = setTimeout(save, 400);
  }
  if (e.target.id === 'custom-css') {
    S.settings.customCss = e.target.value; applyCustomCss();
    clearTimeout(R.cssSave); R.cssSave = setTimeout(save, 600);
  }
  if (e.target.id === 'pl-find') { R.plFilter = e.target.value.trim().toLowerCase(); repaintPlaylist(); }
  if (e.target.id === 'sp-list') updateListCount();
  if (e.target.id === 'imp-name' && IMPORT) IMPORT.name = e.target.value;
});
document.addEventListener('pointerdown', e => {
  const el = e.target.closest('[data-seek],[data-vol]'); if (!el || el.style.pointerEvents === 'none') return;
  e.preventDefault(); const seek = el.hasAttribute('data-seek');
  const fr = ev => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)); };
  const ap = (f, fin) => seek ? seekPreview(f, fin) : setVol(f);
  ap(fr(e), false);
  const mv = ev => ap(fr(ev), false), up = ev => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); ap(fr(ev), true); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
document.addEventListener('wheel', e => {
  const vol = e.target.closest('[data-vol]'); if (!vol) return;
  e.preventDefault();
  const step = e.shiftKey ? 0.01 : 0.04;
  setVol((R.muted ? 0 : S.settings.volume) - Math.sign(e.deltaY) * step);
}, { passive: false });
document.addEventListener('dblclick', e => {
  if (e.target.closest('[data-vol]')) toggleMute();
  else if (e.target.closest('#p-art,#p-meta')) toggleNP();
});

/* Mobile: long-press a row for its context menu, and use short swipes for the
   things the small screen hides (open/close now playing, dismiss the queue). */
let holdT = 0, holdAt = null, touchStart = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  const row = e.target.closest('.row');
  if (!row || e.target.closest('button,a,input')) return;
  holdAt = { x: e.clientX, y: e.clientY, row };
  clearTimeout(holdT);
  holdT = setTimeout(() => {
    if (!holdAt) return;
    R.longPressAt = Date.now(); haptic(14);
    openMenu(holdAt.row.dataset.ctx, +holdAt.row.dataset.i, holdAt.x, holdAt.y);
    holdAt = null;
  }, 520);
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!holdAt) return;
  if (Math.hypot(e.clientX - holdAt.x, e.clientY - holdAt.y) > 11) { clearTimeout(holdT); holdAt = null; }
}, { passive: true });
const cancelHold = () => { clearTimeout(holdT); holdAt = null; };
document.addEventListener('pointerup', cancelHold, { passive: true });
document.addEventListener('pointercancel', cancelHold, { passive: true });

document.addEventListener('touchstart', e => {
  if (!matchMedia('(pointer: coarse)').matches) return;
  const player = e.target.closest('#player'), np = e.target.closest('#np'), queue = e.target.closest('#queue');
  if (!player && !np && !queue) return;
  if (e.target.closest('button,[data-seek],[data-vol],input,.qgrip,.lyr-scroll')) return;
  const p = e.touches[0];
  touchStart = { x: p.clientX, y: p.clientY, player, np, queue };
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!touchStart) return;
  const st = touchStart, p = e.changedTouches[0], dx = p.clientX - st.x, dy = p.clientY - st.y;
  touchStart = null;
  if (st.player && dy < -54 && Math.abs(dy) > Math.abs(dx) * 1.15) { haptic(); toggleNP(); return; }
  if (st.np && dy > 86 && Math.abs(dy) > Math.abs(dx) * 1.3) { haptic(); if ($('#np').classList.contains('open')) toggleNP(); return; }
  if (st.queue && dy > 70 && Math.abs(dy) > Math.abs(dx) * 1.2) { haptic(); $('#queue').classList.remove('open'); }
}, { passive: true });

/* Queue drag-to-reorder. Pointer events work for mouse and touch alike. */
let qDrag = null;
document.addEventListener('pointerdown', e => {
  const grip = e.target.closest('.qgrip'); if (!grip) return;
  const item = grip.closest('.qi'); if (!item) return;
  e.preventDefault();
  qDrag = { from: +item.dataset.qi, to: +item.dataset.qi, item };
  item.classList.add('drag');
  try { grip.setPointerCapture(e.pointerId); } catch {}
});
document.addEventListener('pointermove', e => {
  if (!qDrag) return;
  const list = $('#q-list'); if (!list) return;
  const items = $$('.qi', list);
  for (const el of items) {
    const r = el.getBoundingClientRect();
    if (e.clientY >= r.top && e.clientY <= r.bottom) { qDrag.to = +el.dataset.qi; break; }
  }
  const box = list.getBoundingClientRect();
  if (e.clientY < box.top + 24) list.scrollTop -= 12;
  else if (e.clientY > box.bottom - 24) list.scrollTop += 12;
  items.forEach(el => {
    const i = +el.dataset.qi;
    el.classList.toggle('drop-above', qDrag.to !== qDrag.from && i === qDrag.to && qDrag.to < qDrag.from);
    el.classList.toggle('drop-below', qDrag.to !== qDrag.from && i === qDrag.to && qDrag.to > qDrag.from);
  });
});
const endQDrag = () => {
  if (!qDrag) return;
  const { from, to } = qDrag; qDrag = null; R.dragAt = Date.now();
  if (from !== to) { haptic(10); moveQueue(from, to); } else renderQueue();
};
document.addEventListener('pointerup', endQDrag);
document.addEventListener('pointercancel', endQDrag);

/* Touch: swipe a song right for Play next, left to like it. */
let swipe = null;
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || S.settings.swipeRows === false) return;
  const row = e.target.closest('.row');
  if (!row || e.target.closest('button,a,input')) return;
  swipe = { x: e.clientX, y: e.clientY, row, dx: 0, live: false };
}, { passive: true });
document.addEventListener('pointermove', e => {
  if (!swipe) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (!swipe.live) {
    if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
    if (Math.abs(dx) < 18 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    swipe.live = true; swipe.row.classList.add('swiping'); cancelHold();
  }
  swipe.dx = dx;
  const lim = Math.max(-120, Math.min(120, dx));
  swipe.row.style.transform = `translateX(${lim * 0.55}px)`;
  swipe.row.dataset.swipe = Math.abs(dx) > 84 ? (dx > 0 ? 'queue' : 'like') : '';
}, { passive: true });
const endSwipe = () => {
  if (!swipe) return;
  const { row, dx, live } = swipe; swipe = null;
  if (!live) return;
  R.longPressAt = Date.now();
  row.classList.remove('swiping'); row.style.transform = ''; delete row.dataset.swipe;
  if (Math.abs(dx) <= 84) return;
  const t = ctxList(row.dataset.ctx)[+row.dataset.i]; if (!t) return;
  haptic(14);
  if (dx > 0) {
    if (!R.cur) return play([t], 0, row.dataset.ctx);
    R.queue.splice(R.idx + 1, 0, { ...t, auto: false }); refreshQueue(); renderQueueSmooth(); saveSession(true);
    toast(`Playing next: ${t.title}`);
  } else { toggleLike(t); toast(liked(t) ? 'Added to Liked Songs' : 'Removed from Liked Songs'); }
};
document.addEventListener('pointerup', endSwipe, { passive: true });
document.addEventListener('pointercancel', endSwipe, { passive: true });

/* Full-screen player: double-tap the artwork — left third back 10s, right third
   forward 10s, middle toggles play. */
let artTap = { t: 0, x: 0 };
$('#np-art').addEventListener('pointerup', e => {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const now = Date.now(), box = e.currentTarget.getBoundingClientRect();
  if (now - artTap.t > 320 || Math.abs(e.clientX - artTap.x) > 60) { artTap = { t: now, x: e.clientX }; return; }
  artTap = { t: 0, x: 0 };
  const f = (e.clientX - box.left) / Math.max(1, box.width);
  if (!R.cur) return;
  if (f < 0.34 || f > 0.66) {
    const d = (isFinite(audio.duration) && audio.duration) || R.cur.duration || 0;
    const by = f < 0.5 ? -10 : 10;
    audio.currentTime = Math.max(0, Math.min(d || Infinity, audio.currentTime + by));
    haptic(8); toast(by < 0 ? '−10 seconds' : '+10 seconds');
  } else { togglePlay(); haptic(8); }
});

let qT;
const goSearch = v => {
  v = v.trim();
  if (isSpUrl(v)) { $('#q').value = ''; updateSearchClear(); return importLink(v); }
  if (v) rememberSearch(v);
  nav(v ? 'search/' + encodeURIComponent(v) : 'search');
};
$('#q').addEventListener('input', e => { clearTimeout(qT); updateSearchClear(); const v = e.target.value; qT = setTimeout(() => goSearch(v), isSpUrl(v) ? 50 : 550); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { clearTimeout(qT); goSearch(e.target.value); } });
document.addEventListener('keydown', e => {
  if (SE && e.key === 'Enter' && !e.isComposing && e.target.closest && e.target.closest('#modal')) {
    const field = e.target.tagName === 'INPUT';
    if (field || e.metaKey || e.ctrlKey) { e.preventDefault(); seSave(); return; }
  }
  if (e.key === 'Tab') document.documentElement.dataset.kbd = '1';
  const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable;
  const modalOpen = $('#modal').classList.contains('open');
  const menuOpen = $('#menu').classList.contains('open');

  if (e.key === 'Escape') {
    if (modalOpen) { e.preventDefault(); closeModal(false); return; }
    if (menuOpen) { e.preventDefault(); closeMenu(); return; }
    if ($('#queue').classList.contains('open')) { e.preventDefault(); $('#queue').classList.remove('open'); return; }
    if ($('#np').classList.contains('open')) { e.preventDefault(); toggleNP(); return; }
    if (typing) { e.target.blur(); return; }
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); const q = $('#q'); q.focus(); q.select(); return;
  }
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !typing && R.undo) {
    e.preventDefault(); runUndo(); return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (modalOpen) return;
  if (e.target.closest('button,a,[role=button]') && (e.code === 'Space' || e.key === 'Enter')) return;

  const slider = e.target.closest('[data-seek],[data-vol]');
  if (slider && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    e.preventDefault();
    if (slider.hasAttribute('data-seek')) {
      if (!R.cur) return;
      const d = (isFinite(audio.duration) && audio.duration) || R.cur.duration || 0;
      if (!d) return;
      if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
      if (e.key === 'ArrowRight') audio.currentTime = Math.min(d, audio.currentTime + 5);
      if (e.key === 'Home') audio.currentTime = 0;
      if (e.key === 'End') audio.currentTime = Math.max(0, d - 1);
      if (e.key === 'ArrowUp') setVol(S.settings.volume + 0.05);
      if (e.key === 'ArrowDown') setVol(S.settings.volume - 0.05);
    } else {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') setVol((R.muted ? 0 : S.settings.volume) + 0.05);
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') setVol((R.muted ? 0 : S.settings.volume) - 0.05);
      if (e.key === 'Home') setVol(0); if (e.key === 'End') setVol(1);
    }
    return;
  }

  if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  if (e.code === 'Space' || e.code === 'KeyK') { e.preventDefault(); togglePlay(); haptic(5); }
  else if (e.code === 'ArrowRight' && R.cur) { e.preventDefault(); audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 5); }
  else if (e.code === 'ArrowLeft' && R.cur) { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
  else if (e.code === 'ArrowUp') { e.preventDefault(); setVol(S.settings.volume + 0.05); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); setVol(S.settings.volume - 0.05); }
  else if (e.code === 'KeyN') { if (canNext()) next(); }
  else if (e.code === 'KeyP') prev();
  else if (e.code === 'KeyM') toggleMute();
  else if (e.code === 'KeyL') { if (R.cur) toggleLike(R.cur); }
  else if (e.code === 'KeyS') acts.shuffle();
  else if (e.code === 'KeyR') acts.repeat();
  else if (e.code === 'KeyF') toggleNP();
  else if (e.code === 'KeyV') vizGallery();
  else if (e.code === 'KeyK') skipNow();
  else if (e.code === 'KeyY') lyricsToggle();
  else if (e.code === 'KeyE') editSong(R.cur);
  else if (e.key === '[' || e.key === ']') { const i = SPEEDS.indexOf(+S.settings.speed); setSpeed(SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + (e.key === ']' ? 1 : -1)))]); }
  else if (e.code === 'KeyT') sleepMenu(innerWidth / 2 - 100, innerHeight / 2 - 120);
  else if (e.code === 'KeyQ') { renderQueue(); $('#queue').classList.toggle('open'); }
  else if (e.key === '?') { e.preventDefault(); showShortcuts(); }
  else if (e.key === '/' || e.code === 'Slash') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { flushListening(); api('/api/state', { method: 'PUT', json: S }).catch(() => {}); }
  else if (R.playing) startListening();
});
addEventListener('pagehide', () => { flushUndo(); flushListening(); api('/api/state', { method: 'PUT', json: S }).catch(() => {}); });

/* ═════════ boot ═════════ */

/* ── Discord Rich Presence (desktop). The local server owns the Discord IPC socket. ── */
let discordT = 0, discordOk = null;
const discordStatusText = () => discordOk === true ? 'Connected to Discord.' : discordOk === false ? 'Discord is not running or the ID is wrong.' : 'Not connected.';
function discordPush(now) {
  if (NATIVE) return;
  clearTimeout(discordT);
  discordT = setTimeout(async () => {
    const on = !!S.settings.discord && /^\d{15,25}$/.test(S.settings.discordId || '') && R.cur;
    const t = R.cur;
    const body = on && t ? { id: S.settings.discordId, title: t.title || 'Untitled', artist: t.artist || '', art: /^https:/.test(t.art || '') ? t.art : '', playing: !!R.playing,
      start: Math.floor(Date.now() / 1000 - (audio.currentTime || 0)), dur: isFinite(audio.duration) ? audio.duration : (t.duration || 0) } : { id: S.settings.discordId || '', clear: true };
    if (!S.settings.discord && discordOk === null) return;
    try { const r = await api('/api/discord', { method: 'POST', json: body }); discordOk = r && r.connected ? true : (S.settings.discord ? false : null); } catch { discordOk = false; }
    const st = $('#discord-status'); if (st) st.textContent = discordStatusText();
  }, now ? 0 : 400);
}
['play', 'pause', 'seeked', 'loadedmetadata'].forEach(ev => document.addEventListener(ev, () => discordPush(), true));
document.addEventListener('change', e => { if (e.target && e.target.id === 'discord-id') { S.settings.discordId = e.target.value.trim(); save(); discordPush(true); } });
new MutationObserver(hideOffSettings).observe(document.getElementById('view'), { childList: true });

(async function boot() {
  $$('[data-ic]').forEach(e => e.innerHTML = I[e.dataset.ic]); buildDm();
  try {
    const st = await api('/api/state');
    if (st) {
      S = { ...DEF, ...st, settings: { ...DEF.settings, ...st.settings } };
      // The old single "skip credits" switch becomes "skip outros automatically".
      if (st.settings && st.settings.skipOutro === undefined && st.settings.skipCredits) S.settings.skipOutro = 'auto';
    }
  } catch {}
  // On Android the phone owns the volume. Start from the real media level
  // instead of forcing a stored desktop preference onto the device.
  if (NATIVE) {
    const v = readMediaVolume();
    if (v != null) { S.settings.volume = v; R.muted = v === 0; }
  }
  if (!S.listening || typeof S.listening !== 'object' || !S.listening.devices || typeof S.listening.devices !== 'object') S.listening = { v: 1, devices: {} };
  if (!Array.isArray(S.settings.blockedArtists)) S.settings.blockedArtists = [];
  if (!SORT_KEYS.some(([k]) => k === S.settings.plSort)) S.settings.plSort = 'added';
  if (!['list', 'grid'].includes(S.settings.plView)) S.settings.plView = 'list';
  if (!WLViz.has(S.settings.vizStyle)) S.settings.vizStyle = 'matrix';
  if (!Array.isArray(S.settings.vizHidden)) S.settings.vizHidden = [];
  if (!S.overrides || typeof S.overrides !== 'object' || Array.isArray(S.overrides)) S.overrides = {};
  if (!SPEEDS.includes(+S.settings.speed)) S.settings.speed = 1;
  if (typeof S.settings.swipeRows !== 'boolean') S.settings.swipeRows = true;
  if (S.settings.theme === 'nothing') S.settings.theme = 'dark';
  if (!THEME_GROUPS.some(g => g.items.some(([k]) => k === S.settings.theme))) S.settings.theme = 'dark';
  if (!STYLES.includes(S.settings.style)) S.settings.style = 'nothing';
  if (!['best', 'saver'].includes(S.settings.streamQuality)) S.settings.streamQuality = 'best';
  if (!NATIVE && !/Electron/.test(navigator.userAgent) && 'serviceWorker' in navigator && (location.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(location.hostname))) navigator.serviceWorker.register('/sw.js').catch(() => {});
  applyTheme(); applyMotion(); applyReading(); applyVol(); drawSide(); renderQueue(); updateTransport(); syncSleep(); vizSync(); updateSearchClear(); syncNativePrefs(); watchAudioOutputs();
  applyScrollbar(); applyLayout(); applyDots(); applyCustomCss(); ovApplyAll(); applySpeed(); WLMotion.parallax($('#main'), () => $('#view .ph'));
  applyPerf(); applyFeatures(); syncShortcuts();
  await refreshHealth(); await route(); restoreSession();
  if (!S.settings.setupDone) { S.settings.setupDone = true; save(); setTimeout(featureSetup, 350); } localLoad(); syncLoad().then(() => syncAutoCheck(true)); syncPoll(); folderLoad();
  booted = true;
  launchQueue.splice(0).forEach(([c, a]) => window.wlLaunch(c, a));
})();
