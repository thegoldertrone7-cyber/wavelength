#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
VERSION_CODE="${GITHUB_RUN_NUMBER:-1}"
PROJECT="$ROOT/android-app"

rm -rf "$PROJECT"
mkdir -p "$PROJECT/app/src/main/assets"
mkdir -p "$PROJECT/app/src/main/java/app/wavelength/music"
mkdir -p "$PROJECT/app/src/main/res/values"
mkdir -p "$PROJECT/app/src/main/res/mipmap-xxxhdpi"
mkdir -p "$PROJECT/app/src/main/res/xml"

cp -R "$ROOT/public" "$PROJECT/app/src/main/assets/public"
cp "$ROOT/build/icon.png" "$PROJECT/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"

cat > "$PROJECT/settings.gradle" <<'EOF'
rootProject.name = "Wavelength"
include ':app'
EOF

cat > "$PROJECT/build.gradle" <<'EOF'
buildscript {
  repositories { google(); mavenCentral() }
  dependencies { classpath 'com.android.tools.build:gradle:8.2.2' }
}
allprojects { repositories { google(); mavenCentral() } }
EOF

cat > "$PROJECT/gradle.properties" <<'EOF'
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.nonTransitiveRClass=true
EOF

cat > "$PROJECT/app/build.gradle" <<EOF
plugins { id 'com.android.application' }

android {
  namespace 'app.wavelength.music'
  compileSdk 34

  defaultConfig {
    applicationId 'app.wavelength.music'
    minSdk 26
    targetSdk 34
    versionCode $VERSION_CODE
    versionName '$VERSION'
  }

  buildTypes {
    release { minifyEnabled false }
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
  }
}

dependencies {
  implementation 'androidx.appcompat:appcompat:1.6.1'
}
EOF

cat > "$PROJECT/app/src/main/AndroidManifest.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="Wavelength"
    android:theme="@style/Theme.App"
    android:usesCleartextTraffic="true"
    android:networkSecurityConfig="@xml/network_security">
    <activity
      android:name=".MainActivity"
      android:exported="true"
      android:configChanges="orientation|screenSize|keyboardHidden"
      android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN"/>
        <category android:name="android.intent.category.LAUNCHER"/>
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.SEND"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <data android:mimeType="text/plain"/>
      </intent-filter>
      <intent-filter>
        <action android:name="android.intent.action.VIEW"/>
        <category android:name="android.intent.category.DEFAULT"/>
        <category android:name="android.intent.category.BROWSABLE"/>
        <data android:scheme="https" android:host="open.spotify.com"/>
      </intent-filter>
    </activity>
  </application>
</manifest>
EOF

cat > "$PROJECT/app/src/main/res/xml/network_security.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Wavelength is often hosted on a LAN over plain HTTP. -->
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
EOF

cat > "$PROJECT/app/src/main/res/values/styles.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.App" parent="Theme.AppCompat.NoActionBar">
    <item name="android:windowBackground">#000000</item>
    <item name="android:statusBarColor">#000000</item>
    <item name="android:navigationBarColor">#000000</item>
  </style>
</resources>
EOF

cat > "$PROJECT/app/src/main/java/app/wavelength/music/MainActivity.java" <<'EOF'
package app.wavelength.music;

import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Thin WebView wrapper. The app does not bundle the Node server: point it at
 * an existing Wavelength server on the LAN (or localhost under Termux).
 */
public class MainActivity extends AppCompatActivity {
    private WebView wv;

    private static final String PREFS = "wl";
    private static final String KEY_URL = "server_url";
    private static final String DEFAULT_URL = "http://127.0.0.1:3000";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        wv = new WebView(this);
        WebSettings ws = wv.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setMediaPlaybackRequiresUserGesture(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        wv.setWebChromeClient(new WebChromeClient());
        wv.addJavascriptInterface(new ServerBridge(), "AndroidBridge");

        FrameLayout root = new FrameLayout(this);
        root.addView(wv, new FrameLayout.LayoutParams(-1, -1));

        Button serverButton = new Button(this);
        serverButton.setText("\u22ee");
        serverButton.setContentDescription("Server address");
        serverButton.setTextColor(Color.WHITE);
        serverButton.setTextSize(20);
        serverButton.setAlpha(0.55f);
        serverButton.setBackgroundColor(Color.TRANSPARENT);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(dp(44), dp(44));
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.topMargin = dp(8);
        lp.rightMargin = dp(8);
        root.addView(serverButton, lp);
        serverButton.setOnClickListener(v -> showServerDialog());
        setContentView(root);

        String saved = prefs().getString(KEY_URL, "");
        if (saved.isEmpty()) {
            showServerDialog();
        } else {
            connect(saved);
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, 0);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void connect(String url) {
        wv.loadUrl(url);
        handleIntent(getIntent(), url);
    }

    private void showServerDialog() {
        String current = prefs().getString(KEY_URL, DEFAULT_URL);

        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(current);
        input.setSelectAllOnFocus(true);
        input.setHint("http://192.168.1.10:3000");

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(8), dp(20), 0);
        box.addView(input);

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Wavelength server")
            .setMessage("Enter the address of the computer running Wavelength on the same Wi-Fi.")
            .setView(box)
            .setPositiveButton("Connect", null)
            .setNegativeButton("Cancel", null)
            .create();

        dialog.setOnShowListener(ignored ->
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String url = input.getText().toString().trim();
                if (url.isEmpty()) {
                    input.setError("Server address is required");
                    return;
                }
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    url = "http://" + url;
                }
                while (url.endsWith("/")) {
                    url = url.substring(0, url.length() - 1);
                }
                prefs().edit().putString(KEY_URL, url).apply();
                dialog.dismiss();
                connect(url);
            })
        );
        dialog.show();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String saved = prefs().getString(KEY_URL, "");
        if (saved.isEmpty()) {
            showServerDialog();
        } else {
            handleIntent(intent, saved);
        }
    }

    private void handleIntent(Intent intent, String base) {
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (text != null) {
                wv.loadUrl(base + "/#share/" + Uri.encode(text));
            }
        } else if (Intent.ACTION_VIEW.equals(intent.getAction()) && intent.getData() != null) {
            wv.loadUrl(base + "/#share/" + Uri.encode(intent.getData().toString()));
        }
    }

    @Override
    public void onBackPressed() {
        if (wv.canGoBack()) {
            wv.goBack();
        } else {
            super.onBackPressed();
        }
    }

    class ServerBridge {
        @JavascriptInterface
        public String getServerUrl() {
            return prefs().getString(KEY_URL, DEFAULT_URL);
        }

        @JavascriptInterface
        public void setServerUrl(String url) {
            if (url != null && !url.trim().isEmpty()) {
                prefs().edit().putString(KEY_URL, url.trim()).apply();
            }
        }
    }
}
EOF

mkdir -p "$ROOT/dist"
gradle -p "$PROJECT" assembleDebug --no-daemon

APK="$(find "$PROJECT/app/build/outputs/apk/debug" -name '*.apk' -print -quit)"
if [ -z "$APK" ]; then
    echo "APK build produced no output" >&2
    exit 1
fi
cp "$APK" "$ROOT/dist/Wavelength-${VERSION}-android.apk"
echo "APK: $ROOT/dist/Wavelength-${VERSION}-android.apk"
