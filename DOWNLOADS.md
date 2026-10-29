# Downloads

Latest release: **v2.4.0** — [Wavelength 2.4.0 for macOS, Windows, Linux and Android](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.4.0).

**v2.4.0** is an Android-focused release: a widget that shows artwork, title, artist and album;
visualizer styles and four sizes on the phone, including a full-screen backdrop; a
playback-driven Android visualizer that moves while music plays; a brief lock-screen now-playing
view; and volume control that follows the phone's media stream. Every earlier feature and the
merge behaviour are unchanged. The desktop installers are v2.4.0 as well as the APK.

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `Wavelength-2.4.0-macos-universal.dmg` | Unsigned; right-click → Open |
| Windows 10/11 | `Wavelength-2.4.0-windows-setup.exe` | NSIS installer, unsigned |
| Linux | `Wavelength-2.4.0-linux.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux | `Wavelength-2.4.0-linux-x86_64.flatpak` | Bundles `yt-dlp`, `ffmpeg`, `ffprobe` |
| Android | `Wavelength-2.4.0-android.apk` | Debug-signed, direct install |

`SHA256SUMS.txt` lists the checksum for every file. The Android APK checksum is also published as
`Wavelength-2.4.0-android.apk.sha256`.

```
12659f6a08b2085e2e892c8152660eca48b1ad025ce08cd26858f00690b1d7a9  Wavelength-2.4.0-android.apk
4a246f725b51909faa50ddaeb8a616326847048b9a846d7eda89508052f0f09b  Wavelength-2.4.0-macos-universal.dmg
5b14331ad9a8c14b4ca119fb59c3bab995cd277e02a99454d6167df5a5537e56  Wavelength-2.4.0-windows-setup.exe
9e4c594825c3572dd3360961d3d6ea6b5566388c9d6942a28fd8963551962812  Wavelength-2.4.0-linux.AppImage
59ab566c8f44cfba5e705530d64af04b116321f2b64fbdc67406c531c7523b72  Wavelength-2.4.0-linux-x86_64.flatpak
```

## Android

`Wavelength-2.4.0-android.apk` is a **standalone** app. Search, streaming and your playlists run
on the phone; no desktop app, Node, `yt-dlp`, `ffmpeg` or Wavelength server is required. An
internet connection is still needed for YouTube playback.

1. Download `Wavelength-2.4.0-android.apk` and allow installs from your browser/files app.
2. Open Wavelength and grant the notification permission so playback controls appear on the
   lock screen.
3. Search YouTube, play songs and build playlists on the phone. The library is stored in the app
   and survives with the computer off.

The APK is debug-signed for direct installation; it is not a Play Store build. v2.4.0 uses the
same signing key as v2.3.0, v2.2.5 and v2.2.6, so it installs over any of them and keeps your
library. If you are still on v2.2.4 or older, uninstall that app first because it was signed with
a different debug key. After installing, you can pull the library from the desktop host in
**Settings → Devices**.

### Widget, visualizer and lock screen

- **Home-screen widget** — long-press the home screen, choose widgets, and add Wavelength. It
  shows artwork, title, artist, album and a Playing/Paused label, with previous, play/pause and
  next.
- **Visualizer** — open the full-screen player, or set the style and size in **Settings →
  Appearance**. Sizes are small, medium, large and full screen; full screen makes the canvas the
  player backdrop. Android's WebView exposes no audio samples, so the phone draws a
  track-seeded spectrum from the playback clock. It moves while a song plays, changes between
  tracks and settles flat on pause. It is playback-driven, not a real audio spectrum.
- **Lock screen** — lock the phone during playback and a now-playing view appears briefly with
  artwork, details, progress, controls and the visualizer behind it, then steps out of the way.
  On Android 14 and newer, Android may require the full-screen notification permission; Settings
  shows an **Allow lock-screen display** row when it does.
- **Volume** — the full-screen player and **Settings → Playback** control the phone's media
  stream, so the in-app slider, the hardware keys and Android's volume panel stay in step.

### Optional computer sync

The computer is only needed while syncing; disconnect and keep listening on the phone.

1. On the computer, open **Settings → Devices → Start hosting** and note the address
   (for example `http://192.168.1.10:38422`) and pairing code.
2. On the phone, open **Settings → Devices → Join a host**, enter that address and code. On
   v2.3.0 and later, connecting merges both libraries; older hosts pull their copy to the phone.
3. Use **Merge data** to keep playlists from both devices. The merge preview adds genuinely new
   items automatically; anything this phone removed but the host still has opens a checklist, so you
   choose what returns. **Pull now** replaces the phone library with the host copy; **Send changes**
   replaces the host library with the phone copy. **Disconnect** when finished.

Merge is additive: new playlists, liked songs and history from both copies are kept, and per-device
listening stats keep the newest snapshot. Unchecked items are never deleted from the device that
still has them; deletions are not propagated. There is no automatic background merge. The desktop
remains the sync host and does not push changes out to guests, and the host can only preview the
libraries guests sent during the same hosting session.

The desktop sync listener runs only while Wavelength is open. Use Tailscale on both devices, or
the same Wi-Fi and allow that port through the host firewall. Only sync on a trusted network.

**`127.0.0.1` / `localhost` on Android means the phone itself, not the computer.** Use the
computer's LAN or Tailscale address.

Not yet available on Android: direct Spotify links/account import, offline downloads and
local-file playback. On the phone, paste song names on the Import page and Wavelength matches
them on YouTube.

## Desktop

- **macOS**: `Wavelength-2.4.0-macos-universal.dmg` (Intel + Apple Silicon). The build is unsigned;
  right-click → Open, or run `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `Wavelength-2.4.0-windows-setup.exe` NSIS installer. It is unsigned, so SmartScreen
  may ask for "More info → Run anyway".
- **Linux**: `Wavelength-2.4.0-linux.AppImage` or `Wavelength-2.4.0-linux-x86_64.flatpak`. The
  AppImage needs `yt-dlp` and `ffmpeg` installed; the Flatpak bundles both. Make the AppImage
  executable with `chmod +x Wavelength-2.4.0-linux.AppImage`, then run it.
