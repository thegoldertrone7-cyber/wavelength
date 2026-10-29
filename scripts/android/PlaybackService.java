package app.wavelength.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Keeps the WebView's audio alive while the screen is off and publishes the
 * current track to Android's media session, which is what lock screens and
 * Bluetooth controls read.
 *
 * Playback itself stays in the WebView. This service owns the notification and
 * MediaSession and forwards transport commands back into the page.
 */
public class PlaybackService extends Service {
    static final String CHANNEL = "wavelength_playback";
    static final String CHANNEL_LOCK = "wavelength_lockscreen";
    static final int NOTIFICATION_ID = 30421;
    static final int LOCK_NOTIFICATION_ID = 30422;
    static final String ACTION_METADATA = "app.wavelength.music.METADATA";
    static final String ACTION_STATE = "app.wavelength.music.STATE";
    static final String ACTION_COMMAND = "app.wavelength.music.COMMAND";
    static final String ACTION_STOP = "app.wavelength.music.STOP";
    static final String EXTRA_JSON = "json";
    static final String EXTRA_PLAYING = "playing";
    static final String EXTRA_POSITION = "position";
    static final String EXTRA_DURATION = "duration";
    static final String EXTRA_COMMAND = "command";
    static final String EXTRA_ARG = "arg";

    /* Snapshot used by the lock-screen view, so it can still draw the last
       track when the service is gone. */
    static final String PREFS_NOW = "wl_now";

    private static PlaybackService instance;

    private MediaSession session;
    private NotificationManager notificationManager;
    private ExecutorService artPool;
    private boolean foreground = false;

    private String title = "";
    private String artist = "";
    private String album = "";
    private String artUrl = "";
    private Bitmap art;
    private boolean playing = false;
    private long position = 0;
    private long duration = 0;

    private String widgetTitle = "";
    private String widgetArtist = "";
    private String widgetAlbum = "";
    private boolean widgetPlaying = false;
    private int artVersion = 0;
    private int widgetArtVersion = -1;
    private boolean noisyRegistered = false;
    private boolean screenRegistered = false;

    /* Android tells us when the active audio route disappears (Bluetooth
       headset off, headphones unplugged). Pause instead of blasting the phone
       speaker. The web UI exposes the same preference; MainActivity mirrors it
       into these prefs. */
    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) return;
            if (!playing) return;
            boolean pause = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE)
                .getBoolean("headphones_pause", true);
            if (pause) send("pause", 0);
        }
    };

    /* Turning the screen off while music plays is the moment the lock-screen
       view is for. A full-screen intent is the only way Android lets a media
       app surface an activity over the keyguard without asking for the
       draw-over-other-apps permission. */
    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) return;
            if (!playing || title.isEmpty()) return;
            SharedPreferences p = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE);
            if (!p.getBoolean("lockscreen_show", true)) return;
            showLockScreen(PlaybackService.this);
        }
    };

    static boolean sendCommand(Context context, String command) {
        PlaybackService svc = instance;
        if (svc == null || command == null) return false;
        // Without a live page there is nothing to control; the widget opens the
        // app instead of silently starting an empty service.
        if (!MainActivity.canReceiveCommands()) return false;
        svc.send(command, 0);
        return true;
    }

    static void pushMetadata(Context context, String json) {
        if (instance != null) {
            instance.setMetadata(json);
            instance.ensureForeground();
            return;
        }
        Intent i = new Intent(context, PlaybackService.class)
            .setAction(ACTION_METADATA)
            .putExtra(EXTRA_JSON, json);
        start(context, i);
    }

    static void pushState(Context context, boolean playing, double position, double duration) {
        if (instance != null) {
            instance.setState(playing, (long) position, (long) duration);
            if (playing) instance.ensureForeground();
            return;
        }
        Intent i = new Intent(context, PlaybackService.class)
            .setAction(ACTION_STATE)
            .putExtra(EXTRA_PLAYING, playing)
            .putExtra(EXTRA_POSITION, (long) position)
            .putExtra(EXTRA_DURATION, (long) duration);
        start(context, i);
    }

    static void stop(Context context) {
        if (instance != null) {
            instance.shutdown();
        } else {
            context.stopService(new Intent(context, PlaybackService.class));
        }
    }

    private static void start(Context context, Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
            else context.startService(intent);
        } catch (Exception ignored) {
            // Starting a foreground service from the background can be refused
            // on newer Android versions. The notification is a convenience; the
            // audio itself is already running in the WebView.
        }
    }

    /** Detached copy of what is playing, for the lock-screen activity. */
    static final class Snapshot {
        final String title;
        final String artist;
        final String album;
        final boolean playing;
        final long position;
        final long duration;
        final Bitmap art;

        Snapshot(String title, String artist, String album, boolean playing,
                 long position, long duration, Bitmap art) {
            this.title = title == null ? "" : title;
            this.artist = artist == null ? "" : artist;
            this.album = album == null ? "" : album;
            this.playing = playing;
            this.position = Math.max(0, position);
            this.duration = Math.max(0, duration);
            this.art = art;
        }
    }

    static Snapshot snapshot(Context context) {
        PlaybackService s = instance;
        if (s != null) {
            return new Snapshot(s.title, s.artist, s.album, s.playing, s.position, s.duration, s.art);
        }
        SharedPreferences p = context.getSharedPreferences(PREFS_NOW, Context.MODE_PRIVATE);
        return new Snapshot(
            p.getString("title", ""),
            p.getString("artist", ""),
            p.getString("album", ""),
            p.getBoolean("playing", false),
            p.getLong("position", 0),
            p.getLong("duration", 0),
            null);
    }

    static File artFile(Context context) {
        return new File(context.getFilesDir(), WavelengthWidget.ART_FILE);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        artPool = Executors.newSingleThreadExecutor();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createChannel();
        createLockChannel();
        session = new MediaSession(this, "Wavelength");
        session.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
            | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setSessionActivity(contentIntent());
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { send("play", 0); }
            @Override public void onPause() { send("pause", 0); }
            @Override public void onStop() { send("pause", 0); }
            @Override public void onSkipToNext() { send("next", 0); }
            @Override public void onSkipToPrevious() { send("prev", 0); }
            @Override public void onSeekTo(long pos) { send("seek", pos); }
        });
        session.setActive(true);
        try {
            registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
            noisyRegistered = true;
        } catch (Exception ignored) {}
        try {
            registerReceiver(screenReceiver, new IntentFilter(Intent.ACTION_SCREEN_OFF));
            screenRegistered = true;
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_METADATA.equals(action)) {
                setMetadata(intent.getStringExtra(EXTRA_JSON));
                ensureForeground();
            } else if (ACTION_STATE.equals(action)) {
                setState(intent.getBooleanExtra(EXTRA_PLAYING, false),
                    intent.getLongExtra(EXTRA_POSITION, 0),
                    intent.getLongExtra(EXTRA_DURATION, 0));
                ensureForeground();
            } else if (ACTION_COMMAND.equals(action)) {
                send(intent.getStringExtra(EXTRA_COMMAND), intent.getDoubleExtra(EXTRA_ARG, 0));
            } else if (ACTION_STOP.equals(action)) {
                shutdown();
            }
        }
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (instance == this) instance = null;
        if (noisyRegistered) {
            try { unregisterReceiver(noisyReceiver); } catch (Exception ignored) {}
            noisyRegistered = false;
        }
        if (screenRegistered) {
            try { unregisterReceiver(screenReceiver); } catch (Exception ignored) {}
            screenRegistered = false;
        }
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        if (artPool != null) artPool.shutdownNow();
        super.onDestroy();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26 || notificationManager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL, "Playback", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Lock-screen and Bluetooth playback controls");
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(channel);
    }

    private void createLockChannel() {
        if (Build.VERSION.SDK_INT < 26 || notificationManager == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_LOCK, "Lock-screen now playing", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Briefly shows the current song over the lock screen");
        channel.setShowBadge(false);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setSound(null, null);
        channel.enableVibration(false);
        notificationManager.createNotificationChannel(channel);
    }

    private void setMetadata(String json) {
        if (json == null || json.isEmpty()) return;
        try {
            JSONObject o = new JSONObject(json);
            String nextTitle = o.optString("title", "");
            String nextArtist = o.optString("artist", "");
            String nextAlbum = o.optString("album", "Wavelength");
            String nextArt = o.optString("art", "");
            boolean artChanged = !nextArt.equals(artUrl);
            title = nextTitle;
            artist = nextArtist;
            album = nextAlbum.isEmpty() ? "Wavelength" : nextAlbum;
            artUrl = nextArt;
            if (artChanged) {
                art = null;
                artVersion++;
                loadArt(nextArt);
            }
            applyMetadata();
            updateNotification();
            publishWidget();
        } catch (Exception ignored) {}
    }

    private void setState(boolean isPlaying, long pos, long dur) {
        playing = isPlaying;
        position = Math.max(0, pos);
        duration = Math.max(0, dur);
        if (session != null) {
            PlaybackState.Builder b = new PlaybackState.Builder()
                .setActions(PlaybackState.ACTION_PLAY
                    | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE
                    | PlaybackState.ACTION_STOP
                    | PlaybackState.ACTION_SEEK_TO
                    | PlaybackState.ACTION_SKIP_TO_NEXT
                    | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
                .setState(isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                    position,
                    isPlaying ? 1f : 0f,
                    SystemClock.elapsedRealtime());
            if (duration > 0) b.setBufferedPosition(duration);
            session.setPlaybackState(b.build());
            session.setActive(true);
        }
        if (!playing && notificationManager != null) {
            notificationManager.cancel(LOCK_NOTIFICATION_ID);
        }
        updateNotification();
        publishWidget();
    }

    /* The widget shows title, artist, album and play state, so avoid redraws on
       every one-second position update. Artwork arrival forces one redraw. */
    private void publishWidget() {
        if (title.equals(widgetTitle) && artist.equals(widgetArtist)
            && album.equals(widgetAlbum) && playing == widgetPlaying
            && artVersion == widgetArtVersion) {
            saveNowSnapshot();
            return;
        }
        widgetTitle = title;
        widgetArtist = artist;
        widgetAlbum = album;
        widgetPlaying = playing;
        widgetArtVersion = artVersion;
        WavelengthWidget.publish(this, title, artist, album, playing);
        saveNowSnapshot();
    }

    private void saveNowSnapshot() {
        try {
            getSharedPreferences(PREFS_NOW, MODE_PRIVATE).edit()
                .putString("title", title)
                .putString("artist", artist)
                .putString("album", album)
                .putBoolean("playing", playing)
                .putLong("position", position)
                .putLong("duration", duration)
                .apply();
        } catch (Exception ignored) {}
    }

    private void applyMetadata() {
        if (session == null) return;
        MediaMetadata.Builder b = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title.isEmpty() ? "Wavelength" : title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, duration);
        if (!artUrl.isEmpty()) {
            b.putString(MediaMetadata.METADATA_KEY_ART_URI, artUrl);
            b.putString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI, artUrl);
        }
        if (art != null) {
            b.putBitmap(MediaMetadata.METADATA_KEY_ART, art);
            b.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
            b.putBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON, art);
        }
        session.setMetadata(b.build());
    }

    private void loadArt(String url) {
        if (url == null || url.isEmpty() || artPool == null) return;
        final String wanted = url;
        artPool.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(wanted).openConnection();
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(8000);
                conn.setRequestProperty("User-Agent", MainActivity.UA);
                if (conn.getResponseCode() != 200) return;
                Bitmap bitmap = BitmapFactory.decodeStream(conn.getInputStream());
                if (bitmap == null) return;
                if (!wanted.equals(artUrl)) return;
                art = scaleArt(bitmap, 512);
                saveArt(art);
                artVersion++;
                applyMetadata();
                updateNotification();
                publishWidget();
            } catch (Exception ignored) {
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    /* The widget and the lock-screen view read this file, so artwork survives a
       process restart and never has to be downloaded twice. */
    private void saveArt(Bitmap bitmap) {
        if (bitmap == null) return;
        File file = artFile(this);
        File tmp = new File(file.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out);
            out.flush();
        } catch (Exception ignored) {
            tmp.delete();
            return;
        }
        if (!tmp.renameTo(file)) {
            try (FileOutputStream out = new FileOutputStream(file)) {
                bitmap.compress(Bitmap.CompressFormat.JPEG, 88, out);
            } catch (Exception ignored) {}
            tmp.delete();
        }
    }

    private static Bitmap scaleArt(Bitmap src, int max) {
        int w = src.getWidth(), h = src.getHeight();
        if (w <= 0 || h <= 0) return src;
        float scale = Math.min(1f, (float) max / Math.max(w, h));
        if (scale >= 1f) return src;
        return Bitmap.createScaledBitmap(src, Math.max(1, Math.round(w * scale)),
            Math.max(1, Math.round(h * scale)), true);
    }

    private void ensureForeground() {
        if (foreground) {
            updateNotification();
            return;
        }
        Notification n = buildNotification();
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
            foreground = true;
        } catch (Exception ignored) {}
    }

    private void updateNotification() {
        if (notificationManager == null) return;
        Notification n = buildNotification();
        if (foreground) notificationManager.notify(NOTIFICATION_ID, n);
        else if (playing) ensureForeground();
    }

    private Notification buildNotification() {
        int playIcon = playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playLabel = playing ? "Pause" : "Play";
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(this, CHANNEL);
        else b = new Notification.Builder(this);
        b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title.isEmpty() ? "Wavelength" : title)
            .setContentText(artist)
            .setContentIntent(contentIntent())
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(playing)
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_previous, "Previous", commandIntent("prev", 1)).build())
            .addAction(new Notification.Action.Builder(playIcon, playLabel,
                commandIntent(playing ? "pause" : "play", 2)).build())
            .addAction(new Notification.Action.Builder(
                android.R.drawable.ic_media_next, "Next", commandIntent("next", 3)).build())
            .setStyle(new Notification.MediaStyle()
                .setMediaSession(session == null ? null : session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        if (art != null) b.setLargeIcon(art);
        return b.build();
    }

    /* Full-screen reminder: shows artwork, title and the visualizer over the
       lock screen for a few seconds after the screen goes off. */
    private void showLockScreen(Context context) {
        if (notificationManager == null) return;
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) b = new Notification.Builder(context, CHANNEL_LOCK);
        else b = new Notification.Builder(context);
        b.setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title.isEmpty() ? "Wavelength" : title)
            .setContentText(artist.isEmpty() ? album : artist + " · " + album)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setOnlyAlertOnce(true)
            .setAutoCancel(true)
            .setContentIntent(contentIntent())
            .setFullScreenIntent(nowPlayingIntent(), true)
            .setTimeoutAfter(12000);
        if (art != null) b.setLargeIcon(art);
        try {
            notificationManager.notify(LOCK_NOTIFICATION_ID, b.build());
        } catch (Exception ignored) {}
    }

    private PendingIntent nowPlayingIntent() {
        Intent i = new Intent(this, NowPlayingActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 31, i, flags);
    }

    private PendingIntent contentIntent() {
        Intent i = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(this, 20, i, flags);
    }

    private PendingIntent commandIntent(String command, int request) {
        Intent i = new Intent(this, PlaybackService.class)
            .setAction(ACTION_COMMAND)
            .putExtra(EXTRA_COMMAND, command)
            .putExtra(EXTRA_ARG, 0d);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, request, i, flags);
    }

    private void send(String command, double arg) {
        if (command == null) return;
        MainActivity.sendNativeCommand(command, arg);
    }

    private void shutdown() {
        playing = false;
        widgetTitle = "";
        widgetArtist = "";
        widgetAlbum = "";
        widgetPlaying = false;
        widgetArtVersion = -1;
        artVersion++;
        WavelengthWidget.clear(this);
        if (notificationManager != null) notificationManager.cancel(LOCK_NOTIFICATION_ID);
        if (session != null) {
            session.setActive(false);
        }
        if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        stopSelf();
    }
}
