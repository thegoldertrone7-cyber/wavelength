package app.wavelength.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.widget.RemoteViews;

/**
 * Home-screen widget for the current track.
 *
 * Playback lives in the WebView, so the widget never tries to own a player of
 * its own. PlaybackService publishes title/artist/state here, and the buttons
 * forward transport commands through the live service. If the app process has
 * no live page, a button opens Wavelength instead of pretending to play.
 */
public class WavelengthWidget extends AppWidgetProvider {
    static final String ACTION_CONTROL = "app.wavelength.music.WIDGET_CONTROL";
    static final String EXTRA_COMMAND = "command";
    static final String PREFS = "wl_widget";

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

    static void publish(Context context, String title, String artist, boolean playing) {
        try {
            prefs(context).edit()
                .putString("title", title == null ? "" : title)
                .putString("artist", artist == null ? "" : artist)
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
                .putBoolean("playing", false)
                .apply();
        } catch (Exception ignored) {}
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
        boolean playing = s.getBoolean("playing", false);

        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.wavelength_widget);
        v.setTextViewText(R.id.widget_title, title.isEmpty() ? "Wavelength" : title);
        v.setTextViewText(R.id.widget_artist,
            title.isEmpty() ? "Tap to open" : (artist.isEmpty() ? "Wavelength" : artist));
        v.setImageViewResource(R.id.widget_play,
            playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
        v.setContentDescription(R.id.widget_play, playing ? "Pause" : "Play");
        v.setOnClickPendingIntent(R.id.widget_root, openIntent(context));
        v.setOnClickPendingIntent(R.id.widget_prev, controlIntent(context, "prev", 1));
        v.setOnClickPendingIntent(R.id.widget_play,
            controlIntent(context, playing ? "pause" : "play", 2));
        v.setOnClickPendingIntent(R.id.widget_next, controlIntent(context, "next", 3));
        return v;
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
