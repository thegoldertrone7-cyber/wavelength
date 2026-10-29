# Wavelength

Free, ad-free music app. Paste a Spotify link, it finds the songs on YouTube, plays them
ad-free with endless playback, downloads MP3s, plays your own lossless files at native quality,
custom playlist images, multiple interface styles, Catppuccin palettes and custom accent colours.
Smart volume evens out quiet and loud tracks, smart shuffle balances songs across playlists, and
the listening recap can cover a year or any custom date range.
The product thesis, full feature map, platform status and release plan are in
[PRODUCT_BIBLE.md](PRODUCT_BIBLE.md). The visual language and motion rules are in
[DESIGN.md](DESIGN.md).

## Download v2.4.0

All files are on the [v2.4.0 release page](https://github.com/thegoldertrone7-cyber/wavelength/releases/tag/v2.4.0);
checksums are in `SHA256SUMS.txt`.

- **macOS** (Intel + Apple Silicon): `Wavelength-2.4.0-macos-universal.dmg`
- **Windows**: `Wavelength-2.4.0-windows-setup.exe`
- **Linux**: `Wavelength-2.4.0-linux.AppImage` or `Wavelength-2.4.0-linux-x86_64.flatpak`
- **Android**: `Wavelength-2.4.0-android.apk`

The macOS and Windows builds are unsigned, so the first launch shows the usual warning. Installation
details, sync steps and limits are in [DOWNLOADS.md](DOWNLOADS.md).

## Desktop app (macOS / Windows / Linux)

You need Node.js, yt-dlp and ffmpeg (which includes ffprobe). macOS:  `brew install node yt-dlp ffmpeg`

    npm install          # downloads Electron (~100 MB, once)
    npm run app          # opens Wavelength as a real app window

Build an installable app (run it on the OS you are building for):

    npm run dist:mac     # -> dist/Wavelength-*.dmg
    npm run dist:win     # -> dist/Wavelength Setup *.exe   (run on Windows)
    npm run dist:linux   # -> dist/Wavelength-*.AppImage    (run on Linux)
    bash scripts/build-flatpak.sh   # -> dist/Wavelength-*-x86_64.flatpak (Linux)

The desktop packages and Flatpak are also built by GitHub Actions on every push to `main`.
Each release page lists the installation files included; v2.4.0 ships macOS, Windows, Linux and
Android together.

The app is unsigned. First launch on macOS: right-click the app -> Open, or run
`xattr -cr /Applications/Wavelength.app`.
yt-dlp and ffmpeg/ffprobe are not bundled with the normal desktop builds; install them as above
(`brew upgrade yt-dlp` if playback ever breaks). The Flatpak bundles both tools.

## Browser mode (no Electron)

    ./start.sh           # macOS / Linux  (start.bat on Windows)

Opens http://127.0.0.1:3000 on this computer. That loopback-only default is
deliberate: a normal browser session is not exposed to the network. To let a
phone or another computer connect, start it with:

    HOST=0.0.0.0 ./start.sh

Then use the `Network → http://…:3000` address it prints. The desktop app does
this automatically and shows the address in **Settings → Devices**.

## Lossless local files

Open **Local files** in the sidebar, then choose **Add audio files**. FLAC, WAV, AIFF, ALAC, M4A, MP3,
OGG and Opus files are copied into Wavelength's local library, read with ffprobe, and streamed back at
their original bit depth and sample rate. Nothing is transcoded. Embedded artwork is extracted
automatically. You can rescan the folder or delete individual files from the local view.

YouTube-sourced playback remains lossy; Wavelength labels the two sources separately instead of calling
a YouTube stream lossless. Settings → Playback also has a **Streaming quality** choice: Best available
or Data saver. Local-file playback is currently a desktop feature; the standalone Android build does not
read files from the phone yet.

## Importing from Spotify

Spotify -> Share -> Copy link -> paste into Wavelength (Import page, or straight into the search box).
Playlists, albums and songs work. The playlist must be public. Without signing in, Spotify shares the
first 100 songs of a playlist; "Paste a list of songs" always works for any length.
Signing in with Spotify is optional (only for playlists over 100 songs and liked songs): create an app at
developer.spotify.com/dashboard, add the Redirect URI shown on the Import page, paste the Client ID.
Spotify links and account import run on the desktop; the standalone Android build accepts a pasted list
of songs and matches them on YouTube.

## Device sync

Open **Settings -> Devices** on the device that should keep the main library and choose **Start hosting**.
On the other device, choose **Join a host**, then enter the host address and the short pairing code.
Playlists, liked songs, history and listening stats stay in sync; themes, downloads and local files stay
on each device. On current versions, **Connecting merges** this device with the host, so neither library
is thrown away. **Merge data** is available on every connected device, including the host.

Merge previews the other copy first. New playlists, songs and liked songs are added automatically.
Anything this device used to have but no longer does — while another copy still has it — opens a
checklist instead: tick the items to bring back, or clear them to leave those items only on the
other copy. Unchecked items are never deleted from the device that still has them. Listening history
is always combined, and per-device listening totals keep the newest snapshot instead of being added
twice.

Merge is additive and not a deletion sync: deleting a playlist here does not delete it elsewhere,
and a later merge will not quietly restore it unless you tick it. Wavelength keeps a grow-only
baseline of items this device has seen, which is how it tells a genuinely new item from one that was
removed here. The host cannot reach a sleeping guest, so its Merge data button combines the host copy
with the libraries guests sent during the current hosting session. **Pull now** still replaces this
device's library with the host's copy; **Send changes** replaces the host's library with this
device's copy. There is no automatic background merge.

The sync listener uses the next port after the player (`38422` for the desktop app). It is only active
while Wavelength is open. Use Tailscale on both devices, or join over the same Wi-Fi and allow that port
through the host firewall. Every paired guest can send changes.

## Listening recap

Open **Recap** in the sidebar to see total listening time, plays, top songs, top artists and top
playlists. Pick a year chip or enter any start and end date, then choose **Apply**.

Complete calendar years use full-year totals, including listening recorded before daily detail existed.
Custom date ranges use the daily listening detail recorded from this version onward: total time is
complete for a range, but rankings for older days may be partial and are labelled when that happens.
Devices are merged without counting the same device twice. YouTube does not provide reliable genre
metadata, so the recap ranks artists, playlists and songs instead of inventing a genre. The recap is
stored locally and travels with the library during sync.

## Android

Download the APK from the [Releases page](https://github.com/thegoldertrone7-cyber/wavelength/releases).

The Android build is **standalone**. Search, streaming and your playlists run on the phone.
It does not need the desktop app, Node, `yt-dlp`, `ffmpeg` or a Wavelength server. An internet
connection is still required for YouTube playback.

The phone uses NewPipeExtractor to resolve YouTube audio directly. The first launch after
upgrading from the old companion APK tries to import the library from the last server address;
after that, the library lives in the app and survives with the computer off. Grant the
notification permission when asked so playback controls appear on the lock screen.

On Android today:

- Search YouTube, play songs and build playlists on the phone.
- Keep the library on the phone and optionally sync it with a computer.
- Merge the phone and computer libraries without removing either copy.
- Control playback from the lock screen, notification, Bluetooth or a headset. Disconnecting
  Bluetooth pauses playback when **Pause when headphones disconnect** is on.
- Change volume from the full-screen player or **Settings → Playback**. It moves the phone's
  media stream, so the slider, the hardware keys and Android's volume panel stay in step.
- Add the Wavelength home-screen widget. It shows the artwork, title, artist, album and a
  Playing/Paused label, with previous, play/pause and next buttons.
- Open the full-screen player for the visualizer. All four styles are there, in small, medium,
  large and full-screen sizes; the full-screen size turns the visualizer into the player backdrop.
  Android plays audio inside the WebView, which exposes no samples, so the phone draws a
  track-seeded spectrum from the playback clock: it moves while a song plays and settles flat on
  pause. It is not a real audio spectrum, and the settings say so.
- Lock the phone during playback to see a brief now-playing view: artwork, song details, progress,
  controls, and the visualizer as the background. It fades out after a few seconds. On Android 14
  and newer, settings offers an **Allow lock-screen display** row when Android still needs the
  full-screen notification permission.
- Import a pasted list of songs from the Import page.

Not yet available on Android: direct Spotify links/account import, offline downloads and
local-file playback. Those remain desktop features for now; on the phone, paste song names
on the Import page and Wavelength matches them on YouTube.

### Optional computer sync

The computer is only needed while syncing; disconnect and keep listening on the phone.

1. On the computer, open **Settings → Devices → Start hosting**. Note the address
   (for example `http://192.168.1.10:38422`) and the pairing code.
2. On the phone, open **Settings → Devices → Join a host**, enter the address including
   the sync port and the pairing code.
3. Use **Merge data** to combine both libraries while keeping every playlist. Use **Pull now** only
   when you want the host copy to replace the phone, or **Send changes** to replace the host with the
   phone copy. **Disconnect** when finished.

The sync listener runs only while Wavelength is open on the computer. Use Tailscale on both
devices, or the same Wi-Fi and allow that port through the host firewall. Only sync on a
network you trust. `127.0.0.1` / `localhost` on the phone means the phone itself, not the
computer; use the computer's LAN or Tailscale address.

For browser-only use, HTTPS is needed for Chrome's Install app / Share-target features
(for example `tailscale serve --bg 3000`).

## Your data

Browser mode: ./data.  Desktop app: the app's user-data folder.  Local lossless files live under
`data/local` (or the equivalent user-data folder).  MP3s: ~/Music/Wavelength (change in Settings).

## Note

Streaming and downloading from YouTube is against YouTube's terms. Personal use only.
