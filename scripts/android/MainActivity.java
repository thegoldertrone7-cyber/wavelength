package app.wavelength.music;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.InfoItem;
import org.schabi.newpipe.extractor.MediaFormat;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.ServiceList;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.search.SearchInfo;
import org.schabi.newpipe.extractor.stream.AudioStream;
import org.schabi.newpipe.extractor.stream.StreamInfo;
import org.schabi.newpipe.extractor.stream.StreamInfoItem;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

/**
 * Standalone Wavelength for Android.
 *
 * The app serves the existing Wavelength interface from the APK, keeps its
 * library on the phone, and talks to YouTube through NewPipeExtractor. A
 * computer is only needed when the user explicitly syncs a library.
 */
public class MainActivity extends AppCompatActivity {
    static final String PREFS = "wl";
    static final String KEY_SERVER = "server_url";
    static final String KEY_SYNC_URL = "sync_url";
    static final String KEY_SYNC_CODE = "sync_code";
    static final String KEY_SYNC_PEER = "sync_peer";
    static final String KEY_SYNC_LAST = "sync_last";
    static final String KEY_SYNC_REV = "sync_rev";
    static final String START_URL = "https://appassets.androidplatform.net/assets/public/index.html";
    static final String UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 "
        + "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

    private static final Object STATE_LOCK = new Object();
    private static final Pattern YT_ID = Pattern.compile(
        "(?:[?&]v=|/shorts/|/embed/|youtu\\.be/|/watch/)([A-Za-z0-9_-]{11})");
    private static final Pattern BAD_TITLE = Pattern.compile(
        "(?i)\\b(live|cover|remix|karaoke|reaction|instrumental|sped up|slowed|nightcore|8d|tutorial|lesson|mashup)\\b");

    private WebView wv;
    private WebViewAssetLoader assetLoader;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private final Map<String, CacheEntry> searchCache = new ConcurrentHashMap<>();
    private final Map<String, CacheEntry> streamCache = new ConcurrentHashMap<>();
    private SharedPreferences prefs;
    private File stateFile;
    private boolean pageReady = false;
    private String pendingShare = null;
    private static MainActivity current = null;

    private static final class CacheEntry {
        final long at = System.currentTimeMillis();
        final String value;
        CacheEntry(String value) { this.value = value; }
        boolean fresh(long ttl) { return System.currentTimeMillis() - at < ttl; }
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        current = this;
        prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        stateFile = new File(getFilesDir(), "state.json");
        ensureNewPipe();
        requestNotificationPermission();
        buildWebView();
        setContentView(wv, new ViewGroup.LayoutParams(-1, -1));
        pendingShare = shareTarget(getIntent());
        wv.loadUrl(START_URL);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33
            && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            && !prefs.getBoolean("asked_notifications", false)) {
            prefs.edit().putBoolean("asked_notifications", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 7);
        }
    }

    private void buildWebView() {
        wv = new WebView(this);
        wv.setBackgroundColor(0xFF000000);
        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        ws.setUserAgentString(UA);
        if (Build.VERSION.SDK_INT >= 26) ws.setSafeBrowsingEnabled(false);
        wv.setWebChromeClient(new WebChromeClient());
        wv.addJavascriptInterface(new Bridge(), "AndroidBridge");

        assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        wv.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                pageReady = true;
                applyPendingShare();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternal(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternal(Uri.parse(url));
            }

            private boolean openExternal(Uri uri) {
                if (uri == null) return false;
                String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
                String host = uri.getHost() == null ? "" : uri.getHost();
                if (host.equals("appassets.androidplatform.net")) return false;
                if ("http".equals(scheme) || "https".equals(scheme)) {
                    // The only ordinary links in the interface are Spotify's
                    // sign-in route and external song links. Keep the app's own
                    // origin inside the app and hand everything else to Android.
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {}
                    return true;
                }
                return false;
            }
        });
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
    }

    /* ── lifecycle / sharing ────────────────────────────────────────── */

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        pendingShare = shareTarget(intent);
        applyPendingShare();
    }

    private static String shareTarget(Intent intent) {
        if (intent == null) return null;
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            return text == null ? null : text.toString();
        }
        if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            return intent.getData().toString();
        }
        return null;
    }

    private void applyPendingShare() {
        if (!pageReady || pendingShare == null || wv == null) return;
        String text = pendingShare;
        pendingShare = null;
        String js = "location.hash=" + JSONObject.quote("#share/" + Uri.encode(text)) + ";";
        wv.evaluateJavascript(js, null);
    }

    @Override
    public void onBackPressed() {
        if (wv != null && wv.canGoBack()) wv.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (current == this) current = null;
        if (isFinishing()) PlaybackService.stop(this);
        if (wv != null) {
            wv.stopLoading();
            wv.destroy();
        }
        io.shutdownNow();
        super.onDestroy();
    }

    static void sendNativeCommand(String cmd, double arg) {
        MainActivity a = current;
        if (a == null || a.wv == null) return;
        a.runOnUiThread(() -> a.wv.evaluateJavascript(
            "window.wlNativeCmd&&window.wlNativeCmd(" + JSONObject.quote(cmd) + "," + arg + ")",
            null));
    }

    /* ── bridge ─────────────────────────────────────────────────────── */

    class Bridge {
        @JavascriptInterface
        public void request(String id, String method, String path, String body) {
            io.execute(() -> {
                boolean ok = true;
                String data = null;
                String error = null;
                try {
                    data = handleApi(method == null ? "GET" : method, path == null ? "/" : path,
                        body == null ? "" : body);
                } catch (Exception e) {
                    ok = false;
                    error = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                }
                final boolean fok = ok;
                final String fdata = data;
                final String ferror = error;
                main.post(() -> {
                    if (wv == null) return;
                    String js = "window.wlNativeResult(" + JSONObject.quote(id) + ","
                        + (fok ? "true" : "false") + ","
                        + (fdata == null ? "null" : JSONObject.quote(fdata)) + ","
                        + (ferror == null ? "null" : JSONObject.quote(ferror)) + ");";
                    wv.evaluateJavascript(js, null);
                });
            });
        }

        @JavascriptInterface
        public void setMediaMetadata(String json) {
            PlaybackService.pushMetadata(MainActivity.this, json);
        }

        @JavascriptInterface
        public void setPlaybackState(boolean playing, double position, double duration) {
            PlaybackService.pushState(MainActivity.this, playing, position, duration);
        }

        @JavascriptInterface
        public void clearMedia() {
            PlaybackService.stop(MainActivity.this);
        }

        @JavascriptInterface
        public void openUrl(String url) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void toast(String text) {
            main.post(() -> Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        @JavascriptInterface
        public String version() {
            return BuildConfig.VERSION_NAME;
        }
    }

    /* ── local API used by the bundled interface ─────────────────────── */

    private String handleApi(String method, String path, String body) throws Exception {
        Uri u = Uri.parse(path.startsWith("http") ? path : "http://wavelength.local" + path);
        String p = u.getPath() == null ? "" : u.getPath();
        String m = method.toUpperCase(Locale.ROOT);

        if ("/api/health".equals(p)) return health().toString();
        if ("/api/state".equals(p)) {
            if ("PUT".equals(m)) {
                writeState(body);
                return "{}";
            }
            return readState();
        }
        if ("/api/search".equals(p)) return search(u.getQueryParameter("q"));
        if ("/api/match".equals(p)) return match(new JSONObject(body == null || body.isEmpty() ? "{}" : body));
        if (p.startsWith("/api/related/")) return related(p.substring("/api/related/".length()));

        if (p.startsWith("/api/stream/")) {
            String id = p.substring("/api/stream/".length());
            return stream(id, u.getQueryParameter("q"));
        }
        if (p.startsWith("/api/warm/")) {
            String id = p.substring("/api/warm/".length());
            resolveAudio(id, u.getQueryParameter("q"));
            return "{}";
        }
        if (p.startsWith("/api/cached/")) return new JSONObject().put("cached", false).toString();
        if ("/api/local".equals(p)) return "[]";
        if ("/api/stats".equals(p)) return stats().toString();
        if ("/api/config".equals(p)) {
            if ("PUT".equals(m)) return "{}";
            return new JSONObject().put("downloadDir", "").put("localDir", "").toString();
        }
        if ("/api/downloads".equals(p)) return "[]";
        if ("/api/downloads/clear".equals(p)) return "{}";
        if ("/api/download".equals(p)) {
            throw new Exception("Downloads are not in this standalone build yet. Streaming and sync work.");
        }
        if ("/api/cache/clear".equals(p)) return stats().toString();
        if ("/api/token".equals(p)) return new JSONObject().put("token", "").toString();
        if ("/api/share-test".equals(p)) return "{}";

        if (p.startsWith("/api/spotify/")) {
            throw new Exception("Spotify import is not available in the standalone Android build yet.");
        }

        if ("/api/sync/status".equals(p)) return syncStatus().toString();
        if ("/api/sync/join".equals(p)) return syncJoin(new JSONObject(body == null || body.isEmpty() ? "{}" : body)).toString();
        if ("/api/sync/pull".equals(p)) return syncPull().toString();
        if ("/api/sync/push".equals(p)) return syncPush().toString();
        if ("/api/sync/disconnect".equals(p)) return syncDisconnect().toString();
        if ("/api/sync/host".equals(p)) {
            throw new Exception("Host from the computer, then join it here. Phone hosting is not enabled yet.");
        }
        if ("/api/sync/stop".equals(p)) return syncStatus().toString();

        throw new Exception("Not available in standalone mode: " + p);
    }

    private JSONObject health() throws Exception {
        return new JSONObject()
            .put("version", BuildConfig.VERSION_NAME)
            .put("ytdlp", "NewPipeExtractor 0.26.5")
            .put("ffmpeg", "not needed")
            .put("ffprobe", "not needed")
            .put("urls", new JSONArray())
            .put("downloadDir", "")
            .put("localDir", "")
            .put("clientId", "")
            .put("spotifyConnected", false)
            .put("redirectUri", "");
    }

    private JSONObject stats() throws Exception {
        long size = stateFile != null && stateFile.exists() ? stateFile.length() : 0;
        return new JSONObject()
            .put("version", BuildConfig.VERSION_NAME)
            .put("cacheLimit", 0)
            .put("cacheBytes", 0)
            .put("cacheCount", 0)
            .put("coverCount", 0)
            .put("coverBytes", 0)
            .put("localCount", 0)
            .put("localBytes", 0)
            .put("resolutionCount", 0)
            .put("dataBytes", size)
            .put("matchedCount", 0);
    }

    /* ── state ──────────────────────────────────────────────────────── */

    private String readState() {
        synchronized (STATE_LOCK) {
            if (stateFile.exists()) {
                try {
                    String s = readFile(stateFile);
                    if (s != null && s.trim().startsWith("{")) return s;
                } catch (Exception ignored) {}
            }
            String migrated = migrateFromCompanion();
            String initial = migrated == null ? "{}" : migrated;
            try { writeFile(stateFile, initial); } catch (Exception ignored) {}
            return initial;
        }
    }

    private void writeState(String body) throws Exception {
        if (body == null || body.trim().isEmpty()) body = "{}";
        new JSONObject(body); // validate before replacing the good copy
        synchronized (STATE_LOCK) {
            writeFile(stateFile, body);
        }
    }

    /**
     * Users upgrading from the companion APK already have a desktop address.
     * On first standalone launch, copy that library once so their playlists
     * are not lost. Failure is silent; the app simply starts empty.
     */
    private String migrateFromCompanion() {
        String server = prefs.getString(KEY_SERVER, "");
        if (server == null || server.isEmpty()) return null;
        HttpURLConnection conn = null;
        try {
            URL url = new URL(server.replaceAll("/+$", "") + "/api/state");
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(2500);
            conn.setReadTimeout(3500);
            conn.setRequestProperty("Accept", "application/json");
            if (conn.getResponseCode() != 200) return null;
            String s = readUtf8(conn.getInputStream());
            if (s != null && s.trim().startsWith("{")) return s;
        } catch (Exception ignored) {
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }

    private static void writeFile(File file, String text) throws Exception {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists()) parent.mkdirs();
        File tmp = new File(file.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(text.getBytes(StandardCharsets.UTF_8));
            out.flush();
            out.getFD().sync();
        }
        if (!tmp.renameTo(file)) {
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(text.getBytes(StandardCharsets.UTF_8));
            }
            tmp.delete();
        }
    }

    private static String readFile(File file) throws Exception {
        try (FileInputStream in = new FileInputStream(file)) {
            return readUtf8(in);
        }
    }

    /* ── YouTube extraction ─────────────────────────────────────────── */

    private static boolean newPipeReady = false;

    private static synchronized void ensureNewPipe() {
        if (newPipeReady) return;
        NewPipe.init(new Downloader() {
            @Override
            public Response execute(Request request) throws IOException {
                HttpURLConnection conn = null;
                try {
                    conn = (HttpURLConnection) new URL(request.url()).openConnection();
                    conn.setRequestMethod(request.httpMethod());
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(25000);
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("User-Agent", UA);
                    conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                    for (Map.Entry<String, List<String>> e : request.headers().entrySet()) {
                        for (String value : e.getValue()) conn.addRequestProperty(e.getKey(), value);
                    }
                    byte[] data = request.dataToSend();
                    if (data != null) {
                        conn.setDoOutput(true);
                        try (OutputStream out = conn.getOutputStream()) { out.write(data); }
                    }
                    int code = conn.getResponseCode();
                    InputStream raw = code >= 400 ? conn.getErrorStream() : conn.getInputStream();
                    InputStream in = raw;
                    String enc = conn.getContentEncoding();
                    if (raw != null && enc != null && enc.toLowerCase(Locale.ROOT).contains("gzip")) {
                        in = new GZIPInputStream(raw);
                    }
                    String responseBody = in == null ? "" : readUtf8(in);
                    if (in != null) in.close();
                    Map<String, List<String>> headers = new LinkedHashMap<>();
                    for (Map.Entry<String, List<String>> e : conn.getHeaderFields().entrySet()) {
                        if (e.getKey() != null) headers.put(e.getKey(), e.getValue());
                    }
                    return new Response(code, conn.getResponseMessage(), headers, responseBody, request.url());
                } finally {
                    if (conn != null) conn.disconnect();
                }
            }
        });
        newPipeReady = true;
    }

    private String search(String q) throws Exception {
        q = q == null ? "" : q.trim();
        if (q.isEmpty()) return "[]";
        String key = q.toLowerCase(Locale.ROOT);
        CacheEntry hit = searchCache.get(key);
        if (hit != null && hit.fresh(10 * 60 * 1000)) return hit.value;

        ensureNewPipe();
        SearchInfo info = SearchInfo.getInfo(ServiceList.YouTube,
            ServiceList.YouTube.getSearchQHFactory()
                .fromQuery(q, Collections.singletonList("music_songs"), null));
        JSONArray out = new JSONArray();
        for (InfoItem item : info.getRelatedItems()) {
            if (!(item instanceof StreamInfoItem)) continue;
            JSONObject t = trackFrom((StreamInfoItem) item);
            if (t != null) out.put(t);
            if (out.length() >= 20) break;
        }
        String value = out.toString();
        searchCache.put(key, new CacheEntry(value));
        return value;
    }

    private String match(JSONObject in) throws Exception {
        String title = in.optString("title", "");
        String artist = in.optString("artist", "");
        long duration = in.optLong("duration", 0);
        String q = (artist + " " + title).trim();
        if (q.isEmpty()) return new JSONObject().put("ytId", JSONObject.NULL).toString();
        JSONArray results = new JSONArray(search(q));
        if (results.length() == 0) return new JSONObject().put("ytId", JSONObject.NULL).toString();

        String want = (title + " " + artist).toLowerCase(Locale.ROOT);
        String core = title.toLowerCase(Locale.ROOT).replaceFirst("\\s*[\\[(].*$", "");
        JSONObject best = null;
        double bestScore = -1e9;
        for (int i = 0; i < results.length(); i++) {
            JSONObject t = results.getJSONObject(i);
            String name = t.optString("title", "").toLowerCase(Locale.ROOT);
            String uploader = t.optString("artist", "");
            long d = t.optLong("duration", 0);
            double score = 0;
            if (duration > 0 && d > 0) score -= Math.min(Math.abs(d - duration), 90);
            if (duration > 0 && d > 0 && Math.abs(d - duration) > duration * 0.5) score -= 60;
            if (uploader.toLowerCase(Locale.ROOT).endsWith(" - topic")) score += 25;
            if (name.contains("official audio") || name.contains("official video") || name.contains("music video")) score += 10;
            if (!core.isEmpty() && name.contains(core)) score += 15;
            Matcher bad = BAD_TITLE.matcher(name);
            if (bad.find() && !want.contains(bad.group(1).toLowerCase(Locale.ROOT))) score -= 45;
            if (!artist.isEmpty() && (name.contains(artist.toLowerCase(Locale.ROOT))
                || uploader.toLowerCase(Locale.ROOT).contains(artist.toLowerCase(Locale.ROOT)))) score += 8;
            if (score > bestScore) { bestScore = score; best = t; }
        }
        if (best == null || bestScore < -70) return new JSONObject().put("ytId", JSONObject.NULL).toString();
        return new JSONObject().put("ytId", best.optString("ytId")).toString();
    }

    private String related(String id) throws Exception {
        id = cleanId(id);
        ensureNewPipe();
        StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=" + id);
        JSONArray out = new JSONArray();
        for (InfoItem item : info.getRelatedStreams()) {
            if (!(item instanceof StreamInfoItem)) continue;
            JSONObject t = trackFrom((StreamInfoItem) item);
            if (t != null && !id.equals(t.optString("ytId"))) out.put(t);
            if (out.length() >= 15) break;
        }
        return out.toString();
    }

    private String stream(String id, String q) throws Exception {
        return new JSONObject().put("url", resolveAudio(id, q)).toString();
    }

    private String resolveAudio(String id, String quality) throws Exception {
        id = cleanId(id);
        String key = id + ":" + (quality == null ? "best" : quality);
        CacheEntry hit = streamCache.get(key);
        if (hit != null && hit.fresh(10 * 60 * 1000)) return hit.value;

        ensureNewPipe();
        StreamInfo info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=" + id);
        AudioStream pick = null;
        boolean saver = "saver".equals(quality);
        for (AudioStream a : info.getAudioStreams()) {
            if (a == null) continue;
            String url = a.getContent();
            if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) continue;
            if (pick == null) { pick = a; continue; }
            int br = bitrate(a);
            int pbr = bitrate(pick);
            boolean am4a = a.getFormat() == MediaFormat.M4A;
            boolean pm4a = pick.getFormat() == MediaFormat.M4A;
            if (saver) {
                if ((am4a && !pm4a) || (am4a == pm4a && br < pbr)) pick = a;
            } else {
                if ((am4a && !pm4a) || (am4a == pm4a && br > pbr)) pick = a;
            }
        }
        if (pick == null) throw new Exception("No audio stream available for this video");
        String value = pick.getContent();
        streamCache.put(key, new CacheEntry(value));
        return value;
    }

    private static int bitrate(AudioStream a) {
        int br = a.getAverageBitrate();
        return br > 0 ? br : a.getBitrate();
    }

    private static JSONObject trackFrom(StreamInfoItem item) {
        if (item == null) return null;
        String id = ytId(item.getUrl());
        if (id == null) return null;
        try {
            String artist = item.getUploaderName() == null ? "" : item.getUploaderName();
            artist = artist.replaceFirst("(?i)\\s*-\\s*Topic\\s*$", "");
            if (artist.trim().isEmpty()) artist = "YouTube";
            return new JSONObject()
                .put("ytId", id)
                .put("title", item.getName() == null || item.getName().trim().isEmpty() ? "Untitled" : item.getName())
                .put("artist", artist)
                .put("duration", Math.max(0, item.getDuration()))
                .put("art", "https://i.ytimg.com/vi/" + id + "/mqdefault.jpg");
        } catch (Exception e) {
            return null;
        }
    }

    private static String cleanId(String raw) throws Exception {
        String id = ytId(raw);
        if (id == null) throw new Exception("That YouTube link is not valid");
        return id;
    }

    private static String ytId(String raw) {
        if (raw == null) return null;
        if (raw.matches("[A-Za-z0-9_-]{11}")) return raw;
        try {
            Uri u = Uri.parse(raw);
            String v = u.getQueryParameter("v");
            if (v != null && v.matches("[A-Za-z0-9_-]{11}")) return v;
        } catch (Exception ignored) {}
        Matcher m = YT_ID.matcher(raw);
        return m.find() ? m.group(1) : null;
    }

    /* ── device sync ────────────────────────────────────────────────── */

    private JSONObject syncStatus() throws Exception {
        String url = prefs.getString(KEY_SYNC_URL, "");
        String code = prefs.getString(KEY_SYNC_CODE, "");
        boolean connected = url != null && !url.isEmpty() && code != null && !code.isEmpty();
        JSONObject state = new JSONObject(readState());
        JSONArray playlists = state.optJSONArray("playlists");
        JSONArray liked = state.optJSONArray("liked");
        JSONArray history = state.optJSONArray("history");
        int tracks = 0;
        if (playlists != null) {
            for (int i = 0; i < playlists.length(); i++) {
                JSONArray list = playlists.optJSONObject(i) == null ? null
                    : playlists.optJSONObject(i).optJSONArray("tracks");
                if (list != null) tracks += list.length();
            }
        }
        JSONObject counts = new JSONObject()
            .put("playlists", playlists == null ? 0 : playlists.length())
            .put("tracks", tracks)
            .put("liked", liked == null ? 0 : liked.length())
            .put("history", history == null ? 0 : history.length());
        return new JSONObject()
            .put("role", connected ? "guest" : "off")
            .put("enabled", connected)
            .put("port", 0)
            .put("urls", new JSONArray())
            .put("hostUrl", url == null ? "" : url)
            .put("peer", prefs.getString(KEY_SYNC_PEER, ""))
            .put("lastSync", prefs.getLong(KEY_SYNC_LAST, 0))
            .put("rev", prefs.getLong(KEY_SYNC_REV, 0))
            .put("code", code == null ? "" : code)
            .put("counts", counts)
            .put("error", "")
            .put("device", Build.MODEL == null ? "Android" : Build.MODEL);
    }

    private JSONObject syncJoin(JSONObject input) throws Exception {
        String base = syncBase(input.optString("url", ""));
        String code = syncCode(input.optString("code", ""));
        if (code.length() < 6) throw new Exception("Enter the pairing code shown on the computer");
        JSONObject info = syncFetch(base, code, "GET", "/api/sync/info", null);
        JSONObject remote = syncFetch(base, code, "GET", "/api/sync/library", null);
        JSONObject lib = remote.optJSONObject("library");
        if (lib == null) throw new Exception("The host did not send a library");
        applyLibrary(lib);
        prefs.edit()
            .putString(KEY_SYNC_URL, base)
            .putString(KEY_SYNC_CODE, code)
            .putString(KEY_SYNC_PEER, info.optString("name", info.optString("host", "host")))
            .putLong(KEY_SYNC_LAST, System.currentTimeMillis())
            .putLong(KEY_SYNC_REV, remote.optLong("rev", 0))
            .apply();
        return syncStatus();
    }

    private JSONObject syncPull() throws Exception {
        String base = prefs.getString(KEY_SYNC_URL, "");
        String code = prefs.getString(KEY_SYNC_CODE, "");
        if (base.isEmpty() || code.isEmpty()) throw new Exception("Connect to a computer first");
        JSONObject remote = syncFetch(base, code, "GET", "/api/sync/library", null);
        JSONObject lib = remote.optJSONObject("library");
        if (lib == null) throw new Exception("The host did not send a library");
        applyLibrary(lib);
        prefs.edit()
            .putLong(KEY_SYNC_LAST, System.currentTimeMillis())
            .putLong(KEY_SYNC_REV, remote.optLong("rev", 0))
            .apply();
        return syncStatus();
    }

    private JSONObject syncPush() throws Exception {
        String base = prefs.getString(KEY_SYNC_URL, "");
        String code = prefs.getString(KEY_SYNC_CODE, "");
        if (base.isEmpty() || code.isEmpty()) throw new Exception("Connect to a computer first");
        JSONObject state = new JSONObject(readState());
        JSONObject lib = new JSONObject()
            .put("playlists", state.optJSONArray("playlists") == null ? new JSONArray() : state.optJSONArray("playlists"))
            .put("liked", state.optJSONArray("liked") == null ? new JSONArray() : state.optJSONArray("liked"))
            .put("history", state.optJSONArray("history") == null ? new JSONArray() : state.optJSONArray("history"));
        JSONObject payload = new JSONObject().put("library", lib);
        JSONObject remote = syncFetch(base, code, "PUT", "/api/sync/library", payload.toString());
        prefs.edit()
            .putLong(KEY_SYNC_LAST, System.currentTimeMillis())
            .putLong(KEY_SYNC_REV, remote.optLong("rev", 0))
            .apply();
        return syncStatus();
    }

    private JSONObject syncDisconnect() throws Exception {
        prefs.edit()
            .remove(KEY_SYNC_URL)
            .remove(KEY_SYNC_CODE)
            .remove(KEY_SYNC_PEER)
            .remove(KEY_SYNC_LAST)
            .remove(KEY_SYNC_REV)
            .apply();
        return syncStatus();
    }

    private void applyLibrary(JSONObject lib) throws Exception {
        JSONObject state = new JSONObject(readState());
        if (lib.has("playlists")) state.put("playlists", lib.optJSONArray("playlists"));
        if (lib.has("liked")) state.put("liked", lib.optJSONArray("liked"));
        if (lib.has("history")) state.put("history", lib.optJSONArray("history"));
        writeState(state.toString());
    }

    private static String syncBase(String raw) throws Exception {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) throw new Exception("Enter the computer address");
        if (!s.matches("(?i)^https?://.*")) s = "http://" + s;
        Uri u = Uri.parse(s);
        String scheme = u.getScheme() == null ? "http" : u.getScheme().toLowerCase(Locale.ROOT);
        String host = u.getHost();
        if (host == null || host.isEmpty()) throw new Exception("That host address is not valid");
        if (!scheme.equals("http") && !scheme.equals("https")) throw new Exception("Use an http:// or https:// address");
        int port = u.getPort();
        if (port < 0) port = 38421;
        return scheme + "://" + host + ":" + port;
    }

    private static String syncCode(String raw) {
        return (raw == null ? "" : raw).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private static JSONObject syncFetch(String base, String code, String method, String route, String body) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(base + route);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(10000);
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("X-Wavelength-Sync", code);
            if (body != null) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(body.getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = conn.getResponseCode();
            InputStream in = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String text = in == null ? "{}" : readUtf8(in);
            if (status >= 400) {
                if (status == 401) throw new Exception("That pairing code is not right");
                String error = text;
                try { error = new JSONObject(text).optString("error", text); } catch (Exception ignored) {}
                throw new Exception(error == null || error.isEmpty() ? "Host answered " + status : error);
            }
            return new JSONObject(text);
        } catch (java.net.SocketTimeoutException e) {
            throw new Exception("The computer did not answer in time");
        } catch (java.net.ConnectException e) {
            throw new Exception("Could not reach the computer");
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /* ── small utilities ────────────────────────────────────────────── */

    static String readUtf8(InputStream in) throws IOException {
        if (in == null) return "";
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        return out.toString("UTF-8");
    }
}
