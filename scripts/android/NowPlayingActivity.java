package app.wavelength.music;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import java.io.File;
import java.util.Locale;

/**
 * Brief full-screen now-playing view for the lock screen.
 *
 * PlaybackService asks Android to show this over the keyguard when the screen
 * turns off during playback. It shows artwork, song details and the visualizer,
 * then fades out on its own so unlocking still lands on the normal lock screen.
 */
public class NowPlayingActivity extends Activity {
    private static final long HIDE_AFTER_MS = 9000;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private ImageView backdrop;
    private ImageView art;
    private VizView viz;
    private TextView title, artist, album, elapsed, total, hint, eyebrow;
    private ImageButton play;
    private ProgressBar progress;

    private String shownKey = "";
    private boolean appliedArt = false;
    private boolean hiding = false;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            apply(PlaybackService.snapshot(NowPlayingActivity.this));
            handler.postDelayed(this, 700);
        }
    };

    private final Runnable hide = new Runnable() {
        @Override
        public void run() {
            if (isFinishing() || hiding) return;
            hiding = true;
            root.animate().alpha(0f).setDuration(600).withEndAction(NowPlayingActivity.this::finish).start();
        }
    };

    private final Runnable pauseFinish = new Runnable() {
        @Override
        public void run() {
            if (!isFinishing() && !isChangingConfigurations() && !hiding) finish();
        }
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        root = buildUi();
        setContentView(root);
        apply(PlaybackService.snapshot(this));
        handler.post(tick);
        handler.postDelayed(hide, HIDE_AFTER_MS);
    }

    @Override
    protected void onResume() {
        super.onResume();
        handler.removeCallbacks(pauseFinish);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Do not keep an activity alive over the lock screen once the user has
        // moved on (unlocked, switched apps or answered a call).
        if (!isChangingConfigurations() && !hiding) handler.postDelayed(pauseFinish, 900);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void bump() {
        if (hiding) return;
        handler.removeCallbacks(hide);
        handler.postDelayed(hide, HIDE_AFTER_MS);
    }

    private void apply(PlaybackService.Snapshot s) {
        SharedPreferences prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
        String style = prefs.getString("viz_style", "matrix");
        String accent = prefs.getString("viz_accent", "#cba6f7");
        boolean vizOn = prefs.getBoolean("viz_enabled", true);
        viz.setVisibility(vizOn ? View.VISIBLE : View.GONE);
        viz.setStyle(style);
        viz.setAccent(accent);
        viz.setPlaying(s.playing && vizOn);

        String key = s.title + "\u0000" + s.artist;
        boolean changed = !key.equals(shownKey);
        if (changed) {
            shownKey = key;
            title.setText(s.title.isEmpty() ? "Wavelength" : s.title);
            artist.setText(s.artist.isEmpty() ? "Lock-screen now playing" : s.artist);
            album.setText(s.album.isEmpty() ? "" : s.album);
            album.setVisibility(s.album.isEmpty() ? View.GONE : View.VISIBLE);
            viz.setSeed(s.title + " " + s.artist);
        }
        if ((changed || !appliedArt)) {
            Bitmap bitmap = s.art != null ? s.art : decodeArt();
            if (bitmap != null) {
                art.setImageBitmap(round(bitmap, 512));
                backdrop.setImageBitmap(soften(bitmap));
                art.setVisibility(View.VISIBLE);
                appliedArt = true;
            } else if (changed) {
                art.setImageResource(R.mipmap.ic_launcher);
                backdrop.setImageDrawable(null);
            }
        }

        play.setImageResource(s.playing
            ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        play.setContentDescription(s.playing ? "Pause" : "Play");
        eyebrow.setText(s.playing ? "Wavelength · playing" : "Wavelength · paused");
        long dur = s.duration;
        long pos = Math.min(s.position, dur > 0 ? dur : s.position);
        progress.setProgress(dur > 0 ? (int) Math.min(1000, pos * 1000 / dur) : 0);
        elapsed.setText(clock(pos));
        total.setText(dur > 0 ? clock(dur) : "--:--");
    }

    private static String clock(long ms) {
        long sec = Math.max(0, ms / 1000);
        return String.format(Locale.US, "%d:%02d", sec / 60, sec % 60);
    }

    private Bitmap decodeArt() {
        File file = PlaybackService.artFile(this);
        if (!file.exists()) return null;
        try {
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = 2;
            return BitmapFactory.decodeFile(file.getPath(), opts);
        } catch (Exception e) {
            return null;
        }
    }

    /** Background copy: softened by downscaling, then covered by the scrim. */
    private Bitmap soften(Bitmap src) {
        try {
            int w = Math.max(12, src.getWidth() / 22);
            int h = Math.max(12, src.getHeight() / 22);
            Bitmap small = Bitmap.createScaledBitmap(src, w, h, true);
            return Bitmap.createScaledBitmap(small, Math.max(2, src.getWidth() / 2),
                Math.max(2, src.getHeight() / 2), true);
        } catch (Exception e) {
            return src;
        }
    }

    private Bitmap round(Bitmap src, int max) {
        int side = Math.min(src.getWidth(), src.getHeight());
        if (side <= 0) return src;
        Bitmap square = Bitmap.createBitmap(src, (src.getWidth() - side) / 2,
            (src.getHeight() - side) / 2, side, side);
        int out = Math.min(max, side);
        Bitmap scaled = Bitmap.createScaledBitmap(square, out, out, true);
        Bitmap rounded = Bitmap.createBitmap(out, out, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(rounded);
        android.graphics.Paint paint = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new android.graphics.BitmapShader(scaled,
            android.graphics.Shader.TileMode.CLAMP, android.graphics.Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new android.graphics.RectF(0, 0, out, out), out * 0.14f, out * 0.14f, paint);
        return rounded;
    }

    private FrameLayout buildUi() {
        FrameLayout frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.BLACK);
        frame.setOnClickListener(v -> bump());

        backdrop = new ImageView(this);
        backdrop.setScaleType(ImageView.ScaleType.CENTER_CROP);
        backdrop.setAlpha(0.5f);
        frame.addView(backdrop, new FrameLayout.LayoutParams(-1, -1));

        View scrim = new View(this);
        GradientDrawable gradient = new GradientDrawable(
            GradientDrawable.Orientation.BOTTOM_TOP,
            new int[]{0xF2000000, 0x99000000, 0xCC000000});
        scrim.setBackground(gradient);
        frame.addView(scrim, new FrameLayout.LayoutParams(-1, -1));

        viz = new VizView(this);
        frame.addView(viz, new FrameLayout.LayoutParams(-1, -1));

        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        column.setPadding(dp(28), dp(32), dp(28), dp(26));
        FrameLayout.LayoutParams colParams = new FrameLayout.LayoutParams(-1, -1);
        colParams.gravity = Gravity.CENTER;
        frame.addView(column, colParams);

        eyebrow = text("Wavelength · playing", 10, 0xB3FFFFFF);
        eyebrow.setLetterSpacing(0.18f);
        eyebrow.setGravity(Gravity.CENTER);
        column.addView(eyebrow);

        art = new ImageView(this);
        art.setScaleType(ImageView.ScaleType.CENTER_CROP);
        LinearLayout.LayoutParams artParams = new LinearLayout.LayoutParams(dp(196), dp(196));
        artParams.topMargin = dp(18);
        artParams.bottomMargin = dp(18);
        column.addView(art, artParams);
        if (Build.VERSION.SDK_INT >= 21) art.setElevation(dp(14));

        title = text("Nothing playing", 24, Color.WHITE);
        title.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        title.setGravity(Gravity.CENTER);
        title.setMaxLines(2);
        column.addView(title, new LinearLayout.LayoutParams(-1, -2));

        artist = text("", 14, 0xCCFFFFFF);
        artist.setGravity(Gravity.CENTER);
        artist.setMaxLines(1);
        LinearLayout.LayoutParams artistParams = new LinearLayout.LayoutParams(-1, -2);
        artistParams.topMargin = dp(4);
        column.addView(artist, artistParams);

        album = text("", 12, 0x99FFFFFF);
        album.setGravity(Gravity.CENTER);
        album.setMaxLines(1);
        LinearLayout.LayoutParams albumParams = new LinearLayout.LayoutParams(-1, -2);
        albumParams.topMargin = dp(2);
        column.addView(album, albumParams);

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(1000);
        int accentColor = prefsAccent();
        progress.setProgressTintList(ColorStateList.valueOf(accentColor));
        progress.setProgressBackgroundTintList(ColorStateList.valueOf(0x33FFFFFF));
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(-1, dp(3));
        progressParams.topMargin = dp(20);
        progressParams.leftMargin = dp(6);
        progressParams.rightMargin = dp(6);
        column.addView(progress, progressParams);

        LinearLayout times = new LinearLayout(this);
        times.setOrientation(LinearLayout.HORIZONTAL);
        elapsed = text("0:00", 11, 0x99FFFFFF);
        total = text("--:--", 11, 0x99FFFFFF);
        LinearLayout.LayoutParams side = new LinearLayout.LayoutParams(0, -2, 1f);
        times.addView(elapsed, side);
        LinearLayout.LayoutParams side2 = new LinearLayout.LayoutParams(0, -2, 1f);
        side2.gravity = Gravity.END;
        total.setGravity(Gravity.END);
        times.addView(total, side2);
        column.addView(times);

        LinearLayout controls = new LinearLayout(this);
        controls.setOrientation(LinearLayout.HORIZONTAL);
        controls.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams ctlParams = new LinearLayout.LayoutParams(-1, -2);
        ctlParams.topMargin = dp(14);
        column.addView(controls, ctlParams);

        ImageButton prev = iconButton(android.R.drawable.ic_media_previous, dp(56), "Previous");
        prev.setOnClickListener(v -> { command("prev"); });
        controls.addView(prev);
        play = iconButton(android.R.drawable.ic_media_play, dp(64), "Play");
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(0x22FFFFFF);
        play.setBackground(circle);
        play.setOnClickListener(v -> { command("playpause"); });
        LinearLayout.LayoutParams playParams = new LinearLayout.LayoutParams(dp(64), dp(64));
        playParams.leftMargin = dp(18);
        playParams.rightMargin = dp(18);
        controls.addView(play, playParams);
        ImageButton next = iconButton(android.R.drawable.ic_media_next, dp(56), "Next");
        next.setOnClickListener(v -> { command("next"); });
        controls.addView(next);

        hint = text("Tap to keep · hides after a few seconds", 10, 0x66FFFFFF);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(-1, -2);
        hintParams.topMargin = dp(18);
        column.addView(hint, hintParams);

        return frame;
    }

    private int prefsAccent() {
        String hex = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE)
            .getString("viz_accent", "#cba6f7");
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return 0xFFCBA6F7;
        }
    }

    private void command(String cmd) {
        bump();
        String mapped = "playpause".equals(cmd) ? "toggle" : cmd;
        if (!PlaybackService.sendCommand(this, mapped)) {
            try {
                startActivity(new Intent(this, MainActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP));
                finish();
            } catch (Exception ignored) {}
        }
    }

    private TextView text(String value, int sp, int color) {
        TextView v = new TextView(this);
        v.setText(value);
        v.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        v.setTextColor(color);
        return v;
    }

    private ImageButton iconButton(int icon, int size, String label) {
        ImageButton b = new ImageButton(this);
        b.setImageResource(icon);
        b.setColorFilter(Color.WHITE);
        b.setBackgroundColor(Color.TRANSPARENT);
        b.setContentDescription(label);
        b.setLayoutParams(new LinearLayout.LayoutParams(size, size));
        b.setOnClickListener(v -> bump());
        return b;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
