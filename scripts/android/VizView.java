package app.wavelength.music;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.SystemClock;
import android.util.AttributeSet;
import android.view.View;

/**
 * The phone's visualizer.
 *
 * Android plays audio inside the WebView, which never hands its samples to
 * Web Audio, so a real FFT is not available here. Instead this draws a
 * track-seeded spectrum driven by the playback clock: it moves only while a
 * song plays, looks different for every track, and settles to a flat idle grid
 * on pause. The desktop/browser player still uses the real analyser.
 */
public class VizView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    private final float[] disp = new float[160];

    private int accent = 0xFFCBA6F7;
    private String style = "matrix";
    private boolean playing = false;
    private float seed = 0.31f;
    private float phase = 0f;
    private long lastTick = 0;

    public VizView(Context context) {
        super(context);
        setLayerType(LAYER_TYPE_SOFTWARE, null);
    }

    public VizView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    void setStyle(String value) {
        style = value == null ? "matrix" : value;
        invalidate();
    }

    void setPlaying(boolean value) {
        if (playing == value) {
            if (value) postInvalidateOnAnimation();
            return;
        }
        playing = value;
        lastTick = 0;
        if (!value) {
            for (int i = 0; i < disp.length; i++) disp[i] = 0f;
        }
        invalidate();
    }

    void setSeed(String text) {
        if (text == null) text = "";
        int h = 0x811C9DC5;
        for (int i = 0; i < text.length(); i++) {
            h ^= text.charAt(i);
            h *= 16777619;
        }
        seed = (Math.abs(h) % 10007) / 10007f;
        invalidate();
    }

    void setAccent(String hex) {
        try {
            if (hex != null && hex.startsWith("#")) accent = Color.parseColor(hex);
        } catch (Exception ignored) {}
        invalidate();
    }

    private float level(int i, int n) {
        double s = seed * 6.283;
        float t = phase;
        double tilt = Math.pow(Math.max(0, 1 - (double) i / n), 0.72);
        double beat = Math.pow(0.5 + 0.5 * Math.sin(t * 3.05 + s), 3);
        double body = 0.5 + 0.5 * Math.sin(t * 1.31 + i * 0.52 + s * 1.7);
        double air = 0.5 + 0.5 * Math.sin(t * 2.63 + i * 1.17 + s * 3.1);
        double dip = 0.5 + 0.5 * Math.sin(t * 0.47 + i * 0.09 + s * 0.8);
        return (float) Math.min(1, 0.1 + tilt * (0.34 * body + 0.3 * beat) * (0.55 + 0.45 * dip)
            + 0.16 * air * tilt + 0.06 * beat);
    }

    private float ease(int i, float value) {
        disp[i] = disp[i] + (value - disp[i]) * 0.32f;
        return disp[i];
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        int w = getWidth(), h = getHeight();
        if (w <= 0 || h <= 0) return;

        long now = SystemClock.uptimeMillis();
        float dt = lastTick == 0 ? 0.016f : Math.min(0.06f, (now - lastTick) / 1000f);
        lastTick = now;
        if (playing) phase += dt * 2.1f;

        int color = accent;
        if (!playing) color = (color & 0x00FFFFFF) | 0x66000000;
        else color = (color & 0x00FFFFFF) | 0xCC000000;
        paint.setColor(color);
        paint.setStyle(Paint.Style.FILL);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeWidth(Math.max(2f, h * 0.006f));

        float idle = playing ? 1f : 0.22f;
        if ("bars".equals(style)) {
            int n = 44;
            float bw = (float) w / n;
            for (int i = 0; i < n; i++) {
                float lv = playing ? ease(i, level(i, n)) : 0.04f;
                float bh = Math.max(h * 0.02f, lv * h * 0.8f * idle + h * 0.02f);
                float x = i * bw + bw * 0.2f;
                canvas.drawRoundRect(x, h - bh, x + bw * 0.6f, h, bw * 0.3f, bw * 0.3f, paint);
            }
        } else if ("wave".equals(style)) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(2f, h * 0.007f));
            paint.setAlpha(playing ? 235 : 90);
            path.reset();
            float amp = playing ? 0.03f + 0.2f * (float) Math.pow(0.5 + 0.5 * Math.sin(phase * 3.05 + seed * 6.283), 2) : 0.012f;
            for (int x = 0; x <= w; x += 3) {
                double v = Math.sin((double) x / w * 21 + phase * 3.1) * amp
                    * (0.55 + 0.45 * Math.sin((double) x / w * 4.7 + phase * 0.8));
                float y = h / 2f + (float) v * h * 0.42f;
                if (x == 0) path.moveTo(x, y);
                else path.lineTo(x, y);
            }
            canvas.drawPath(path, paint);
            paint.setAlpha(255);
        } else if ("radial".equals(style)) {
            int n = 72;
            float cx = w / 2f, cy = h / 2f, r0 = Math.min(w, h) * 0.26f;
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(Math.max(2f, Math.min(w, h) * 0.006f));
            for (int i = 0; i < n; i++) {
                float lv = playing ? ease(i, level(i < n / 2 ? i : n - i, n / 2)) : 0.02f;
                double a = (double) i / n * 6.283 - 1.5708 + phase * 0.15;
                float len = 4f + lv * r0 * 1.15f * idle;
                canvas.drawLine(
                    cx + (float) Math.cos(a) * r0,
                    cy + (float) Math.sin(a) * r0,
                    cx + (float) Math.cos(a) * (r0 + len),
                    cy + (float) Math.sin(a) * (r0 + len), paint);
            }
        } else {
            int cols = 34, rows = 11;
            float cell = Math.min((float) w / cols, (float) h / rows);
            float ox = (w - cell * cols) / 2f, oy = (h - cell * rows) / 2f, r = cell * 0.3f;
            int dim = (accent & 0x00FFFFFF) | 0x33000000;
            for (int x = 0; x < cols; x++) {
                int lit = playing ? Math.round(ease(x, level(x, cols)) * rows) : 0;
                for (int y = 0; y < rows; y++) {
                    boolean on = y >= rows - lit;
                    paint.setColor(on ? color : dim);
                    float cx = ox + x * cell + cell / 2f, cy = oy + y * cell + cell / 2f;
                    canvas.drawCircle(cx, cy, on ? r * 1.08f : r * 0.62f, paint);
                }
            }
        }

        if (playing) postInvalidateOnAnimation();
    }
}
