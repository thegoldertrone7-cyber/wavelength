package app.wavelength.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;

/**
 * Home-screen widget for the current track.
 *
 * Playback lives in the WebView, so the widget never tries to own a player of
 * its own. PlaybackService publishes title/artist/album/state here, and the
 * buttons forward transport commands through the live service.
 *
 * Behaviour worth knowing about:
 *  - Two layouts. Tall widgets get the full card (artwork, text, progress, four
 *    buttons); short ones get a compact strip. The choice follows the size the
 *    launcher reports, so resizing just works.
 *  - The play button is drawn in the app's accent colour.
 *  - Progress is refreshed with partial updates every few seconds while playing,
 *    which is cheap and avoids re-sending the artwork.
 *  - If the app process is gone, Play starts Wavelength and resumes the last
 *    session instead of doing nothing.
 */
public class WavelengthWidget extends AppWidgetProvider {
    static final String ACTION_CONTROL = "app.wavelength.music.WIDGET_CONTROL";
    static final String EXTRA_COMMAND = "command";
    static final String PREFS = "wl_widget";
    static final String ART_FILE = "widget_art.jpg";

    /* Below this many dp of height the compact strip is used. The full card
       needs roughly 165dp. */
    private static final int COMPACT_BELOW_DP = 150;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context, manager, id));
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                          int id, Bundle options) {
        manager.updateAppWidget(id, build(context, manager, id));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_CONTROL.equals(action)) {
            String cmd = intent.getStringExtra(EXTRA_COMMAND);
            if (cmd != null) dispatch(context, cmd);
            return;
        }
        super.onReceive(context, intent);
    }

    static void publish(Context context, String title, String artist, String album,
                        boolean playing, boolean liked) {
        try {
            prefs(context).edit()
                .putString("title", title == null ? "" : title)
                .putString("artist", artist == null ? "" : artist)
                .putString("album", album == null ? "" : album)
                .putBoolean("playing", playing)
                .putBoolean("liked", liked)
                .apply();
        } catch (Exception ignored) {}
        refresh(context);
    }

    static void clear(Context context) {
        try {
            prefs(context).edit()
                .putString("title", "")
                .putString("artist", "")
                .putString("album", "")
                .putBoolean("playing", false)
                .putBoolean("liked", false)
                .putLong("pos", 0)
                .putLong("dur", 0)
                .apply();
        } catch (Exception ignored) {}
        File art = new File(context.getFilesDir(), ART_FILE);
        if (art.exists()) art.delete();
        refresh(context);
    }

    /** Lightweight progress refresh: only the bar is touched. Values are milliseconds. */
    static void progress(Context context, long position, long duration) {
        try {
            prefs(context).edit().putLong("pos", position).putLong("dur", duration).apply();
        } catch (Exception ignored) {}
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, WavelengthWidget.class));
            for (int id : ids) {
                RemoteViews v = new RemoteViews(context.getPackageName(), layoutFor(manager, id));
                v.setProgressBar(R.id.widget_progress, 1000, permille(position, duration), false);
                manager.partiallyUpdateAppWidget(id, v);
            }
        } catch (Exception ignored) {}
    }

    static void refresh(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, WavelengthWidget.class));
            for (int id : ids) manager.updateAppWidget(id, build(context, manager, id));
        } catch (Exception ignored) {}
    }

    private static void dispatch(Context context, String command) {
        if (PlaybackService.sendCommand(context, command)) {
            refresh(context);
            return;
        }
        try {
            Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if ("play".equals(command) || "toggle".equals(command)) {
                open.putExtra(MainActivity.EXTRA_LAUNCH_CMD, "play");
            }
            context.startActivity(open);
        } catch (Exception ignored) {}
    }

    private static boolean compact(AppWidgetManager manager, int id) {
        try {
            Bundle o = manager.getAppWidgetOptions(id);
            int minH = o == null ? 0 : o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
            return minH > 0 && minH < COMPACT_BELOW_DP;
        } catch (Exception e) {
            return false;
        }
    }

    private static int layoutFor(AppWidgetManager manager, int id) {
        return compact(manager, id) ? R.layout.wavelength_widget_compact : R.layout.wavelength_widget;
    }

    private static int permille(long position, long duration) {
        if (duration <= 0) return 0;
        return (int) Math.max(0, Math.min(1000, position * 1000L / duration));
    }

    private static RemoteViews build(Context context, AppWidgetManager manager, int id) {
        boolean small = compact(manager, id);
        SharedPreferences s = prefs(context);
        String title = s.getString("title", "");
        String artist = s.getString("artist", "");
        String album = s.getString("album", "");
        boolean liked = s.getBoolean("liked", false);
        /* The saved flag can outlive the process that wrote it, so only trust
           "playing" while the service that would be playing is actually alive. */
        boolean playing = s.getBoolean("playing", false) && PlaybackService.isRunning();
        boolean live = MainActivity.canReceiveCommands();
        int accent = accentColor(context);

        RemoteViews v = new RemoteViews(context.getPackageName(),
            small ? R.layout.wavelength_widget_compact : R.layout.wavelength_widget);
        v.setTextViewText(R.id.widget_title, title.isEmpty() ? "Wavelength" : title);
        v.setTextViewText(R.id.widget_artist,
            title.isEmpty() ? "Tap to open" : (artist.isEmpty() ? "Wavelength" : artist));
        if (!small) {
            if (album.isEmpty() || album.equals("Wavelength")) {
                v.setViewVisibility(R.id.widget_album, View.GONE);
            } else {
                v.setViewVisibility(R.id.widget_album, View.VISIBLE);
                v.setTextViewText(R.id.widget_album, album);
            }
            v.setTextViewText(R.id.widget_state, playing ? "Playing" : "Paused");
            v.setImageViewResource(R.id.widget_like,
                liked ? R.drawable.ic_heart_filled : R.drawable.ic_heart);
            v.setContentDescription(R.id.widget_like, liked ? "Remove from Liked Songs" : "Like song");
            v.setOnClickPendingIntent(R.id.widget_like,
                live ? controlIntent(context, "like", 4) : openIntent(context));
        }

        Bitmap art = loadArt(context);
        if (art != null) v.setImageViewBitmap(R.id.widget_art, art);
        else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher);

        v.setImageViewBitmap(R.id.widget_play, playButton(accent, playing, 128));
        v.setContentDescription(R.id.widget_play, playing ? "Pause" : "Play");
        v.setProgressBar(R.id.widget_progress, 1000,
            permille(s.getLong("pos", 0), s.getLong("dur", 0)), false);

        v.setOnClickPendingIntent(R.id.widget_root, openIntent(context));
        v.setOnClickPendingIntent(R.id.widget_art, openIntent(context));
        if (live) {
            v.setOnClickPendingIntent(R.id.widget_prev, controlIntent(context, "prev", 1));
            v.setOnClickPendingIntent(R.id.widget_play,
                controlIntent(context, playing ? "pause" : "play", 2));
            v.setOnClickPendingIntent(R.id.widget_next, controlIntent(context, "next", 3));
        } else {
            /* No live page: Play opens Wavelength and resumes; the skips just open it. */
            v.setOnClickPendingIntent(R.id.widget_prev, openIntent(context));
            v.setOnClickPendingIntent(R.id.widget_play, launchIntent(context, "play", 42));
            v.setOnClickPendingIntent(R.id.widget_next, openIntent(context));
        }
        return v;
    }

    private static int accentColor(Context context) {
        try {
            String hex = context.getSharedPreferences(MainActivity.PREFS, Context.MODE_PRIVATE)
                .getString("viz_accent", "#d71921");
            return Color.parseColor(hex == null ? "#d71921" : hex);
        } catch (Exception e) {
            return 0xFFD71921;
        }
    }

    /** Round accent-coloured play/pause button, glyph chosen for contrast. */
    private static Bitmap playButton(int accent, boolean playing, int px) {
        Bitmap b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(b);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setStyle(Paint.Style.FILL);
        p.setColor(accent | 0xFF000000);
        c.drawCircle(px / 2f, px / 2f, px / 2f, p);
        double lum = (Color.red(accent) * 299 + Color.green(accent) * 587 + Color.blue(accent) * 114) / 1000.0;
        p.setColor(lum > 150 ? 0xFF000000 : 0xFFFFFFFF);
        if (playing) {
            float r = px * 0.04f;
            c.drawRoundRect(new RectF(px * 0.33f, px * 0.29f, px * 0.45f, px * 0.71f), r, r, p);
            c.drawRoundRect(new RectF(px * 0.55f, px * 0.29f, px * 0.67f, px * 0.71f), r, r, p);
        } else {
            Path tri = new Path();
            tri.moveTo(px * 0.39f, px * 0.27f);
            tri.lineTo(px * 0.39f, px * 0.73f);
            tri.lineTo(px * 0.75f, px * 0.50f);
            tri.close();
            c.drawPath(tri, p);
        }
        return b;
    }

    /** Square, rounded artwork small enough for the RemoteViews binder. */
    private static Bitmap loadArt(Context context) {
        File file = new File(context.getFilesDir(), ART_FILE);
        if (!file.exists()) return null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getPath(), bounds);
            int side = Math.min(bounds.outWidth, bounds.outHeight);
            if (side <= 0) return null;
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = Math.max(1, side / 512);
            Bitmap src = BitmapFactory.decodeFile(file.getPath(), opts);
            if (src == null) return null;
            return round(src, 256);
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap round(Bitmap src, int out) {
        int side = Math.min(src.getWidth(), src.getHeight());
        if (side <= 0) return null;
        Bitmap square = Bitmap.createBitmap(src, (src.getWidth() - side) / 2,
            (src.getHeight() - side) / 2, side, side);
        Bitmap scaled = Bitmap.createScaledBitmap(square, out, out, true);
        Bitmap rounded = Bitmap.createBitmap(out, out, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(rounded);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(0, 0, out, out), out * 0.17f, out * 0.17f, paint);
        return rounded;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static PendingIntent openIntent(Context context) {
        Intent i = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 10, i, flags());
    }

    /** Opens Wavelength and asks the page to run a command once it is ready. */
    private static PendingIntent launchIntent(Context context, String command, int request) {
        Intent i = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(MainActivity.EXTRA_LAUNCH_CMD, command);
        return PendingIntent.getActivity(context, request, i, flags());
    }

    private static PendingIntent controlIntent(Context context, String command, int request) {
        Intent i = new Intent(context, WavelengthWidget.class)
            .setAction(ACTION_CONTROL)
            .putExtra(EXTRA_COMMAND, command);
        return PendingIntent.getBroadcast(context, request, i, flags());
    }

    private static int flags() {
        int f = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) f |= PendingIntent.FLAG_IMMUTABLE;
        return f;
    }
}
