'use strict';
// Wavelength desktop shell (macOS / Windows / Linux): runs the server inside the app and shows it in a window.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// GUI apps on macOS/Linux don't inherit your shell PATH, so add the usual spots for yt-dlp / ffmpeg.
if (process.platform !== 'win32') {
  const extra = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', path.join(process.env.HOME || '', '.local/bin')];
  process.env.PATH = [...extra, process.env.PATH || ''].join(path.delimiter);
}
app.setName('Wavelength');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'HardwareMediaKeyHandling,MediaSessionService'); // keyboard media keys

if (!app.requestSingleInstanceLock()) app.quit();
let win;
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  process.env.WAVELENGTH_DATA = path.join(app.getPath('userData'), 'data');
  process.env.NO_OPEN = '1';
  process.env.PORT = process.env.PORT || '38421';
  const srv = require('../server.js');
  await srv.ready;
  if (process.platform === 'darwin' && app.dock) { try { app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png')); } catch {} }
  win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 900, minHeight: 620, backgroundColor: '#000000', title: 'Wavelength',
    icon: path.join(__dirname, '..', 'build', 'icon.png'), autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },
  });
  win.loadURL(`http://127.0.0.1:${srv.port}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.on('closed', () => { win = null; });
});
app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win && app.isReady()) app.relaunch(), app.exit(); });
