#!/usr/bin/env node
'use strict';
/**
 * Wavelength server — zero npm dependencies (Node 18+).
 * Streaming fix: shorter cache TTL, stall-detect, auto-resume with fresh URL,
 *   chunked-pipe with backpressure, 3-attempt retry ladder.
 */
const http = require('http'), fs = require('fs'), path = require('path'),
      os = require('os'), crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const ROOT = __dirname,
      PUB  = path.join(ROOT, 'public'),
      DATA = process.env.WAVELENGTH_DATA || path.join(ROOT, 'data'),
      COVERS = path.join(DATA, 'covers'),
      LOCAL_DIR = path.join(DATA, 'local');
const VERSION = (() => { try { return require(path.join(ROOT, 'package.json')).version || ''; } catch { return ''; } })();
fs.mkdirSync(COVERS, { recursive: true });
fs.mkdirSync(LOCAL_DIR, { recursive: true });

try {
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT   = +process.env.PORT  || 3000;
const HOST   = process.env.HOST   || '127.0.0.1';
const LOOPBACK = ['127.0.0.1','localhost','::1'].includes(HOST);
/* Addresses a phone or another browser can use to reach this player server.
   Empty in loopback-only mode, which stays the default for plain `node server.js`. */
const lanUrls = () => {
  if (LOOPBACK) return [];
  const urls = [];
  for (const nets of Object.values(os.networkInterfaces())) for (const n of nets || []) {
    if (n.family === 'IPv4' && !n.internal && !/^169\.254\./.test(n.address)) urls.push(`http://${n.address}:${PORT}`);
  }
  return [...new Set(urls)];
};
const SYNC_PORT = +process.env.SYNC_PORT || (PORT < 65535 ? PORT + 1 : PORT - 1);
const YTDLP   = process.env.YTDLP_PATH   || 'yt-dlp';
const FFMPEG  = process.env.FFMPEG_PATH  || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

// App-scoped yt-dlp patch: skip the "waiting out a pre-roll ad" sleep.
// Lives beside server.js in dev and in Resources/ when packaged.
const YTPATCH = [
  path.join(ROOT, 'ytpatch'),
  path.join(path.dirname(ROOT), 'ytpatch'),
].find(p => fs.existsSync(path.join(p, 'sitecustomize.py')));
const YT_ENV = YTPATCH
  ? { ...process.env, PYTHONPATH: [YTPATCH, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) }
  : process.env;
console.log(`[dl] ytpatch ${YTPATCH || 'off'}`);
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const YTID = /^[A-Za-z0-9_-]{11}$/;

/* ── utils ── */
const readJSON  = (f,d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA,f),'utf8')); } catch { return d; } };
const writeJSON = (f,v) => {
  const p=path.join(DATA,f);
  const tmp=p+'.'+process.pid+'.'+crypto.randomBytes(3).toString('hex')+'.tmp';
  fs.writeFileSync(tmp,JSON.stringify(v));
  fs.renameSync(tmp,p);
};
const httpErr   = (s,m) => Object.assign(new Error(m),{status:s});
const json      = (res,v,s=200) => { res.writeHead(s,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(v)); };
const safe      = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/^\./,'').trim();
const body      = (req,max) => new Promise((ok,no) => {
  const c=[]; let n=0;
  req.on('data', d=>{ n+=d.length; if(n>max){no(httpErr(413,'Too large'));req.destroy();}else c.push(d); });
  req.on('end', ()=>ok(Buffer.concat(c)));
  req.on('error', no);
});
const bin = (cmd,args) => new Promise(r=>execFile(cmd,args,{timeout:8000},(e,o)=>r(e?null:String(o).split('\n')[0].trim())));
const sleep = ms => new Promise(r=>setTimeout(r,ms));

/* ── config ── */
const config  = { downloadDir: path.join(os.homedir(),'Music','Wavelength'), spotifyClientId:'', ...readJSON('config.json',{}) };
const clientId = () => config.spotifyClientId || process.env.SPOTIFY_CLIENT_ID || '';
const matches = readJSON('matches.json',{});
let matchTimer;
const saveMatches = () => { clearTimeout(matchTimer); matchTimer=setTimeout(()=>writeJSON('matches.json',matches),500); };

/* ── yt-dlp ── */
function ytdlp(args, {timeout=45000}={}) {
  return new Promise((ok,no) => {
    const p = spawn(YTDLP, args, {stdio:['ignore','pipe','pipe'], env: YT_ENV});
    let out='', err='';
    const t = setTimeout(()=>{ p.kill('SIGKILL'); no(new Error('yt-dlp timed out')); }, timeout);
    p.stdout.on('data', d=>out+=d);
    p.stderr.on('data', d=>err+=d);
    p.on('error', e=>{ clearTimeout(t); no(e.code==='ENOENT'?httpErr(503,'yt-dlp not installed — brew install yt-dlp ffmpeg'):e); });
    p.on('close', c=>{ clearTimeout(t); c===0?ok(out):no(new Error(err.trim().split('\n').pop()||'yt-dlp failed')); });
  });
}
let active=0; const waiters=[];
async function limited(fn) {
  if(active>=4) await new Promise(r=>waiters.push(r));
  active++;
  try { return await fn(); } finally { active--; const w=waiters.shift(); if(w)w(); }
}
const lines  = out => out.split('\n').filter(Boolean).map(l=>{ try{return JSON.parse(l);}catch{return null;} }).filter(Boolean);
const toTrack = j => ({ ytId:j.id, title:j.title||'Untitled', artist:(j.channel||j.uploader||'').replace(/ - Topic$/i,''), duration:Math.round(j.duration||0), art:`https://i.ytimg.com/vi/${j.id}/mqdefault.jpg` });

/* Search results change slowly. Cache them briefly and coalesce identical
   requests so typing, deleting, or reopening a search does not pay for the
   same yt-dlp call twice. */
const SEARCH_TTL = 10 * 60 * 1000;
const SEARCH_MAX = 60;
const searchCache = new Map();  // key -> { at, items }
const searchJobs = new Map();   // key -> Promise

function jsonAfter(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = at + marker.length;
  let depth = 0, str = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (str) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') str = false;
    } else if (c === '"') str = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

function durationSeconds(value) {
  const parts = String(value || '').split(':').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/* YouTube's search page already contains everything we need. Reading its
   initial JSON avoids launching Python and is usually several seconds faster
   than yt-dlp; yt-dlp remains the fallback if YouTube changes the page. */
async function fastSearch(q) {
  const url = 'https://www.youtube.com/results?' + new URLSearchParams({ search_query: q, hl: 'en', gl: 'US' });
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`YouTube search answered ${r.status}`);
  const html = await r.text();
  const data = jsonAfter(html, 'var ytInitialData = ') || jsonAfter(html, 'window["ytInitialData"] = ');
  if (!data) throw new Error('YouTube search markup changed');
  const found = [];
  const walk = o => {
    if (!o || typeof o !== 'object' || found.length >= 15) return;
    if (o.videoRenderer) {
      const v = o.videoRenderer;
      const title = (v.title?.runs || []).map(x => x.text || '').join('') || v.title?.simpleText || '';
      const channel = (v.ownerText?.runs || v.longBylineText?.runs || [])[0]?.text || '';
      const duration = durationSeconds(v.lengthText?.simpleText);
      if (v.videoId && title && duration) {
        found.push({ ytId: v.videoId, title, artist: channel.replace(/ - Topic$/i, ''), duration, art: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg` });
      }
    }
    for (const value of Object.values(o)) walk(value);
  };
  walk(data);
  if (found.length < 3) throw new Error('YouTube search returned no usable videos');
  return found;
}

async function search(q) {
  const key = q.toLowerCase().replace(/\s+/g, ' ').trim();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) {
    searchCache.delete(key); searchCache.set(key, hit); // LRU touch
    return hit.items;
  }
  const running = searchJobs.get(key);
  if (running) return running;
  const job = fastSearch(q)
    .catch(async () => {
      const out = await limited(()=>ytdlp(['--flat-playlist','-j','--no-warnings',`ytsearch15:${q}`]));
      return lines(out).filter(j => j.id && j.duration).map(toTrack);
    })
    .then(items => {
      searchCache.delete(key); searchCache.set(key, { at: Date.now(), items });
      while (searchCache.size > SEARCH_MAX) searchCache.delete(searchCache.keys().next().value);
      return items;
    })
    .finally(() => searchJobs.delete(key));
  searchJobs.set(key, job);
  return job;
}

const BAD = /\b(live|cover|remix|karaoke|reaction|instrumental|sped up|slowed|nightcore|8d|tutorial|lesson|mashup)\b/i;
/* Best-effort text filter, mirroring the client. It is deliberately
   conservative: YouTube metadata has no reliable "AI generated" flag. */
const AI_RE = /(?:\bA\.?I\.?\b|artificial intelligence|\bai[- ]?(?:generated|powered|cover|version|vocals?|music|song|artist|remix)\b|\b(?:generated|made) (?:by|with) ai\b|\bsuno\b|\budio\b|\brvc\b|deepfake|voice ?clone|neural (?:network|vocals?)|\bllm\b|chatgpt)/i;
const looksAI = t => !!t && AI_RE.test([t.title, t.artist, t.album].filter(Boolean).join(' '));
const noAiFilter = (list, on) => on ? list.filter(t => !looksAI(t)) : list;
async function match(title,artist,dur) {
  const out = await limited(()=>ytdlp(['--flat-playlist','-j','--no-warnings',`ytsearch6:${[artist,title].filter(Boolean).join(' - ')}`]));
  const want=`${title} ${artist}`.toLowerCase(), core=title.toLowerCase().replace(/\s*[(\[].*$/,'');
  let best=null, bs=-1e9;
  for(const j of lines(out)){
    if(!j.id||!j.duration) continue;
    const name=(j.title||'').toLowerCase(), ch=j.channel||j.uploader||'';
    let s=0;
    if(dur) s-=Math.min(Math.abs(j.duration-dur),90);
    if(dur&&Math.abs(j.duration-dur)>dur*0.5) s-=60;
    if(/ - topic$/i.test(ch)) s+=25;
    if(/official (audio|video|music video)/.test(name)) s+=10;
    if(core&&name.includes(core)) s+=15;
    const m=name.match(BAD); if(m&&!want.includes(m[1].toLowerCase())) s-=45;
    if(s>bs){ bs=s; best=j; }
  }
  return best&&bs>-70?best.id:null;
}

async function related(id) {
  const out = await limited(()=>ytdlp(['--flat-playlist','-j','--no-warnings','--playlist-end','15',`https://www.youtube.com/watch?v=${id}&list=RD${id}`]));
  return lines(out).filter(j=>j.id&&j.id!==id&&j.duration).map(toTrack);
}

/* Chapter/segment metadata for credits skipping. Cached because a track can
   start repeatedly and yt-dlp is expensive. */
const INFO_TTL = 60 * 60 * 1000, INFO_MAX = 200;
const infoCache = new Map();
async function videoInfo(id) {
  const hit = infoCache.get(id);
  if (hit && Date.now() - hit.at < INFO_TTL) return hit.value;
  const out = await limited(() => ytdlp(['-j', '--no-warnings', '--no-playlist', `https://www.youtube.com/watch?v=${id}`], { timeout: 30000 }));
  const j = lines(out)[0] || {};
  const value = {
    duration: Math.round(+j.duration || 0),
    chapters: Array.isArray(j.chapters) ? j.chapters.slice(0, 100).map(c => ({
      title: String(c.title || '').slice(0, 200),
      start: Math.round(+c.start_time || 0),
      end: Math.round(+c.end_time || 0),
    })) : [],
  };
  infoCache.set(id, { at: Date.now(), value });
  while (infoCache.size > INFO_MAX) infoCache.delete(infoCache.keys().next().value);
  return value;
}

/* ════════════════════════════════════════════════════════════
   STREAMING — start playing while yt-dlp is still downloading.

   yt-dlp writes the track directly to <data>/cache/<videoId>.<ext>
   (--no-part). We serve that growing file over HTTP with a real
   Content-Length (taken from yt-dlp's progress metadata) and
   Range support, waiting for more bytes whenever the browser reads
   past what has been downloaded so far.

   Result: first audio in ~1-2 s instead of waiting for the whole
   song, while still supporting duration, seeking and instant
   replays from the cache.

   The cache is capped (default 2 GB, override with
   WAVELENGTH_CACHE_MB) and pruned least-recently-played first.
   ════════════════════════════════════════════════════════════ */
const CACHE_DIR = path.join(DATA, 'cache');
fs.mkdirSync(CACHE_DIR, { recursive: true });

const AUDIO_EXTS = ['.m4a', '.webm', '.mp4', '.opus', '.ogg', '.aac'];
const AUDIO_FMT = 'ba[ext=m4a]/ba[ext=webm]/b[ext=mp4]/b';
const CACHE_LIMIT = Math.max(128, +(process.env.WAVELENGTH_CACHE_MB || 2048)) * 1024 * 1024;

/* Small storage summary for Settings. Everything here is local and cheap to
   inspect, so it can be refreshed after imports or cache clears. */
function folderStats(dir) {
  let bytes = 0, count = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      try { bytes += fs.statSync(path.join(dir, entry.name)).size; count++; } catch {}
    }
  } catch {}
  return { bytes, count };
}
function dataStats() {
  const cache = folderStats(CACHE_DIR), covers = folderStats(COVERS), local = folderStats(LOCAL_DIR);
  const data = folderStats(DATA);
  return {
    version: VERSION,
    cacheBytes: cache.bytes, cacheCount: cache.count, cacheLimit: CACHE_LIMIT,
    coverBytes: covers.bytes, coverCount: covers.count,
    localBytes: local.bytes, localCount: local.count,
    dataBytes: data.bytes, totalBytes: data.bytes + cache.bytes,
    matchedCount: Object.keys(matches || {}).length, resolutionCount: resolutions.size
  };
}

const AUDIO_MIME = {
  '.m4a': 'audio/mp4',
  '.alac': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.webm': 'audio/webm',
  '.opus': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.aac': 'audio/aac',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.aiff': 'audio/aiff',
  '.aif': 'audio/aiff',
};

/* ════════════════════════════════════════════════════════════
   LOCAL LOSSLESS LIBRARY

   YouTube only offers lossy streams, so lossless playback comes
   from the listener's own files. FLAC, WAV, AIFF, ALAC and other
   audio files are copied into <data>/local, probed with ffprobe,
   and served with normal byte-range support. The browser receives
   the original file untouched — no transcoding.
   ════════════════════════════════════════════════════════════ */
const LOCAL_EXTS = new Set(['.flac', '.wav', '.aiff', '.aif', '.alac', '.m4a', '.mp3', '.ogg', '.oga', '.opus', '.aac', '.webm']);
const LOCAL_INDEX_FILE = 'local-index.json';
let localIndex = readJSON(LOCAL_INDEX_FILE, {});
if (!localIndex || typeof localIndex !== 'object' || Array.isArray(localIndex)) localIndex = {};
let localSaveT;

function saveLocalIndex() {
  clearTimeout(localSaveT);
  localSaveT = setTimeout(() => {
    try { writeJSON(LOCAL_INDEX_FILE, localIndex); } catch {}
  }, 300);
  localSaveT.unref?.();
}

const localHash = rel => crypto.createHash('sha1').update(rel).digest('hex').slice(0, 16);
const localFormat = rel => path.extname(rel).slice(1).toUpperCase() || 'AUDIO';

function walkLocal(dir, rel = '') {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const childRel = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) { out.push(...walkLocal(path.join(dir, entry.name), childRel)); continue; }
    if (entry.isFile() && LOCAL_EXTS.has(path.extname(entry.name).toLowerCase())) out.push(childRel);
  }
  return out;
}

async function extractLocalCover(file, id, stamp) {
  const name = `local-${id}-${stamp}.jpg`;
  const dest = path.join(COVERS, name);
  if (fs.existsSync(dest)) return '/covers/' + name;
  await new Promise((ok, no) => {
    execFile(FFMPEG, ['-v', 'error', '-y', '-i', file, '-map', '0:v:0', '-frames:v', '1', '-vf', 'scale=600:-1', dest],
      { timeout: 25000 }, error => error ? no(error) : ok());
  });
  return '/covers/' + name;
}

function probeLocal(file, rel, stat) {
  return new Promise((ok, no) => {
    execFile(FFPROBE, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
      { timeout: 25000, maxBuffer: 8 * 1024 * 1024 }, async (error, stdout) => {
        if (error) return no(error);
        try {
          const info = JSON.parse(stdout || '{}');
          const audio = (info.streams || []).find(stream => stream.codec_type === 'audio');
          if (!audio) throw new Error('No audio stream in file');
          const tags = {};
          for (const source of [info.format && info.format.tags, audio.tags]) {
            for (const [key, value] of Object.entries(source || {})) tags[key.toLowerCase()] = String(value);
          }
          const ext = path.extname(rel).toLowerCase();
          const codec = String(audio.codec_name || '').toLowerCase();
          const lossless = /^(flac|alac|wavpack|ape|truehd|mlp)$/.test(codec) || /^pcm_/.test(codec);
          const bitDepth = +(audio.bits_per_raw_sample || audio.bits_per_sample || 0) || 0;
          const sampleRate = +(audio.sample_rate || 0) || 0;
          const duration = Math.round(+(info.format && info.format.duration || audio.duration || 0)) || 0;
          const size = +(info.format && info.format.size || stat.size || 0) || 0;
          const bitrate = +(info.format && info.format.bit_rate || audio.bit_rate || 0) || 0;
          const localId = localHash(rel);
          const title = tags.title || path.basename(rel, path.extname(rel)).replace(/^\d+[\s._-]+/, '').trim() || 'Untitled';
          const artist = tags.artist || tags.album_artist || tags.creator || 'Unknown artist';
          const hasArt = (info.streams || []).some(stream =>
            stream.codec_type === 'video' && (stream.disposition && stream.disposition.attached_pic === 1));
          let art = null;
          if (hasArt) {
            try { art = await extractLocalCover(file, localId, Math.floor(stat.mtimeMs || 0)); } catch {}
          }
          ok({
            localId, title, artist,
            album: tags.album || '', duration, art,
            lossless, format: localFormat(rel), codec,
            bitDepth, sampleRate, bitrate, size,
            file: rel,
          });
        } catch (e) { no(e); }
      });
  });
}

async function localTracks(force = false) {
  const files = walkLocal(LOCAL_DIR);
  const seen = new Set();
  const tracks = [];
  let changed = false;
  for (const rel of files) {
    const file = path.join(LOCAL_DIR, rel);
    let stat;
    try { stat = fs.statSync(file); } catch { continue; }
    seen.add(rel);
    const cached = localIndex[rel];
    if (!force && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size && cached.track) {
      tracks.push(cached.track);
      continue;
    }
    try {
      const track = await probeLocal(file, rel, stat);
      localIndex[rel] = { mtimeMs: stat.mtimeMs, size: stat.size, track };
      tracks.push(track);
      changed = true;
    } catch (e) {
      console.warn(`[local] skipped ${rel}: ${e.message}`);
    }
  }
  for (const rel of Object.keys(localIndex)) {
    if (!seen.has(rel)) { delete localIndex[rel]; changed = true; }
  }
  if (changed) saveLocalIndex();
  tracks.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  return tracks;
}

function localEntry(id) {
  for (const [rel, entry] of Object.entries(localIndex)) {
    if (entry && entry.track && entry.track.localId === id) return { rel, ...entry };
  }
  return null;
}

async function receiveLocalFile(req) {
  let name = '';
  try { name = decodeURIComponent(String(req.headers['x-filename'] || '')); } catch {}
  name = path.basename(String(name).replace(/\\/g, '/')).replace(/\u0000/g, '');
  const ext = path.extname(name).toLowerCase();
  if (!LOCAL_EXTS.has(ext)) throw httpErr(400, 'Use FLAC, WAV, AIFF, ALAC, M4A, MP3, OGG, Opus or AAC');
  const length = +req.headers['content-length'] || 0;
  if (length > 4 * 1024 * 1024 * 1024) throw httpErr(413, 'That file is too large');
  req.setTimeout(0);

  const base = safe(path.basename(name, ext)).slice(0, 120) || 'Local track';
  let rel = base + ext, n = 2;
  while (fs.existsSync(path.join(LOCAL_DIR, rel))) rel = `${base} (${n++})${ext}`;
  const dest = path.join(LOCAL_DIR, rel);
  const temp = path.join(LOCAL_DIR, '.upload-' + crypto.randomUUID() + '.part');

  try {
    await pipeline(req, fs.createWriteStream(temp, { flags: 'wx' }));
    const stat = fs.statSync(temp);
    if (stat.size < 512) throw httpErr(400, 'That file is empty or incomplete');
    fs.renameSync(temp, dest);
    const finalStat = fs.statSync(dest);
    let track;
    try { track = await probeLocal(dest, rel, finalStat); }
    catch {
      try { fs.unlinkSync(dest); } catch {}
      throw httpErr(415, 'That file could not be read as audio');
    }
    localIndex[rel] = { mtimeMs: finalStat.mtimeMs, size: finalStat.size, track };
    saveLocalIndex();
    return track;
  } catch (e) {
    try { fs.unlinkSync(temp); } catch {}
    throw e;
  }
}

async function deleteLocalFile(id) {
  const entry = localEntry(id);
  if (!entry) throw httpErr(404, 'Local file not found');
  try { fs.unlinkSync(path.join(LOCAL_DIR, entry.rel)); } catch {}
  const art = entry.track && entry.track.art;
  if (art && art.startsWith('/covers/')) {
    try { fs.unlinkSync(path.join(COVERS, path.basename(art))); } catch {}
  }
  delete localIndex[entry.rel];
  saveLocalIndex();
  return { ok: true };
}

const downloadJobs = new Map();   // id -> live job
const activeFiles = new Set();    // files currently being streamed

/* ════════════════════════════════════════════════════════════
   RESOLUTION CACHE — yt-dlp finds a direct audio URL, then the
   browser streams ranges through our local proxy.

   This is what makes seeking instant and avoids writing whole
   songs to disk. The URL cache is persisted so a quick app
   restart does not pay for another extraction. URLs expire, so
   each entry gets a TTL and a 403 triggers one fresh resolve.
   ════════════════════════════════════════════════════════════ */
const RESOLVE_FILE = 'resolve-cache.json';
const RESOLVE_MAX = 300;
const RESOLVE_CONCURRENCY = 2;
const RESOLVE_URL_TTL = 2 * 60 * 60 * 1000;
const resolutions = new Map();    // ytId -> { url, headers, ext, mime, expiresAt, at }
const resolveJobs = new Map();    // ytId -> { id, priority, promise, ok, no }
const resolveQ = [];
let resolveActive = 0;
const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 15) gzip';
const VISIONOS_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const VISIONOS_CLIENT = {
  clientName: 'VISIONOS',
  clientVersion: '1.02',
  deviceMake: 'Apple',
  deviceModel: 'RealityDevice17,1',
  userAgent: VISIONOS_UA,
  osName: 'visionOS',
  osVersion: '26.5.23O471',
  hl: 'en',
  gl: 'US',
};
const STREAM_RANGE_CHUNK = 1024 * 1024;
const RESOLVE_CACHE_VERSION = 2;
let visitorData = '';
let visitorAt = 0;
let visitorPromise = null;

async function getVisitorData(force = false) {
  if (!force && visitorData && Date.now() - visitorAt < 6 * 60 * 60 * 1000) return visitorData;
  if (!force && visitorPromise) return visitorPromise;
  visitorPromise = (async () => {
    const r = await fetch('https://youtubei.googleapis.com/youtubei/v1/visitor_id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': VISIONOS_UA },
      body: JSON.stringify({ context: { client: VISIONOS_CLIENT } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`YouTube visitor endpoint answered ${r.status}`);
    const d = await r.json();
    const value = d?.responseContext?.visitorData;
    if (!value) throw new Error('YouTube did not return visitor data');
    visitorData = String(value);
    visitorAt = Date.now();
    return visitorData;
  })().finally(() => { visitorPromise = null; });
  return visitorPromise;
}

function pickAudioFormat(formats, quality = 'best') {
  const q = normQuality(quality);
  const byBest = list => list.slice().sort((a, b) => (+b.bitrate || 0) - (+a.bitrate || 0));
  const bySaver = list => list.slice().sort((a, b) => (+a.bitrate || 0) - (+b.bitrate || 0));
  const m4a = formats.filter(f => /audio\/mp4/i.test(f.mimeType));
  const webm = formats.filter(f => /audio\/webm/i.test(f.mimeType));
  if (q === 'saver') {
    // Prefer Opus/WebM for data saver: lower bitrate and no HE-AAC trouble.
    return bySaver(webm.filter(f => (+f.bitrate || 0) <= 128000))[0]
      || webm.find(f => f.itag === 250)
      || bySaver(webm)[0]
      || m4a.find(f => f.itag === 140)
      || bySaver(m4a.filter(f => f.itag !== 139))[0]
      || bySaver(formats)[0];
  }
  return byBest(webm)[0] || byBest(formats)[0] || byBest(m4a)[0];
}
const normQuality = value => value === 'saver' ? 'saver' : 'best';
const resolutionKey = (id, quality) => id + ':' + normQuality(quality);
const audioFormat = quality => normQuality(quality) === 'saver'
  ? 'ba[ext=m4a][abr<=128]/ba[abr<=128]/ba[ext=m4a]/ba'
  : AUDIO_FMT;

const isAudioUrl = value => {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'googlevideo.com' || u.hostname.endsWith('.googlevideo.com'));
  } catch { return false; }
};

const pickHeader = (headers, name) => {
  if (!headers) return '';
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
};

function loadResolutions() {
  const saved = readJSON(RESOLVE_FILE, {});
  if (!saved || saved.__v !== RESOLVE_CACHE_VERSION) return;
  const now = Date.now();
  for (const [key, r] of Object.entries(saved || {})) {
    if (key === '__v') continue;
    const [id, savedQuality] = String(key).split(':');
    const quality = normQuality(savedQuality);
    if (!YTID.test(id) || !r || !isAudioUrl(r.url) || !(r.expiresAt > now + 30000)) continue;
    r.quality = quality;
    resolutions.set(resolutionKey(id, quality), r);
  }
  pruneResolutions();
  if (resolutions.size) console.log(`[resolve] restored ${resolutions.size} cached URL(s)`);
}
let resolveSaveT;
function saveResolutions() {
  clearTimeout(resolveSaveT);
  resolveSaveT = setTimeout(() => {
    const out = { __v: RESOLVE_CACHE_VERSION };
    for (const [id, r] of resolutions) out[id] = r;
    try { writeJSON(RESOLVE_FILE, out); } catch {}
  }, 400);
  resolveSaveT.unref?.();
}
function pruneResolutions() {
  if (resolutions.size <= RESOLVE_MAX) return;
  [...resolutions.entries()].sort((a, b) => (a[1].at || 0) - (b[1].at || 0))
    .slice(0, resolutions.size - RESOLVE_MAX).forEach(([id]) => resolutions.delete(id));
}
function invalidateResolution(id) {
  resolutions.delete(id);
  saveResolutions();
}
const validResolution = r => r && r.expiresAt - 30000 > Date.now();

function resolutionFromInfo(id, j, quality = 'best') {
  if (!j || !j.url) throw new Error('yt-dlp did not return an audio URL');
  if (!isAudioUrl(j.url)) throw new Error('No direct audio stream available');
  const ext = String(j.ext || 'm4a').replace(/^\./, '').toLowerCase();
  if (!AUDIO_EXTS.includes('.' + ext)) throw new Error('Unsupported audio format');
  const headers = {};
  for (const name of ['User-Agent', 'Accept', 'Accept-Language', 'Referer', 'Origin']) {
    const value = pickHeader(j.http_headers, name);
    if (value) headers[name] = value;
  }
  let expiresAt = Date.now() + RESOLVE_URL_TTL;
  try {
    const expire = +(new URL(j.url).searchParams.get('expire') || 0);
    if (expire) expiresAt = Math.min(expiresAt, expire * 1000 - 60000);
  } catch {}
  if (expiresAt <= Date.now()) expiresAt = Date.now() + 60000;
  return {
    id,
    url: j.url,
    headers,
    ext,
    mime: AUDIO_MIME['.' + ext] || 'audio/mp4',
    duration: Math.round(+j.duration || 0),
    title: String(j.title || ''),
    quality: normQuality(quality),
    bitrate: Math.round(+(j.abr || j.bitrate || 0)) || 0,
    codec: String(j.acodec || ''),
    expiresAt,
    at: Date.now(),
  };
}

/* YouTube's Android player endpoint returns direct, un-ciphered audio URLs
   in well under a second. yt-dlp still handles matching and remains the
   fallback, but normal playback no longer waits 10–15 seconds for Python
   to start and extract a URL. */
async function androidResolution(id, quality = 'best') {
  const q = normQuality(quality);
  const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
    body: JSON.stringify({
      context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 35, osName: 'Android', osVersion: '15', hl: 'en', gl: 'US' } },
      videoId: id,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`YouTube player answered ${r.status}`);
  const d = await r.json();
  if (d?.playabilityStatus?.status !== 'OK') throw new Error(d?.playabilityStatus?.reason || 'Video is not playable');
  const formats = (d.streamingData?.adaptiveFormats || []).filter(f => f && f.url && /^audio\//.test(String(f.mimeType || '')));
  const m4a = formats.filter(f => /audio\/mp4/i.test(f.mimeType));
  const byBest = list => list.slice().sort((a, b) => (+b.bitrate || 0) - (+a.bitrate || 0));
  const bySaver = list => list.slice().sort((a, b) => (+a.bitrate || 0) - (+b.bitrate || 0));
  const fmt = q === 'saver'
    ? (formats.find(f => f.itag === 140)
      || byBest(m4a.filter(f => (+f.bitrate || 0) <= 128000))[0]
      || bySaver(m4a)[0]
      || bySaver(formats)[0])
    : (byBest(formats)[0] || byBest(m4a)[0]);
  if (!fmt) throw new Error('No direct audio stream in player response');
  const ext = /webm/i.test(fmt.mimeType) ? 'webm' : /mp4|m4a/i.test(fmt.mimeType) ? 'm4a' : 'm4a';
  return resolutionFromInfo(id, {
    url: fmt.url,
    ext,
    duration: +(d.videoDetails?.lengthSeconds || 0),
    title: d.videoDetails?.title || '',
    bitrate: +fmt.bitrate || 0,
    acodec: fmt.mimeType,
    http_headers: { 'User-Agent': ANDROID_UA, 'Accept': '*/*' },
  }, q);
}

/* Plain ANDROID/IOS videoplayback URLs are now Proof-of-Origin gated: only
   the first megabyte or so is readable, so later range requests get a 403.
   VISIONOS still returns ordinary audio URLs with a visitor session and is
   no longer dependent on signature deciphering. */
async function visionosResolution(id, quality = 'best') {
  const q = normQuality(quality);
  let lastError = new Error('YouTube did not return an audio stream');
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const vd = await getVisitorData(attempt > 0);
      const r = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': VISIONOS_UA,
          'X-Goog-Visitor-Id': vd,
        },
        body: JSON.stringify({
          context: { client: { ...VISIONOS_CLIENT, visitorData: vd } },
          videoId: id,
          contentCheckOk: true,
          racyCheckOk: true,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`YouTube player answered ${r.status}`);
      const d = await r.json();
      const status = d?.playabilityStatus?.status;
      if (status !== 'OK') {
        const reason = d?.playabilityStatus?.reason || 'Video is not playable';
        if (attempt === 0 && /LOGIN_REQUIRED|bot|sign in/i.test(reason)) {
          visitorData = '';
          visitorAt = 0;
          lastError = new Error(reason);
          continue;
        }
        throw new Error(reason);
      }
      const formats = (d.streamingData?.adaptiveFormats || [])
        .filter(f => f && f.url && /^audio\//.test(String(f.mimeType || '')));
      const fmt = pickAudioFormat(formats, q);
      if (!fmt) throw new Error('No direct audio stream in player response');
      const ext = /webm/i.test(fmt.mimeType) ? 'webm' : 'm4a';
      return resolutionFromInfo(id, {
        url: fmt.url,
        ext,
        duration: +(d.videoDetails?.lengthSeconds || fmt.approxDurationMs / 1000 || 0),
        title: d.videoDetails?.title || '',
        bitrate: +fmt.bitrate || 0,
        acodec: fmt.mimeType,
        http_headers: { 'User-Agent': VISIONOS_UA, 'Accept': '*/*' },
      }, q);
    } catch (e) {
      lastError = e;
      if (attempt > 0) break;
    }
  }
  throw lastError;
}

function pumpResolve() {
  while (resolveActive < RESOLVE_CONCURRENCY && resolveQ.length) {
    resolveQ.sort((a, b) => (b.priority === true) - (a.priority === true) || a.at - b.at);
    const job = resolveQ.shift();
    resolveActive++;
    (async () => {
      const t0 = Date.now();
      try {
        let r;
        try {
          r = await visionosResolution(job.id, job.quality);
        } catch (visionError) {
          console.warn(`[resolve] ${job.id} VISIONOS failed: ${visionError.message}`);
          try {
            r = await androidResolution(job.id, job.quality);
          } catch {
            const out = await ytdlp([
              '-j', '--no-warnings', '--no-playlist',
              '--socket-timeout', '15', '--retries', '2',
              '-f', audioFormat(job.quality),
              'https://www.youtube.com/watch?v=' + job.id,
            ], { timeout: 60000 });
            const j = lines(out).filter(x => x && x.url).pop();
            r = resolutionFromInfo(job.id, j, job.quality);
          }
        }
        resolutions.set(job.key, r); pruneResolutions(); saveResolutions();
        console.log(`[resolve] ${job.id} ${job.quality} ${r.ext} ${r.bitrate ? Math.round(r.bitrate / 1000) + 'kbps' : ''} in ${Date.now() - t0}ms`);
        job.ok({ ...r, cached: false });
      } catch (e) {
        console.warn(`[resolve] ${job.id} failed after ${Date.now() - t0}ms: ${e.message}`);
        job.no(e);
      } finally {
        resolveActive--;
        resolveJobs.delete(job.key);
        pumpResolve();
      }
    })();
  }
}

function resolveAudio(id, priority = false, force = false, quality = 'best') {
  if (!YTID.test(id)) return Promise.reject(httpErr(400, 'Bad video id'));
  const q = normQuality(quality), key = resolutionKey(id, q);
  if (!force) {
    const hit = resolutions.get(key);
    if (validResolution(hit)) {
      hit.at = Date.now();
      return Promise.resolve({ ...hit, cached: true });
    }
  }
  const running = resolveJobs.get(key);
  if (running) {
    if (priority) running.priority = true;
    return running.promise;
  }
  const job = { id, quality: q, key, priority: priority === true, at: Date.now(), promise: null, ok: null, no: null };
  job.promise = new Promise((ok, no) => { job.ok = ok; job.no = no; });
  resolveJobs.set(key, job);
  resolveQ.push(job);
  pumpResolve();
  return job.promise;
}

function upstreamHeaders(req, r) {
  const out = {};
  for (const [k, v] of Object.entries(r.headers || {})) {
    if (['user-agent', 'accept', 'accept-language', 'referer', 'origin'].includes(k.toLowerCase())) out[k] = v;
  }
  if (!pickHeader(out, 'user-agent')) out['User-Agent'] = UA;
  out['Accept-Encoding'] = 'identity';
  // googlevideo rejects open-ended ranges (`bytes=0-`) and requests without
  // a range when `rqh=1`. Browsers open media with exactly those headers, so
  // turn them into a bounded range and let the element ask for the next chunk.
  const range = String(req.headers.range || '').trim();
  const m = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (m) {
    const start = +m[1];
    const end = m[2] ? +m[2] : start + STREAM_RANGE_CHUNK - 1;
    out.Range = `bytes=${start}-${end}`;
  } else if (range) {
    out.Range = range;
  } else {
    out.Range = `bytes=0-${STREAM_RANGE_CHUNK - 1}`;
  }
  return out;
}

async function proxyAudio(req, res, id, quality = 'best') {
  const cached = cachedAudio(id);
  if (cached) { serveCached(req, res, cached); return true; }

  let r;
  try { r = await resolveAudio(id, true, false, quality); }
  catch (e) { console.warn(`[stream] ${id} resolve failed: ${e.message}`); return false; }
  if (res.destroyed || res.writableEnded) return true;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (res.destroyed || req.destroyed) return true;
    const ac = new AbortController();
    const headTimer = setTimeout(() => ac.abort(), 25000);
    let up;
    try {
      up = await fetch(r.url, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: upstreamHeaders(req, r),
        redirect: 'follow',
        signal: ac.signal,
      });
      clearTimeout(headTimer);
    } catch (e) {
      clearTimeout(headTimer);
      if (attempt === 0 && !res.destroyed) {
        invalidateResolution(resolutionKey(id, quality));
        try { r = await resolveAudio(id, true, true, quality); continue; } catch {}
      }
      console.warn(`[stream] ${id} upstream error: ${e.message}`);
      return false;
    }

    if ((up.status === 403 || up.status === 410 || up.status === 404) && attempt === 0) {
      try { await up.body?.cancel(); } catch {}
      invalidateResolution(resolutionKey(id, quality));
      try { r = await resolveAudio(id, true, true, quality); continue; } catch {}
      return false;
    }
    if (!up.ok && up.status !== 416) {
      console.warn(`[stream] ${id} upstream HTTP ${up.status}`);
      try { await up.body?.cancel(); } catch {}
      return false;
    }

    const headers = {
      'Content-Type': up.headers.get('content-type') || r.mime,
      'Accept-Ranges': up.headers.get('accept-ranges') || 'bytes',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'X-Wavelength-Stream': 'range',
    };
    for (const name of ['content-range', 'content-length', 'last-modified', 'etag']) {
      const value = up.headers.get(name);
      if (value) headers[name.replace(/(^|-)(\w)/g, (_, a, b) => a + b.toUpperCase())] = value;
    }
    res.writeHead(up.status, headers);
    if (req.method === 'HEAD') { try { await up.body?.cancel(); } catch {} return true; }

    const body = up.body ? Readable.fromWeb(up.body) : Readable.from([]);
    const cleanup = () => { ac.abort(); body.destroy(); };
    res.on('close', cleanup);
    try { await pipeline(body, res); }
    catch (e) { if (!res.destroyed) console.warn(`[stream] ${id} relay ended: ${e.message}`); }
    finally { res.off('close', cleanup); }
    return true;
  }
  return false;
}

loadResolutions();

const fileSize = f => { try { return fs.statSync(f).size; } catch { return 0; } };
const touch = f => { try { const n = new Date(); fs.utimesSync(f, n, n); } catch {} };

function cachedAudio(id) {
  for (const ext of AUDIO_EXTS) {
    const f = path.join(CACHE_DIR, id + ext);
    if (fileSize(f) > 8192) return f;
  }
  return null;
}

function findAudioFile(id) {
  try {
    const n = fs.readdirSync(CACHE_DIR).find(x => x.startsWith(id + '.') && !x.includes('.part.') && AUDIO_EXTS.includes(path.extname(x).toLowerCase()));
    return n ? path.join(CACHE_DIR, n) : null;
  } catch { return null; }
}

function pruneCache() {
  try {
    const files = [];
    let total = 0;
    for (const name of fs.readdirSync(CACHE_DIR)) {
      if (!AUDIO_EXTS.includes(path.extname(name).toLowerCase())) continue;
      const f = path.join(CACHE_DIR, name), id = name.split('.')[0];
      if (activeFiles.has(f) || downloadJobs.has(id)) continue;
      let st; try { st = fs.statSync(f); } catch { continue; }
      files.push({ f, size: st.size, mtime: st.mtimeMs });
      total += st.size;
    }
    if (total <= CACHE_LIMIT) return;
    files.sort((a, b) => a.mtime - b.mtime);
    let removed = 0;
    for (const item of files) {
      if (total <= CACHE_LIMIT) break;
      try { fs.unlinkSync(item.f); total -= item.size; removed++; } catch {}
    }
    if (removed) console.log(`[cache] pruned ${removed} track(s), now ${(total / 1048576).toFixed(0)} MB`);
  } catch {}
}

function startDownload(id) {
  const existing = downloadJobs.get(id);
  if (existing) return existing;

  const job = {
    id, file: null, total: 0, downloaded: 0,
    done: false, error: null, proc: null, started: Date.now(),
  };
  downloadJobs.set(id, job);
  console.log(`[dl] ${id} start`);

  const args = [
    '-f', AUDIO_FMT,
    '--no-playlist', '--no-warnings', '--newline',
    '--no-part', '--fixup', 'never',
    '--retries', '3', '--fragment-retries', '3',
    '--progress-template', 'download:WLDL %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s',
    '-o', path.join(CACHE_DIR, id + '.part.%(ext)s'),
    'https://www.youtube.com/watch?v=' + id,
  ];

  let errBuf = '', buf = '';
  const onLine = line => {
    if (/Sleeping|Destination/.test(line)) console.log(`[dl] ${id} ${line.trim()}`);
    let m = line.match(/\[download\] Destination:\s*(.+)$/);
    if (m) { job.file = m[1].trim(); console.log(`[dl] ${id} file ${path.basename(job.file)}`); return; }
    m = line.match(/^WLDL\s+(\d+|NA)\s+(\d+|NA)\s+(\d+|NA)/);
    if (m) {
      job.downloaded = +m[1] || 0;
      const total = Math.max(+m[2] || 0, +m[3] || 0);
      if (total && !job.total) console.log(`[dl] ${id} total ${total}`);
      if (total) job.total = total;
    }
  };
  const onChunk = d => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const l of lines) onLine(l);
  };

  const p = spawn(YTDLP, args, { stdio: ['ignore', 'pipe', 'pipe'], env: YT_ENV });
  job.proc = p;
  p.stdout.on('data', onChunk);
  p.stderr.on('data', d => { errBuf += d; onChunk(d); });

  p.on('error', e => {
    job.error = new Error(e.code === 'ENOENT'
      ? 'yt-dlp not found — install it with: brew install yt-dlp ffmpeg'
      : e.message);
    job.done = true;
    downloadJobs.delete(id);
  });

  p.on('close', code => {
    downloadJobs.delete(id);
    if (!job.file) job.file = findAudioFile(id);

    if (code === 0 && job.file && fileSize(job.file) > 8192) {
      // Publish the completed file under its real name. Any stream that is
      // already reading the partial keeps its open descriptor.
      const final = path.join(CACHE_DIR, id + path.extname(job.file));
      try {
        if (job.file !== final) {
          if (activeFiles.has(job.file)) { activeFiles.delete(job.file); activeFiles.add(final); }
          fs.renameSync(job.file, final);
          job.file = final;
        }
      } catch (e) { job.error = e; }
      job.done = true;
      job.total = Math.max(job.total, fileSize(job.file));
      console.log(`[dl] ${id} done code=${code} bytes=${fileSize(job.file)}`);
      if (!job.error) setTimeout(pruneCache, 50).unref?.();
      return;
    }

    job.done = true;
    job.error = new Error(errBuf.trim().split('\n').pop() || 'yt-dlp failed to download audio');
    console.log(`[dl] ${id} failed code=${code} bytes=${job.file ? fileSize(job.file) : 0}: ${job.error.message}`);
    // Keep a non-empty partial so the next attempt can resume it.
    if (job.file && fileSize(job.file) === 0) { try { fs.unlinkSync(job.file); } catch {} }
  });

  return job;
}

function waitReady(job, timeout = 60000) {
  return new Promise((ok, no) => {
    const t0 = Date.now();
    const tick = () => {
      if (job.error) return no(job.error);
      if (job.file && fileSize(job.file) > 0) {
        console.log(`[dl] ${job.id} ready after ${Date.now() - t0}ms size=${fileSize(job.file)} total=${job.total}`);
        return ok(job);
      }
      if (job.done && (!job.file || fileSize(job.file) === 0)) {
        return no(new Error('yt-dlp finished without producing audio'));
      }
      if (Date.now() - t0 > timeout) return no(new Error('Timed out waiting for YouTube'));
      setTimeout(tick, 80);
    };
    tick();
  });
}

function parseRange(req, total) {
  let start = 0, end = total - 1, code = 200;
  const h = req.headers.range;
  if (h) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(h).trim());
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') start = Math.max(0, total - parseInt(m[2], 10));
      else {
        start = parseInt(m[1], 10);
        end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      }
      if (!Number.isFinite(start) || !Number.isFinite(end) || start >= total || start > end) return null;
      code = 206;
    }
  }
  return { start, end, code };
}

function audioHeaders(file, start, end, total, code) {
  const h = {
    'Content-Type': AUDIO_MIME[path.extname(file).toLowerCase()] || 'audio/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  };
  if (code === 206) h['Content-Range'] = `bytes ${start}-${end}/${total}`;
  return h;
}

function serveCached(req, res, file) {
  const total = fileSize(file);
  if (!total) return json(res, { error: 'Audio file missing' }, 404);
  const r = parseRange(req, total);
  if (!r) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); return res.end(); }

  touch(file);
  res.writeHead(r.code, audioHeaders(file, r.start, r.end, total, r.code));
  if (req.method === 'HEAD') return res.end();

  activeFiles.add(file);
  const rs = fs.createReadStream(file, { start: r.start, end: r.end });
  const cleanup = () => { activeFiles.delete(file); rs.destroy(); };
  res.on('close', cleanup);
  rs.on('error', () => { if (!res.writableEnded) res.end(); });
  rs.on('end', () => activeFiles.delete(file));
  rs.pipe(res);
}

async function* readGrowing(job, start, end) {
  let pos = start, fd;
  try { fd = await fs.promises.open(job.file, 'r'); } catch { return; }
  try {
    while (pos <= end) {
      const size = fileSize(job.file);
      if (pos < size) {
        const len = Math.min(262144, end - pos + 1, size - pos);
        const buf = Buffer.allocUnsafe(len);
        let r;
        try { r = await fd.read(buf, 0, len, pos); } catch { break; }
        if (r.bytesRead) {
          pos += r.bytesRead;
          yield buf.subarray(0, r.bytesRead);
          continue;
        }
      }
      if (job.done || job.error) break;
      await new Promise(r => setTimeout(r, 80));
    }
  } finally {
    try { await fd.close(); } catch {}
  }
}

function serveGrowing(req, res, job) {
  const total = job.total || (job.done ? fileSize(job.file) : 0);
  if (!total) return serveGrowingUnknown(req, res, job);

  const r = parseRange(req, total);
  if (!r) { res.writeHead(416, { 'Content-Range': 'bytes */' + total }); return res.end(); }

  res.writeHead(r.code, audioHeaders(job.file, r.start, r.end, total, r.code));
  if (req.method === 'HEAD') return res.end();

  activeFiles.add(job.file);
  const rs = Readable.from(readGrowing(job, r.start, r.end));
  const cleanup = () => { activeFiles.delete(job.file); rs.destroy(); };
  res.on('close', cleanup);
  pipeline(rs, res)
    .catch(() => {})
    .finally(() => {
      activeFiles.delete(job.file);
      touch(job.file);
      res.off('close', cleanup);
      if (job.done) setTimeout(pruneCache, 50).unref?.();
    });
}

function waitForComplete(job, timeout = 60000) {
  return new Promise((ok, no) => {
    const t0 = Date.now();
    const tick = () => {
      if (job.error) return no(job.error);
      if (job.done) return ok(job);
      if (Date.now() - t0 > timeout) return no(new Error('Timed out waiting for download'));
      setTimeout(tick, 100);
    };
    tick();
  });
}

/* Downloads whose total size is unknown until finished (HLS etc.) are sent
   chunked. A seek before completion waits for the rest, then serves a range. */
function serveGrowingUnknown(req, res, job) {
  const h = req.headers.range && /^bytes=(\d+)-/.exec(String(req.headers.range).trim());
  if (h && +h[1] > 0) {
    waitForComplete(job).then(() => {
      if (!res.destroyed) serveCached(req, res, job.file);
    }).catch(e => {
      if (!res.destroyed) json(res, { error: e.message || 'Download failed' }, 502);
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': AUDIO_MIME[path.extname(job.file).toLowerCase()] || 'audio/mp4',
    'Accept-Ranges': 'none',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Type',
  });
  if (req.method === 'HEAD') return res.end();

  activeFiles.add(job.file);
  const rs = Readable.from(readGrowing(job, 0, Number.MAX_SAFE_INTEGER));
  const cleanup = () => { activeFiles.delete(job.file); rs.destroy(); };
  res.on('close', cleanup);
  pipeline(rs, res)
    .catch(() => {})
    .finally(() => {
      activeFiles.delete(job.file);
      touch(job.file);
      res.off('close', cleanup);
      if (job.done) setTimeout(pruneCache, 50).unref?.();
    });
}

async function streamDownload(req, res, id) {
  const cached = cachedAudio(id);
  if (cached) return serveCached(req, res, cached);

  const job = startDownload(id);
  try {
    await waitReady(job);
  } catch (e) {
    if (res.destroyed) return;
    return json(res, { error: e.message || 'Could not fetch audio' }, 502);
  }
  if (res.destroyed || res.writableEnded) return;
  if (!job.file) return json(res, { error: 'Audio file missing' }, 502);

  if (job.done) {
    touch(job.file);
    return serveCached(req, res, job.file);
  }
  serveGrowing(req, res, job);
}

async function stream(req, res, id, quality = 'best') {
  // Normal path: stream ranges directly from YouTube. No full-song file.
  // Fallback: the old growing-download path, used only when a direct URL
  // cannot be resolved/relayed (HLS-only tracks, temporary errors, etc.).
  let handled = false;
  try { handled = await proxyAudio(req, res, id, quality); }
  catch (e) { console.warn(`[stream] ${id} proxy error: ${e.message}`); }
  if (handled || res.headersSent || res.destroyed) return;
  return streamDownload(req, res, id);
}

// Keep the cache tidy, including leftovers from previous sessions.
setTimeout(pruneCache, 10000).unref?.();

/* ── downloads ── */
const jobs=new Map(); let chain=Promise.resolve();
function queueDownload(o){
  const job={id:crypto.randomUUID(),ytId:o.ytId,name:o.title?`${o.artist?o.artist+' – ':''}${o.title}`:o.ytId,status:'queued',progress:0,error:null,ts:Date.now()};
  jobs.set(job.id,job);
  chain=chain.then(()=>runDownload(job,o)).catch(()=>{});
  return job;
}
function runDownload(job,o){
  return new Promise(done=>{
    try{fs.mkdirSync(config.downloadDir,{recursive:true});}catch(e){job.status='error';job.error=e.message;return done();}
    const base=o.title?safe(`${o.artist?o.artist+' - ':''}${o.title}`).slice(0,120).replace(/%/g,'%%'):'%(title)s';
    const q=[128,192,256,320].includes(+o.quality)?+o.quality:192;
    const args=['-x','--audio-format','mp3','--audio-quality',q+'K','--embed-metadata','--embed-thumbnail',
      '--convert-thumbnails','jpg','--no-playlist','--newline','--no-warnings',
      '-o',path.join(config.downloadDir.replace(/%/g,'%%'),base+'.%(ext)s'),
      `https://www.youtube.com/watch?v=${o.ytId}`];
    job.status='downloading';
    const p=spawn(YTDLP,args,{stdio:['ignore','pipe','pipe'],env:YT_ENV});
    let err='';
    p.stdout.on('data',d=>{
      for(const l of String(d).split('\n')){
        const m=l.match(/\[download\]\s+([\d.]+)%/);
        if(m) job.progress=Math.min(99,+m[1]);
        else if(/\[(ExtractAudio|Metadata|EmbedThumbnail|ThumbnailsConvertor)\]/.test(l)) job.status='converting';
      }
    });
    p.stderr.on('data',d=>err+=d);
    p.on('error',e=>{job.status='error';job.error=e.code==='ENOENT'?'yt-dlp not installed':e.message;done();});
    p.on('close',c=>{
      if(c===0){job.status='done';job.progress=100;}
      else{job.status='error';job.error=err.trim().split('\n').pop()||'Download failed';}
      done();
    });
  });
}

/* ── Spotify public link reader (no login) ── */
function walk(o,fn,d=0){if(!o||typeof o!=='object'||d>16)return;fn(o);for(const k in o)walk(o[k],fn,d+1);}
function parseEmbed(html,kind,id){
  const tracks=new Map();let name='',image=null;
  for(const m of html.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)){
    let j;try{j=JSON.parse(m[1]);}catch{continue;}
    walk(j,o=>{
      const uri=typeof o.uri==='string'?o.uri:'';
      if(uri.startsWith('spotify:track:')){
        const title=o.title||o.name,sid=uri.split(':')[2];
        if(typeof title==='string'&&title&&!tracks.has(sid)){
          const artist=typeof o.subtitle==='string'?o.subtitle:Array.isArray(o.artists)?o.artists.map(a=>a&&a.name).filter(Boolean).join(', '):'';
          const dur=+(o.duration??o.duration_ms??0);
          tracks.set(sid,{spId:sid,title,artist:artist.replace(/\u00a0/g,' ').trim(),album:'',duration:Math.round(dur>10000?dur/1000:dur),art:null});
        }
      }else if(uri===`spotify:${kind}:${id}`){
        name=name||o.name||o.title||'';
        const src=(o.coverArt&&o.coverArt.sources)||(o.visualIdentity&&o.visualIdentity.image)||o.images;
        if(!image&&Array.isArray(src)&&src.length)image=((src.find(x=>x&&x.width>=300)||src[0])||{}).url||null;
      }
    });
  }
  const list=[...tracks.values()];
  if(kind==='album')list.forEach(t=>{t.art=image;t.album=name;});
  return{kind,id,name:name||(kind==='track'&&list[0]?list[0].title:'Imported playlist'),image,tracks:list,truncated:kind==='playlist'&&list.length>=100};
}
async function spotifyPublic(url){
  let u;try{u=new URL(url);}catch{throw httpErr(400,"That doesn't look like a link");}
  try{
    if(/(^|\.)spotify\.(link|app\.link)$/.test(u.hostname)||u.hostname.endsWith('.app.link')){
      const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':UA},signal:AbortSignal.timeout(12000)});
      const loc=r.headers.get('location');
      if(!loc) throw httpErr(400,"Couldn't open that short link — paste the full open.spotify.com link");
      u=new URL(loc,url);
    }
    if(u.hostname!=='open.spotify.com') throw httpErr(400,'Paste a link from open.spotify.com (Share → Copy link)');
    const m=u.pathname.match(/\/(playlist|album|track)\/([A-Za-z0-9]{10,40})/);
    if(!m) throw httpErr(400,"That link isn't a playlist, album or song");
    const r=await fetch(`https://open.spotify.com/embed/${m[1]}/${m[2]}`,{headers:{'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'},signal:AbortSignal.timeout(15000)});
    if(!r.ok) throw httpErr(r.status===404?404:502,r.status===404?"Spotify can't find that. Make sure the playlist is public.":`Spotify answered with ${r.status}`);
    const d=parseEmbed(await r.text(),m[1],m[2]);
    if(!d.tracks.length) throw httpErr(422,"Couldn't read any songs from that link. It may be private, or use 'Paste a list of songs' instead.");
    return d;
  }catch(e){
    if(e&&(e.name==='TimeoutError'||e.name==='AbortError')) throw httpErr(504,'Spotify took too long to answer. Try again.');
    throw e;
  }
}

/* ── covers ── */
function sniff(b){
  if(b.length<12)return null;
  if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47)return'png';
  if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return'jpg';
  if(b.toString('ascii',0,4)==='GIF8')return'gif';
  if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return'webp';
  return null;
}

/* ── Spotify OAuth (optional, for >100 songs) ── */
const pending=new Map();
const b64u=b=>b.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function login(res){
  const cid=clientId();
  if(!cid){res.writeHead(302,{Location:'/#import'});return res.end();}
  const verifier=b64u(crypto.randomBytes(48)),state=b64u(crypto.randomBytes(12));
  pending.set(state,verifier);setTimeout(()=>pending.delete(state),10*60*1000);
  const q=new URLSearchParams({response_type:'code',client_id:cid,redirect_uri:REDIRECT,state,
    scope:'playlist-read-private playlist-read-collaborative user-library-read',
    code_challenge_method:'S256',code_challenge:b64u(crypto.createHash('sha256').update(verifier).digest())});
  res.writeHead(302,{Location:'https://accounts.spotify.com/authorize?'+q});res.end();
}
async function callback(res,u){
  const state=u.searchParams.get('state'),code=u.searchParams.get('code'),verifier=pending.get(state);
  pending.delete(state);
  if(!code||!verifier){res.writeHead(400,{'Content-Type':'text/html; charset=utf-8'});
    return res.end(`<body style="font:16px system-ui;padding:40px"><h2>Spotify login failed</h2><p>${u.searchParams.get('error')||'Session expired.'}</p><a href="/#import">Back</a></body>`);}
  const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',
    body:new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:REDIRECT,client_id:clientId(),code_verifier:verifier})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw httpErr(502,j.error_description||'Spotify token exchange failed');
  writeJSON('spotify.json',{access:j.access_token,refresh:j.refresh_token,exp:Date.now()+j.expires_in*1000});
  res.writeHead(302,{Location:'/#import'});res.end();
}
async function token(){
  let t=readJSON('spotify.json',null);
  if(!t) throw httpErr(401,'Not connected to Spotify');
  if(t.exp-30000<Date.now()){
    const r=await fetch('https://accounts.spotify.com/api/token',{method:'POST',
      body:new URLSearchParams({grant_type:'refresh_token',refresh_token:t.refresh,client_id:clientId()})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok) throw httpErr(401,'Spotify session expired — connect again');
    t={access:j.access_token,refresh:j.refresh_token||t.refresh,exp:Date.now()+j.expires_in*1000};
    writeJSON('spotify.json',t);
  }
  return t.access;
}
async function sp(p){
  const r=await fetch(p.startsWith('http')?p:'https://api.spotify.com/v1'+p,{headers:{Authorization:'Bearer '+await token()}});
  if(r.status===429) throw httpErr(429,'Spotify is rate limiting — wait a minute');
  if(!r.ok){let m='';try{m=(await r.json()).error.message;}catch{}throw httpErr(r.status,m||`Spotify error ${r.status}`);}
  return r.json();
}
const spTrack=t=>(t&&t.id&&!t.is_local&&t.type!=='episode')?{spId:t.id,title:t.name,artist:(t.artists||[]).map(a=>a.name).join(', '),album:t.album&&t.album.name||'',duration:Math.round((t.duration_ms||0)/1000),art:t.album&&t.album.images&&(t.album.images[1]||t.album.images[0]||{}).url||null}:null;
async function paged(first,pick){
  const out=[];let next=first,pages=0;
  while(next&&pages++<60){const pg=await sp(next);out.push(...pg.items.map(pick).filter(Boolean));next=pg.next;}
  return out;
}
async function spPlaylist(id){
  const meta=await sp(`/playlists/${id}?fields=name,images`);
  const pick=it=>spTrack(it&&(it.track||it.item));
  let tracks;
  try{tracks=await paged(`/playlists/${id}/tracks?limit=100`,pick);}
  catch(e){try{tracks=await paged(`/playlists/${id}/items?limit=100`,pick);}catch{throw e;}}
  return{name:meta.name,image:meta.images&&meta.images[0]&&meta.images[0].url||null,tracks};
}

/* ── health ── */
let hc=null,hAt=0;
async function health(){
  if(!hc||Date.now()-hAt>10000){
    const[y,f,p]=await Promise.all([bin(YTDLP,['--version']),bin(FFMPEG,['-version']),bin(FFPROBE,['-version'])]);
    hc={ytdlp:y,ffmpeg:f?f.replace(/^ffmpeg version\s+(\S+).*/,'$1'):null,ffprobe:p?p.replace(/^ffprobe version\s+(\S+).*/,'$1'):null};hAt=Date.now();
  }
  return{...hc,version:VERSION,host:HOST,loopback:LOOPBACK,urls:lanUrls(),syncPort:SYNC_PORT,clientId:clientId(),redirectUri:REDIRECT,spotifyConnected:!!readJSON('spotify.json',null),downloadDir:config.downloadDir,localDir:LOCAL_DIR,port:PORT};
}

/* ── device sync ── */
/* Sync deliberately uses a tiny second HTTP listener instead of exposing the
   whole player server. Only the library endpoints are reachable there, and
   every read/write requires the pairing code. The main server stays on
   loopback, so a guest can never use the sync port to reach /api/state or a
   stream. */
const SYNC_HEADER = 'x-wavelength-sync';
const syncDefaults = { role: 'off', enabled: false, code: '', hostUrl: '', rev: 0, lastSync: 0, remoteUpdatedAt: 0, peer: '', port: SYNC_PORT };
let sync = { ...syncDefaults, ...readJSON('sync.json', {}) };
let syncServer = null, syncLastError = '';
/* In-memory copies used by the host's Merge data button. They never leave
   sync.json, and are cleared when hosting stops. */
let syncGuestSnaps = new Map(), syncKeepHost = null;
const syncSave = () => { try { writeJSON('sync.json', sync); } catch (e) { console.error('[sync] could not save settings:', e.message); } };
const syncCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 24);
const newSyncCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const syncList = (v, max) => Array.isArray(v) ? v.filter(x => x && typeof x === 'object').slice(0, max) : [];
const syncNum = v => Math.max(0, Math.min(1e12, Math.round(+v || 0)));
const syncText = (v, n = 200) => String(v == null ? '' : v).slice(0, n);
/* Listening stats are owned by one device each, so sync keeps the newest
   snapshot per device id instead of adding counters together. */
const cleanPairs = (v, max, keyLen) => {
  const out = {};
  const src = v && typeof v === 'object' ? v : {};
  for (const [k, arr] of Object.entries(src).slice(0, max)) {
    if (!Array.isArray(arr)) continue;
    out[syncText(k, keyLen)] = [syncNum(arr[0]), syncNum(arr[1])];
  }
  return out;
};
function cleanListening(v) {
  if (!v || typeof v !== 'object' || !v.devices || typeof v.devices !== 'object') return { v: 1, devices: {} };
  const out = { v: 1, devices: {} };
  for (const [id, d] of Object.entries(v.devices).slice(0, 40)) {
    if (!d || typeof d !== 'object') continue;
    const key = syncText(id, 64).replace(/[^A-Za-z0-9_.:-]/g, '');
    if (!key) continue;
    const dev = { name: syncText(d.name, 60) || 'Device', updatedAt: syncNum(d.updatedAt), days: {}, years: {}, daily: {} };
    for (const [day, sec] of Object.entries(d.days || {}).slice(0, 800)) if (/^\d{4}-\d{2}-\d{2}$/.test(day)) dev.days[day] = syncNum(sec);
    for (const [day, b] of Object.entries(d.daily || {}).slice(0, 800)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !b || typeof b !== 'object') continue;
      dev.daily[day] = {
        t: cleanPairs(b.t, 5000, 80),
        a: cleanPairs(b.a, 2000, 200),
        p: cleanPairs(b.p, 500, 200),
      };
    }
    for (const [y, b] of Object.entries(d.years || {}).slice(0, 12)) {
      if (!/^\d{4}$/.test(y) || !b || typeof b !== 'object') continue;
      const yb = { seconds: syncNum(b.seconds), tracks: {}, playlists: {}, artists: {} };
      for (const [k, t] of Object.entries(b.tracks || {}).slice(0, 5000)) {
        if (!t || typeof t !== 'object') continue;
        yb.tracks[syncText(k, 80)] = {
          title: syncText(t.title, 300), artist: syncText(t.artist, 300), art: syncText(t.art, 500),
          seconds: syncNum(t.seconds), plays: syncNum(t.plays),
        };
      }
      for (const [name, x] of Object.entries(b.playlists || {}).slice(0, 500)) yb.playlists[syncText(name, 200)] = { seconds: syncNum(x && x.seconds), plays: syncNum(x && x.plays) };
      for (const [name, x] of Object.entries(b.artists || {}).slice(0, 2000)) yb.artists[syncText(name, 200)] = { seconds: syncNum(x && x.seconds), plays: syncNum(x && x.plays) };
      dev.years[y] = yb;
    }
    out.devices[key] = dev;
  }
  return out;
}
function mergeListening(cur, incoming) {
  const out = { v: 1, devices: {} };
  for (const src of [cur, incoming]) {
    if (!src || typeof src !== 'object' || !src.devices) continue;
    for (const [id, d] of Object.entries(src.devices)) {
      if (!d || typeof d !== 'object') continue;
      const have = out.devices[id];
      if (!have || syncNum(d.updatedAt) >= syncNum(have.updatedAt)) out.devices[id] = d;
    }
  }
  return out;
}
/* Merge is additive: playlists, liked songs, history and per-device listening
   stats from both copies are kept. It is intentionally not a deletion sync —
   a track removed on one device comes back if the other copy still has it. */
const trackKeyOf = t => {
  if (!t || typeof t !== 'object') return '';
  if (t.localId) return 'local:' + syncText(t.localId, 80);
  if (t.spId) return 'sp:' + syncText(t.spId, 80);
  if (t.ytId) return 'yt:' + syncText(t.ytId, 80);
  const title = syncText(t.title, 300).trim().toLowerCase();
  return title ? 'x:' + title + '|' + syncText(t.artist, 300).trim().toLowerCase() : '';
};
const playlistKeyOf = p => {
  if (!p || typeof p !== 'object') return '';
  if (p.spId) return 'sp:' + syncText(p.spId, 120);
  if (p.id) return 'id:' + syncText(p.id, 120);
  return 'name:' + syncText(p.name, 200).trim().toLowerCase();
};
const mergeTrack = (have, extra) => {
  for (const [k, v] of Object.entries(extra || {})) {
    if (k === 'addedAt') {
      const a = +have.addedAt || 0, b = +v || 0;
      if (a && b) have.addedAt = Math.min(a, b);
      else if (!a && b) have.addedAt = b;
    } else if (have[k] == null || have[k] === '') have[k] = v;
  }
  return have;
};
const mergeTrackLists = (left, right, max) => {
  const out = [], seen = new Map();
  for (const src of [left, right]) {
    for (const t of Array.isArray(src) ? src : []) {
      if (!t || typeof t !== 'object') continue;
      const key = trackKeyOf(t);
      if (!key) continue;
      const have = seen.get(key);
      if (!have) {
        const copy = { ...t };
        seen.set(key, copy);
        out.push(copy);
      } else mergeTrack(have, t);
    }
  }
  return out.slice(0, max);
};
const emptyLibrary = () => ({ playlists: [], liked: [], history: [], listening: { v: 1, devices: {} } });
/* A baseline records the last library this device merged. It is used only to
   tell a genuinely new item (add it automatically) from one this device used
   to have and has since removed (ask before adding it back). */
const readMergeBase = () => {
  const b = readJSON('merge-base.json', null);
  return b && typeof b === 'object' && b.playlists && typeof b.playlists === 'object' ? b : null;
};
const writeMergeBase = lib => {
  if (!lib) return;
  const base = { v: 1, updatedAt: Date.now(), playlists: {}, liked: {} };
  for (const p of lib.playlists || []) {
    const key = playlistKeyOf(p);
    if (!key) continue;
    const tracks = {};
    for (const t of p.tracks || []) {
      const tk = trackKeyOf(t);
      if (tk) tracks[tk] = 1;
    }
    base.playlists[key] = { tracks };
  }
  for (const t of lib.liked || []) {
    const tk = trackKeyOf(t);
    if (tk) base.liked[tk] = 1;
  }
  try { writeJSON('merge-base.json', base); } catch (e) { console.error('[sync] could not save merge baseline:', e.message); }
};
/* The baseline only grows. An item this device ever knew stays "known", so a
   later copy offering it back is presented as something removed, not silently
   treated as new. */
const rememberMergeBase = lib => {
  const old = readMergeBase();
  if (!old) return writeMergeBase(lib);
  const base = { v: 1, updatedAt: Date.now(), playlists: {}, liked: {} };
  for (const [key, val] of Object.entries(old.playlists || {})) {
    const tracks = {};
    for (const tk of Object.keys((val && val.tracks) || {})) tracks[tk] = 1;
    base.playlists[key] = { tracks };
  }
  for (const tk of Object.keys(old.liked || {})) base.liked[tk] = 1;
  for (const p of lib.playlists || []) {
    const key = playlistKeyOf(p);
    if (!key) continue;
    if (!base.playlists[key]) base.playlists[key] = { tracks: {} };
    for (const t of p.tracks || []) {
      const tk = trackKeyOf(t);
      if (tk) base.playlists[key].tracks[tk] = 1;
    }
  }
  for (const t of lib.liked || []) {
    const tk = trackKeyOf(t);
    if (tk) base.liked[tk] = 1;
  }
  try { writeJSON('merge-base.json', base); } catch (e) { console.error('[sync] could not save merge baseline:', e.message); }
};
const cleanMergeKeys = (v, max) => [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === 'string' && x).map(x => x.slice(0, 400)))].slice(0, max);
const cleanMergeSelection = v => {
  if (!v || typeof v !== 'object') return null;
  const songs = [];
  for (const x of Array.isArray(v.songs) ? v.songs.slice(0, 20000) : []) {
    let p = '', t = '';
    if (Array.isArray(x)) { p = String(x[0] || ''); t = String(x[1] || ''); }
    else if (x && typeof x === 'object') { p = String(x.p || ''); t = String(x.t || x.key || ''); }
    if (p && t) songs.push([p.slice(0, 400), t.slice(0, 400)]);
  }
  return {
    playlists: new Set(cleanMergeKeys(v.playlists, 2000)),
    songs: new Set(songs.map(([p, t]) => p + '\u0000' + t)),
    liked: new Set(cleanMergeKeys(v.liked, 50000)),
  };
};
const trackAllowed = (selection, pkey, tkey, all) => !selection || all || selection.playlists.has(pkey) || selection.songs.has(pkey + '\u0000' + tkey);
/* Merges one local library with one or more peer copies. Pass selection to
   add only the keys the user confirmed; omit it for the old full merge. */
function mergeLibraries(left, rights, selection = null) {
  const a = left || emptyLibrary();
  const peers = (Array.isArray(rights) ? rights : [rights]).filter(x => x && typeof x === 'object');
  const out = { playlists: [], liked: [], history: [], listening: cleanListening(a.listening) };
  const pls = new Map(), addedPlaylists = new Set();
  for (const p of a.playlists || []) {
    const key = playlistKeyOf(p);
    if (!key) continue;
    const copy = { ...p, tracks: mergeTrackLists(p.tracks, [], 50000) };
    pls.set(key, copy);
    out.playlists.push(copy);
  }
  for (const b of peers) out.listening = mergeListening(out.listening, cleanListening(b.listening));
  for (const b of peers) {
    for (const p of b.playlists || []) {
      const key = playlistKeyOf(p);
      if (!key) continue;
      let have = pls.get(key);
      if (!have) {
        if (selection && !selection.playlists.has(key)) continue;
        have = { ...p, tracks: mergeTrackLists(p.tracks, [], 50000) };
        pls.set(key, have);
        addedPlaylists.add(key);
        out.playlists.push(have);
      } else {
        for (const f of ['name', 'cover', 'description', 'createdAt']) {
          if ((have[f] == null || have[f] === '') && p[f] != null) have[f] = p[f];
        }
        const tracks = (p.tracks || []).filter(t => trackAllowed(selection, key, trackKeyOf(t), addedPlaylists.has(key)));
        have.tracks = mergeTrackLists(have.tracks, tracks, 50000);
      }
    }
  }
  out.liked = mergeTrackLists(a.liked, [], 50000);
  out.history = mergeTrackLists(a.history, [], 50000);
  for (const b of peers) {
    out.liked = mergeTrackLists(out.liked, (b.liked || []).filter(t => !selection || selection.liked.has(trackKeyOf(t))), 50000);
    out.history = mergeTrackLists(out.history, b.history, 50000);
  }
  out.playlists = out.playlists.slice(0, 2000);
  return out;
}
function previewMerge(local, sources, baseline) {
  const src = (Array.isArray(sources) ? sources : [sources]).filter(x => x && typeof x === 'object');
  const localPls = new Map();
  for (const p of local.playlists || []) {
    const key = playlistKeyOf(p);
    if (key) localPls.set(key, p);
  }
  const localLiked = new Set((local.liked || []).map(trackKeyOf).filter(Boolean));
  const localHistory = new Set((local.history || []).map(trackKeyOf).filter(Boolean));
  const add = { playlists: [], songs: [], liked: [], history: 0 };
  const removed = { playlists: [], songs: [], liked: [] };
  const selected = { playlists: [], songs: [], liked: [] };
  const seenPlaylist = new Set(), seenSong = new Set(), seenLiked = new Set(), seenHistory = new Set();
  for (const s of src) {
    for (const p of s.playlists || []) {
      const pkey = playlistKeyOf(p);
      if (!pkey) continue;
      const localP = localPls.get(pkey);
      if (!localP) {
        if (seenPlaylist.has(pkey)) continue;
        seenPlaylist.add(pkey);
        const item = { key: pkey, name: p.name || 'Untitled playlist', count: (p.tracks || []).length };
        if (baseline?.playlists?.[pkey]) removed.playlists.push(item);
        else { add.playlists.push(item); selected.playlists.push(pkey); }
        continue;
      }
      const have = new Set((localP.tracks || []).map(trackKeyOf).filter(Boolean));
      for (const t of p.tracks || []) {
        const tkey = trackKeyOf(t);
        if (!tkey || have.has(tkey)) continue;
        const songKey = pkey + '\u0000' + tkey;
        if (seenSong.has(songKey)) continue;
        seenSong.add(songKey);
        const item = { key: tkey, pkey, title: t.title || 'Untitled song', artist: t.artist || '', playlist: localP.name || p.name || 'Playlist' };
        if (baseline?.playlists?.[pkey]?.tracks?.[tkey]) removed.songs.push(item);
        else { add.songs.push(item); selected.songs.push([pkey, tkey]); }
      }
    }
    for (const t of s.liked || []) {
      const tkey = trackKeyOf(t);
      if (!tkey || localLiked.has(tkey) || seenLiked.has(tkey)) continue;
      seenLiked.add(tkey);
      const item = { key: tkey, title: t.title || 'Untitled song', artist: t.artist || '' };
      if (baseline?.liked?.[tkey]) removed.liked.push(item);
      else { add.liked.push(item); selected.liked.push(tkey); }
    }
    for (const t of s.history || []) {
      const tkey = trackKeyOf(t);
      if (!tkey || localHistory.has(tkey) || seenHistory.has(tkey)) continue;
      seenHistory.add(tkey);
      add.history++;
    }
  }
  const byName = (a, b) => String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''));
  add.playlists.sort(byName); add.liked.sort(byName);
  removed.playlists.sort(byName);
  removed.songs.sort((a, b) => String(a.playlist).localeCompare(String(b.playlist)) || String(a.title).localeCompare(String(b.title)));
  removed.liked.sort(byName);
  return { add, removed, selected };
}
const cleanSyncLibrary = v => {
  if (!v || typeof v !== 'object') throw httpErr(400, 'That device did not send a library');
  return { playlists: syncList(v.playlists, 2000), liked: syncList(v.liked, 50000), history: syncList(v.history, 50000), listening: cleanListening(v.listening) };
};
const readSyncLibrary = () => {
  const st = readJSON('state.json', {}) || {};
  return { playlists: syncList(st.playlists, 2000), liked: syncList(st.liked, 50000), history: syncList(st.history, 50000), listening: cleanListening(st.listening) };
};
const syncCounts = lib => ({
  playlists: lib.playlists.length,
  tracks: lib.playlists.reduce((n, p) => n + (Array.isArray(p.tracks) ? p.tracks.length : 0), 0),
  liked: lib.liked.length,
  history: lib.history.length,
  devices: Object.keys((lib.listening && lib.listening.devices) || {}).length,
});
const stateStamp = () => { try { return fs.statSync(path.join(DATA, 'state.json')).mtimeMs; } catch { return 0; } };
const applySyncLibrary = lib => {
  const state = readJSON('state.json', {}) || {};
  state.playlists = lib.playlists;
  state.liked = lib.liked;
  state.history = lib.history;
  state.listening = mergeListening(cleanListening(state.listening), lib.listening || { devices: {} });
  writeJSON('state.json', state);
};
const syncUrls = () => {
  const urls = [];
  for (const nets of Object.values(os.networkInterfaces())) for (const n of nets || []) {
    if (n.family === 'IPv4' && !n.internal && !/^169\.254\./.test(n.address)) urls.push(`http://${n.address}:${SYNC_PORT}`);
  }
  return [...new Set(urls)];
};
const syncStatus = () => {
  const lib = readSyncLibrary();
  return {
    ...syncDefaults,
    ...sync,
    role: ['off', 'host', 'guest'].includes(sync.role) ? sync.role : 'off',
    port: SYNC_PORT,
    urls: sync.role === 'host' ? syncUrls() : [],
    counts: syncCounts(lib),
    error: syncLastError,
    device: os.hostname(),
    mergeReady: sync.role === 'host' ? !!(syncKeepHost || syncGuestSnaps.size) : false,
    mergePeer: sync.role === 'host' ? [...new Set([...syncGuestSnaps.values()].map(x => x.name))].join(', ') : '',
    mergeCount: sync.role === 'host' ? syncGuestSnaps.size : 0,
  };
};
const syncCodeOk = req => {
  const given = syncCode(req.headers[SYNC_HEADER]);
  const expected = syncCode(sync.code);
  return !!expected && given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};
const syncSend = (res, code, value) => {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, X-Wavelength-Sync',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  });
  res.end(JSON.stringify(value));
};
async function syncHostRequest(req, res) {
  const u = new URL(req.url || '/', 'http://sync');
  if (req.method === 'OPTIONS') return syncSend(res, 204, {});
  if (u.pathname === '/api/sync/info') {
    if (req.method !== 'GET') return syncSend(res, 405, { error: 'Method not allowed' });
    return syncSend(res, 200, { ok: true, merge: true, name: os.hostname(), version: VERSION, rev: +sync.rev || 0, updatedAt: stateStamp(), port: SYNC_PORT });
  }
  /* Preview is its own path so an older host cannot mistake it for a library
     replacement. Old hosts simply answer 404 and the caller falls back. */
  if (u.pathname === '/api/sync/preview') {
    if (req.method !== 'PUT') return syncSend(res, 405, { error: 'Method not allowed' });
    if (!syncCodeOk(req)) return syncSend(res, 401, { error: 'That pairing code is not right' });
    const raw = (await body(req, 25e6)).toString() || '{}';
    let incoming;
    try { incoming = JSON.parse(raw); } catch { throw httpErr(400, 'Bad library JSON'); }
    const lib = cleanSyncLibrary(incoming.library || incoming);
    return syncSend(res, 200, {
      ok: true, role: 'guest', sources: [syncText(incoming.device, 80) || 'Device'],
      ...previewMerge(readSyncLibrary(), [lib], readMergeBase()),
    });
  }
  if (u.pathname !== '/api/sync/library') return syncSend(res, 404, { error: 'Not found' });
  if (!syncCodeOk(req)) return syncSend(res, 401, { error: 'That pairing code is not right' });
  if (req.method === 'GET') {
    return syncSend(res, 200, { ok: true, host: os.hostname(), rev: +sync.rev || 0, updatedAt: stateStamp(), library: readSyncLibrary() });
  }
  if (req.method === 'PUT') {
    const raw = (await body(req, 25e6)).toString() || '{}';
    let incoming;
    try { incoming = JSON.parse(raw); } catch { throw httpErr(400, 'Bad library JSON'); }
    const lib = cleanSyncLibrary(incoming.library || incoming);
    const mode = u.searchParams.get('mode') || req.headers['x-wavelength-sync-mode'] || '';
    const peerName = syncText(incoming.device, 80) || 'Device';
    const peerKey = syncText(req.socket.remoteAddress || '', 80) + '|' + peerName;
    if (mode === 'merge') {
      const selected = cleanMergeSelection(incoming.selected);
      const merged = mergeLibraries(readSyncLibrary(), [lib], selected);
      applySyncLibrary(merged);
      rememberMergeBase(readSyncLibrary());
      /* Keep this copy as a recovery source for the host's own Merge button.
         The host may delete something later and offer it back. */
      syncGuestSnaps.set(peerKey, { lib, name: peerName });
      sync.rev = (+sync.rev || 0) + 1;
      sync.lastSync = Date.now();
      syncSave();
      return syncSend(res, 200, { ok: true, merged: true, rev: sync.rev, updatedAt: stateStamp(), counts: syncCounts(merged), library: merged });
    }
    /* Keep the host copy and every guest copy for the host's own Merge
       button, so a replace can still be combined instead of losing data. */
    if (!syncKeepHost) syncKeepHost = readSyncLibrary();
    syncGuestSnaps.set(peerKey, { lib, name: peerName });
    applySyncLibrary(lib);
    rememberMergeBase(lib);
    sync.rev = (+sync.rev || 0) + 1;
    sync.lastSync = Date.now();
    syncSave();
    return syncSend(res, 200, { ok: true, rev: sync.rev, updatedAt: stateStamp(), counts: syncCounts(lib) });
  }
  return syncSend(res, 405, { error: 'Method not allowed' });
}
async function startSyncHost() {
  sync.role = 'host';
  sync.enabled = true;
  sync.port = SYNC_PORT;
  if (!sync.code) sync.code = newSyncCode();
  rememberMergeBase(readSyncLibrary());
  syncSave();
  if (syncServer) return syncStatus();
  syncLastError = '';
  await new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      syncHostRequest(req, res).catch(e => {
        if (res.headersSent) return res.end();
        syncSend(res, e.status || 500, { error: e.message || 'Sync error' });
      });
    });
    s.on('error', e => {
      syncServer = null;
      sync.role = 'off';
      sync.enabled = false;
      syncLastError = e.code === 'EADDRINUSE' ? `Port ${SYNC_PORT} is already in use` : (e.message || 'Could not start sync');
      syncSave();
      reject(httpErr(503, syncLastError));
    });
    s.listen(SYNC_PORT, '0.0.0.0', () => {
      syncServer = s;
      sync.enabled = true;
      syncLastError = '';
      syncSave();
      console.log(`[sync] hosting on port ${SYNC_PORT}`);
      resolve();
    });
  });
  return syncStatus();
}
async function stopSyncHost() {
  const s = syncServer;
  syncServer = null;
  if (s) await new Promise(resolve => { try { s.close(() => resolve()); } catch { resolve(); } });
  sync.role = 'off';
  sync.enabled = false;
  sync.rev = 0;
  syncLastError = '';
  syncGuestSnaps = new Map();
  syncKeepHost = null;
  syncSave();
  return syncStatus();
}
const syncHostBase = input => {
  let raw = String(input || '').trim();
  if (!raw) throw httpErr(400, 'Enter the host address');
  if (!/^https?:\/\//i.test(raw)) raw = 'http://' + raw;
  let u;
  try { u = new URL(raw); } catch { throw httpErr(400, 'That host address is not valid'); }
  if (!/^https?:$/.test(u.protocol)) throw httpErr(400, 'Use an http:// or https:// address');
  u.pathname = u.pathname.replace(/\/api\/sync.*$/i, '').replace(/\/+$/, '');
  u.search = ''; u.hash = '';
  if (!u.port) u.port = String(SYNC_PORT);
  return u.origin;
};
async function syncRemote(base, code, route, init = {}, timeout = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(base + route, {
      ...init,
      signal: ctrl.signal,
      headers: { ...(init.headers || {}), [SYNC_HEADER]: code },
    });
    let value = {};
    try { value = await r.json(); } catch {}
    if (!r.ok) throw new Error(value.error || `Host answered ${r.status}`);
    return value;
  } catch (e) {
    if (e.name === 'AbortError') throw httpErr(504, 'The host did not answer in time');
    throw httpErr(502, `Could not reach the host: ${e.message}`);
  } finally {
    clearTimeout(timer);
  }
}
async function joinSync(input = {}) {
  const base = syncHostBase(input.url);
  const code = syncCode(input.code);
  if (code.length < 6) throw httpErr(400, 'Enter the pairing code shown on the host');
  const local = readSyncLibrary();
  const info = await syncRemote(base, code, '/api/sync/info');
  let remote;
  if (info.merge) {
    /* New hosts support merge, so connecting keeps this device's playlists
       too. Older hosts fall back to the documented pull-and-replace. */
    let selected;
    try {
      const preview = await syncRemote(base, code, '/api/sync/preview', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ library: readSyncLibrary(), device: os.hostname() }),
      }, 30000);
      selected = preview.selected;
    } catch {}
    remote = await syncRemote(base, code, '/api/sync/library?mode=merge', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: readSyncLibrary(), device: os.hostname(), selected }),
    }, 30000);
    if (!remote.library) throw httpErr(502, 'The host did not send the merged library');
  } else {
    remote = await syncRemote(base, code, '/api/sync/library', {}, 30000);
    if (!remote.library) throw httpErr(502, 'The host did not send a library');
  }
  if (syncServer) await stopSyncHost();
  const incoming = cleanSyncLibrary(remote.library);
  /* Joining is additive too: items this device already has stay here even if
     the host no longer has them. Only Pull replaces the local copy. */
  applySyncLibrary(info.merge ? mergeLibraries(local, [incoming]) : incoming);
  rememberMergeBase(readSyncLibrary());
  sync.role = 'guest';
  sync.enabled = true;
  sync.hostUrl = base;
  sync.code = code;
  sync.peer = info.name || remote.host || '';
  sync.rev = +remote.rev || 0;
  sync.remoteUpdatedAt = +remote.updatedAt || 0;
  sync.lastSync = Date.now();
  syncLastError = '';
  syncSave();
  return syncStatus();
}
async function pullSync() {
  if (sync.role !== 'guest' || !sync.hostUrl) throw httpErr(400, 'This device is not connected to a host');
  const remote = await syncRemote(sync.hostUrl, sync.code, '/api/sync/library', {}, 30000);
  if (!remote.library) throw httpErr(502, 'The host did not send a library');
  applySyncLibrary(cleanSyncLibrary(remote.library));
  rememberMergeBase(readSyncLibrary());
  sync.rev = +remote.rev || 0;
  sync.remoteUpdatedAt = +remote.updatedAt || 0;
  sync.lastSync = Date.now();
  syncLastError = '';
  syncSave();
  return syncStatus();
}
async function pushSync() {
  if (sync.role !== 'guest' || !sync.hostUrl) throw httpErr(400, 'This device is not connected to a host');
  const lib = readSyncLibrary();
  const remote = await syncRemote(sync.hostUrl, sync.code, '/api/sync/library', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ library: lib, device: os.hostname() }),
  }, 30000);
  sync.rev = +remote.rev || 0;
  sync.remoteUpdatedAt = +remote.updatedAt || 0;
  sync.lastSync = Date.now();
  syncLastError = '';
  syncSave();
  return syncStatus();
}
const hostMergeSources = () => [syncKeepHost, ...[...syncGuestSnaps.values()].map(x => x.lib)].filter(Boolean);
/* Merge is available on both ends. A guest combines its library with the
   host's and saves the result on both. A host combines the copy it had before
   the last replacement with the libraries guests sent, so the host button can
   recover data even when a guest used Send changes. */
async function previewSync() {
  let local, sources, names = [];
  if (sync.role === 'host') {
    local = readSyncLibrary();
    sources = hostMergeSources();
    names = [
      ...(syncKeepHost ? ["this host's earlier copy"] : []),
      ...new Set([...syncGuestSnaps.values()].map(x => x.name).filter(Boolean)),
    ];
    if (!sources.length) {
      throw httpErr(400, 'No device has sent a library during this hosting session. On the other device, open Devices and choose Merge data.');
    }
  } else if (sync.role === 'guest' && sync.hostUrl) {
    const remote = await syncRemote(sync.hostUrl, sync.code, '/api/sync/preview', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ library: readSyncLibrary(), device: os.hostname() }),
    }, 30000);
    if (!remote || (!remote.add && !remote.removed)) throw httpErr(502, 'The host did not send a merge preview');
    return { ...remote, role: 'guest', sources: remote.sources || [sync.peer || 'the host'] };
  } else {
    throw httpErr(400, 'Start hosting or connect to a host before merging');
  }
  return { ok: true, role: sync.role, sources: names, ...previewMerge(local, sources, readMergeBase()) };
}
async function mergeSync(input = {}) {
  const selection = cleanMergeSelection(input.selected);
  if (sync.role === 'host') {
    const sources = hostMergeSources();
    if (!sources.length) {
      throw httpErr(400, 'No device has sent a library during this hosting session. On the other device, open Devices and choose Merge data.');
    }
    const merged = mergeLibraries(readSyncLibrary(), sources, selection);
    applySyncLibrary(merged);
    rememberMergeBase(readSyncLibrary());
    syncKeepHost = null;
    syncGuestSnaps = new Map();
    sync.rev = (+sync.rev || 0) + 1;
    sync.lastSync = Date.now();
    syncLastError = '';
    syncSave();
    return syncStatus();
  }
  if (sync.role !== 'guest' || !sync.hostUrl) throw httpErr(400, 'Connect to a host before merging');
  const local = readSyncLibrary();
  const remote = await syncRemote(sync.hostUrl, sync.code, '/api/sync/library?mode=merge', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ library: local, device: os.hostname(), selected: input.selected }),
  }, 30000);
  if (!remote.library) throw httpErr(502, 'The host did not send the merged library. Update the host, then try again.');
  /* The host's answer is filtered by the confirmation menu. Union it with this
     device's own copy so an unchecked item is left only on this device instead
     of disappearing from both. */
  applySyncLibrary(mergeLibraries(local, [cleanSyncLibrary(remote.library)]));
  rememberMergeBase(readSyncLibrary());
  sync.rev = +remote.rev || 0;
  sync.remoteUpdatedAt = +remote.updatedAt || 0;
  sync.lastSync = Date.now();
  syncLastError = '';
  syncSave();
  return syncStatus();
}
async function disconnectSync() {
  if (sync.role === 'host') return stopSyncHost();
  sync.role = 'off';
  sync.enabled = false;
  sync.hostUrl = '';
  sync.code = '';
  sync.peer = '';
  sync.rev = 0;
  sync.remoteUpdatedAt = 0;
  syncLastError = '';
  syncSave();
  return syncStatus();
}

/* ── routing ── */
function guard(req,res){
  const host=(req.headers.host||'').toLowerCase();
  const bad=msg=>{res.writeHead(403,{'Content-Type':'text/plain'});res.end(msg);return false;};
  if(LOOPBACK&&host!==`127.0.0.1:${PORT}`&&host!==`localhost:${PORT}`)return bad('Bad host');
  if(req.method!=='GET'&&req.method!=='HEAD'){
    const o=req.headers.origin;
    if(o){try{if(new URL(o).host!==host)return bad('Bad origin');}catch{return bad('Bad origin');}}
    if(req.headers['x-wavelength']!=='1')return bad('Missing header');
  }
  return true;
}

async function api(req,res,u,p){
  const m=req.method, q=u.searchParams; let g;
  const parse=async(max=1e6)=>{try{return JSON.parse((await body(req,max)).toString()||'{}');}catch(e){throw e.status?e:httpErr(400,'Bad JSON');}};

  if(m==='GET'&&p==='/api/health') return json(res,await health());
  if(m==='GET'&&p==='/api/stats') return json(res,dataStats());
  if(m==='POST'&&p==='/api/cache/clear'){
    let freed=0, removed=0;
    for(const name of fs.readdirSync(CACHE_DIR)){
      const file=path.join(CACHE_DIR,name);
      if(activeFiles.has(file)) continue;
      try{const st=fs.statSync(file);fs.unlinkSync(file);freed+=st.size;removed++;}
      catch{}
    }
    return json(res,{ok:true,freed,removed,...dataStats()});
  }

  if(m==='GET'&&p==='/api/local'){
    const tracks=await localTracks(q.get('force')==='1');
    return json(res,{tracks,folder:LOCAL_DIR,ffprobe:!!(await health()).ffprobe});
  }
  if(m==='POST'&&p==='/api/local/upload') return json(res,await receiveLocalFile(req));
  if(m==='DELETE'&&(g=p.match(/^\/api\/local\/([a-f0-9]{16})$/))) return json(res,await deleteLocalFile(g[1]));
  if((m==='GET'||m==='HEAD')&&(g=p.match(/^\/api\/local\/([a-f0-9]{16})\/stream$/))){
    const entry=localEntry(g[1]);
    if(!entry) throw httpErr(404,'Local file not found');
    return serveCached(req,res,path.join(LOCAL_DIR,entry.rel));
  }

  if(p==='/api/config'&&m==='PUT'){
    const b=await parse();
    if(typeof b.spotifyClientId==='string'){
      const v=b.spotifyClientId.trim();
      if(v&&!/^[A-Za-z0-9]{20,64}$/.test(v)) throw httpErr(400,"That doesn't look like a Spotify Client ID");
      config.spotifyClientId=v;
    }
    if(typeof b.downloadDir==='string'&&b.downloadDir.trim()){
      let d=b.downloadDir.trim();if(d.startsWith('~'))d=path.join(os.homedir(),d.slice(1));
      if(!path.isAbsolute(d)) throw httpErr(400,'Use an absolute path');
      config.downloadDir=d;
    }
    writeJSON('config.json',config);hc=null;return json(res,{ok:true});
  }

  if(p==='/api/state'){
    if(m==='GET') return json(res,readJSON('state.json',null));
    if(m==='PUT'){writeJSON('state.json',await parse(25e6));return json(res,{ok:true});}
  }

  if(m==='GET'&&p==='/api/sync/status') return json(res,syncStatus());
  if(m==='POST'&&p==='/api/sync/host') return json(res,await startSyncHost());
  if(m==='POST'&&p==='/api/sync/stop') return json(res,await stopSyncHost());
  if(m==='POST'&&p==='/api/sync/join') return json(res,await joinSync(await parse()));
  if(m==='POST'&&p==='/api/sync/pull') return json(res,await pullSync());
  if(m==='POST'&&p==='/api/sync/push') return json(res,await pushSync());
  if(m==='POST'&&p==='/api/sync/merge/preview') return json(res,await previewSync());
  if(m==='POST'&&p==='/api/sync/merge') return json(res,await mergeSync(await parse()));
  if(m==='POST'&&p==='/api/sync/disconnect') return json(res,await disconnectSync());

  if(m==='POST'&&p==='/api/cover'){
    const b=await body(req,6e6),ext=sniff(b);
    if(!ext) throw httpErr(400,'Use a PNG, JPG, WebP or GIF');
    const name=crypto.randomUUID()+'.'+ext;
    fs.writeFileSync(path.join(COVERS,name),b);
    return json(res,{url:'/covers/'+name});
  }
  if(m==='DELETE'&&(g=p.match(/^\/api\/cover\/([0-9a-f-]{36}\.(?:png|jpg|gif|webp))$/))){
    try{fs.unlinkSync(path.join(COVERS,g[1]));}catch{}
    return json(res,{ok:true});
  }

  if(m==='GET'&&p==='/api/spotify-url') return json(res,await spotifyPublic(q.get('u')||''));
  if(m==='GET'&&p==='/api/spotify/me'){const me=await sp('/me');return json(res,{id:me.id,name:me.display_name||me.id});}
  if(m==='GET'&&p==='/api/spotify/playlists'){
    const pls=await paged('/me/playlists?limit=50',x=>x&&x.id?{id:x.id,name:x.name,owner:x.owner&&x.owner.display_name||'',count:x.tracks?x.tracks.total:(x.items?x.items.total:null),image:x.images&&x.images[0]&&x.images[0].url||null}:null);
    return json(res,pls);
  }
  if(m==='GET'&&(g=p.match(/^\/api\/spotify\/playlist\/([A-Za-z0-9]{10,40})$/))) return json(res,await spPlaylist(g[1]));
  if(m==='GET'&&p==='/api/spotify/liked') return json(res,{name:'Liked Songs',tracks:await paged('/me/tracks?limit=50',it=>spTrack(it&&it.track))});
  if(m==='POST'&&p==='/api/spotify/logout'){try{fs.unlinkSync(path.join(DATA,'spotify.json'));}catch{}return json(res,{ok:true});}

  if(m==='GET'&&p==='/api/search'){
    const s=(q.get('q')||'').trim().slice(0,200);
    const noAi=/^(1|true|yes)$/i.test(q.get('noAi')||'');
    return json(res,s?noAiFilter(await search(s),noAi):[]);
  }
  if(m==='POST'&&p==='/api/match'){
    const b=await parse(),key=String(b.key||'').slice(0,80);
    if(key&&matches[key]) return json(res,{ytId:matches[key]});
    const id=await match(String(b.title||'').slice(0,200),String(b.artist||'').slice(0,200),+b.duration||0);
    if(id&&key){matches[key]=id;saveMatches();}
    return json(res,{ytId:id});
  }
  if(m==='GET'&&(g=p.match(/^\/api\/related\/([A-Za-z0-9_-]{11})$/))){
    const noAi=/^(1|true|yes)$/i.test(q.get('noAi')||'');
    return json(res,noAiFilter(await related(g[1]),noAi));
  }
  if(m==='GET'&&(g=p.match(/^\/api\/info\/([A-Za-z0-9_-]{11})$/))) return json(res,await videoInfo(g[1]));
  if(m==='GET'&&(g=p.match(/^\/api\/ready\/([A-Za-z0-9_-]{11})$/))) {
    const cached=cachedAudio(g[1]);
    if(cached){ const st=fs.statSync(cached); return json(res,{ok:true,cached:true,size:st.size,mime:AUDIO_MIME[path.extname(cached).toLowerCase()]||'audio/mp4'}); }
    const job=startDownload(g[1]);
    await waitReady(job);
    return json(res,{ok:true,cached:false,size:job.total||fileSize(job.file),mime:AUDIO_MIME[path.extname(job.file).toLowerCase()]||'audio/mp4'});
  }
  if (m === 'GET' && (g = p.match(/^\/api\/resolve\/([A-Za-z0-9_-]{11})$/))) {
    const r = await resolveAudio(g[1], true, false, q.get('q'));
    return json(res, { ok: true, id: g[1], ext: r.ext, mime: r.mime, quality: r.quality, bitrate: r.bitrate, duration: r.duration, expiresAt: r.expiresAt, cached: !!r.cached });
  }
  if (m === 'GET' && (g = p.match(/^\/api\/(?:warm|prefetch)\/([A-Za-z0-9_-]{11})$/))) {
    // Warm the URL cache only. Never download the whole song for a prefetch.
    resolveAudio(g[1], false, false, q.get('q')).catch(() => {});
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (m === 'GET' && (g = p.match(/^\/api\/cached\/([A-Za-z0-9_-]{11})$/))) return json(res, { cached: !!cachedAudio(g[1]) });
  if(m==='GET'&&(g=p.match(/^\/api\/stream\/([A-Za-z0-9_-]{11})$/))) return await stream(req,res,g[1],q.get('q'));

  if(m==='POST'&&p==='/api/download'){
    const b=await parse();
    if(!YTID.test(b.ytId||'')) throw httpErr(400,'Bad video id');
    return json(res,queueDownload({ytId:b.ytId,title:String(b.title||'').slice(0,200),artist:String(b.artist||'').slice(0,200),quality:b.quality}));
  }
  if(m==='GET'&&p==='/api/downloads') return json(res,[...jobs.values()].sort((a,b)=>b.ts-a.ts).slice(0,50));
  if(m==='POST'&&p==='/api/downloads/clear'){for(const[k,j]of jobs)if(j.status==='done'||j.status==='error')jobs.delete(k);return json(res,{ok:true});}

  if(m==='GET'&&p==='/api/share-test') return json(res,{ok:true});
  throw httpErr(404,'Not found');
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};
function serveFile(res,base,rel,immutable){
  let f;try{f=path.join(base,decodeURIComponent(rel));}catch{return notFound(res);}
  if(!f.startsWith(base+path.sep))return notFound(res);
  fs.stat(f,(e,st)=>{
    if(e||!st.isFile())return notFound(res);
    const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':immutable?'public, max-age=31536000, immutable':'no-cache'};
    if(immutable)h['Content-Security-Policy']='sandbox';
    res.writeHead(200,h);fs.createReadStream(f).pipe(res);
  });
}
const notFound=res=>{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');};

let resolveReady; const ready=new Promise(r=>{resolveReady=r;});
module.exports={ready,port:PORT,parseEmbed};
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,'http://x'),p=u.pathname;
    if(!guard(req,res))return;
    if(p.startsWith('/api/')) return await api(req,res,u,p);
    if(p==='/share'){
      const t=['url','text','title'].map(k=>u.searchParams.get(k)).filter(Boolean).join(' ');
      res.writeHead(302,{Location:'/#share/'+encodeURIComponent(t).slice(0,2000)});return res.end();
    }
    if(p==='/auth/login') return login(res);
    if(p==='/callback')   return await callback(res,u);
    if(p.startsWith('/covers/')) return serveFile(res,COVERS,p.slice(8),true);
    return serveFile(res,PUB,p==='/'?'index.html':p.slice(1));
  }catch(e){
    if(res.headersSent)return res.end();
    json(res,{error:e.message||'Server error'},e.status||500);
  }
});
server.on('error',e=>{
  console.error(e.code==='EADDRINUSE'?`Port ${PORT} is in use. Try: PORT=3001 node server.js`:e);
  process.exit(1);
});
server.listen(PORT,HOST,()=>{
  resolveReady();
  const url=`http://127.0.0.1:${PORT}`;
  console.log(`\n  Wavelength  →  ${url}\n  Spotify redirect URI  →  ${REDIRECT}\n  Downloads  →  ${config.downloadDir}\n`);
  if(!LOOPBACK) for(const l of Object.values(os.networkInterfaces()).flat()) if(l&&l.family==='IPv4'&&!l.internal) console.log(`  Network  →  http://${l.address}:${PORT}`);
  if(sync.role==='host'&&sync.enabled) startSyncHost().catch(e=>console.error('[sync]',e.message));
  if(process.env.NO_OPEN!=='1'){
    const c=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
    try{spawn(c[0],c[1],{stdio:'ignore',detached:true}).on('error',()=>{}).unref();}catch{}
  }
});
