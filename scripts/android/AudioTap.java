package app.wavelength.music;

import android.media.audiofx.Visualizer;
import android.util.Base64;

/* Real spectrum + waveform for the Android visualizer.
   The WebView plays through Chromium's own player, which never exposes samples
   to Web Audio, so this reads the device output mix with android.media.audiofx.Visualizer
   (session 0). It needs RECORD_AUDIO, returns only FFT/waveform summaries (never audio),
   and on some devices or Android versions it is refused. The page then falls back to
   its generated spectrum. */
final class AudioTap {
    private static final int BINS = 32, WAVE = 64;
    private Visualizer viz;
    private final byte[] packed = new byte[BINS + WAVE];
    private volatile String last = "";
    private volatile long stamp = 0;

    synchronized boolean start() {
        if (viz != null) return true;
        try {
            Visualizer v = new Visualizer(0);
            int[] range = Visualizer.getCaptureSizeRange();
            v.setCaptureSize(Math.max(range[0], Math.min(512, range[1])));
            int rate = Math.min(Visualizer.getMaxCaptureRate(), 30000);
            v.setDataCaptureListener(new Visualizer.OnDataCaptureListener() {
                @Override public void onWaveFormDataCapture(Visualizer vis, byte[] w, int sr) {
                    int n = w.length;
                    for (int i = 0; i < WAVE; i++) packed[BINS + i] = (byte) ((w[Math.min(n - 1, i * n / WAVE)] & 0xFF) - 128);
                    publish();
                }
                @Override public void onFftDataCapture(Visualizer vis, byte[] fft, int sr) {
                    int pairs = fft.length / 2 - 1;
                    if (pairs < BINS) return;
                    for (int b = 0; b < BINS; b++) {
                        int lo = 1 + (int) Math.pow(pairs - 1, (double) b / BINS);
                        int hi = Math.max(lo + 1, 1 + (int) Math.pow(pairs - 1, (double) (b + 1) / BINS));
                        double peak = 0;
                        for (int k = lo; k < hi && 2 * k + 1 < fft.length; k++) {
                            double re = fft[2 * k], im = fft[2 * k + 1];
                            peak = Math.max(peak, Math.sqrt(re * re + im * im));
                        }
                        double v01 = Math.min(1.0, Math.log1p(peak) / Math.log1p(90.0));
                        packed[b] = (byte) Math.round(v01 * 255);
                    }
                }
            }, rate, true, true);
            v.setEnabled(true);
            viz = v;
            return true;
        } catch (Throwable t) {
            stop();
            return false;
        }
    }

    private void publish() {
        last = Base64.encodeToString(packed, Base64.NO_WRAP);
        stamp = System.nanoTime();
    }

    /* Base64 of 32 spectrum bytes (0..255, low to high) then 64 signed waveform bytes. */
    String read() {
        return (System.nanoTime() - stamp) < 400_000_000L ? last : "";
    }

    synchronized void stop() {
        if (viz != null) {
            try { viz.setEnabled(false); } catch (Throwable ignored) {}
            try { viz.release(); } catch (Throwable ignored) {}
            viz = null;
        }
        last = "";
    }
}
