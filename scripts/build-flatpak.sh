#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
UNPACKED="$ROOT/dist/linux-unpacked"

rm -rf "$UNPACKED" "$ROOT/flatpak-build" "$ROOT/flatpak-repo" "$ROOT/vendor"
mkdir -p "$ROOT/vendor" "$ROOT/flatpak"

# Electron app payload (not the AppImage: Flatpak runs the unpacked tree).
npx electron-builder --linux dir --x64

if [ ! -x "$UNPACKED/wavelength" ]; then
  echo "Expected executable not found: $UNPACKED/wavelength" >&2
  find "$UNPACKED" -maxdepth 1 -type f -perm -u+x -print >&2 || true
  exit 1
fi

# Bundle the external tools the app shells out to. Flatpak cannot assume the
# host has Homebrew/apt packages installed.
curl -L --fail --retry 3 -o "$ROOT/vendor/yt-dlp_linux" \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
chmod +x "$ROOT/vendor/yt-dlp_linux"

curl -L --fail --retry 3 -o "$ROOT/vendor/ffmpeg.tar.xz" \
  https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

cat > "$ROOT/flatpak/app.wavelength.music.desktop" <<'EOF'
[Desktop Entry]
Name=Wavelength
Comment=Free, ad-free music app
Exec=wavelength
Icon=app.wavelength.music
Terminal=false
Type=Application
Categories=Audio;Music;Player;
StartupWMClass=Wavelength
EOF

cat > "$ROOT/flatpak/app.wavelength.music.yml" <<'EOF'
app-id: app.wavelength.music
runtime: org.freedesktop.Platform
runtime-version: '24.08'
sdk: org.freedesktop.Sdk
base: org.electronjs.Electron2.BaseApp
base-version: '24.08'
command: wavelength
finish-args:
  - --share=network
  - --share=ipc
  - --socket=pulseaudio
  - --socket=x11
  - --device=dri
  - --env=YTDLP_PATH=/app/bin/yt-dlp
  - --env=FFMPEG_PATH=/app/bin/ffmpeg
  - --env=FFPROBE_PATH=/app/bin/ffprobe
modules:
  - name: yt-dlp
    buildsystem: simple
    build-commands:
      - install -Dm755 yt-dlp_linux /app/bin/yt-dlp
    sources:
      - type: file
        path: ../vendor/yt-dlp_linux

  - name: ffmpeg
    buildsystem: simple
    build-commands:
      - tar -xJf ffmpeg.tar.xz --strip-components=1
      - install -Dm755 ffmpeg /app/bin/ffmpeg
      - install -Dm755 ffprobe /app/bin/ffprobe
    sources:
      - type: file
        path: ../vendor/ffmpeg.tar.xz

  - name: wavelength
    buildsystem: simple
    build-commands:
      - mkdir -p /app/wavelength
      - cp -a . /app/wavelength
      - install -Dm644 app.wavelength.music.desktop /app/share/applications/app.wavelength.music.desktop
      - install -Dm644 icon.png /app/share/icons/hicolor/512x512/apps/app.wavelength.music.png
      - |
        cat > /app/bin/wavelength <<'WRAPPER'
        #!/bin/sh
        exec zypak-wrapper /app/wavelength/wavelength "$@"
        WRAPPER
      - chmod +x /app/bin/wavelength
    sources:
      - type: dir
        path: ../dist/linux-unpacked
      - type: file
        path: ../flatpak/app.wavelength.music.desktop
      - type: file
        path: ../build/icon.png
EOF

flatpak remote-add --if-not-exists --user flathub \
  https://dl.flathub.org/repo/flathub.flatpakrepo

flatpak-builder --user --install-deps-from=flathub --disable-rofiles-fuse \
  --force-clean --repo="$ROOT/flatpak-repo" \
  "$ROOT/flatpak-build" "$ROOT/flatpak/app.wavelength.music.yml"

flatpak build-bundle "$ROOT/flatpak-repo" \
  "$ROOT/dist/Wavelength-${VERSION}-x86_64.flatpak" \
  app.wavelength.music

ls -lh "$ROOT/dist/Wavelength-${VERSION}-x86_64.flatpak"
