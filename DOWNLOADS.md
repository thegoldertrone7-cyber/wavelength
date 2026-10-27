# Downloads

Latest Android release: **v2.2.5** — [Wavelength 2.2.5 APK](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.2.5).

Desktop release: **v2.2.4** — [macOS, Windows, AppImage and Flatpak](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.2.4).

> v2.2.5 is an **Android-only** release. The desktop builds remain on v2.2.4 until the next desktop release.

## Android

`Wavelength-2.2.5-android.apk` is a **standalone** app. Search, streaming and your playlists run
on the phone; no desktop app, Node, `yt-dlp`, `ffmpeg` or Wavelength server is required. An
internet connection is still needed for YouTube playback.

1. Download `Wavelength-2.2.5-android.apk` and allow installs from your browser/files app.
2. Open Wavelength and grant the notification permission so playback controls appear on the
   lock screen.
3. Search YouTube, play songs and build playlists on the phone. The library is stored in the app
   and survives with the computer off.

The APK is debug-signed for direct installation; it is not a Play Store build. Because v2.2.4 was
signed with a different debug key, uninstall the old Android app before installing v2.2.5. If you
need the library, install v2.2.5 and pull it from the desktop host in **Settings → Devices**.

### Optional computer sync

The computer is only needed while syncing; disconnect and keep listening on the phone.

1. On the computer, open **Settings → Devices → Start hosting** and note the address
   (for example `http://192.168.1.10:38422`) and pairing code.
2. On the phone, open **Settings → Devices → Join a host**, enter that address and code.
3. Use **Pull now** to replace the phone library with the host copy, or **Send changes** to
   replace the host library with the phone copy. **Disconnect** when finished.

The desktop sync listener runs only while Wavelength is open. Use Tailscale on both devices, or
the same Wi-Fi and allow that port through the host firewall. Only sync on a trusted network.

**`127.0.0.1` / `localhost` on Android means the phone itself, not the computer.** Use the
computer's LAN or Tailscale address.

Not yet available on Android: direct Spotify links/account import, offline downloads and
local-file playback. On the phone, paste song names on the Import page and Wavelength matches
them on YouTube.

## Desktop

- **macOS**: `Wavelength-2.2.4-universal.dmg` (Intel + Apple Silicon). If unsigned, right-click →
  Open or run `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `Wavelength.Setup.2.2.4.exe` NSIS installer.
- **Linux**: `Wavelength-2.2.4.AppImage` or `Wavelength-2.2.4-x86_64.flatpak`. The Flatpak bundles
  `yt-dlp`, `ffmpeg` and `ffprobe`.
- The normal DMG/EXE/AppImage builds expect `yt-dlp` and `ffmpeg` on the computer.
