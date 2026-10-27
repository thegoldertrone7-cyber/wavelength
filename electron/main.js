'use strict';
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const { execFile, execFileSync } = require('child_process');

/* ── PATH: find yt-dlp / ffmpeg before anything else ── */
const BREW_PATHS = [
  '/opt/homebrew/bin',   // Apple Silicon
  '/usr/local/bin',      // Intel Mac / Linux Homebrew
  '/usr/bin', '/bin',
  '/usr/local/sbin', '/usr/sbin', '/sbin',
];
if (process.platform !== 'win32') {
  const home = process.env.HOME || '';
  const extra = [...BREW_PATHS, path.join(home, '.local/bin'), path.join(home, 'bin'), '/snap/bin'];
  process.env.PATH = [...extra, ...(process.env.PATH || '').split(path.delimiter).filter(Boolean)].join(path.delimiter);
}

function findBin(name) {
  // 1. Explicit env override
  if (process.env[name.toUpperCase().replace('-','') + '_PATH']) return process.env[name.toUpperCase().replace('-','') + '_PATH'];
  // 2. Search every brew path directly (don't rely on PATH for which)
  for (const dir of BREW_PATHS) {
    const full = path.join(dir, name);
    try { require('fs').accessSync(full, require('fs').constants.X_OK); return full; } catch {}
  }
  // 3. Fallback: which
  try { return execFileSync('which', [name], { encoding: 'utf8' }).trim(); } catch {}
  return name; // last resort — just the name
}

const YTDLP   = findBin('yt-dlp');
const FFMPEG  = findBin('ffmpeg');
const FFPROBE = findBin('ffprobe');
process.env.YTDLP_PATH   = YTDLP;
process.env.FFMPEG_PATH  = FFMPEG;
process.env.FFPROBE_PATH = FFPROBE;
console.log(`[Wavelength] yt-dlp  → ${YTDLP}`);
console.log(`[Wavelength] ffmpeg  → ${FFMPEG}`);
console.log(`[Wavelength] ffprobe → ${FFPROBE}`);

/* ── Chromium flags — MUST be set before app.whenReady ── */
// Allow autoplay without user gesture (essential for music apps)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Media keys
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService');
// Media playback is same-origin (proxied by our local server), so we can
// keep Chromium's web security enabled.
app.commandLine.appendSwitch('enable-precise-memory-info');
app.commandLine.appendSwitch('js-flags', '--expose-gc');

app.setName('Wavelength');
if (!app.requestSingleInstanceLock()) app.quit();

let win;
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  // Boot the server
  process.env.WAVELENGTH_DATA = path.join(app.getPath('userData'), 'data');
  process.env.NO_OPEN = '1';
  process.env.PORT = process.env.PORT || '38421';
  // Let phones and other browsers on the same trusted network reach the
  // desktop app. Wavelength still requires the X-Wavelength header for API
  // writes, and Settings → Devices shows the exact LAN address to enter.
  process.env.HOST = process.env.HOST || '0.0.0.0';
  const srv = require('../server.js');
  await srv.ready;

  // Set dock icon (macOS)
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png')); } catch {}
  }

  // Content-Security-Policy: allow the local server plus Google Fonts and
  // remote artwork (Spotify/YouTube CDNs), while keeping scripts local.
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' data: blob: http://127.0.0.1:*; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' data: https://fonts.gstatic.com; " +
          "img-src 'self' data: blob: http://127.0.0.1:* https:; " +
          "media-src 'self' http://127.0.0.1:* blob: data:; " +
          "connect-src 'self' http://127.0.0.1:*;"
        ],
      }
    });
  });

  win = new BrowserWindow({
    width: 1320, height: 860,
    minWidth: 900, minHeight: 620,
    backgroundColor: '#000000',
    title: 'Wavelength',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const url = `http://127.0.0.1:${srv.port}/`;
  console.log(`[Wavelength] Loading → ${url}`);
  win.loadURL(url);

  // Open external links in browser, not in the app window
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });

  // Debug: log console messages from renderer so we can see errors
  win.webContents.on('console-message', (e, level, msg, line, src) => {
    if (level >= 2) console.log(`[renderer] ${msg} (${src}:${line})`);
  });

  win.on('closed', () => { win = null; });
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win && app.isReady()) { app.relaunch(); app.exit(); } });
