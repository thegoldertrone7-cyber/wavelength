@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Install Node.js first: https://nodejs.org & pause & exit /b 1)
where yt-dlp >nul 2>nul || echo yt-dlp not found. Run: winget install yt-dlp.yt-dlp
where ffmpeg >nul 2>nul || echo ffmpeg not found. Run: winget install Gyan.FFmpeg
node server.js
pause
