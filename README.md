# Wavelength

Free, ad-free music app. Paste a Spotify link, it finds the songs on YouTube, plays them
ad-free with endless playback, downloads MP3s, custom playlist images, Nothing OS or Classic style,
Catppuccin Mocha + custom accent colours.

## Desktop app (macOS / Windows / Linux)

You need Node.js, yt-dlp and ffmpeg. macOS:  `brew install node yt-dlp ffmpeg`

    npm install          # downloads Electron (~100 MB, once)
    npm run app          # opens Wavelength as a real app window

Build an installable app (run it on the OS you are building for):

    npm run dist:mac     # -> dist/Wavelength-*.dmg
    npm run dist:win     # -> dist/Wavelength Setup *.exe   (run on Windows)
    npm run dist:linux   # -> dist/Wavelength-*.AppImage    (run on Linux)

The app is unsigned. First launch on macOS: right-click the app -> Open, or run
`xattr -cr /Applications/Wavelength.app`.
yt-dlp and ffmpeg are not bundled; install them as above (`brew upgrade yt-dlp` if playback ever breaks).

## Browser mode (no Electron)

    ./start.sh           # macOS / Linux  (start.bat on Windows)

Opens http://127.0.0.1:3000.

## Importing from Spotify

Spotify -> Share -> Copy link -> paste into Wavelength (Import page, or straight into the search box).
Playlists, albums and songs work. The playlist must be public. Without signing in, Spotify shares the
first 100 songs of a playlist; "Paste a list of songs" always works for any length.
Signing in with Spotify is optional (only for playlists over 100 songs and liked songs): create an app at
developer.spotify.com/dashboard, add the Redirect URI shown on the Import page, paste the Client ID.

## Android

There is no APK. Run browser mode with `HOST=0.0.0.0 ./start.sh` and open the printed network address in
Chrome on your phone. While a song plays, Android shows lock-screen and notification controls
(play, pause, next, previous, seek, artwork).
To install it as an app, and to make Spotify's Share button send links straight to Wavelength, Chrome needs
HTTPS (for example `tailscale serve --bg 3000`); then use Chrome menu -> Install app.
Anyone on your network can use the server while HOST=0.0.0.0, so only do this on a network you trust.

## Your data

Browser mode: ./data.  Desktop app: the app's user-data folder.  MP3s: ~/Music/Wavelength (change in Settings).

## Note

Streaming and downloading from YouTube is against YouTube's terms. Personal use only.
