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
const DEF = { playlists: [], liked: [], history: [], settings: { theme: 'dark', style: 'nothing', accent: null, viz: true, vizStyle: 'matrix', autoplay: true, gapless: true, resume: true, motion: 'system', readSize: 'default', contrast: false, sleepUntil: 0, quality: 192, streamQuality: 'best', volume: 0.8 } };
let S = structuredClone(DEF);
const R = { queue: [], idx: -1, cur: null, playing: false, shuffle: false, shuffleOrder: [], shufflePos: -1, repeat: 0, muted: false, results: [], sTok: 0, health: null, stats: null, sp: undefined, dls: [], local: [], localReady: false, localLoading: false, localError: '', localFolder: '', seeking: false, sleepT: 0, sleepTick: 0, listPreviewT: 0, sync: null };
let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(() => api('/api/state', { method: 'PUT', json: S }).catch(() => {}), 400); };
let toastT; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); };

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
  return 'dark';
}
const paletteFor = () => CTP[S.settings.theme] || CTP[themeMode() === 'light' ? 'latte' : 'mocha'];
const defAccent = () => {
  const ctp = CTP[S.settings.theme];
  if (ctp) return ctp.accents.mauve;
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
      contrast: !!S.settings.contrast, motion: S.settings.motion || 'system'
    }));
  } catch {}
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
  root.dataset.theme = theme; root.dataset.style = S.settings.style || 'nothing';
  const a = accent || defAccent();
  const rgb = hexRgb(a) || { r: 215, g: 25, b: 33 };
  root.style.setProperty('--accent', a);
  root.style.setProperty('--accent-rgb', `${rgb.r},${rgb.g},${rgb.b}`);
  root.style.setProperty('--on-accent', (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 150 ? '#000' : '#fff');
  cachePrefs();
  VC.accent = a;
  VC.dim = getComputedStyle(root).getPropertyValue('--dot').trim() || VC.dim;
  const meta = $('meta[name=theme-color]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--bg').trim();
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
  return list.map((t, i) => `<div class="row rise${isCur(t) ? ' on' : ''}${t.miss ? ' miss' : ''}" data-ctx="${ctx}" data-i="${i + offset}" style="--i:${Math.min(i, 14)}">
    <div class="n"><span>${i + offset + 1}</span><em class="eq"><i></i><i></i><i></i></em><b class="pl">${I.playS}</b></div>
    <div class="who">${art(t, 'sm')}<div><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.localId ? ' ' + localBadge(t) : ''}${t.miss ? ' · no YouTube match' : ''}</div></div></div>
    <div class="al">${esc(t.album || '')}</div><div class="d">${fmt(t.duration)}</div>
    <button class="ib hrt${liked(t) ? ' on' : ''}" data-act="like" title="Like">${liked(t) ? I.heartF : I.heart}</button>
    <button class="ib" data-act="menu" title="More">${I.more}</button></div>`).join('');
}
function ctxList(c) {
  if (c === 'liked') return S.liked; if (c === 'search') return R.results; if (c === 'history') return S.history; if (c === 'queue') return R.queue;
  if (c === 'local') return R.local;
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
  if (hit) R.results = hit.items;
  doSearch(q);
  return `<div class="search-head rise"><div><div class="eyebrow">Search results</div><h1 class="search-title">${esc(q)}</h1></div><div class="search-head-side"><span class="meta" id="search-count">${hit ? plural(hit.items.length, 'song') : 'Searching…'}</span><button class="btn sm" data-act="search-clear">Clear</button></div></div><div id="sr">${hit ? searchHTML(hit.items) : searchSkeleton()}</div>`;
}
function renderSearch(r) {
  R.results = r;
  const root = $('#sr');
  if (!root) return;
  const count = $('#search-count'); if (count) count.textContent = plural(r.length, 'song');
  root.innerHTML = searchHTML(r);
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
  api('/api/search?q=' + encodeURIComponent(q)).then(r => {
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
  return `<h1 class="ttl">Library</h1><div class="grid">
    ${tile(`<div class="cover liked">${I.heartF}</div>`, 'Liked Songs', `${S.liked.length} songs`, 'data-go="liked"', 0, `<button class="fab" data-act="playliked" title="Play">${I.playS}</button>`)}
    ${tile(`<div class="cover local-cover">${I.disc}</div>`, 'Local files', R.localReady ? `${R.local.length} songs${lossless ? ' · ' + lossless + ' lossless' : ''}` : 'FLAC, WAV, ALAC', 'data-go="local"', 1)}
    ${S.playlists.map((p, i) => plTile(p, i + 2)).join('')}
    <div class="tile new rise" style="--i:${S.playlists.length + 2}" data-act="newpl">${I.plus}<div>New playlist</div></div></div>`;
}

function vPlaylist(id) {
  const isL = id === 'liked';
  const pl = isL ? { name: 'Liked Songs', tracks: S.liked } : S.playlists.find(p => p.id === id);
  if (!pl) return '<div class="empty">That playlist doesn’t exist anymore.</div>';
  const min = Math.round(pl.tracks.reduce((a, t) => a + (t.duration || 0), 0) / 60);
  const un = pl.tracks.filter(t => !t.ytId && !t.miss).length, miss = pl.tracks.filter(t => t.miss).length;
  return `<div class="ph rise">
    ${isL ? `<div class="cover liked">${I.heartF}</div>` : `<div class="cover${TONE_IDS.has(pl.cover && pl.cover.tone) ? ' tone-' + pl.cover.tone : ''}" data-act="editpl" data-id="${pl.id}" title="Change cover">${coverContent(pl)}${pl.cover && pl.cover.url ? `<img src="${esc(pl.cover.url)}" alt="" onerror="this.remove()">` : ''}<span class="edit">${I.image}</span></div>`}
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

function vLocal() {
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
  return `<h1 class="ttl">Downloads</h1><div class="box rise"><h2>Save any song as MP3</h2><p class="mut">Use the ••• menu on a song, or paste a YouTube link here. Files go to <b>${esc((R.health || {}).downloadDir || '~/Music/Wavelength')}</b>.</p>
    <div class="inline"><input class="inp" id="dl-url" placeholder="https://www.youtube.com/watch?v=…" spellcheck="false" aria-label="YouTube link"><button class="btn solid" data-act="dl-url">${I.dl}Download</button></div></div>
    <div class="sec"><h2>Queue</h2><a data-act="dl-clear">Clear finished</a></div><div id="dl-list">${dlList()}</div>`;
}
const dlList = () => R.dls.length ? R.dls.map(j => `<div class="dl ${j.status}"><div class="nm"><div class="t">${esc(j.name)}</div><div class="st">${j.status === 'error' ? esc(j.error) : j.status === 'done' ? 'Saved' : j.status === 'queued' ? 'Waiting…' : j.status === 'converting' ? 'Converting to MP3…' : Math.round(j.progress) + '%'}</div>
  <div class="dtw" style="pointer-events:none;padding:6px 0 0"><div class="dt"><i style="width:${j.progress}%"></i></div></div></div>${j.status === 'done' ? I.check.replace('<svg', '<svg style="width:22px;color:var(--accent)"') : ''}</div>`).join('') : '<div class="empty">No downloads yet.</div>';

const THEME_GROUPS = [
  { name: 'Essentials', items: [['dark', 'Dark', 'Black'], ['light', 'Light', 'Bright'], ['auto', 'System', 'Follows your Mac']] },
  { name: 'Color themes', items: [['rose', 'Rose', 'Pink'], ['amber', 'Amber', 'Warm gold'], ['teal', 'Teal', 'Green-blue'], ['sky', 'Sky', 'Bright blue'], ['violet', 'Violet', 'Purple'], ['lime', 'Lime', 'Green'], ['slate', 'Slate', 'Neutral']] },
  { name: 'Catppuccin', items: [['latte', 'Latte', 'Light · Mauve'], ['frappe', 'Frappé', 'Dark · Mauve'], ['macchiato', 'Macchiato', 'Dark · Mauve'], ['mocha', 'Mocha', 'Dark · Mauve']] }
];
function themePreview(k) {
  if (k === 'dark') return { bg: '#000', card: '#171718', accent: THEME_ACCENTS.dark, text: '#f4f4f4' };
  if (k === 'light') return { bg: '#e6e6e8', card: '#ebebed', accent: THEME_ACCENTS.light, text: '#0e0e10' };
  if (k === 'auto') return { bg: 'linear-gradient(90deg,#181825 50%,#eff1f5 50%)', card: '#313244', accent: THEME_ACCENTS.dark, text: '#cdd6f4' };
  if (CTP[k]) return { bg: CTP[k].bg, card: CTP[k].surface, accent: CTP[k].accents.mauve, text: CTP[k].text };
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
    R.local = Array.isArray(d) ? d : (d.tracks || []);
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
function syncHTML() {
  const s = R.sync;
  if (!s) return '<div class="sync-loading"><i></i>Reading device sync…</div>';
  const pc = s.counts?.playlists ?? 0, tc = s.counts?.tracks ?? 0, lc = s.counts?.liked ?? 0;
  const countLine = `<div class="sync-counts"><span><b>${pc}</b> ${pc === 1 ? 'playlist' : 'playlists'}</span><span><b>${tc}</b> ${tc === 1 ? 'song' : 'songs'}</span><span><b>${lc}</b> liked</span></div>`;
  const err = s.error ? `<div class="sync-error" role="status">${esc(s.error)}</div>` : '';
  if (s.role === 'host') {
    const urls = s.urls || [];
    return `<div class="sync-hero"><div><span class="sync-badge on"><i></i>Hosting on this device</span><h3>Your library is available to paired devices.</h3><p class="mut">Keep Wavelength open while other devices sync. Use Tailscale on both devices, or join over the same Wi-Fi.</p></div><button class="btn" data-act="sync-stop">Stop hosting</button></div>
      ${err}
      <div class="sync-pair"><div><div class="set-label">Pairing code</div><code class="sync-code">${esc(s.code)}</code></div><button class="btn sm" data-act="sync-copy" data-copy="${esc(s.code)}">${I.copy}Copy</button></div>
      <div class="set-label">Host address</div>
      <div class="sync-urls">${urls.length ? urls.map(u => `<button class="sync-url" data-act="sync-copy" data-copy="${esc(u)}"><span>${esc(u)}</span>${I.copy}</button>`).join('') : '<div class="sync-url empty-url">No network address found. Connect Wi-Fi or Tailscale, then try again.</div>'}</div>
      <p class="meta sync-note">Pair a device with the address and code above. The host stays authoritative for its current library; send changes from a guest when you want to update it.</p>
      ${countLine}`;
  }
  if (s.role === 'guest') {
    return `<div class="sync-hero"><div><span class="sync-badge on"><i></i>Connected to ${esc(s.peer || 'host')}</span><h3>This device follows a shared library.</h3><p class="mut">Pull when the host changes. Send when you changed playlists or liked songs here.</p></div><button class="btn" data-act="sync-disconnect">Disconnect</button></div>
      ${err}
      <div class="sync-peer"><span class="meta">Host</span><code>${esc(s.hostUrl)}</code><span class="meta">Last sync · ${syncWhen(s.lastSync)}</span></div>
      <div class="line"><div><div class="l">Pull the host library</div><div class="s">Playlists, liked songs and history replace this device's copy. Settings stay local.</div></div><button class="btn solid" data-act="sync-pull">Pull now</button></div>
      <div class="line"><div><div class="l">Send this library</div><div class="s">Replace the host's playlists, liked songs and history with this device's copy.</div></div><button class="btn" data-act="sync-push">Send changes</button></div>
      ${countLine}`;
  }
  return `<div class="sync-hero"><div><span class="sync-badge"><i></i>Not set up</span><h3>Keep your library in step across Mac, Linux and Android.</h3><p class="mut">Choose one always-on device as the host. No account, no central server — just a short pairing code and your local network or Tailscale.</p></div></div>
    ${err}
    <div class="sync-options">
      <div class="sync-panel"><div class="eyebrow">Option one</div><h3>Host here</h3><p class="mut">Publish this device's playlists to a paired device. The host only runs while Wavelength is open.</p><button class="btn solid" data-act="sync-host">${I.link}Start hosting</button></div>
      <div class="sync-panel"><div class="eyebrow">Option two</div><h3>Join a host</h3><p class="mut">Paste the host address and pairing code. Joining pulls the host library to this device.</p><div class="sync-form"><input class="inp" id="sync-url" placeholder="http://100.x.x.x:${s.port || ''}" spellcheck="false" aria-label="Host address"><input class="inp" id="sync-code" placeholder="Pairing code" spellcheck="false" aria-label="Pairing code" autocomplete="off"><button class="btn" data-act="sync-join">Connect</button></div></div>
    </div>`;
}
function accessHTML() {
  const h = R.health || {};
  const urls = Array.isArray(h.urls) ? h.urls : [];
  const enabled = urls.length > 0;
  return `<div class="access-box">
    <div class="set-label">Phone &amp; browser access</div>
    ${enabled
      ? `<p class="mut">Open one of these addresses on a phone or another computer on the same network. In the Android app, paste it into the setup screen or tap <b>Find my computer</b>.</p>
        <div class="sync-urls">${urls.map(u => `<button class="sync-url" data-act="sync-copy" data-copy="${esc(u)}"><span>${esc(u)}</span>${I.copy}</button>`).join('')}</div>`
      : `<p class="mut">This player is only listening on this computer (127.0.0.1), so a phone cannot reach it yet.</p>
        <p class="mut">In the <b>desktop app</b>, this switches on automatically — reopen Settings → Devices once it has restarted. In browser mode, start the server with <code>HOST=0.0.0.0 ./start.sh</code>.</p>`}
    <p class="meta sync-note"><b>Only use a network you trust.</b> Anyone who can reach this address can use your library. On Android, <code>127.0.0.1</code> means the phone itself, not your computer. The APK is a companion client and does not bundle the server, yt-dlp or ffmpeg.</p>
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
  drawSide();
  if (['home', 'library', 'playlist', 'liked', 'local', 'settings'].includes(curRoute)) draw();
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
    </div>
    <div class="set-find rise" style="--i:1">${I.search}<input id="set-find" type="search" placeholder="Find a setting — theme, audio, sync…" autocomplete="off" aria-label="Find a setting"><button class="set-find-clear" data-act="set-clear" title="Clear filter" aria-label="Clear filter">${I.close}</button></div>
    <nav class="set-jump rise" aria-label="Settings sections">
      <button data-scroll="set-appearance">Appearance</button><button data-scroll="set-reading">Reading</button><button data-scroll="set-feel">Motion</button><button data-scroll="set-playback">Playback</button><button data-scroll="set-sync">Devices</button><button data-scroll="set-storage">Storage</button><button data-scroll="set-import">Spotify</button><button data-scroll="set-status">Status</button>
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
      ${tg('viz', 'Show in full-screen player', 'Reacts to the real audio, not a fake animation.')}
      <div class="line"><div class="l">Visualizer style</div><select class="inp" data-set="vizStyle" aria-label="Visualizer style">${['matrix', 'bars', 'wave', 'radial'].map(v => `<option value="${v}"${s.vizStyle === v ? ' selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div></div>
    <div class="box rise" style="--i:2" id="set-playback"><h2>Playback</h2>${tg('autoplay', 'Endless playback', 'When your queue ends, keep going with similar songs.')}
      ${tg('gapless', 'Gapless transitions', 'Prepares the next track early for a smoother change.')}
      ${tg('resume', 'Resume last session', 'Restore your queue and position next time you open Wavelength.')}
      <div class="line"><div><div class="l">Streaming quality</div><div class="s">Best available takes the highest-bitrate YouTube stream. YouTube audio is lossy; lossless playback comes from local files.</div></div><select class="inp" data-set="streamQuality" aria-label="Streaming quality"><option value="best"${s.streamQuality === 'saver' ? '' : ' selected'}>Best available</option><option value="saver"${s.streamQuality === 'saver' ? ' selected' : ''}>Data saver</option></select></div>
      <div class="line"><div><div class="l">Sleep timer</div><div class="s" id="sleep-status">${sleepText()}</div></div><select class="inp" data-set="sleep" aria-label="Sleep timer">${rem ? `<option value="active" selected>${sleepLabel(rem)} left</option>` : ''}<option value="0">Off</option>${sleepOpts}</select></div></div>
    <div class="box rise" style="--i:3" id="set-sync"><h2>Devices</h2><p class="mut">Sync playlists, liked songs and listening history between Wavelength installations. Settings and downloads stay on each device.</p><div id="sync-box">${syncHTML()}</div><div id="access-box">${accessHTML()}</div></div>
    <div class="box rise" style="--i:3" id="set-storage"><h2>Downloads &amp; storage</h2>
      <div class="line"><div class="l">MP3 quality</div><select class="inp" data-set="quality" aria-label="MP3 quality">${[128, 192, 256, 320].map(q => `<option${s.quality === q ? ' selected' : ''}>${q}</option>`).join('')}</select></div>
      <div class="line"><div class="l">Folder</div><div class="inline" style="flex:1;justify-content:flex-end"><input class="inp" id="dl-dir" value="${esc(h.downloadDir || '')}" aria-label="Download folder"><button class="btn" data-act="save-dir">Save</button></div></div>
      <div class="line"><div><div class="l">Lossless local files</div><div class="s">FLAC, WAV, AIFF and ALAC play untouched at their original quality.${R.localReady ? ` ${plural(R.local.length, 'file')} added.` : ''}</div></div><div class="acts" style="margin:0"><button class="btn solid" data-act="local-pick">${I.plus}Add files</button><button class="btn" data-act="local-scan">Rescan</button></div></div>
      ${h.localDir ? `<div class="line"><div><div class="l">Local folder</div><div class="s mono-break">${esc(h.localDir)}</div></div><button class="btn" data-go="local">Open</button></div>` : ''}
      <div class="storage-box" id="storage-stats">${storageHTML()}</div>
      <div class="line"><div><div class="l">Playback cache</div><div class="s">Downloaded songs and covers stay. Only temporary stream files are cleared.</div></div><button class="btn" data-act="clear-cache">Clear cache</button></div></div>
    <div class="box rise" style="--i:4" id="set-import"><h2>Spotify</h2><div class="line"><div><div class="l">Client ID</div><div class="s">${h.clientId ? esc(h.clientId.slice(0, 6)) + '…' : 'Not set'} · ${h.spotifyConnected ? 'connected' : 'not connected'}</div></div><button class="btn" data-go="import">Manage</button></div>
      <div class="line"><div><div class="l">Importing</div><div class="s">Preview playlists, keep matched songs, and choose a cover before saving.</div></div><button class="btn" data-go="import">Open import</button></div></div>
    <div class="box rise" style="--i:5" id="set-status"><h2>Status</h2>
      <div class="line"><div><div class="l">Keyboard shortcuts</div><div class="s">Open the full list with <b>?</b>.</div></div><button class="btn" data-act="shortcuts">${I.keyboard}Shortcuts</button></div>
      <div class="line"><div class="l">Version</div><div class="meta" id="set-version">${h.version ? 'v' + esc(h.version) : (R.stats && R.stats.version ? 'v' + esc(R.stats.version) : '—')}</div></div>
      <div class="line"><div class="l">yt-dlp</div><div class="meta">${h.ytdlp ? esc(h.ytdlp) : 'missing — brew install yt-dlp'}</div></div>
      <div class="line"><div class="l">ffmpeg</div><div class="meta">${h.ffmpeg ? esc(h.ffmpeg) : 'missing — brew install ffmpeg'}</div></div>
      <div class="line"><div class="l">ffprobe</div><div class="meta">${h.ffprobe ? esc(h.ffprobe) : 'missing — brew install ffmpeg'}</div></div>
      <div class="line"><div class="l">Ads</div><div class="meta">None</div></div><div class="line"><div class="l">Price</div><div class="meta">Free</div></div></div></div>`;
}

/* ═════════ router ═════════ */
let curRoute = 'home', curArg = '', routeTok = 0, drawn = false;
const V = { share: a => { if (R.sharing !== a) { R.sharing = a; importLink(a); } return '<h1 class="ttl">Importing…</h1>' + loader(); }, home: vHome, search: vSearch, library: vLib, local: vLocal, playlist: vPlaylist, liked: () => vPlaylist('liked'), import: vImport, downloads: vDl, settings: vSet };
function draw() { $('#view').innerHTML = (V[curRoute] || vHome)(curArg); updMatch(); requestAnimationFrame(observeRows); }

/* Resolve visible rows before they are clicked. IntersectionObserver keeps
   this cheap on long playlists; the server queues at most two extractions. */
let rowObserver;
function observeRows() {
  if (rowObserver) rowObserver.disconnect();
  const rows = $$('.row');
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
async function route() {
  const [name, ...rest] = (location.hash.slice(1) || 'home').split('/');
  const my = ++routeTok, v = $('#view');
  if (drawn) { v.classList.add('out'); await sleep(motionReduced() ? 0 : 80); if (my !== routeTok) return; }
  curRoute = V[name] ? name : 'home'; curArg = decodeURIComponent(rest.join('/'));
  $$('.nav a,.mnav a').forEach(a => {
    const r = a.dataset.r || (a.dataset.go || '').split('/')[0];
    const on = r === curRoute || ((curRoute === 'liked' || curRoute === 'playlist' || curRoute === 'local') && r === 'library');
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  v.classList.remove('out', 'in'); draw();
  requestAnimationFrame(() => { if (my === routeTok) v.classList.add('in'); });
  drawn = true;
  $('#main').scrollTo({ top: 0 });
  if (curRoute === 'search' && document.activeElement !== $('#q')) $('#q').value = curArg;
  updateSearchClear();
  if (curRoute === 'downloads') dlPoll();

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
  $('#side-pl').innerHTML = `<div class="spl" data-go="liked"><div class="cover liked" style="width:38px;border-radius:12px">${I.heartF}</div><div><div class="n">Liked Songs</div><div class="c">${S.liked.length} songs</div></div></div>` +
    `<div class="spl" data-go="local"><div class="cover local-cover" style="width:38px;border-radius:12px">${I.disc}</div><div><div class="n">Local files</div><div class="c">${R.localReady ? plural(R.local.length, 'song') : 'Lossless audio'}</div></div></div>` +
    S.playlists.map(p => `<div class="spl" data-go="playlist/${p.id}">${cover(p)}<div><div class="n">${esc(p.name)}</div><div class="c">${p.tracks.length} songs</div></div></div>`).join('');
}

/* ═════════ audio engine + visualizer ═════════ */
const audioA = $('#audio'), audioB = $('#audio-b');
let audio = audioA, spareAudio = audioB;
const audioEls = [audioA, audioB];
let preparedNext = null;
let actx, analyser, gain, freq, wave;
function ensureGraph() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.78;
    gain = actx.createGain();
    for (const el of audioEls) {
      if (el.__wlSource) continue;
      const src = actx.createMediaElementSource(el);
      src.connect(analyser);
      el.__wlSource = src;
    }
    analyser.connect(gain); gain.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount); wave = new Uint8Array(analyser.fftSize);
    for (const el of audioEls) el.volume = 1;
    applyVol();
  } catch { actx = null; analyser = null; }
}
function applyVol() {
  const v = R.muted ? 0 : S.settings.volume;
  if (gain) gain.gain.value = v; else audioEls.forEach(el => el.volume = v);
  $('#v-fill').style.width = (R.muted ? 0 : S.settings.volume * 100) + '%';
  $('#b-mute').innerHTML = R.muted || S.settings.volume === 0 ? I.mute : I.vol;
  const pct = Math.round((R.muted ? 0 : S.settings.volume) * 100);
  $$('.vol').forEach(el => { el.setAttribute('aria-valuenow', pct); el.setAttribute('aria-valuetext', pct + ' percent'); });
  if (S.settings.volume > 0) lastVolume = S.settings.volume;
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
function syncSleep() {
  clearTimeout(R.sleepT); clearInterval(R.sleepTick);
  const el = $('#sleep-status'); if (el) el.textContent = sleepText();
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
    if (!sleepLeft()) syncSleep();
  }, 15000);
}
let vizRaf = 0, vizLast = 0, vizPrev = 0, vizStep = 0.035, phase = 0, disp = [];
let vizW = 0, vizH = 0, vizDpr = 1, vizRO = null;
const VSTYLES = ['matrix', 'bars', 'wave', 'radial'];
function vizResize() {
  const c = $('#viz'); if (!c) return;
  const w = Math.max(1, c.clientWidth), h = Math.max(1, c.clientHeight);
  const dpr = Math.min(2, devicePixelRatio || 1);
  vizW = w; vizH = h; vizDpr = dpr;
  const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
}
function vizLoop(ts) {
  vizRaf = requestAnimationFrame(vizLoop);
  if (document.hidden) return;
  const live = R.playing && analyser;
  const fps = motionReduced() ? 15 : live ? 30 : 15;
  if (ts - vizLast < 1000 / fps - 1) return;
  const dt = Math.min(0.09, (ts - (vizPrev || ts)) / 1000);
  vizPrev = ts; vizLast = ts; vizStep = Math.max(0.012, dt * 2.1);
  const c = $('#viz'); if (!c || !vizW || !vizH) return;
  drawViz(c, c.getContext('2d'));
}
function vizSync() {
  const open = $('#np').classList.contains('open'), on = open && S.settings.viz;
  $('#viz').style.display = S.settings.viz ? '' : 'none';
  $('#b-viz').textContent = S.settings.vizStyle[0].toUpperCase() + S.settings.vizStyle.slice(1);
  if (on && !vizRaf) {
    vizResize();
    if (!vizRO && 'ResizeObserver' in window) { vizRO = new ResizeObserver(vizResize); vizRO.observe($('#viz')); }
    vizRaf = requestAnimationFrame(vizLoop);
    vizLast = 0; vizPrev = 0;
  }
  if (!on && vizRaf) { cancelAnimationFrame(vizRaf); vizRaf = 0; }
}
function drawViz(c, g) {
  const w = vizW, h = vizH, dpr = vizDpr;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const live = analyser && R.playing; phase += vizStep;
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
function trackSrc(t, attempt = 0, preload = false) {
  if (!t) return '';
  if (t.localId) return '/api/local/' + encodeURIComponent(t.localId) + '/stream' + (attempt ? '?r=' + attempt : '');
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
    R.shuffleOrder = shuffleIndices(R.queue.length, R.idx);
    R.shufflePos = 0;
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
  const my = ++playTok;
  clearSkip();
  loadingTrack = my;
  mediaErrRetries = 0;
  ensureGraph(); uiNow(); setBuffering(true);
  if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
  audio.play().then(() => {
    if (my !== playTok) return;
    S.history = [{ ...R.cur }, ...S.history.filter(x => uid(x) !== uid(R.cur))].slice(0, 40);
    save(); saveSession(true); mediaSession(); warmNext(); startStall();
  }).catch(e => {
    if (my !== playTok || e.name === 'AbortError') return;
    doPlayTrack(p.t, my, 1);
  });
}

const play = (list, i) => { R.queue = [...list]; resetShuffleOrder(); renderQueue(); playIdx(i); };

async function playIdx(i, startAt = 0) {
  const t = R.queue[i]; if (!t) return;
  const my = ++playTok;
  R.idx = i; R.cur = t; R.resumeTime = 0;
  clearStall(); ensureGraph(); uiNow(); setBuffering(true);
  cancelPrepared();
  clearSkip();
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

  // Set new source — cache-bust on retry
  audio.src = trackSrc(t, attempt);
  try { audio.load(); } catch {}
  setBuffering(true);
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
  fetch('/api/warm/' + id + '?q=' + encodeURIComponent(q || 'best'), { headers: { 'X-Wavelength': '1' } })
    .catch(() => {})
    .finally(() => {
      warmSeen.set(key, Date.now());
      warmBusy = false;
      setTimeout(pumpWarm, 120);
    });
}

async function extend() {
  if (extending || !R.cur || !R.cur.ytId) return 0; extending = true;
  try {
    const r = await api('/api/related/' + R.cur.ytId);
    const have = new Set(R.queue.map(t => t.ytId).filter(Boolean));
    const add = r.filter(t => !have.has(t.ytId)).slice(0, 12).map(t => ({ ...t, auto: true }));
    R.queue.push(...add); refreshQueue(); renderQueue(); return add.length;
  } catch { return 0; } finally { extending = false; }
}

async function next() {
  if (!R.queue.length) return;
  let i;
  if (R.shuffle && R.queue.length > 1) i = peekNextIdx();
  else i = R.idx + 1;
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
    if (S.history.length) play(S.history, 0);
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
  if (!p) { clearStall(); setBuffering(false); saveSession(true); }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = p ? 'playing' : 'paused';
  updateTransport();
}

function onEnded() {
  if (R.repeat === 2) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
  const wantIdx = peekNextIdx();
  const want = wantIdx >= 0 ? R.queue[wantIdx] : null;
  if (preparedNext && want && preparedNext.idx === wantIdx && preparedNext.uid === uid(want)) {
    usePrepared(preparedNext);
    return;
  }
  next();
}

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
  el.addEventListener('loadedmetadata', () => { if (el === audio) uiTime(); });
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
  if (f > 0) lastVolume = f;
  S.settings.volume = f; R.muted = false; applyVol(); save();
}
function mediaSession() {
  if (!('mediaSession' in navigator) || !R.cur) return;
  const ms = navigator.mediaSession;
  ms.metadata = new MediaMetadata({ title: R.cur.title, artist: R.cur.artist, album: R.cur.album || 'Wavelength', artwork: R.cur.art ? [{ src: R.cur.art, sizes: '512x512' }, { src: R.cur.art, sizes: '256x256' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
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
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !d || !isFinite(d) || Math.floor(c) === lastPos) return;
  lastPos = Math.floor(c); try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: 1, position: Math.min(c, d) }); } catch {}
}

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
      time: R.resumeTime || audio.currentTime || 0,
      shuffle: R.shuffle, repeat: R.repeat, at: now
    }));
  } catch {}
}
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch {} }
function restoreSession() {
  if (!S.settings.resume) return;
  let st; try { st = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch {}
  if (!st || !st.cur || !Array.isArray(st.queue) || !st.queue.length) return;
  R.queue = st.queue.slice(0, 250);
  R.idx = Math.max(0, Math.min(+st.idx || 0, R.queue.length - 1));
  R.cur = R.queue[R.idx] || st.cur;
  if (!R.cur) return;
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

function uiNow() {
  const t = R.cur; if (!t) { updateTransport(); return; }
  const artist = t.artist + (t.localId ? ' · ' + localQualityText(t) : '');
  const m = $('#p-meta'); m.classList.remove('swap'); void m.offsetWidth; m.classList.add('swap');
  $('#p-title').textContent = t.title; $('#p-artist').textContent = artist;
  $('#p-art').innerHTML = art(t); $('#np-art').innerHTML = art(t);
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
  $('#q-list').innerHTML = R.queue.length ? R.queue.map((t, i) => `<div class="qi${i === R.idx ? ' on' : ''}" data-qi="${i}">${art(t, 'sm')}<div class="qm"><div class="t">${esc(t.title)}</div><div class="a">${esc(t.artist)}${t.localId ? ' ' + localBadge(t) : ''}${t.auto ? ' · endless' : ''}</div></div><button class="ib sm" data-act="qrm" data-i="${i}" title="Remove from queue" aria-label="Remove ${esc(t.title)} from queue">${I.close}</button></div>`).join('') : '<div class="empty">Nothing queued.</div>';
}
function toggleNP() { $('#np').classList.toggle('open'); vizSync(); }
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
    const list = await api('/api/related/' + t.ytId);
    R.shuffle = false;
    R.queue = [{ ...t }, ...list.filter(x => x.ytId !== t.ytId).map(x => ({ ...x, auto: true }))];
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
    ['Copy song details', 'copy', () => copyText(`${t.title} — ${t.artist || 'Unknown artist'}`)],
  ];
  if (t.ytId && !t.localId) it.push(['Copy YouTube link', 'link', () => copyText('https://www.youtube.com/watch?v=' + t.ytId)]);
  if (ctx === 'queue') it.push(['Remove from queue', 'trash', () => { R.queue.splice(i, 1); if (i <= R.idx) R.idx--; refreshQueue(); renderQueue(); saveSession(true); }]);
  else if (ctx === 'local') it.push(['Delete local file', 'trash', () => deleteLocalTrack(t)]);
  else if (!['search', 'history'].includes(ctx)) it.push(['Remove from this list', 'trash', () => { ctxList(ctx).splice(i, 1); save(); drawSide(); draw(); saveSession(true); }]);
  R.menu = it; const m = $('#menu');
  m.innerHTML = it.map((x, k) => `<button data-mi="${k}">${I[x[1]]}${x[0]}</button>`).join('');
  m.style.left = Math.min(x, innerWidth - 250) + 'px'; m.style.top = Math.min(y, innerHeight - 20 - it.length * 44) + 'px'; m.classList.add('open');
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
  const m = $('#modal');
  m.classList.remove('open'); m.setAttribute('aria-hidden', 'true');
  if (!save_) {
    if (M) M.up.forEach(delCover);
    if (IMPORT) IMPORT.up.forEach(delCover);
  }
  M = null; IMPORT = null;
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
  if (M.addTrack && !pl.tracks.some(x => uid(x) === uid(M.addTrack))) { pl.tracks.push({ ...M.addTrack }); toast(`Added to ${pl.name}`); } else toast(M.id ? 'Saved' : `“${name}” created`);
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
  if (d.kind === 'track') { closeModal(true); play(d.tracks, 0); nav('home'); return toast('Playing ' + d.tracks[0].title); }
  if (d.kind === 'liked') {
    const have = new Set(S.liked.map(t => t.spId).filter(Boolean));
    const add = d.tracks.filter(t => !have.has(t.spId));
    S.liked = [...add, ...S.liked]; save(); closeModal(true); drawSide(); startMatching(add); nav('liked');
    toast(`${add.length} liked songs added`); return;
  }
  let pl = d.kind === 'playlist' && d.id ? S.playlists.find(p => p.spId === d.id) : null;
  const existed = !!pl;
  const old = new Map(pl ? pl.tracks.filter(t => t.spId).map(t => [t.spId, t]) : []);
  const tracks = d.tracks.map(t => { const o = old.get(t.spId); return o ? { ...t, ytId: o.ytId, miss: o.miss, art: o.art || t.art } : t; });
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
  ['Focus search', ['/', '⌘K']], ['Shortcuts', ['?']], ['Close overlays', ['Esc']]
];
function showShortcuts() {
  modal(`<div class="eyebrow">Keyboard</div><h3 class="imp-title">Move without the mouse</h3>
    <p class="mut" style="margin-bottom:14px">These work anywhere except while you’re typing in a field.</p>
    <div class="key-list">${KEY_ROWS.map(([label, keys]) => `<div class="key-row"><span>${label}</span><span class="keys">${keys.map(k => `<kbd>${k}</kbd>`).join('')}</span></div>`).join('')}</div>
    <div class="acts end"><button class="btn solid" data-act="close-modal">Done</button></div>`, 'shortcut-sheet');
}
const rowTrack = el => { const r = el.closest('.row'); return r ? ctxList(r.dataset.ctx)[+r.dataset.i] : R.cur; };
const acts = {
  play: togglePlay, prev, next: () => { if (canNext()) next(); },
  shuffle: () => {
    R.shuffle = !R.shuffle;
    $$('[data-act=shuffle]').forEach(b => b.classList.toggle('on', R.shuffle));
    refreshQueue();
    toast('Shuffle ' + (R.shuffle ? 'on' : 'off'));
  },
  repeat: () => { R.repeat = (R.repeat + 1) % 3; $$('[data-act=repeat]').forEach(b => { b.innerHTML = R.repeat === 2 ? I.repeat1 : I.repeat; b.classList.toggle('on', R.repeat > 0); }); toast(['Repeat off', 'Repeat all', 'Repeat one'][R.repeat]); },
  mute: () => { R.muted = !R.muted; applyVol(); },
  queue: () => { renderQueue(); $('#queue').classList.toggle('open'); },
  qclear: () => { R.queue = R.cur ? [R.cur] : []; R.idx = R.cur ? 0 : -1; refreshQueue(); renderQueue(); saveSession(true); },
  qrm: el => { const i = +el.dataset.i; R.queue.splice(i, 1); if (i <= R.idx) R.idx--; refreshQueue(); renderQueue(); saveSession(true); },
  np: toggleNP,
  'viz-style': () => { S.settings.vizStyle = VSTYLES[(VSTYLES.indexOf(S.settings.vizStyle) + 1) % VSTYLES.length]; save(); vizSync(); },
  like: el => { const t = rowTrack(el); if (t) toggleLike(t); },
  menu: el => { const r = el.closest('.row'), b = el.getBoundingClientRect(); openMenu(r.dataset.ctx, +r.dataset.i, b.left - 190, b.bottom + 6); },
  playhist: el => play(S.history, +el.dataset.i), playliked: () => S.liked.length && play(S.liked, 0),
  playpl: el => { const p = S.playlists.find(x => x.id === el.dataset.id); if (p && p.tracks.length) play(p.tracks, 0); },
  playall: el => { const l = ctxList(el.dataset.id); if (l.length) play(l, 0); },
  shufflepl: el => { const l = ctxList(el.dataset.id); if (!l.length) return; R.shuffle = true; $$('[data-act=shuffle]').forEach(b => b.classList.add('on')); play(l, Math.floor(Math.random() * l.length)); },
  'local-pick': pickLocalFiles,
  'local-scan': async () => { R.localReady = false; await localLoad(true); toast('Local files refreshed'); },
  dlall: async el => {
    const l = ctxList(el.dataset.id); if (!l.length) return;
    if (!confirm(`Download ${l.length} songs as MP3? This can take a while.`)) return;
    toast(`Queuing ${l.length} downloads…`); for (const t of l) { await download(t); } nav('downloads');
  },
  matchrest: el => startMatching(ctxList(el.dataset.id)),
  newpl: () => plModal(), editpl: el => plModal(el.dataset.id),
  delpl: el => { const p = S.playlists.find(x => x.id === el.dataset.id); if (p && confirm(`Delete “${p.name}”? The songs stay on Spotify and YouTube.`)) { delCover(p.cover && p.cover.url); S.playlists = S.playlists.filter(x => x !== p); save(); closeModal(true); drawSide(); nav('library'); } },
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
  playsearch: el => { if (R.results.length) play(R.results, +el.dataset.i || 0); },
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
      await refreshLibraryState();
      syncPaint();
      toast(`Connected to ${R.sync.peer || 'host'}`);
    } catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-pull': async () => {
    try { R.sync = await api('/api/sync/pull', { method: 'POST' }); await refreshLibraryState(); syncPaint(); toast('Library pulled from host'); }
    catch (e) { toast(e.message); await syncLoad(true); }
  },
  'sync-push': async () => {
    try { R.sync = await api('/api/sync/push', { method: 'POST' }); syncPaint(); toast('Library sent to host'); }
    catch (e) { toast(e.message); await syncLoad(true); }
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
  'add-to': el => { const p = S.playlists.find(x => x.id === el.dataset.id), t = R.addT; closeModal(true); if (p.tracks.some(x => uid(x) === uid(t))) return toast('Already in ' + p.name); p.tracks.push({ ...t }); save(); drawSide(); toast('Added to ' + p.name); refreshView(); },
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
    if (k === 'viz') vizSync();
    if (k === 'contrast') applyReading();
    if (k === 'resume' && !S.settings.resume) clearSession();
    if (k === 'gapless') { if (S.settings.gapless) schedulePrepare(500); else cancelPrepared(); }
  },
  'save-dir': async () => { try { await api('/api/config', { method: 'PUT', json: { downloadDir: $('#dl-dir').value } }); await refreshHealth(); toast('Folder saved'); } catch (e) { toast(e.message); } },
};
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('.row') && Date.now() - (R.longPressAt || 0) < 650) { e.preventDefault(); return; }
  if (!t.closest('#menu') && !t.closest('[data-act=menu]')) closeMenu();
  const mi = t.closest('[data-mi]'); if (mi) { const f = R.menu[+mi.dataset.mi][2]; closeMenu(); f(); return; }
  if (t === $('#modal')) return closeModal(false);
  const a = t.closest('[data-act]'); if (a && acts[a.dataset.act]) return acts[a.dataset.act](a, e);
  const sc = t.closest('[data-scroll]'); if (sc) return acts['data-scroll'](sc);
  const g = t.closest('[data-go]'); if (g) return nav(g.dataset.go);
  const q = t.closest('[data-qi]'); if (q) return playIdx(+q.dataset.qi);
  const r = t.closest('.row'); if (r) return play(ctxList(r.dataset.ctx), +r.dataset.i);
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

document.addEventListener('change', e => {
  if (e.target.id === 'sp-order') { updateListCount(); return; }
  const el = e.target.closest('[data-set]'); if (!el) return; const k = el.dataset.set;
  if (k === 'sleep') {
    const m = +el.value;
    if (el.value === 'active') return;
    S.settings.sleepUntil = m ? Date.now() + m * 60000 : 0;
    save(); syncSleep();
    if (m) toast(`Sleep timer: pausing in ${sleepLabel(m * 60000)}`);
    return;
  }
  if (k === 'motion') { S.settings.motion = el.value; applyMotion(); save(); vizSync(); return; }
  S.settings[k] = k === 'quality' ? +el.value : el.value; save(); if (k === 'vizStyle') vizSync();
});
document.addEventListener('input', e => {
  if (e.target.id === 'accent-pick') { S.settings.accent = e.target.value; applyTheme(); save(); }
  if (e.target.id === 'set-find') filterSettings();
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
  if (e.target.closest('[data-vol]')) { R.muted = !R.muted; applyVol(); haptic(10); }
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
  if (e.target.closest('button,[data-seek],[data-vol],input')) return;
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
  else if (e.code === 'KeyM') { R.muted = !R.muted; applyVol(); }
  else if (e.code === 'KeyL') { if (R.cur) toggleLike(R.cur); }
  else if (e.code === 'KeyS') acts.shuffle();
  else if (e.code === 'KeyR') acts.repeat();
  else if (e.code === 'KeyF') toggleNP();
  else if (e.code === 'KeyQ') { renderQueue(); $('#queue').classList.toggle('open'); }
  else if (e.key === '/' || e.code === 'Slash') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
  else if (e.key === '?') { e.preventDefault(); showShortcuts(); }
});
addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (document.hidden) api('/api/state', { method: 'PUT', json: S }).catch(() => {}); });

/* ═════════ boot ═════════ */
(async function boot() {
  $$('[data-ic]').forEach(e => e.innerHTML = I[e.dataset.ic]); buildDm();
  try { const st = await api('/api/state'); if (st) S = { ...DEF, ...st, settings: { ...DEF.settings, ...st.settings } }; } catch {}
  if (S.settings.theme === 'nothing') S.settings.theme = 'dark';
  if (!THEME_GROUPS.some(g => g.items.some(([k]) => k === S.settings.theme))) S.settings.theme = 'dark';
  if (!STYLES.includes(S.settings.style)) S.settings.style = 'nothing';
  if (!['best', 'saver'].includes(S.settings.streamQuality)) S.settings.streamQuality = 'best';
  if (!/Electron/.test(navigator.userAgent) && 'serviceWorker' in navigator && (location.protocol === 'https:' || ['127.0.0.1', 'localhost'].includes(location.hostname))) navigator.serviceWorker.register('/sw.js').catch(() => {});
  applyTheme(); applyMotion(); applyReading(); applyVol(); drawSide(); renderQueue(); updateTransport(); syncSleep(); vizSync(); updateSearchClear();
  await refreshHealth(); await route(); restoreSession(); localLoad(); syncLoad(); syncPoll();
})();
