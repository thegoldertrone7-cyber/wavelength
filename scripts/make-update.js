#!/usr/bin/env node
'use strict';
/* Build and sign an in-app update.
     node scripts/make-update.js --init                 one time: create your signing key pair
     node scripts/make-update.js [--notes "text"] [--min-shell 2.5.0]
   Output goes to dist-update/: upload both files to the GitHub release as assets.
   The private key lives in ~/.wavelength/update-private.pem and must never be committed. */
const fs = require('fs'), path = require('path'), os = require('os'), zlib = require('zlib'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), KEYDIR = path.join(os.homedir(), '.wavelength'), PRIV = path.join(KEYDIR, 'update-private.pem');
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };

if (process.argv.includes('--init')) {
  if (fs.existsSync(PRIV)) { console.error('A signing key already exists at ' + PRIV + '. Delete it only if you accept that installed apps will reject new updates.'); process.exit(1); }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  fs.mkdirSync(KEYDIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PRIV, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(path.join(ROOT, 'update-pubkey.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
  console.log('Created update-pubkey.pem (commit this) and ' + PRIV + ' (back it up, keep it secret).\nBuild and release new installers once so every app contains the public key.');
  process.exit(0);
}
if (!fs.existsSync(PRIV)) { console.error('No signing key. Run: node scripts/make-update.js --init'); process.exit(1); }

const files = [];
const walk = (dir, rel) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  if (e.name.startsWith('.') || /\.bak$/.test(e.name)) continue;
  const full = path.join(dir, e.name), r = rel + '/' + e.name;
  e.isDirectory() ? walk(full, r) : files.push([r, fs.readFileSync(full)]);
} };
walk(path.join(ROOT, 'public'), 'public');
for (const f of ['server.js', 'discord-rpc.js', 'updater.js', 'package.json']) files.push([f, fs.readFileSync(path.join(ROOT, f))]);

const octal = (n, len) => Buffer.from(n.toString(8).padStart(len - 1, '0') + '\0');
const blocks = [];
for (const [name, data] of files) {
  const h = Buffer.alloc(512);
  h.write(name, 0, 100); octal(0o644, 8).copy(h, 100); octal(0, 8).copy(h, 108); octal(0, 8).copy(h, 116);
  octal(data.length, 12).copy(h, 124); octal(0, 12).copy(h, 136); h.fill(0x20, 148, 156); h[156] = 48; h.write('ustar\0', 257); h.write('00', 263);
  let sum = 0; for (const b of h) sum += b; h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
}
blocks.push(Buffer.alloc(1024));
const gz = zlib.gzipSync(Buffer.concat(blocks), { level: 9 });
const sha256 = crypto.createHash('sha256').update(gz).digest('hex');
const sig = crypto.sign('sha256', Buffer.from(sha256), crypto.createPrivateKey(fs.readFileSync(PRIV))).toString('base64');
const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const out = path.join(ROOT, 'dist-update'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'wavelength-update.tar.gz'), gz);
fs.writeFileSync(path.join(out, 'update.json'), JSON.stringify({ version, notes: arg('--notes'), minShell: arg('--min-shell') || '', size: gz.length, sha256, sig, url: 'wavelength-update.tar.gz' }, null, 2));
console.log(`Built update ${version} (${(gz.length / 1024).toFixed(0)} KB) in dist-update/. Upload both files to the GitHub release.`);
