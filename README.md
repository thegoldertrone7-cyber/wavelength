# Wavelength

Free, ad-free music app. Paste a Spotify link, it finds the songs on YouTube, plays them
ad-free with endless playback, downloads MP3s, plays your own lossless files at native quality,
custom playlist images, multiple interface styles, Catppuccin palettes and custom accent colours.
The visual language, motion rules and feature map are documented in [DESIGN.md](DESIGN.md).

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
Each release page lists the installation files included; Android-only patch releases may contain
just the APK and its checksum.

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
Playlists, liked songs and history stay in sync; themes, downloads and local files stay on each device.

The sync listener uses the next port after the player (`38422` for the desktop app). It is only active
while Wavelength is open. Use Tailscale on both devices, or join over the same Wi-Fi and allow that port
through the host firewall. **Pull now** replaces this device's library with the host's copy; **Send
changes** replaces the host's library with this device's copy. Every paired guest can send changes;
the newest push wins, and there is no automatic merge.

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
- Control playback from the lock screen, notification, Bluetooth or a headset.
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
3. Use **Pull now** to replace the phone library with the host copy, or **Send changes** to
   replace the host library with the phone copy. **Disconnect** when finished.

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
