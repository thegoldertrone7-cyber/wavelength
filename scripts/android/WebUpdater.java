package app.wavelength.music;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebResourceResponse;
import androidx.webkit.WebViewAssetLoader;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.zip.GZIPInputStream;

/* In-app updates for the web layer (everything under public/). The bundle is verified with SHA-256
   and an ECDSA P-256 signature (update-pubkey.pem in the APK's assets) and unpacked into private
   storage. It is used in place of the packaged files at the next start. If the page never confirms
   a successful start, the next launch drops the update and goes back to the packaged files. */
final class WebUpdater {
    static final String MANIFEST = "https://github.com/thegoldertrone7-cyber/wavelength/releases/latest/download/update.json";
    private static final int MAX = 60 * 1024 * 1024;
    private final Context ctx;
    private final File root;
    private final SharedPreferences sp;
    private File active;
    private String activeVersion = "";
    private JSONObject avail;
    private long checkedAt = 0;
    private String error = "";

    WebUpdater(Context c) {
        ctx = c;
        root = new File(c.getFilesDir(), "webupdate");
        sp = c.getSharedPreferences("webupdate", Context.MODE_PRIVATE);
    }

    String appVersion() {
        try { return ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0).versionName; } catch (Exception e) { return "0.0.0"; }
    }

    static int cmp(String a, String b) {
        String[] x = a.split("\\."), y = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
            if (p != q) return p > q ? 1 : -1;
        }
        return 0;
    }
    private static int num(String s) { try { return Integer.parseInt(s.replaceAll("\\D", "")); } catch (Exception e) { return 0; } }

    private String versionOf(File dir) {
        try {
            byte[] b = readAll(new FileInputStream(new File(dir, "package.json")), 1 << 20);
            return new JSONObject(new String(b, "UTF-8")).optString("version", "0.0.0");
        } catch (Exception e) { return "0.0.0"; }
    }

    /* Call once before the WebView loads. Applies a staged update and rolls back one that never started. */
    synchronized void prepare() {
        File cur = new File(root, "current"), next = new File(root, "next");
        if (!sp.getString("booting", "").isEmpty()) {
            sp.edit().putString("bad", sp.getString("booting", "")).putString("booting", "").apply();
            deleteTree(cur);
        }
        if (new File(next, "public/index.html").exists()) {
            deleteTree(cur);
            next.renameTo(cur);
        }
        active = null; activeVersion = "";
        if (new File(cur, "public/index.html").exists()) {
            String v = versionOf(cur);
            if (cmp(v, appVersion()) > 0 && !v.equals(sp.getString("bad", ""))) {
                active = cur; activeVersion = v;
                sp.edit().putString("booting", v).apply();
            } else deleteTree(cur);
        }
    }

    void confirm() { sp.edit().putString("booting", "").apply(); }

    WebViewAssetLoader.PathHandler handler(final WebViewAssetLoader.PathHandler fallback) {
        return path -> {
            File d = active;
            if (d != null && path != null && path.startsWith("public/")) {
                try {
                    File f = new File(d, path);
                    if (f.getCanonicalPath().startsWith(d.getCanonicalPath() + File.separator) && f.isFile()) {
                        return new WebResourceResponse(mime(path), "UTF-8", new FileInputStream(f));
                    }
                } catch (Exception ignored) {}
            }
            return fallback.handle(path);
        };
    }

    private static String mime(String p) {
        p = p.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private static byte[] readAll(InputStream in, int max) throws Exception {
        try (InputStream i = in) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[16384]; int n;
            while ((n = i.read(buf)) > 0) { o.write(buf, 0, n); if (o.size() > max) throw new Exception("Update is too large"); }
            return o.toByteArray();
        }
    }

    private static byte[] get(String url, int max) throws Exception {
        for (int hop = 0; hop < 6; hop++) {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(30000); c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "Wavelength-Updater");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) { url = new URL(new URL(url), c.getHeaderField("Location")).toString(); c.disconnect(); continue; }
            if (code != 200) throw new Exception("Update server answered " + code);
            return readAll(c.getInputStream(), max);
        }
        throw new Exception("Too many redirects");
    }

    private void verify(String hashHex, String sigB64) throws Exception {
        String pem = new String(readAll(ctx.getAssets().open("update-pubkey.pem"), 4096), "UTF-8")
            .replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
        Signature s = Signature.getInstance("SHA256withECDSA");
        s.initVerify(KeyFactory.getInstance("EC").generatePublic(new X509EncodedKeySpec(android.util.Base64.decode(pem, android.util.Base64.DEFAULT))));
        s.update(hashHex.getBytes("UTF-8"));
        if (!s.verify(android.util.Base64.decode(sigB64, android.util.Base64.DEFAULT))) throw new Exception("The update is not signed by Wavelength. It was not installed.");
    }

    synchronized JSONObject check() {
        try {
            try { ctx.getAssets().open("update-pubkey.pem").close(); } catch (Exception e) { throw new Exception("Updates are not set up in this build (no signing key)."); }
            JSONObject m = new JSONObject(new String(get(MANIFEST, 100000), "UTF-8"));
            String v = m.optString("version", "");
            if (!v.matches("\\d+\\.\\d+\\.\\d+") || !m.optString("sha256", "").matches("[a-f0-9]{64}")) throw new Exception("Update information is malformed");
            String running = activeVersion.isEmpty() ? appVersion() : activeVersion;
            String staged = stagedVersion();
            avail = null; error = "";
            if (cmp(v, running) > 0 && !v.equals(staged)) avail = m;
        } catch (Exception e) { avail = null; error = e.getMessage() == null ? "Could not check for updates" : e.getMessage(); }
        checkedAt = System.currentTimeMillis();
        return status();
    }

    private String stagedVersion() { File n = new File(root, "next"); return new File(n, "public/index.html").exists() ? versionOf(n) : ""; }

    synchronized JSONObject install() throws Exception {
        if (avail == null) throw new Exception("No update to install. Check for updates first.");
        JSONObject a = avail;
        String min = a.optString("minShell", "");
        if (!min.isEmpty() && cmp(appVersion(), min) < 0) throw new Exception("This update needs the app itself to be updated (version " + min + " or newer). Install the new APK once.");
        verify(a.getString("sha256"), a.optString("sig", ""));
        byte[] gz = get(new URL(new URL(MANIFEST), a.optString("url", "wavelength-update.tar.gz")).toString(), MAX);
        String hex = hex(MessageDigest.getInstance("SHA-256").digest(gz));
        if (!hex.equals(a.getString("sha256"))) throw new Exception("The download was damaged. Try again.");
        File tmp = new File(root, "next.tmp");
        deleteTree(tmp); tmp.mkdirs();
        int n = untar(new GZIPInputStream(new java.io.ByteArrayInputStream(gz)), tmp);
        if (n < 3 || !new File(tmp, "public/index.html").exists() || !versionOf(tmp).equals(a.getString("version"))) { deleteTree(tmp); throw new Exception("The update is incomplete"); }
        File next = new File(root, "next");
        deleteTree(next);
        if (!tmp.renameTo(next)) throw new Exception("Could not store the update");
        avail = null;
        return status();
    }

    /* Switches to a staged update immediately; the caller then reloads the page. */
    synchronized boolean applyNow() {
        if (stagedVersion().isEmpty()) return false;
        prepare();
        return true;
    }

    private static String hex(byte[] b) { StringBuilder s = new StringBuilder(); for (byte x : b) s.append(String.format("%02x", x)); return s.toString(); }

    private static int untar(InputStream in, File dest) throws Exception {
        byte[] h = new byte[512]; int files = 0;
        while (readFully(in, h) == 512) {
            boolean zero = true; for (byte b : h) if (b != 0) { zero = false; break; }
            if (zero) break;
            String name = new String(h, 0, 100, "UTF-8").replaceAll("\0.*$", "");
            String size = new String(h, 124, 12, "ASCII").replaceAll("\0.*$", "").trim();
            long len = size.isEmpty() ? 0 : Long.parseLong(size, 8);
            char type = h[156] == 0 ? '0' : (char) h[156];
            boolean ok = type == '0' && name.startsWith("public/") && !name.contains("..") && !name.startsWith("/");
            File out = ok ? new File(dest, name) : null;
            if (out != null) {
                if (!out.getCanonicalPath().startsWith(dest.getCanonicalPath() + File.separator)) throw new Exception("Unsafe path in update");
                out.getParentFile().mkdirs();
            }
            try (FileOutputStream fo = out == null ? null : new FileOutputStream(out)) {
                long left = len; byte[] buf = new byte[8192];
                while (left > 0) { int r = in.read(buf, 0, (int) Math.min(buf.length, left)); if (r < 0) throw new Exception("Truncated update"); if (fo != null) fo.write(buf, 0, r); left -= r; }
            }
            if (out != null) files++;
            long pad = (512 - (len % 512)) % 512;
            while (pad > 0) { long s = in.skip(pad); if (s <= 0) { if (in.read() < 0) break; s = 1; } pad -= s; }
        }
        return files;
    }

    private static int readFully(InputStream in, byte[] b) throws Exception {
        int o = 0; while (o < b.length) { int r = in.read(b, o, b.length - o); if (r < 0) break; o += r; } return o;
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) return;
        File[] k = f.listFiles();
        if (k != null) for (File c : k) deleteTree(c);
        f.delete();
    }

    JSONObject status() {
        try {
            JSONObject o = new JSONObject();
            String running = activeVersion.isEmpty() ? appVersion() : activeVersion, staged = stagedVersion();
            o.put("shell", appVersion()).put("running", running).put("staged", staged.equals(running) ? "" : staged)
                .put("rolledBack", !sp.getString("bad", "").isEmpty()).put("checkedAt", checkedAt).put("error", error).put("canUpdate", true);
            if (avail != null) {
                String min = avail.optString("minShell", "");
                o.put("available", new JSONObject().put("version", avail.optString("version")).put("notes", avail.optString("notes"))
                    .put("size", avail.optLong("size")).put("needsInstaller", !min.isEmpty() && cmp(appVersion(), min) < 0).put("minShell", min));
            } else o.put("available", JSONObject.NULL);
            return o;
        } catch (Exception e) { return new JSONObject(); }
    }
}
