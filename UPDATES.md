# In-app updates

Wavelength can update its interface and player without a new installer. An update is a small signed bundle
of `public/`, `server.js`, `discord-rpc.js`, `updater.js` and `package.json`. Apps verify the signature,
unpack the bundle into their data folder and use it from the next start. If a new version fails to start,
the next launch quietly goes back to the version that came with the installer.

## One-time setup

1. `npm run make:update:init` creates your signing key pair (ECDSA P-256).
   - The **private** key goes to `~/.wavelength/update-private.pem` (mode 0600). Back it up somewhere safe
     and never commit it. If it is lost, installed apps reject later updates and everyone needs one more
     installer; if it leaks, someone else can sign an update your apps will trust.
   - The **public** key is written to `update-pubkey.pem` in the repo root. Commit it. It is embedded in
     every installer and in the Android APK.
2. Build and publish new installers and the APK **once**. They now contain the public key, and
   Settings → Updates stops saying "Updates are not set up in this build".

There is no account or external service: the key pair is generated locally and only the public half is
published.

## The Overhaul channel

The updater downloads `update.json` from a fixed channel release, not from whichever release GitHub calls
latest:

    https://github.com/thegoldertrone7-cyber/wavelength/releases/download/overhaul-updates/update.json

`overhaul-updates` is a permanent, prerelease-marked release. Its `update.json` and
`wavelength-update.tar.gz` assets are replaced on every Overhaul release, so the URL never changes and
Overhaul builds never read the stable v2.4.1 channel. Keep the release (and its tag) in place; deleting it
breaks the updater for every installed build.

To follow `releases/latest/download` instead, build with `WAVELENGTH_UPDATE_CHANNEL=latest` or start the
app with `WAVELENGTH_UPDATE_URL` pointing at another manifest. The Android app uses the Overhaul channel
(`WebUpdater.java`); rebuild the APK after changing it.

## Shipping an update

1. Bump `version` in `package.json`.
2. `npm run make:update -- --notes "What changed"` writes `dist-update/update.json` and
   `dist-update/wavelength-update.tar.gz`.
3. Upload both files to the **overhaul-updates** release, replacing the previous pair:

       gh release upload overhaul-updates dist-update/update.json dist-update/wavelength-update.tar.gz --clobber

4. Apps notice the new `update.json` on their next check (on launch, then at most every 12 hours) or when
   the user presses **Check now** in Settings → Updates. The bundle is verified, staged, and applied after
   **Restart now**.

Every release does not need a new installer: the bundle carries the web layer. But the installer and the
versioned release still matter for new users and for native changes.

Use `--min-shell X.Y.Z` when a change needs a newer installer (new Electron code or new Android Java).
Apps older than that show "Get installer" instead of installing the bundle.

## Release checklist

1. Bump the version, update the docs, commit and push.
2. Build and publish the installers and APK as usual.
3. `npm run make:update -- --notes "..."` (add `--min-shell` if the native shell changed).
4. Replace the two assets on the `overhaul-updates` release.
5. Confirm with `curl -L https://github.com/thegoldertrone7-cyber/wavelength/releases/download/overhaul-updates/update.json`
   that the version and notes are the new ones.

## Limits

- Installed versions that were built before this feature (or without `update-pubkey.pem`) cannot update
  themselves. They need one last installer; after that updates are in-app.
- Anything inside the native shell (`electron/`, `scripts/android/*.java`, permissions) still ships through
  an installer.
- Android applies an update after you tap Restart in Settings → Updates (the page reloads); desktop
  relaunches.
