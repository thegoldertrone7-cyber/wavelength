# Downloads

Latest release: **v2.2.4** — [Releases page](https://github.com/thegoldertrone7-cyber/wavelength/releases/latest).
Every release attaches all five installers:

- `Wavelength-2.2.4-universal.dmg` — macOS (Intel + Apple Silicon)
- `Wavelength.Setup.2.2.4.exe` — Windows installer
- `Wavelength-2.2.4.AppImage` — Linux (portable)
- `Wavelength-2.2.4-x86_64.flatpak` — Linux (bundles `yt-dlp`, `ffmpeg` and `ffprobe`)
- `Wavelength-2.2.4-android.apk` — Android companion client

## Desktop
- **macOS**: `.dmg` (universal x64/arm64). If unsigned, right-click → Open or `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `.exe` NSIS installer.
- **Linux**: `.AppImage` or `.flatpak` (the Flatpak bundles `yt-dlp`, `ffmpeg` and `ffprobe`).
- The normal DMG/EXE/AppImage builds expect `yt-dlp` and `ffmpeg` on the computer.

## Android
The Android app is a companion client — it **does not** include the server, `yt-dlp` or
`ffmpeg`. Wavelength must be running on a computer on the same network.

1. Install `Wavelength-2.2.4-android.apk` (allow installs from your browser/files app).
2. Open Wavelength on the computer. The desktop app is recommended; browser mode also works
   with `HOST=0.0.0.0 ./start.sh`.
3. On the phone, the native setup screen asks for the computer address. Either:
   - copy it from **Settings → Devices → Phone & browser access** in Wavelength on the computer
     (desktop app port `38421`, browser mode port `3000`), or
   - tap **Find my computer** to scan the Wi-Fi for it.
4. Tap **Connect**. If it fails, the app stays on the setup screen with **Retry**,
   **Find my computer** and **Back to player** — never Chrome's error page.
5. Tap the small `⋮` button in the top-right corner to change the server later.

**`127.0.0.1` / `localhost` on Android means the phone itself, not the computer.** The app
rejects those addresses with an explanation. Use the computer's Wi-Fi/Tailscale address.

Only use this on a trusted network: anyone who can reach the address can use your library.
The desktop app listens on the LAN while it runs. Plain `./start.sh` / `node server.js` stays
loopback-only unless you set `HOST=0.0.0.0`.

For lock-screen/notification media controls and Spotify's Share button, the APK already
handles share intents. Chrome's "Install app" / HTTPS remains an option for browser-only use
(for example `tailscale serve --bg 3000`).
