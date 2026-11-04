'use strict';
/* Minimal Discord Rich Presence client over the local IPC socket. No dependencies. */
const net = require('net'), os = require('os'), path = require('path'), fs = require('fs');
let sock = null, ready = false, clientId = '', buf = Buffer.alloc(0), nonce = 0, connecting = null;

function candidates() {
  if (process.platform === 'win32') return Array.from({ length: 10 }, (_, i) => `\\\\?\\pipe\\discord-ipc-${i}`);
  const dirs = [process.env.XDG_RUNTIME_DIR, process.env.TMPDIR, process.env.TMP, process.env.TEMP, '/tmp'].filter(Boolean);
  const out = [];
  for (const d of dirs) for (let i = 0; i < 10; i++) {
    out.push(path.join(d, `discord-ipc-${i}`));
    out.push(path.join(d, 'snap.discord', `discord-ipc-${i}`));
    out.push(path.join(d, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`));
  }
  return [...new Set(out)];
}
const frame = (op, data) => { const j = Buffer.from(JSON.stringify(data)); const h = Buffer.alloc(8); h.writeInt32LE(op, 0); h.writeInt32LE(j.length, 4); return Buffer.concat([h, j]); };
function tryOne(p) {
  return new Promise(res => {
    if (process.platform !== 'win32' && !fs.existsSync(p)) return res(null);
    const s = net.createConnection(p); let done = false;
    const fin = v => { if (!done) { done = true; res(v); } };
    s.once('connect', () => fin(s)); s.once('error', () => fin(null)); setTimeout(() => { s.destroy(); fin(null); }, 800);
  });
}
function reset() { try { sock && sock.destroy(); } catch {} sock = null; ready = false; buf = Buffer.alloc(0); }
async function connect(id) {
  if (sock && ready && clientId === id) return true;
  if (connecting) return connecting;
  reset(); clientId = id;
  connecting = (async () => {
    for (const p of candidates()) {
      const s = await tryOne(p); if (!s) continue;
      sock = s;
      const ok = await new Promise(res => {
        const t = setTimeout(() => res(false), 2500);
        s.on('data', d => {
          buf = Buffer.concat([buf, d]);
          while (buf.length >= 8) {
            const op = buf.readInt32LE(0), len = buf.readInt32LE(4); if (buf.length < 8 + len) break;
            let msg = {}; try { msg = JSON.parse(buf.slice(8, 8 + len).toString()); } catch {}
            buf = buf.slice(8 + len);
            if (op === 1 && msg.evt === 'READY') { ready = true; clearTimeout(t); res(true); }
            else if (op === 2 || (msg.evt === 'ERROR')) { clearTimeout(t); res(false); }
            else if (op === 3) s.write(frame(4, msg));
          }
        });
        s.on('close', () => { if (sock === s) reset(); }); s.on('error', () => { if (sock === s) reset(); });
        s.write(frame(0, { v: 1, client_id: id }));
      });
      if (ok) return true;
      reset();
    }
    return false;
  })();
  try { return await connecting; } finally { connecting = null; }
}
const clip = (s, n) => String(s || '').slice(0, n).padEnd(2, ' ');
async function update(b) {
  if (!/^\d{15,25}$/.test(String(b.id || ''))) return { connected: false };
  if (b.clear) { if (sock && ready) sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid }, nonce: String(++nonce) })); return { connected: !!(sock && ready) }; }
  if (!(await connect(b.id))) return { connected: false };
  const act = { type: 2, details: clip(b.title, 128), state: clip(b.artist || 'Unknown artist', 128),
    assets: { large_image: b.art || 'wavelength', large_text: 'Wavelength' } };
  if (b.playing && b.dur > 0) act.timestamps = { start: b.start, end: Math.round(b.start + b.dur) };
  else if (b.playing) act.timestamps = { start: b.start };
  else act.state = clip('Paused', 128);
  sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: act }, nonce: String(++nonce) }));
  return { connected: true };
}
module.exports = { update, close: reset };
