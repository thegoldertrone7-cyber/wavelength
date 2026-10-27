package app.wavelength.music;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PorterDuff;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

/**
 * Wavelength for Android is a companion client. It does not bundle the Node
 * server, yt-dlp or ffmpeg: it connects to Wavelength running on the user's
 * computer over the local network.
 *
 * The native setup screen is deliberate. A bare WebView that loads an
 * unreachable http://127.0.0.1:3000 leaves Chromium's "Webpage not available"
 * page in front, which looks like the app is broken. Here the WebView is kept
 * hidden until a page actually loads, and every connection failure returns to
 * the branded setup screen with Retry / Change server / Cancel.
 */
public class MainActivity extends AppCompatActivity {
    private static final String PREFS = "wl";
    private static final String KEY_URL = "server_url";
    private static final int DESKTOP_PORT = 38421;
    private static final int BROWSER_PORT = 3000;
    private static final int LOAD_TIMEOUT_MS = 15000;

    private static final int C_BG = 0xFF000000;
    private static final int C_CARD = 0xFF0D0D0E;
    private static final int C_CARD2 = 0xFF171718;
    private static final int C_LINE = 0xFF2A2A2E;
    private static final int C_TEXT = 0xFFF4F4F4;
    private static final int C_MUTED = 0xFF9B9BA1;
    private static final int C_FAINT = 0xFF6B6B70;
    private static final int C_ACCENT = 0xFFD71921;
    private static final int C_ERROR = 0xFFFF8A80;

    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService scanPool = Executors.newSingleThreadExecutor();

    private WebView wv;
    private FrameLayout root;
    private ScrollView setup;
    private EditText input;
    private TextView errorText;
    private TextView statusText;
    private TextView hintText;
    private LinearLayout statusRow;
    private ProgressBar spinner;
    private Button connectBtn;
    private Button scanBtn;
    private Button cancelBtn;
    private Button menuBtn;

    private String lastGoodUrl = "";
    private String pendingUrl = "";
    private String pendingShare = null;
    private String lastFailure = "";
    private boolean pageFailed = false;
    private boolean httpFailed = false;
    private boolean setupVisible = true;
    private boolean restoring = false;
    private boolean scanning = false;

    private int loadToken = 0;
    private int scanGen = 0;

    private final Runnable loadTimeout = () -> {
        if (setupVisible) fail("No answer from " + prettyHost(pendingUrl)
            + ". Make sure Wavelength is open, the computer is awake, and both devices are on the same Wi-Fi.");
    };

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        root = new FrameLayout(this);
        root.setBackgroundColor(C_BG);

        buildWebView();
        buildSetup();
        buildMenuButton();

        root.addView(wv, new FrameLayout.LayoutParams(-1, -1));
        root.addView(setup, new FrameLayout.LayoutParams(-1, -1));
        root.addView(menuBtn, menuParams());
        setContentView(root);

        pendingShare = shareTarget(getIntent());
        String saved = prefs().getString(KEY_URL, "");
        if (saved.isEmpty()) {
            showSetup(false, null);
        } else {
            input.setText(saved);
            input.setSelection(input.length());
            connectTo(saved);
        }
    }

    /* ── WebView ─────────────────────────────────────────────────────── */

    private void buildWebView() {
        wv = new WebView(this);
        wv.setBackgroundColor(C_BG);
        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setSupportZoom(false);
        ws.setBuiltInZoomControls(false);
        wv.setWebChromeClient(new WebChromeClient());
        wv.setWebViewClient(new WaveViewClient());
        wv.addJavascriptInterface(new ServerBridge(), "AndroidBridge");
        if (BuildConfig.DEBUG) WebView.setWebContentsDebuggingEnabled(true);
    }

    private class WaveViewClient extends WebViewClient {
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url == null || pendingUrl.isEmpty() || !url.startsWith(pendingUrl)) return;
            if (pageFailed || httpFailed) {
                fail(lastFailure);
                return;
            }
            if (setupVisible) {
                lastGoodUrl = pendingUrl;
                restoring = false;
                prefs().edit().putString(KEY_URL, lastGoodUrl).apply();
                hideSetup();
            }
            applyPendingShare();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request != null && !request.isForMainFrame()) return;
            String failed = request != null && request.getUrl() != null ? request.getUrl().toString() : pendingUrl;
            if (!pendingUrl.isEmpty() && !failed.startsWith(pendingUrl)) return;
            pageFailed = true;
            lastFailure = describeError(error);
            view.stopLoading();
            fail(lastFailure);
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
            if (request == null || !request.isForMainFrame()) return;
            int code = response == null ? 0 : response.getStatusCode();
            if (code < 400) return;
            String failed = request.getUrl() == null ? pendingUrl : request.getUrl().toString();
            if (!pendingUrl.isEmpty() && !failed.startsWith(pendingUrl)) return;
            httpFailed = true;
            lastFailure = "That address answered with HTTP " + code
                + ". Is it really the Wavelength server? The desktop app usually uses port " + DESKTOP_PORT + ".";
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, android.net.http.SslError error) {
            handler.cancel();
            pageFailed = true;
            lastFailure = "The secure connection to that address failed. On a local network use http:// instead of https://.";
            fail(lastFailure);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return handleUrl(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(Uri.parse(url));
        }

        private boolean handleUrl(Uri uri) {
            if (uri == null) return false;
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            // Keep http(s) — including the Spotify sign-in round trip — inside
            // the app. Only hand non-web schemes to the system.
            if (scheme.equals("http") || scheme.equals("https")) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception ignored) {}
            return true;
        }
    }

    /* ── native setup screen ─────────────────────────────────────────── */

    private void buildSetup() {
        setup = new ScrollView(this);
        setup.setFillViewport(true);
        setup.setBackgroundColor(C_BG);

        int pad = dp(26);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL | Gravity.CENTER_VERTICAL);
        column.setPadding(pad, dp(40), pad, dp(28));
        setup.addView(column, new ScrollView.LayoutParams(-1, -2));

        TextView brand = new TextView(this);
        brand.setText("WAVELENGTH");
        brand.setTextColor(C_TEXT);
        brand.setTextSize(28);
        brand.setTypeface(Typeface.DEFAULT_BOLD);
        brand.setLetterSpacing(0.28f);
        brand.setGravity(Gravity.CENTER);
        column.addView(brand, wrap());

        TextView tagline = new TextView(this);
        tagline.setText("Your music. Your computer. No ads.");
        tagline.setTextColor(C_MUTED);
        tagline.setTextSize(13);
        tagline.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams tagLp = wrap();
        tagLp.topMargin = dp(6);
        column.addView(tagline, tagLp);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(20), dp(20), dp(20), dp(20));
        card.setBackground(round(C_CARD, C_LINE, 24, 1));
        int cardWidth = Math.min(getResources().getDisplayMetrics().widthPixels - dp(52), dp(520));
        LinearLayout.LayoutParams cardLp = new LinearLayout.LayoutParams(cardWidth, -2);
        cardLp.gravity = Gravity.CENTER_HORIZONTAL;
        cardLp.topMargin = dp(28);
        column.addView(card, cardLp);

        TextView intro = new TextView(this);
        intro.setText("Connect to Wavelength on your computer");
        intro.setTextColor(C_TEXT);
        intro.setTextSize(17);
        intro.setTypeface(Typeface.DEFAULT_BOLD);
        card.addView(intro, wrap());

        TextView sub = new TextView(this);
        sub.setText("Install Wavelength on a Mac, PC or Linux computer, open it, then connect this phone over the same Wi-Fi.");
        sub.setTextColor(C_MUTED);
        sub.setTextSize(12);
        sub.setLineSpacing(0f, 1.25f);
        LinearLayout.LayoutParams subLp = wrap();
        subLp.topMargin = dp(7);
        subLp.bottomMargin = dp(18);
        card.addView(sub, subLp);

        TextView label = new TextView(this);
        label.setText("COMPUTER ADDRESS");
        label.setTextColor(C_MUTED);
        label.setTextSize(10);
        label.setLetterSpacing(0.13f);
        label.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams labelLp = wrap();
        labelLp.bottomMargin = dp(8);
        card.addView(label, labelLp);

        input = new EditText(this);
        input.setSingleLine(true);
        input.setTextColor(C_TEXT);
        input.setHintTextColor(C_FAINT);
        input.setTextSize(16);
        input.setHint("192.168.1.10:38421");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setImeOptions(EditorInfo.IME_ACTION_GO);
        input.setSelectAllOnFocus(true);
        input.setPadding(dp(14), dp(12), dp(14), dp(12));
        input.setBackground(round(C_CARD2, C_LINE, 14, 1));
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                connectFromInput();
                return true;
            }
            return false;
        });
        card.addView(input, new LinearLayout.LayoutParams(-1, dp(52)));

        hintText = new TextView(this);
        hintText.setText("Desktop app: port " + DESKTOP_PORT + "  ·  Browser mode: port " + BROWSER_PORT);
        hintText.setTextColor(C_FAINT);
        hintText.setTextSize(11);
        LinearLayout.LayoutParams hintLp = wrap();
        hintLp.topMargin = dp(8);
        card.addView(hintText, hintLp);

        errorText = new TextView(this);
        errorText.setTextColor(C_ERROR);
        errorText.setTextSize(12);
        errorText.setLineSpacing(0f, 1.25f);
        errorText.setVisibility(View.GONE);
        LinearLayout.LayoutParams errLp = wrap();
        errLp.topMargin = dp(12);
        card.addView(errorText, errLp);

        statusRow = new LinearLayout(this);
        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        statusRow.setVisibility(View.GONE);
        spinner = new ProgressBar(this, null, android.R.attr.progressBarStyleSmall);
        spinner.setIndeterminate(true);
        if (spinner.getIndeterminateDrawable() != null) {
            spinner.getIndeterminateDrawable().setColorFilter(C_ACCENT, PorterDuff.Mode.SRC_IN);
        }
        LinearLayout.LayoutParams spinLp = new LinearLayout.LayoutParams(dp(18), dp(18));
        statusRow.addView(spinner, spinLp);
        statusText = new TextView(this);
        statusText.setTextColor(C_MUTED);
        statusText.setTextSize(12);
        LinearLayout.LayoutParams statusLp = new LinearLayout.LayoutParams(-1, -2);
        statusLp.leftMargin = dp(10);
        statusRow.addView(statusText, statusLp);
        LinearLayout.LayoutParams rowLp = wrap();
        rowLp.topMargin = dp(12);
        card.addView(statusRow, rowLp);

        connectBtn = makeButton("Connect", true);
        LinearLayout.LayoutParams connectLp = new LinearLayout.LayoutParams(-1, dp(52));
        connectLp.topMargin = dp(16);
        connectBtn.setOnClickListener(v -> connectFromInput());
        card.addView(connectBtn, connectLp);

        scanBtn = makeButton("Find my computer", false);
        LinearLayout.LayoutParams scanLp = new LinearLayout.LayoutParams(-1, dp(50));
        scanLp.topMargin = dp(10);
        scanBtn.setOnClickListener(v -> findComputer());
        card.addView(scanBtn, scanLp);

        cancelBtn = makeButton("Back to player", false);
        cancelBtn.setTextColor(C_MUTED);
        cancelBtn.setBackgroundColor(Color.TRANSPARENT);
        cancelBtn.setVisibility(View.GONE);
        LinearLayout.LayoutParams cancelLp = new LinearLayout.LayoutParams(-1, dp(44));
        cancelLp.topMargin = dp(6);
        cancelBtn.setOnClickListener(v -> cancelSetup());
        card.addView(cancelBtn, cancelLp);

        TextView note = new TextView(this);
        note.setText("Only use a network you trust — anyone who can reach this address can use your library. "
            + "On Android, 127.0.0.1 means this phone itself. This app is a companion client: the server, yt-dlp and ffmpeg stay on your computer.");
        note.setTextColor(C_FAINT);
        note.setTextSize(11);
        note.setLineSpacing(0f, 1.3f);
        LinearLayout.LayoutParams noteLp = new LinearLayout.LayoutParams(cardWidth, -2);
        noteLp.gravity = Gravity.CENTER_HORIZONTAL;
        noteLp.topMargin = dp(20);
        column.addView(note, noteLp);
    }

    private void buildMenuButton() {
        menuBtn = new Button(this);
        menuBtn.setText("\u22ee");
        menuBtn.setTextSize(22);
        menuBtn.setTextColor(C_TEXT);
        menuBtn.setAllCaps(false);
        menuBtn.setPadding(0, 0, 0, 0);
        menuBtn.setMinWidth(0);
        menuBtn.setMinimumWidth(0);
        menuBtn.setMinHeight(0);
        menuBtn.setMinimumHeight(0);
        menuBtn.setElevation(0);
        menuBtn.setBackground(round(0xE6171718, C_LINE, 22, 1));
        menuBtn.setContentDescription("Change Wavelength server");
        menuBtn.setVisibility(View.GONE);
        menuBtn.setOnClickListener(v -> showSetup(true, null));
    }

    private FrameLayout.LayoutParams menuParams() {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(42), dp(42));
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.topMargin = dp(10);
        lp.rightMargin = dp(10);
        return lp;
    }

    private Button makeButton(String text, boolean filled) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setPadding(dp(16), 0, dp(16), 0);
        b.setElevation(0);
        if (filled) {
            b.setTextColor(Color.WHITE);
            b.setBackground(round(C_ACCENT, C_ACCENT, 14, 0));
        } else {
            b.setTextColor(C_TEXT);
            b.setBackground(round(C_CARD2, C_LINE, 14, 1));
        }
        return b;
    }

    /* ── connection state ────────────────────────────────────────────── */

    private void connectFromInput() {
        if (scanning) cancelScan();
        String raw = input.getText().toString();
        String url;
        try {
            url = normalizeAddress(raw);
        } catch (IllegalArgumentException e) {
            input.setError(e.getMessage());
            showError(e.getMessage());
            setStatus(null, false);
            connectBtn.setEnabled(true);
            scanBtn.setEnabled(true);
            return;
        }
        connectTo(url);
    }

    private void connectTo(String url) {
        cancelScan();
        hideKeyboard();
        pendingUrl = url;
        input.setText(url);
        input.setSelection(input.length());
        input.setError(null);
        clearError();
        setupVisible = true;
        restoring = false;
        wv.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        menuBtn.setVisibility(View.GONE);
        cancelBtn.setVisibility(lastGoodUrl.isEmpty() ? View.GONE : View.VISIBLE);
        connectBtn.setEnabled(false);
        scanBtn.setEnabled(false);
        connectBtn.setText("Connect");
        pageFailed = false;
        httpFailed = false;
        lastFailure = "";
        setStatus("Connecting to " + url + "\u2026", true);
        ++loadToken;
        main.removeCallbacks(loadTimeout);
        main.postDelayed(loadTimeout, LOAD_TIMEOUT_MS);
        wv.stopLoading();
        wv.loadUrl(url + "/");
    }

    private void showSetup(boolean canCancel, String message) {
        cancelScan();
        loadToken++;
        main.removeCallbacks(loadTimeout);
        setupVisible = true;
        wv.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        menuBtn.setVisibility(View.GONE);
        cancelBtn.setVisibility(canCancel && !lastGoodUrl.isEmpty() ? View.VISIBLE : View.GONE);
        connectBtn.setText("Connect");
        connectBtn.setEnabled(true);
        scanBtn.setEnabled(true);
        clearError();
        if (message != null) setStatus(message, false); else setStatus(null, false);
        String current = input.getText().toString().trim();
        if (current.isEmpty()) {
            String saved = prefs().getString(KEY_URL, "");
            if (!saved.isEmpty()) input.setText(saved);
        }
        input.setSelection(input.getText().length());
    }

    private void hideSetup() {
        main.removeCallbacks(loadTimeout);
        setupVisible = false;
        setup.setVisibility(View.GONE);
        wv.setVisibility(View.VISIBLE);
        menuBtn.setVisibility(View.VISIBLE);
        hideKeyboard();
    }

    private void cancelSetup() {
        hideKeyboard();
        if (lastGoodUrl.isEmpty()) {
            showSetup(false, null);
            return;
        }
        cancelScan();
        restoring = true;
        pendingUrl = lastGoodUrl;
        input.setText(lastGoodUrl);
        pageFailed = false;
        httpFailed = false;
        lastFailure = "";
        hideSetup();
        wv.loadUrl(lastGoodUrl + "/");
    }

    private void fail(String message) {
        if (isFinishing() || isDestroyed()) return;
        main.removeCallbacks(loadTimeout);
        setupVisible = true;
        wv.setVisibility(View.GONE);
        setup.setVisibility(View.VISIBLE);
        menuBtn.setVisibility(View.GONE);
        connectBtn.setText("Retry");
        connectBtn.setEnabled(true);
        scanBtn.setEnabled(true);
        cancelBtn.setVisibility((!lastGoodUrl.isEmpty() && !restoring) ? View.VISIBLE : View.GONE);
        setStatus(null, false);
        showError(message == null || message.isEmpty()
            ? "Couldn't reach " + prettyHost(pendingUrl) + ". Check the address and try again."
            : message);
    }

    private void setStatus(String message, boolean busy) {
        if (message == null || message.isEmpty()) {
            statusRow.setVisibility(View.GONE);
            return;
        }
        statusRow.setVisibility(View.VISIBLE);
        statusText.setText(message);
        spinner.setVisibility(busy ? View.VISIBLE : View.GONE);
    }

    private void showError(String message) {
        errorText.setText(message);
        errorText.setVisibility(View.VISIBLE);
    }

    private void clearError() {
        errorText.setText("");
        errorText.setVisibility(View.GONE);
    }

    /* ── address parsing ─────────────────────────────────────────────── */

    static String normalizeAddress(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) throw new IllegalArgumentException("Enter your computer's address, or tap Find my computer.");
        s = s.replaceAll("\\s+", "");
        if (!s.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) s = "http://" + s;

        Uri u;
        try {
            u = Uri.parse(s);
        } catch (Exception e) {
            throw new IllegalArgumentException("That doesn't look like an address. Try 192.168.1.10:" + DESKTOP_PORT + ".");
        }
        String scheme = u.getScheme() == null ? "http" : u.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw new IllegalArgumentException("Use an http:// address. Wavelength runs over plain HTTP on your local network.");
        }
        String host = u.getHost();
        if (host == null || host.isEmpty()) {
            throw new IllegalArgumentException("That doesn't look like an address. Try 192.168.1.10:" + DESKTOP_PORT + ".");
        }
        host = host.toLowerCase(Locale.ROOT).replaceAll("^\\[|\\]$", "");
        if (host.equals("localhost") || host.equals("::1") || host.equals("0.0.0.0") || host.startsWith("127.")) {
            throw new IllegalArgumentException("127.0.0.1 / localhost means this phone itself, not your computer. "
                + "Enter the computer's Wi-Fi address from Wavelength \u2192 Settings \u2192 Devices (for example 192.168.1.10:" + DESKTOP_PORT + ").");
        }
        int port = u.getPort();
        if (port == -1) port = scheme.equals("https") ? 443 : DESKTOP_PORT;
        if (port < 1 || port > 65535) {
            throw new IllegalArgumentException("The port must be between 1 and 65535.");
        }
        String hostOut = host.contains(":") ? "[" + host + "]" : host;
        return scheme + "://" + hostOut + ":" + port;
    }

    private static int portOf(String raw) {
        if (raw == null) return -1;
        String s = raw.trim();
        if (s.isEmpty()) return -1;
        if (!s.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) s = "http://" + s;
        try {
            int p = Uri.parse(s).getPort();
            return p > 0 && p <= 65535 ? p : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private static String prettyHost(String url) {        if (url == null || url.isEmpty()) return "that address";
        try {
            Uri u = Uri.parse(url);
            String h = u.getHost();
            if (h == null || h.isEmpty()) return url;
            return h + (u.getPort() > 0 ? ":" + u.getPort() : "");
        } catch (Exception e) {
            return url;
        }
    }

    private String describeError(WebResourceError error) {
        int code = error == null ? -1 : error.getErrorCode();
        switch (code) {
            case WebViewClient.ERROR_HOST_LOOKUP:
                return "Can't find " + prettyHost(pendingUrl)
                    + ". Check the address, and that the phone and computer are on the same Wi-Fi.";
            case WebViewClient.ERROR_CONNECT:
                return "The connection to " + prettyHost(pendingUrl)
                    + " was refused. Is Wavelength open on the computer, and allowed through its firewall?";
            case WebViewClient.ERROR_TIMEOUT:
                return "The computer didn't answer in time. Check it is awake, on the same Wi-Fi, and that Wavelength is open.";
            case WebViewClient.ERROR_UNSUPPORTED_SCHEME:
                return "That address used a scheme Wavelength can't open. Use http:// or https://.";
            case WebViewClient.ERROR_FAILED_SSL_HANDSHAKE:
                return "The secure connection failed. On a local network use http:// instead of https://.";
            case WebViewClient.ERROR_FILE_NOT_FOUND:
            case WebViewClient.ERROR_FILE:
                return "The server answered, but not with the Wavelength player. Is this the right address and port?";
            default:
                String desc = error == null || error.getDescription() == null ? "" : error.getDescription().toString();
                return "Couldn't reach " + prettyHost(pendingUrl)
                    + (desc.isEmpty() ? "." : " (" + desc + ").")
                    + " Check the address and the computer's firewall, then try again.";
        }
    }

    /* ── LAN discovery ───────────────────────────────────────────────── */

    private void findComputer() {
        if (scanning) return;
        final String local = localIpv4();
        if (local == null) {
            showError("No Wi-Fi network found. Connect this phone to the same Wi-Fi as your computer, then try again.");
            return;
        }
        final String prefix = local.substring(0, local.lastIndexOf('.') + 1);
        final int gen = ++scanGen;
        scanning = true;
        clearError();
        scanBtn.setEnabled(false);
        connectBtn.setEnabled(false);

        // Scan the two default ports plus whatever port is currently in use,
        // so custom desktop/browser ports are discoverable too.
        final Set<Integer> ports = new LinkedHashSet<>();
        ports.add(DESKTOP_PORT);
        ports.add(BROWSER_PORT);
        for (String candidate : new String[]{pendingUrl, lastGoodUrl, prefs().getString(KEY_URL, ""), input.getText().toString()}) {
            int p = portOf(candidate);
            if (p > 0) ports.add(p);
        }
        setStatus("Scanning " + prefix + "0\u2013255 for Wavelength\u2026 this can take up to 30 seconds.", true);

        scanPool.execute(() -> {
            final Set<String> found = Collections.synchronizedSet(new LinkedHashSet<>());
            ExecutorService inner = Executors.newFixedThreadPool(32);
            List<Future<?>> tasks = new ArrayList<>();
            for (int i = 1; i <= 254; i++) {
                final String host = prefix + i;
                for (final int port : ports) {
                    tasks.add(inner.submit(() -> {
                        if (gen != scanGen) return;
                        if (healthOk(host, port) && gen == scanGen) found.add("http://" + host + ":" + port);
                    }));
                }
            }
            for (Future<?> f : tasks) {
                try { f.get(); } catch (Exception ignored) {}
            }
            inner.shutdownNow();
            final List<String> results = new ArrayList<>(found);
            Collections.sort(results);
            main.post(() -> {
                if (isFinishing() || isDestroyed() || gen != scanGen) return;
                scanning = false;
                connectBtn.setEnabled(true);
                scanBtn.setEnabled(true);
                if (results.isEmpty()) {
                    setStatus(null, false);
                    showError("No Wavelength server found on this Wi-Fi. Open Wavelength on your computer, "
                        + "keep both devices on the same network, then try again — or type the address shown in "
                        + "Settings \u2192 Devices.");
                } else if (results.size() == 1) {
                    setStatus("Found " + results.get(0), false);
                    input.setText(results.get(0));
                    connectFromInput();
                } else {
                    setStatus("Found " + results.size() + " servers", false);
                    chooseServer(results);
                }
            });
        });
    }

    private void chooseServer(final List<String> urls) {
        final String[] labels = urls.toArray(new String[0]);
        new AlertDialog.Builder(this)
            .setTitle("Choose your computer")
            .setItems(labels, (dialog, which) -> {
                input.setText(labels[which]);
                connectFromInput();
            })
            .setNegativeButton("Cancel", null)
            .show();
    }

    private void cancelScan() {
        scanGen++;
        scanning = false;
    }

    private static boolean healthOk(String host, int port) {
        HttpURLConnection conn = null;
        try {
            URL u = new URL("http://" + host + ":" + port + "/api/health");
            conn = (HttpURLConnection) u.openConnection();
            conn.setConnectTimeout(350);
            conn.setReadTimeout(900);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            if (conn.getResponseCode() != 200) return false;
            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder body = new StringBuilder();
            char[] buf = new char[1024];
            int n;
            while ((n = reader.read(buf)) != -1 && body.length() < 8192) body.append(buf, 0, n);
            reader.close();
            return body.indexOf("\"version\"") >= 0;
        } catch (Exception e) {
            return false;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static String localIpv4() {
        String fallback = null;
        try {
            Enumeration<NetworkInterface> ifs = NetworkInterface.getNetworkInterfaces();
            while (ifs != null && ifs.hasMoreElements()) {
                NetworkInterface ni = ifs.nextElement();
                if (!ni.isUp() || ni.isLoopback()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress a = addrs.nextElement();
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress() || a.isLinkLocalAddress()) continue;
                    String ip = a.getHostAddress();
                    if (ip == null || ip.isEmpty()) continue;
                    if (ip.startsWith("192.168.") || ip.startsWith("10.") || is172Private(ip)) return ip;
                    if (fallback == null) fallback = ip;
                }
            }
        } catch (Exception ignored) {}
        return fallback;
    }

    private static boolean is172Private(String ip) {
        if (!ip.startsWith("172.")) return false;
        try {
            int second = Integer.parseInt(ip.split("\\.")[1]);
            return second >= 16 && second <= 31;
        } catch (Exception e) {
            return false;
        }
    }

    /* ── intents, lifecycle, bridge ──────────────────────────────────── */

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String text = shareTarget(intent);
        if (text == null) return;
        if (setupVisible || lastGoodUrl.isEmpty()) {
            pendingShare = text;
        } else {
            wv.loadUrl(lastGoodUrl + "/#share/" + Uri.encode(text));
        }
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
        if (pendingShare == null || lastGoodUrl.isEmpty() || setupVisible) return;
        String text = pendingShare;
        pendingShare = null;
        wv.loadUrl(lastGoodUrl + "/#share/" + Uri.encode(text));
    }

    @Override
    public void onBackPressed() {
        if (setupVisible) {
            if (!lastGoodUrl.isEmpty() && !restoring) {
                cancelSetup();
                return;
            }
            super.onBackPressed();
            return;
        }
        if (wv.canGoBack()) wv.goBack(); else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        scanPool.shutdownNow();
        cancelScan();
        if (!lastGoodUrl.isEmpty()) prefs().edit().putString(KEY_URL, lastGoodUrl).apply();
        if (wv != null) {
            wv.stopLoading();
            wv.loadUrl("about:blank");
            wv.destroy();
        }
        super.onDestroy();
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static LinearLayout.LayoutParams wrap() {
        return new LinearLayout.LayoutParams(-1, -2);
    }

    private GradientDrawable round(int fill, int stroke, int radiusDp, int strokeDp) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radiusDp));
        if (strokeDp > 0) d.setStroke(dp(strokeDp), stroke);
        return d;
    }

    private void hideKeyboard() {
        try {
            View focus = getCurrentFocus();
            if (focus != null) {
                InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.hideSoftInputFromWindow(focus.getWindowToken(), 0);
                focus.clearFocus();
            }
        } catch (Exception ignored) {}
    }

    class ServerBridge {
        @JavascriptInterface
        public String getServerUrl() {
            return prefs().getString(KEY_URL, "");
        }

        @JavascriptInterface
        public void setServerUrl(String url) {
            try {
                String normalized = normalizeAddress(url);
                prefs().edit().putString(KEY_URL, normalized).apply();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void openSetup() {
            runOnUiThread(() -> showSetup(true, null));
        }
    }
}
