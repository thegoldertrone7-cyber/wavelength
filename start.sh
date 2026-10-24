#!/usr/bin/env bash
# Wavelength launcher for macOS / Linux
cd "$(dirname "$0")" || exit 1
need() { command -v "$1" >/dev/null 2>&1; }

missing=()
need node   || missing+=(node)
need yt-dlp || missing+=(yt-dlp)
need ffmpeg || missing+=(ffmpeg)

if [ ${#missing[@]} -gt 0 ]; then
  echo "Missing: ${missing[*]}"
  if need brew; then
    read -r -p "Install them with Homebrew now? [Y/n] " a
    if [[ "${a:-Y}" =~ ^[Yy] ]]; then brew install "${missing[@]}" || exit 1; else exit 1; fi
  else
    echo "Install them first (macOS: https://brew.sh then 'brew install ${missing[*]}')."
    echo "Linux: use your package manager; for yt-dlp prefer 'pipx install yt-dlp' (distro versions go stale)."
    exit 1
  fi
fi
exec node server.js
