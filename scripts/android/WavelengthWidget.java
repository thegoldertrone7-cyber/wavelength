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
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;

/**
 * Home-screen widget for the current track.
 *
 * Playback lives in the WebView, so the widget never tries to own a player of
 * its own. PlaybackService publishes title/artist/album/state here, and the
 * buttons forward transport commands through the live service. If the app
 * process has no live page, a button opens Wavelength instead of pretending
 * to play.
 */
public class WavelengthWidget extends AppWidgetProvider {
    static final String ACTION_CONTROL = "app.wavelength.music.WIDGET_CONTROL";
    static final String EXTRA_COMMAND = "command";
    static final String PREFS = "wl_widget";
    static final String ART_FILE = "widget_art.jpg";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context));
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

    static void publish(Context context, String title, String artist, String album, boolean playing) {
        try {
            prefs(context).edit()
                .putString("title", title == null ? "" : title)
                .putString("artist", artist == null ? "" : artist)
                .putString("album", album == null ? "" : album)
                .putBoolean("playing", playing)
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
                .apply();
        } catch (Exception ignored) {}
        File art = new File(context.getFilesDir(), ART_FILE);
        if (art.exists()) art.delete();
        refresh(context);
    }

    static void refresh(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, WavelengthWidget.class));
            for (int id : ids) manager.updateAppWidget(id, build(context));
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
            context.startActivity(open);
        } catch (Exception ignored) {}
    }

    private static RemoteViews build(Context context) {
        SharedPreferences s = prefs(context);
        String title = s.getString("title", "");
        String artist = s.getString("artist", "");
        String album = s.getString("album", "");
        boolean playing = s.getBoolean("playing", false);

        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.wavelength_widget);
        v.setTextViewText(R.id.widget_title, title.isEmpty() ? "Wavelength" : title);
        v.setTextViewText(R.id.widget_artist,
            title.isEmpty() ? "Tap to open" : (artist.isEmpty() ? "Wavelength" : artist));
        if (album.isEmpty() || album.equals("Wavelength")) {
            v.setViewVisibility(R.id.widget_album, View.GONE);
        } else {
            v.setViewVisibility(R.id.widget_album, View.VISIBLE);
            v.setTextViewText(R.id.widget_album, album);
        }
        Bitmap art = loadArt(context);
        if (art != null) v.setImageViewBitmap(R.id.widget_art, art);
        else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher);

        v.setImageViewResource(R.id.widget_play,
            playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        v.setContentDescription(R.id.widget_play, playing ? "Pause" : "Play");
        v.setTextViewText(R.id.widget_state, playing ? "Playing" : "Paused");
        v.setOnClickPendingIntent(R.id.widget_root, openIntent(context));
        v.setOnClickPendingIntent(R.id.widget_art, openIntent(context));
        v.setOnClickPendingIntent(R.id.widget_prev, controlIntent(context, "prev", 1));
        v.setOnClickPendingIntent(R.id.widget_play,
            controlIntent(context, playing ? "pause" : "play", 2));
        v.setOnClickPendingIntent(R.id.widget_next, controlIntent(context, "next", 3));
        return v;
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
