# Wavelength

Free, ad-free music app. Paste a Spotify link, it finds the songs on YouTube, plays them
ad-free with endless playback, downloads MP3s, plays your own lossless files at native quality,
custom playlist images, multiple interface styles, Catppuccin palettes and custom accent colours.

## Desktop app (macOS / Windows / Linux)

You need Node.js, yt-dlp and ffmpeg (which includes ffprobe). macOS:  `brew install node yt-dlp ffmpeg`

    npm install          # downloads Electron (~100 MB, once)
    npm run app          # opens Wavelength as a real app window

Build an installable app (run it on the OS you are building for):

    npm run dist:mac     # -> dist/Wavelength-*.dmg
    npm run dist:win     # -> dist/Wavelength Setup *.exe   (run on Windows)
    npm run dist:linux   # -> dist/Wavelength-*.AppImage    (run on Linux)
    bash scripts/build-flatpak.sh   # -> dist/Wavelength-*-x86_64.flatpak (Linux)

The desktop packages and Flatpak are also built by GitHub Actions on every push to `main`;
tagged releases attach the DMG, EXE, AppImage, Flatpak and Android APK to the GitHub release.

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
or Data saver.

## Importing from Spotify

Spotify -> Share -> Copy link -> paste into Wavelength (Import page, or straight into the search box).
Playlists, albums and songs work. The playlist must be public. Without signing in, Spotify shares the
first 100 songs of a playlist; "Paste a list of songs" always works for any length.
Signing in with Spotify is optional (only for playlists over 100 songs and liked songs): create an app at
developer.spotify.com/dashboard, add the Redirect URI shown on the Import page, paste the Client ID.

## Device sync

Open **Settings -> Devices** on the device that should keep the main library and choose **Start hosting**.
On the other device, choose **Join a host**, then enter the host address and the short pairing code.
Playlists, liked songs and history stay in sync; themes, downloads and local files stay on each device.

The sync listener uses the next port after the player (`38422` for the desktop app). It is only active
while Wavelength is open. Use Tailscale on both devices, or join over the same Wi-Fi and allow that port
through the host firewall. **Pull now** replaces this device's library with the host's copy; **Send
changes** replaces the host's library with this device's copy.

## Android

Download the APK from the [Releases page](https://github.com/thegoldertrone7-cyber/wavelength/releases).
The APK is a companion client: it does **not** bundle the Node server, `yt-dlp` or
`ffmpeg`. Playback, downloads and local files come from the computer running Wavelength.

1. Open Wavelength on your computer. The desktop app is the easiest option; browser mode
   also works with `HOST=0.0.0.0 ./start.sh`.
2. In **Settings → Devices → Phone & browser access**, copy the address shown
   (for example `http://192.168.1.10:38421`).
3. On the phone, open Wavelength and paste that address, or tap **Find my computer** to
   scan the current Wi-Fi network for Wavelength on ports `38421` (desktop app) and
   `3000` (browser mode). If more than one server answers, pick yours from the list.
4. The desktop app usually uses port `38421`. If the connection fails, the app stays on its
   native setup screen and offers **Retry**, **Back to player** and **Find my computer**;
   it never leaves Chrome's "Webpage not available" page in front.
5. Tap the small `⋮` button in the top-right corner to change the server later.

**`127.0.0.1` / `localhost` on Android means the phone itself, not your computer.** The app
rejects those addresses and explains why. Use the computer's Wi-Fi/Tailscale address instead.

Only do this on a network you trust: anyone who can reach that address can use your
Wavelength library. The desktop app listens on the local network while it runs; the plain
`./start.sh` / `node server.js` mode stays loopback-only unless you set `HOST=0.0.0.0`.

While a song plays, Android shows lock-screen and notification controls (play, pause, next,
previous, seek, artwork). For browser-only use, HTTPS is needed for Chrome's Install app /
Share-target features (for example `tailscale serve --bg 3000`).

## Your data

Browser mode: ./data.  Desktop app: the app's user-data folder.  Local lossless files live under
`data/local` (or the equivalent user-data folder).  MP3s: ~/Music/Wavelength (change in Settings).

## Note

Streaming and downloading from YouTube is against YouTube's terms. Personal use only.
