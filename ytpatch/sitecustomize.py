"""App-scoped yt-dlp patch for Wavelength.

yt-dlp sets `available_at` on formats when YouTube reports a pre-roll ad and
then sleeps until the ad would have finished before downloading. Wavelength is
audio-only and never plays ads, so that delay is pure startup latency.

This module is loaded automatically by Python's `site` machinery when the app
spawns yt-dlp with PYTHONPATH pointing at this directory. It only strips the
ad wait; everything else is unchanged. If the import fails (e.g. yt-dlp is a
standalone binary), yt-dlp simply behaves normally.
"""
try:
    from yt_dlp.downloader import common as _common

    _orig_download = _common.FileDownloader.download

    def _download_without_ad_wait(self, filename, info_dict, subtitle=False):
        info_dict.pop('available_at', None)
        for fmt in info_dict.get('requested_formats') or ():
            if isinstance(fmt, dict):
                fmt.pop('available_at', None)
        return _orig_download(self, filename, info_dict, subtitle)

    _common.FileDownloader.download = _download_without_ad_wait
except Exception:
    pass
