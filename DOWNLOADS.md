# Downloads

Latest release: **v2.3.0** — [Wavelength 2.3.0 for macOS, Windows, Linux and Android](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.3.0).

**v2.3.0** adds merge data with a removed-item checklist, listening recap with custom dates, the
home-screen widget, No AI, credits skipping, smart volume (desktop/browser), smarter shuffle and
playlist sorting. This is a full release: the desktop installers are v2.3.0 as well as the APK.

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `Wavelength-2.3.0-macos-universal.dmg` | Unsigned; right-click → Open |
| Windows 10/11 | `Wavelength-2.3.0-windows-setup.exe` | NSIS installer, unsigned |
| Linux | `Wavelength-2.3.0-linux.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux | `Wavelength-2.3.0-linux-x86_64.flatpak` | Bundles `yt-dlp`, `ffmpeg`, `ffprobe` |
| Android | `Wavelength-2.3.0-android.apk` | Debug-signed, direct install |

`SHA256SUMS.txt` lists the checksum for every file. The Android APK checksum is also published as
`Wavelength-2.3.0-android.apk.sha256`.

```
0183eef00e7b022b7b10771251bbda5175e5b4e2dadc8ace4c5fafea8287b8ab  Wavelength-2.3.0-android.apk
a1fae8f4575a11a549a4d05c16c4d6b47b7338d193378ca716e9903656e5660a  Wavelength-2.3.0-macos-universal.dmg
48246417f4bfe9769042dfb099134d1f24da2e464e112eabe36415572b703340  Wavelength-2.3.0-windows-setup.exe
8069887f6f3f9eafd2dad546db27155c58ba390d3791c548266314b4aa7cbf09  Wavelength-2.3.0-linux.AppImage
95880ad21cfd9f7d5c64a25e08166f74ebf614fb2d51795872b9e6142b14bdd2  Wavelength-2.3.0-linux-x86_64.flatpak
```

## Android

`Wavelength-2.3.0-android.apk` is a **standalone** app. Search, streaming and your playlists run
on the phone; no desktop app, Node, `yt-dlp`, `ffmpeg` or Wavelength server is required. An
internet connection is still needed for YouTube playback.

1. Download `Wavelength-2.3.0-android.apk` and allow installs from your browser/files app.
2. Open Wavelength and grant the notification permission so playback controls appear on the
   lock screen.
3. Search YouTube, play songs and build playlists on the phone. The library is stored in the app
   and survives with the computer off.

The APK is debug-signed for direct installation; it is not a Play Store build. v2.3.0 uses the
same signing key as v2.2.5 and v2.2.6, so it installs over either version and keeps your library.
If you are still on v2.2.4 or older, uninstall that app first because it was signed with a different
debug key. After installing, you can pull the library from the desktop host in **Settings → Devices**.

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

- **macOS**: `Wavelength-2.3.0-macos-universal.dmg` (Intel + Apple Silicon). The build is unsigned;
  right-click → Open, or run `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `Wavelength-2.3.0-windows-setup.exe` NSIS installer. It is unsigned, so SmartScreen
  may ask for "More info → Run anyway".
- **Linux**: `Wavelength-2.3.0-linux.AppImage` or `Wavelength-2.3.0-linux-x86_64.flatpak`. The
  Flatpak bundles `yt-dlp`, `ffmpeg` and `ffprobe`.
- The normal DMG/EXE/AppImage builds expect `yt-dlp` and `ffmpeg` on the computer.
