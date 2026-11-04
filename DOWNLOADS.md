# Downloads

Two builds are published side by side.

- **Latest stable: v2.4.1** — [Wavelength 2.4.1 for macOS, Windows, Linux and Android](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.4.1).
- **Overhaul: 2.7.0** — [Wavelength Overhaul (2.7.0)](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.7.0-overhaul),
  built from the `Overhaul` branch. It is a separate release and does not replace v2.4.1.
  The earlier [Overhaul 2.6.0](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.6.0-overhaul),
  [Overhaul 2.5.1](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.5.1-overhaul)
  and [Overhaul 2.5.0](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.5.0-overhaul)
  releases remain available.

## Overhaul 2.7.0

The 2.7.0 build adds **in-app updates**. The interface and player can update without a new
installer: a signed bundle is verified, unpacked into the app's data folder and used from the next
start, and a broken update rolls back automatically on the next launch. Changes to the native shell
still arrive through an installer. This build contains the updater but no signing key, so
**Settings → Updates** reports that updates are not set up. The one-time key setup is described in
[UPDATES.md](UPDATES.md).

It includes everything from 2.6.0: the smart intro/outro skipper, window layouts, 33 more themes
with a dotted background and custom CSS, synced lyrics, song-editor upgrades, the new app icon, and
the 2.5.x work (motion v3, playback speed, editable song details, twenty visualizer styles with a
live gallery, undo and filtering, queue tools, sleep timer, Android widgets). Every installer and
the APK are 2.7.0.

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `Wavelength-2.7.0-macos-universal.dmg` | Unsigned; right-click → Open |
| Windows 10/11 | `Wavelength-2.7.0-windows-setup.exe` | NSIS installer, unsigned |
| Linux x64 | `Wavelength-2.7.0-linux.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux arm64 | `Wavelength-2.7.0-linux-arm64.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux | `Wavelength-2.7.0-linux-x86_64.flatpak` | Bundles `yt-dlp`, `ffmpeg`, `ffprobe` |
| Android | `Wavelength-2.7.0-android.apk` | Debug-signed, direct install |

`SHA256SUMS.txt` lists the checksum for every file. The Android APK checksum is also published as
`Wavelength-2.7.0-android.apk.sha256`.

```
__OVERHAUL_SUMS__
```

## Overhaul 2.6.0

The 2.6.0 build adds a **smart intro/outro skipper** (chapters, description timestamps,
SponsorBlock data and ffmpeg silence detection merged with confidence scores; Off, Skip button or
Automatic per intros, outros and breaks, with Undo and seek-bar marks), **window layouts** (sidebar
left/right/top/rail/hidden, player bottom/top/floating, centred content and eight presets),
**33 more themes** with a dotted background and a custom CSS box, **synced lyrics** from LRCLIB,
and song-editor upgrades including a Spotify image button and Enter to save.

It also includes everything from the 2.5.x Overhaul builds: motion v3 (travelling covers, gliding
lists and highlights, artwork fades), playback speed, editable song title/artist/artwork, twenty
visualizer styles with a live gallery, undo and filtering across playlists and the queue, queue
drag-reordering with **Mix** and **Save**, a sleep timer, touch shortcuts, and taller Android
widgets with progress, a like action and launcher shortcuts. The app icon is the new Wavelength
mark. Every installer and the APK are 2.6.0.

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `Wavelength-2.6.0-macos-universal.dmg` | Unsigned; right-click → Open |
| Windows 10/11 | `Wavelength-2.6.0-windows-setup.exe` | NSIS installer, unsigned |
| Linux x64 | `Wavelength-2.6.0-linux.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux arm64 | `Wavelength-2.6.0-linux-arm64.AppImage` | Needs `yt-dlp` and `ffmpeg` |
| Linux | `Wavelength-2.6.0-linux-x86_64.flatpak` | Bundles `yt-dlp`, `ffmpeg`, `ffprobe` |
| Android | `Wavelength-2.6.0-android.apk` | Debug-signed, direct install |

`SHA256SUMS.txt` lists the checksum for every file. The Android APK checksum is also published as
`Wavelength-2.6.0-android.apk.sha256`.

```
a414d0a9965072536130d45842cde63a309ba4a8b43c12f8263aeb0b03545f0c  Wavelength-2.6.0-android.apk
5a3fc1ee253398702977ae7d01374c603781203f7f1c58752f45545daf7607fb  Wavelength-2.6.0-linux-arm64.AppImage
b60e2e4d0b1e29070cdc6c384ff34dc201ab253a59b15c3f476f541be6244808  Wavelength-2.6.0-linux-x86_64.flatpak
ea61419994b6f8746678cfc09511454c0ab16f4a6eefca93f600dee4e74c53d5  Wavelength-2.6.0-linux.AppImage
b03cfdf38e40e3ba0f71b54d001c8bdcfa9ffa181b0c36499b165cc454bbc936  Wavelength-2.6.0-macos-universal.dmg
4d2f203e8dc21c647ca5026465d3377aaa71a140387191a39c007d9eafc99405  Wavelength-2.6.0-windows-setup.exe
```

## Stable: v2.4.1

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

Both APKs are **standalone** apps. Search, streaming and your playlists run on the phone; no
desktop app, Node, `yt-dlp`, `ffmpeg` or Wavelength server is required. An internet connection is
still needed for YouTube playback.

1. Download the APK for the build you want and allow installs from your browser/files app.
2. Open Wavelength and grant the notification permission so playback controls appear on the
   lock screen.
3. Search YouTube, play songs and build playlists on the phone. The library is stored in the app
   and survives with the computer off.

The APKs are debug-signed for direct installation; they are not Play Store builds. v2.7.0 uses the
same signing key as v2.6.0, v2.5.1, v2.5.0, v2.4.1, v2.4.0, v2.3.0, v2.2.5 and v2.2.6, so any of them installs over
the others and keeps your library. If you are still on v2.2.4 or older, uninstall that app first
because it was signed with a different debug key. After installing, you can pull the library from
the desktop host in **Settings → Devices**.

### Widget, visualizer, volume and lock screen

- **Home-screen widget** — long-press the home screen, choose widgets, and add Wavelength. It
  shows artwork, title, artist, album and a Playing/Paused label, with previous, play/pause and
  next. Overhaul adds taller layouts with progress and a like action.
- **Visualizer** — open the full-screen player, or set the style and size in **Settings →
  Appearance**. Sizes are small, medium, large and full screen; full screen makes the canvas the
  player backdrop. Overhaul offers twenty styles on desktop and in the browser, previewed live in
  the style gallery. Android's WebView exposes no audio samples, so the phone draws a
  track-seeded spectrum from the playback clock, and the lock screen draws the closest of the four
  classic looks. It moves while a song plays, changes between tracks and settles flat on pause. It
  is playback-driven, not a real audio spectrum. The slim volume meter under the full-screen
  slider follows the same playback-driven estimate on Android; on desktop and in the browser it
  reads the live audio analyser.
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

The instructions are the same for both releases; substitute the version you downloaded.

- **macOS**: `Wavelength-2.7.0-macos-universal.dmg` or `Wavelength-2.4.1-macos-universal.dmg`
  (Intel + Apple Silicon). The builds are unsigned; right-click → Open, or run
  `xattr -cr /Applications/Wavelength.app`.
- **Windows**: `Wavelength-2.7.0-windows-setup.exe` or `Wavelength-2.4.1-windows-setup.exe` NSIS
  installers. They are unsigned, so SmartScreen may ask for "More info → Run anyway".
- **Linux**: `Wavelength-2.7.0-linux.AppImage` (x64), `Wavelength-2.7.0-linux-arm64.AppImage`
  (arm64) or `Wavelength-2.7.0-linux-x86_64.flatpak`; v2.4.1 uses the same names with `2.4.1`.
  The AppImages need `yt-dlp` and `ffmpeg` installed; the Flatpak bundles both. Make the AppImage
  executable with `chmod +x Wavelength-2.7.0-linux.AppImage`, then run it.
