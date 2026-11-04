# In-app updates

Wavelength can update its interface and player without a new installer. An update is a small signed bundle
of `public/`, `server.js`, `discord-rpc.js`, `updater.js` and `package.json`. Apps verify the signature,
unpack the bundle into their data folder and use it from the next start. If a new version fails to start,
the next launch quietly goes back to the version that came with the installer.

## One-time setup

1. `npm run make:update:init` creates your signing key. The private key goes to `~/.wavelength/update-private.pem`
   (back it up, never commit it). The public key is written to `update-pubkey.pem` (commit it).
2. Build and publish new installers and the APK **once**. They now contain the public key and the updater.

## Shipping an update

1. Bump `version` in `package.json`.
2. `npm run make:update -- --notes "What changed"` writes `dist-update/update.json` and `dist-update/wavelength-update.tar.gz`.
3. Upload both files as assets of the newest GitHub release (the app reads `releases/latest/download/update.json`).

Use `--min-shell X.Y.Z` when a change needs a newer installer (new Electron code or new Android Java).
Apps older than that show "Get installer" instead of installing the bundle.

## Limits

- Installed versions that were built before this feature (2.4.1 and earlier) cannot update themselves. They need
  one last installer; after that updates are in-app.
- Anything inside the native shell (`electron/`, `scripts/android/*.java`, permissions) still ships through an installer.
- Android applies an update after you tap Restart in Settings → Updates (the page reloads); desktop relaunches.
