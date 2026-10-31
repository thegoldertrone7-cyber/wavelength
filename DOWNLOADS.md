# Downloads

Latest release: **v2.4.1** — [Wavelength 2.4.1 for macOS, Windows, Linux and Android](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.4.1).

**v2.4.1** makes connecting devices easier and adds a full-screen volume meter: a **Find devices**
button that discovers a hosting computer on the same Wi-Fi, automatic correction when a copied
player address is used for sync, **Smart volume** on Android that samples each song natively and
only turns loud tracks down, and a slim output meter under the full-screen volume slider on every
installer. Every earlier feature and the merge behaviour are unchanged. The desktop installers and
the APK are all v2.4.1.

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `Wavelength-2.4.1-macos-universal.dmg` | Unsigned; right-click → Open |
| Windows 10/11 | `Wavelength-2.4.1-windows-setup.exe` | NSIS installer, unsigned |
| Linux x64 | `Wavelength-2.4.1-linux.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux arm64 | `Wavelength-2.4.1-linux-arm64.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux | `Wavelength-2.4.1-linux-x86_64.flatpak` | Bundles `yt-dlp`, `ffmpeg`, `ffprobe` |
| Android | `Wavelength-2.4.1-android.apk` | Debug-signed, direct install |

`SHA256SUMS.txt` lists the checksum for every file. The Android APK checksum is also published as
`Wavelength-2.4.1-android.apk.sha256`.

```
1bf221e3de9dcffc635332a0cfb36c47de4bba8531013879aa02a8e323c8c201  Wavelength-2.4.1-android.apk
1a21b3ffc293804e52c3c324027f3cc27430688c816557f4afa627fb0561e293  Wavelength-2.4.1-linux-arm64.AppImage
5b514f2d609359eaae04757cb8685fff7b26490f1e3ded7d2b25a6bc737f1871  Wavelength-2.4.1-linux-x86_64.flatpak
8a216aa44c5037e08b303fee692bbcdb5c9b3f8350aa9561a93805d9a8fdacc6  Wavelength-2.4.1-linux.AppImage
c290f8ea013ad6bca235c04bb581344286c5760a40faa6ad093cbcde46a0c10d  Wavelength-2.4.1-macos-universal.dmg
4aa36ed87549f265acea21041bdbc28bb4e8800c81f7dae66dec508824c42535  Wavelength-2.4.1-windows-setup.exe
```

## Android

`Wavelength-2.4.1-android.apk` is a **standalone** app. Search, streaming and your playlists run
on the phone; no desktop app, Node, `yt-dlp`, `ffmpeg` or Wavelength server is required. An
internet connection is still needed for YouTube playback.

1. Download `Wavelength-2.4.1-android.apk` and allow installs from your browser/files app.
2. Open Wavelength and grant the notification permission so playback controls appear on the
   lock screen.
3. Search YouTube, play songs and build playlists on the phone. The library is stored in the app
   and survives with the computer off.

The APK is debug-signed for direct installation; it is not a Play Store build. v2.4.1 uses the
same signing key as v2.4.0, v2.3.0, v2.2.5 and v2.2.6, so it installs over any of them and keeps
your library. If you are still on v2.2.4 or older, uninstall that app first because it was signed
with a different debug key. After installing, you can pull the library from the desktop host in
**Settings → Devices**.

### Widget, visualizer, volume and lock screen

- **Home-screen widget** — long-press the home screen, choose widgets, and add Wavelength. It
  shows artwork, title, artist, album and a Playing/Paused label, with previous, play/pause and
  next.
- **Visualizer** — open the full-screen player, or set the style and size in **Settings →
  Appearance**. Sizes are small, medium, large and full screen; full screen makes the canvas the
  player backdrop. Android's WebView exposes no audio samples, so the phone draws a
  track-seeded spectrum from the playback clock. It moves while a song plays, changes between
  tracks and settles flat on pause. It is playback-driven, not a real audio spectrum. The slim
  volume meter under the full-screen slider follows the same playback-driven estimate on Android;
  on desktop and in the browser it reads the live audio analyser.
- **Lock screen** — lock the phone during playback and a now-playing view appears briefly with
  artwork, details, progress, controls and the visualizer behind it, then steps out of the way.
  On Android 14 and newer, Android may require the full-screen notification permission; Settings
  shows an **Allow lock-screen display** row when it does.
- **Volume** — the full-screen player and **Settings → Playback** control the phone's media
  stream, so the in-app slider, the hardware keys and Android's volume panel stay in step.
- **Smart volume** — turn it on in **Settings → Playback**. The phone analyses the first few
  seconds of each song natively and turns louder songs down. It never boosts a quiet song above
  the volume you set, and if analysis fails playback continues unchanged.

### Optional computer sync

The computer is only needed while syncing; disconnect and keep listening on the phone.

1. On the computer, open **Settings → Devices → Start hosting** and note the address
   (for example `http://192.168.1.10:38422`) and pairing code.
2. On the phone, open **Settings → Devices → Join a host**. Use **Find devices** to discover the
   host on the same Wi-Fi, or enter the address and code manually. On
   v2.3.0 and later, connecting merges both libraries; older hosts pull their copy to the phone.
   If you paste the player address (for example `192.168.1.10:38421`), Wavelength corrects it to
   the sync port automatically.
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

- **macOS**: `Wavelength-2.4.1-macos-universal.dmg` (Intel + Apple Silicon). The build is unsigned;
  right-click → Open, or run `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `Wavelength-2.4.1-windows-setup.exe` NSIS installer. It is unsigned, so SmartScreen
  may ask for "More info → Run anyway".
- **Linux**: `Wavelength-2.4.1-linux.AppImage` (x64), `Wavelength-2.4.1-linux-arm64.AppImage`
  (arm64) or `Wavelength-2.4.1-linux-x86_64.flatpak`. The AppImages need `yt-dlp` and `ffmpeg`
  installed; the Flatpak bundles both. Make the AppImage executable with
  `chmod +x Wavelength-2.4.1-linux.AppImage`, then run it.
