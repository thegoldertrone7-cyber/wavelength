# Downloads

Get the latest release installers here: [Releases page](https://github.com/thegoldertrone7-cyber/wavelength/releases).

## Desktop
- **macOS**: `.dmg` (universal x64/arm64). If unsigned, right-click → Open or `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `.exe` NSIS installer.
- **Linux**: `.AppImage` or `.deb`.

## Android
The Android app is a thin WebView client — it **does not** include the server or `yt-dlp`/`ffmpeg`. You need Wavelength running on another device on the same network (or reachable).

1. Install `Wavelength-android.apk` (allow installs from your browser/files app).
2. On first launch, enter the server address (e.g. `http://192.168.1.100:3000`). Start the server with `./start.sh` (or run the desktop app) on your computer.
3. Use the menu (⋮) → "Server address…" to change it later.

For lock-screen/notification media controls and to use Spotify's Share button more easily, Chrome's "Install app"/HTTPS (e.g. Tailscale) is also an option per README.
