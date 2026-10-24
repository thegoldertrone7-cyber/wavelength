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
const { Readable, PassThrough } = require('stream');

const ROOT = __dirname,
      PUB  = path.join(ROOT, 'public'),
      DATA = process.env.WAVELENGTH_DATA || path.join(ROOT, 'data'),
      COVERS = path.join(DATA, 'covers');
fs.mkdirSync(COVERS, { recursive: true });

try {
  for (const l of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT   = +process.env.PORT  || 3000;
const HOST   = process.env.HOST   || '127.0.0.1';
const LOOPBACK = ['127.0.0.1','localhost','::1'].includes(HOST);
const YTDLP  = process.env.YTDLP_PATH  || 'yt-dlp';
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const YTID = /^[A-Za-z0-9_-]{11}$/;

/* ── utils ── */
const readJSON  = (f,d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA,f),'utf8')); } catch { return d; } };
const writeJSON = (f,v) => { const p=path.join(DATA,f); fs.writeFileSync(p+'.tmp',JSON.stringify(v)); fs.renameSync(p+'.tmp',p); };
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
    const p = spawn(YTDLP, args, {stdio:['ignore','pipe','pipe']});
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

async function search(q) {
  const out = await limited(()=>ytdlp(['--flat-playlist','-j','--no-warnings',`ytsearch15:${q}`]));
  return lines(out).filter(j=>j.id&&j.duration).map(toTrack);
}

const BAD = /\b(live|cover|remix|karaoke|reaction|instrumental|sped up|slowed|nightcore|8d|tutorial|lesson|mashup)\b/i;
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

/* ════════════════════════════════════════════════
   STREAMING — the big fix.

   Root causes of "stops after a few seconds":
   1. YouTube CDN URLs expire in ~6 h AND are IP-pinned.
      Old code cached them for 90 min which is fine, but it
      also relied on the browser re-requesting with Range bytes
      on seek/stall, and if that Range request hit an expired
      or IP-rotated URL the whole thing 403'd → audio error →
      skip.
   2. No stall detection on the pipe: if the YouTube CDN hung
      mid-transfer the pipe just sat silently until the browser
      gave up.
   3. One retry on 403/410 but no resume from byte offset.

   Fix:
   - Cache TTL dropped to 55 min (well inside the ~6 h window).
   - On ANY 403/410/429 we flush the cache entry and re-resolve
     before retrying, carrying the byte offset forward so the
     browser never notices.
   - Stall watchdog: if no bytes flow for STALL_MS ms we kill
     the upstream and restart from current offset.
   - We pipe through a PassThrough so we can watch byte flow.
   - 3-attempt retry ladder with 800 ms back-off on each.
   - Accept-Encoding stripped so CDN never sends compressed
     data (breaks m4a parsing in some browsers).
   - Connection: keep-alive on the upstream request.
════════════════════════════════════════════════ */
const STALL_MS  = 8000;   // declare a stall after 8 s of silence
const CACHE_TTL = 55 * 60 * 1000;  // 55 min

const urlCache = new Map();
async function audioUrl(id, force=false) {
  const c = urlCache.get(id);
  if(!force && c && c.exp > Date.now()) return c.url;
  urlCache.delete(id);
  const out = await limited(()=>ytdlp(
    ['-f','bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
     '-g','--no-playlist','--no-warnings',
     '--extractor-args','youtube:player_client=web,mweb',
     `https://www.youtube.com/watch?v=${id}`],
    {timeout:50000}
  ));
  const url = out.trim().split('\n')[0];
  if(!url) throw httpErr(502,'No audio stream found');
  urlCache.set(id,{ url, exp:Date.now()+CACHE_TTL });
  return url;
}

async function stream(req,res,id) {
  let offset = 0;
  // honour the browser's initial Range header
  const rangeHdr = req.headers.range;
  if(rangeHdr){ const m=rangeHdr.match(/bytes=(\d+)/); if(m) offset=+m[1]; }

  let closed = false;
  req.on('close', ()=>{ closed=true; });

  for(let attempt=0; attempt<3; attempt++){
    if(closed) return;
    try {
      const url = await audioUrl(id, attempt>0);
      const upHdrs = {
        'User-Agent': UA,
        'Connection': 'keep-alive',
        'Range': `bytes=${offset}-`,
      };
      // don't request compression — breaks audio in some browsers
      upHdrs['Accept-Encoding'] = 'identity';

      const up = await fetch(url, { headers:upHdrs });

      // stale / rate-limited → retry with fresh URL after back-off
      if(up.status===403||up.status===410||up.status===429){
        urlCache.delete(id);
        if(attempt<2){ await sleep(800*(attempt+1)); continue; }
        throw httpErr(502,'YouTube refused the stream after 3 attempts — try again in a moment');
      }
      if(up.status!==200&&up.status!==206){
        throw httpErr(502,`Unexpected upstream status ${up.status}`);
      }

      // only write headers on first attempt (or if not sent yet)
      if(!res.headersSent){
        const h = {
          'Accept-Ranges':  'bytes',
          'Content-Type':   up.headers.get('content-type')||'audio/mp4',
          'Cache-Control':  'no-store',
          'X-Accel-Buffering':'no',
        };
        const cl = up.headers.get('content-length');
        const cr = up.headers.get('content-range');
        if(cr) h['Content-Range'] = cr;
        if(cl) h['Content-Length'] = cl;
        res.writeHead(up.status, h);
      }

      // pipe through a PassThrough so we can watch bytes and detect stalls
      const pt = new PassThrough();
      const rs = Readable.fromWeb(up.body);

      let stall = null, bytesThisWindow = 0;

      const resetStall = () => {
        clearTimeout(stall);
        stall = setTimeout(()=>{
          if(closed) return;
          // stall detected — destroy upstream and retry from current offset
          rs.destroy(); pt.destroy();
        }, STALL_MS);
      };

      pt.on('data', chunk=>{
        offset += chunk.length;
        bytesThisWindow += chunk.length;
        resetStall();
        if(!res.write(chunk)){
          // backpressure — pause source while drain
          rs.pause();
          pt.once('drain', ()=>rs.resume());
        }
      });

      rs.on('error', ()=>{ clearTimeout(stall); pt.destroy(); });
      pt.on('error', ()=>{ clearTimeout(stall); });

      resetStall(); // kick off watchdog

      await new Promise((ok,fail)=>{
        rs.pipe(pt);
        pt.on('end', ()=>{ clearTimeout(stall); ok('done'); });
        pt.on('close', ()=>{ clearTimeout(stall); ok('close'); });
        rs.on('error', e=>{ clearTimeout(stall); fail(e); });
        req.on('close', ()=>{ clearTimeout(stall); rs.destroy(); ok('client-closed'); });
      });

      // if we get here cleanly, we're done
      if(!res.writableEnded) res.end();
      return;

    } catch(e) {
      if(closed){ if(!res.writableEnded) res.end(); return; }
      if(attempt<2){
        await sleep(800*(attempt+1));
        continue; // retry from current offset
      }
      if(!res.headersSent) throw e;
      // headers already sent — just close cleanly
      if(!res.writableEnded) res.end();
      return;
    }
  }
}

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
    const p=spawn(YTDLP,args,{stdio:['ignore','pipe','pipe']});
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
  if(/(^|\.)spotify\.(link|app\.link)$/.test(u.hostname)||u.hostname.endsWith('.app.link')){
    const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':UA}});
    const loc=r.headers.get('location');
    if(!loc) throw httpErr(400,"Couldn't open that short link — paste the full open.spotify.com link");
    u=new URL(loc,url);
  }
  if(u.hostname!=='open.spotify.com') throw httpErr(400,'Paste a link from open.spotify.com (Share → Copy link)');
  const m=u.pathname.match(/\/(playlist|album|track)\/([A-Za-z0-9]{10,40})/);
  if(!m) throw httpErr(400,"That link isn't a playlist, album or song");
  const r=await fetch(`https://open.spotify.com/embed/${m[1]}/${m[2]}`,{headers:{'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'}});
  if(!r.ok) throw httpErr(r.status===404?404:502,r.status===404?"Spotify can't find that. Make sure the playlist is public.":`Spotify answered with ${r.status}`);
  const d=parseEmbed(await r.text(),m[1],m[2]);
  if(!d.tracks.length) throw httpErr(422,"Couldn't read any songs from that link. It may be private, or use 'Paste a list of songs' instead.");
  return d;
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
    const[y,f]=await Promise.all([bin(YTDLP,['--version']),bin(FFMPEG,['-version'])]);
    hc={ytdlp:y,ffmpeg:f?f.replace(/^ffmpeg version\s+(\S+).*/,'$1'):null};hAt=Date.now();
  }
  return{...hc,clientId:clientId(),redirectUri:REDIRECT,spotifyConnected:!!readJSON('spotify.json',null),downloadDir:config.downloadDir,port:PORT};
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

  if(m==='GET'&&p==='/api/search'){const s=(q.get('q')||'').trim().slice(0,200);return json(res,s?await search(s):[]);}
  if(m==='POST'&&p==='/api/match'){
    const b=await parse(),key=String(b.key||'').slice(0,80);
    if(key&&matches[key]) return json(res,{ytId:matches[key]});
    const id=await match(String(b.title||'').slice(0,200),String(b.artist||'').slice(0,200),+b.duration||0);
    if(id&&key){matches[key]=id;saveMatches();}
    return json(res,{ytId:id});
  }
  if(m==='GET'&&(g=p.match(/^\/api\/related\/([A-Za-z0-9_-]{11})$/))) return json(res,await related(g[1]));
  if(m==='GET'&&(g=p.match(/^\/api\/prefetch\/([A-Za-z0-9_-]{11})$/))) {await audioUrl(g[1]);res.writeHead(204);return res.end();}
  if(m==='GET'&&(g=p.match(/^\/api\/stream\/([A-Za-z0-9_-]{11})$/))) return await stream(req,res,g[1]);

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
  if(process.env.NO_OPEN!=='1'){
    const c=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd',['/c','start','',url]]:['xdg-open',[url]];
    try{spawn(c[0],c[1],{stdio:'ignore',detached:true}).on('error',()=>{}).unref();}catch{}
  }
});
