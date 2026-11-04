'use strict';
/* In-app updates without installers.
   An update is a signed bundle of the web layer (public/, server.js and friends).
   It is verified (SHA-256 + ECDSA P-256 signature against update-pubkey.pem), unpacked into the
   user's data folder and loaded in place of the bundled copy at the next start.
   If a new version fails to start, the next launch falls back to the bundled one.
   Changes to the native shell (Electron, the Android app) still need an installer; the manifest's
   minShell says when that is the case. */
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');

const BASE = __dirname;
const REPO = 'thegoldertrone7-cyber/wavelength';
const MANIFEST_URL = process.env.WAVELENGTH_UPDATE_URL || `https://github.com/${REPO}/releases/latest/download/update.json`;
const UPDATES = () => process.env.WAVELENGTH_UPDATES || path.join(process.env.WAVELENGTH_DATA || path.join(BASE, 'data'), '..', 'updates');
const MAX_BYTES = 60 * 1024 * 1024;

const pkgVersion = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; } };
const cmp = (a, b) => { const x = String(a).split('.').map(n => parseInt(n, 10) || 0), y = String(b).split('.').map(n => parseInt(n, 10) || 0); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1; } return 0; };
const stateFile = () => path.join(UPDATES(), 'state.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch { return {}; } };
const writeState = s => { try { fs.mkdirSync(UPDATES(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s)); } catch {} };
const pubKey = () => { try { return fs.readFileSync(path.join(BASE, 'update-pubkey.pem'), 'utf8'); } catch { return ''; } };
const shellVersion = () => process.env.WAVELENGTH_SHELL || pkgVersion(BASE);

/* Which folder should the app run from? Called before server.js is loaded. */
function activeRoot() {
  const st = readState();
  const dir = st.current && path.join(UPDATES(), st.current);
  if (!dir || !fs.existsSync(path.join(dir, 'server.js')) || !fs.existsSync(path.join(dir, 'public', 'index.html'))) return BASE;
  if ((st.bad || []).includes(st.current)) return BASE;
  if (cmp(pkgVersion(dir), pkgVersion(BASE)) <= 0) return BASE;           // an installer caught up
  if (st.booting === st.current) {                                        // last start never confirmed
    st.bad = [...(st.bad || []), st.current]; st.booting = ''; writeState(st); return BASE;
  }
  st.booting = st.current; writeState(st);
  return dir;
}
function confirmBoot() { const st = readState(); if (st.booting) { st.booting = ''; writeState(st); } }
const runningVersion = () => pkgVersion(BASE);
const active = () => { const st = readState(); return st.current && !(st.bad || []).includes(st.current) ? st.current : ''; };

/* Minimal tar reader for .tar.gz bundles (regular files only, safe paths only). */
function untar(buf, dest) {
  let off = 0, n = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every(b => b === 0)) break;
    let name = h.toString('utf8', 0, 100).replace(/\0.*$/, '');
    const prefix = h.toString('utf8', 345, 500).replace(/\0.*$/, '');
    if (prefix) name = prefix + '/' + name;
    const size = parseInt(h.toString('ascii', 124, 136).replace(/\0.*$/, '').trim() || '0', 8) || 0;
    const type = String.fromCharCode(h[156] || 48);
    off += 512;
    if ((type === '0' || type === '\0') && name) {
      const rel = path.normalize(name).replace(/^(\.\.[\\/])+/, '');
      if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('Unsafe path in update');
      if (!/^(public\/|server\.js$|discord-rpc\.js$|updater\.js$|package\.json$)/.test(rel.replace(/\\/g, '/'))) { off += Math.ceil(size / 512) * 512; continue; }
      const out = path.join(dest, rel);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, buf.subarray(off, off + size)); n++;
    }
    off += Math.ceil(size / 512) * 512;
  }
  return n;
}
const verify = (hashHex, sigB64) => {
  const key = pubKey(); if (!key) throw new Error('This build has no update signing key');
  const ok = crypto.verify('sha256', Buffer.from(hashHex), key, Buffer.from(String(sigB64 || ''), 'base64'));
  if (!ok) throw new Error('The update is not signed by Wavelength. It was not installed.');
};
const get = async (url, max) => {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(45000), headers: { 'User-Agent': 'Wavelength-Updater' } });
  if (!r.ok) throw new Error('Update server answered ' + r.status);
  const len = +r.headers.get('content-length') || 0; if (len > max) throw new Error('Update is too large');
  const b = Buffer.from(await r.arrayBuffer()); if (b.length > max) throw new Error('Update is too large');
  return b;
};

let last = { checkedAt: 0, available: null, error: '' };
async function check() {
  try {
    if (!pubKey()) throw new Error('Updates are not set up in this build (no signing key).');
    const m = JSON.parse((await get(MANIFEST_URL, 1e5)).toString());
    if (!m || !/^\d+\.\d+\.\d+$/.test(m.version || '') || !/^[a-f0-9]{64}$/.test(m.sha256 || '')) throw new Error('Update information is malformed');
    const cur = runningVersion();
    const staged = readState().staged || '';
    last = { checkedAt: Date.now(), error: '', available: cmp(m.version, cur) > 0 && m.version !== staged ? { version: m.version, notes: String(m.notes || '').slice(0, 1200), size: +m.size || 0, needsInstaller: !!m.minShell && cmp(shellVersion(), m.minShell) < 0, minShell: m.minShell || '', url: String(m.url || 'wavelength-update.tar.gz'), sha256: m.sha256, sig: m.sig } : null };
  } catch (e) { last = { checkedAt: Date.now(), available: null, error: e.message }; }
  return status();
}
async function install() {
  const a = last.available; if (!a) throw new Error('No update to install. Check for updates first.');
  if (a.needsInstaller) throw new Error(`This update needs the app itself to be updated (version ${a.minShell} or newer). Download the new installer once.`);
  verify(a.sha256, a.sig);
  const url = new URL(a.url, MANIFEST_URL).toString();
  const gz = await get(url, MAX_BYTES);
  if (crypto.createHash('sha256').update(gz).digest('hex') !== a.sha256) throw new Error('The download was damaged. Try again.');
  const tar = zlib.gunzipSync(gz, { maxOutputLength: 200 * 1024 * 1024 });
  const dir = path.join(UPDATES(), a.version), tmp = dir + '.tmp';
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  if (untar(tar, tmp) < 3 || !fs.existsSync(path.join(tmp, 'public', 'index.html')) || !fs.existsSync(path.join(tmp, 'server.js'))) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('The update is incomplete'); }
  if (pkgVersion(tmp) !== a.version) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('The update version does not match'); }
  fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir);
  const st = readState(); st.staged = a.version; st.current = a.version; st.booting = ''; st.bad = (st.bad || []).filter(v => v !== a.version); writeState(st);
  try { for (const d of fs.readdirSync(UPDATES())) if (/^\d+\.\d+\.\d+$/.test(d) && d !== a.version && d !== st.prev) fs.rmSync(path.join(UPDATES(), d), { recursive: true, force: true }); } catch {}
  last.available = null;
  return status();
}
function status() {
  const st = readState();
  return { shell: shellVersion(), running: runningVersion(), staged: st.staged && st.staged !== runningVersion() ? st.staged : '', rolledBack: (st.bad || []).length > 0, checkedAt: last.checkedAt, available: last.available && { version: last.available.version, notes: last.available.notes, size: last.available.size, needsInstaller: last.available.needsInstaller, minShell: last.available.minShell }, error: last.error, canUpdate: !!pubKey() };
}
module.exports = { activeRoot, confirmBoot, check, install, status, untar, cmp };
