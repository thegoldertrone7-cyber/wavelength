#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
VERSION_CODE="$(node -p "const v=require('./package.json').version.split('.').map(Number); v[0]*10000+v[1]*100+v[2]")"
PROJECT="$ROOT/android-app"

rm -rf "$PROJECT"
mkdir -p "$PROJECT/app/src/main/assets"
mkdir -p "$PROJECT/app/src/main/java/app/wavelength/music"
mkdir -p "$PROJECT/app/src/main/res/values"
mkdir -p "$PROJECT/app/src/main/res/layout"
mkdir -p "$PROJECT/app/src/main/res/drawable"
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
allprojects {
  repositories {
    google()
    mavenCentral()
    maven { url 'https://jitpack.io' }
  }
}
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

  buildFeatures {
    buildConfig true
  }

  compileOptions {
    sourceCompatibility JavaVersion.VERSION_17
    targetCompatibility JavaVersion.VERSION_17
    coreLibraryDesugaringEnabled true
  }
}

dependencies {
  implementation 'androidx.appcompat:appcompat:1.6.1'
  implementation 'androidx.webkit:webkit:1.11.0'
  implementation 'com.github.teamnewpipe:NewPipeExtractor:0.26.5'
  coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs_nio:2.1.5'
}
EOF

cat > "$PROJECT/app/src/main/AndroidManifest.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
  <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT"/>
  <uses-permission android:name="android.permission.RECORD_AUDIO"/>
  <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
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
      android:launchMode="singleTop"
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
      <meta-data
        android:name="android.app.shortcuts"
        android:resource="@xml/shortcuts"/>
    </activity>
    <activity
      android:name=".NowPlayingActivity"
      android:exported="false"
      android:launchMode="singleTop"
      android:excludeFromRecents="true"
      android:showWhenLocked="true"
      android:turnScreenOn="true"
      android:configChanges="orientation|screenSize|keyboardHidden"
      android:theme="@style/Theme.NowPlaying"/>
    <service
      android:name=".PlaybackService"
      android:exported="false"
      android:foregroundServiceType="mediaPlayback"/>
    <receiver
      android:name=".WavelengthWidget"
      android:exported="false"
      android:label="Wavelength">
      <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE"/>
      </intent-filter>
      <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/wavelength_widget_info"/>
    </receiver>
  </application>
</manifest>
EOF

cat > "$PROJECT/app/src/main/res/xml/wavelength_widget_info.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
  android:minWidth="250dp"
  android:minHeight="180dp"
  android:minResizeWidth="250dp"
  android:minResizeHeight="60dp"
  android:targetCellWidth="4"
  android:targetCellHeight="3"
  android:updatePeriodMillis="0"
  android:initialLayout="@layout/wavelength_widget"
  android:previewLayout="@layout/wavelength_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen"
  android:description="@string/widget_description"/>
EOF

cat > "$PROJECT/app/src/main/res/xml/shortcuts.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
    android:shortcutId="search"
    android:enabled="true"
    android:icon="@drawable/ic_shortcut_search"
    android:shortcutShortLabel="@string/shortcut_search_short"
    android:shortcutLongLabel="@string/shortcut_search_long">
    <intent
      android:action="android.intent.action.MAIN"
      android:targetPackage="app.wavelength.music"
      android:targetClass="app.wavelength.music.MainActivity">
      <extra android:name="launch_route" android:value="search"/>
    </intent>
  </shortcut>
  <shortcut
    android:shortcutId="liked"
    android:enabled="true"
    android:icon="@drawable/ic_shortcut_heart"
    android:shortcutShortLabel="@string/shortcut_liked_short"
    android:shortcutLongLabel="@string/shortcut_liked_long">
    <intent
      android:action="android.intent.action.MAIN"
      android:targetPackage="app.wavelength.music"
      android:targetClass="app.wavelength.music.MainActivity">
      <extra android:name="launch_cmd" android:value="playliked"/>
    </intent>
  </shortcut>
  <shortcut
    android:shortcutId="smartshuffle"
    android:enabled="true"
    android:icon="@drawable/ic_shortcut_shuffle"
    android:shortcutShortLabel="@string/shortcut_shuffle_short"
    android:shortcutLongLabel="@string/shortcut_shuffle_long">
    <intent
      android:action="android.intent.action.MAIN"
      android:targetPackage="app.wavelength.music"
      android:targetClass="app.wavelength.music.MainActivity">
      <extra android:name="launch_cmd" android:value="smartshuffle"/>
    </intent>
  </shortcut>
</shortcuts>
EOF

cat > "$PROJECT/app/src/main/res/layout/wavelength_widget.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="vertical"
  android:gravity="center_vertical"
  android:background="@drawable/widget_bg"
  android:padding="14dp">

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <ImageView
      android:id="@+id/widget_art"
      android:layout_width="72dp"
      android:layout_height="72dp"
      android:scaleType="centerCrop"
      android:background="@drawable/widget_art_bg"
      android:contentDescription="Album art"/>

    <LinearLayout
      android:layout_width="0dp"
      android:layout_height="wrap_content"
      android:layout_weight="1"
      android:layout_marginStart="12dp"
      android:orientation="vertical">

      <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
          android:layout_width="0dp"
          android:layout_height="wrap_content"
          android:layout_weight="1"
          android:text="WAVELENGTH"
          android:textColor="#99FFFFFF"
          android:textSize="9sp"
          android:letterSpacing="0.2"
          android:fontFamily="sans-serif-medium"/>

        <TextView
          android:id="@+id/widget_state"
          android:layout_width="wrap_content"
          android:layout_height="wrap_content"
          android:text="Paused"
          android:textColor="#80FFFFFF"
          android:textSize="9sp"
          android:letterSpacing="0.06"
          android:fontFamily="sans-serif-medium"/>
      </LinearLayout>

      <TextView
        android:id="@+id/widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="Wavelength"
        android:textColor="#FFFFFFFF"
        android:textSize="16sp"
        android:fontFamily="sans-serif-medium"
        android:maxLines="1"
        android:ellipsize="end"/>

      <TextView
        android:id="@+id/widget_artist"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:text="Tap to open"
        android:textColor="#B3FFFFFF"
        android:textSize="12sp"
        android:maxLines="1"
        android:ellipsize="end"/>

      <TextView
        android:id="@+id/widget_album"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="1dp"
        android:text=""
        android:textColor="#80FFFFFF"
        android:textSize="11sp"
        android:textStyle="italic"
        android:maxLines="1"
        android:ellipsize="end"/>
    </LinearLayout>
  </LinearLayout>

  <ProgressBar
    android:id="@+id/widget_progress"
    style="?android:attr/progressBarStyleHorizontal"
    android:layout_width="match_parent"
    android:layout_height="3dp"
    android:layout_marginTop="10dp"
    android:max="1000"
    android:progress="0"
    android:indeterminate="false"
    android:progressDrawable="@drawable/widget_progress"/>

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="4dp"
    android:orientation="horizontal"
    android:gravity="center_vertical">

    <ImageButton
      android:id="@+id/widget_prev"
      android:layout_width="44dp"
      android:layout_height="44dp"
      android:background="@android:color/transparent"
      android:contentDescription="Previous"
      android:src="@android:drawable/ic_media_previous"
      android:tint="#FFFFFFFF"/>

    <ImageButton
      android:id="@+id/widget_play"
      android:layout_width="48dp"
      android:layout_height="48dp"
      android:layout_marginLeft="6dp"
      android:layout_marginRight="6dp"
      android:background="@android:color/transparent"
      android:scaleType="fitCenter"
      android:contentDescription="Play"/>

    <ImageButton
      android:id="@+id/widget_next"
      android:layout_width="44dp"
      android:layout_height="44dp"
      android:background="@android:color/transparent"
      android:contentDescription="Next"
      android:src="@android:drawable/ic_media_next"
      android:tint="#FFFFFFFF"/>

    <FrameLayout
      android:layout_width="0dp"
      android:layout_height="1dp"
      android:layout_weight="1"/>

    <ImageButton
      android:id="@+id/widget_like"
      android:layout_width="44dp"
      android:layout_height="44dp"
      android:padding="10dp"
      android:background="@android:color/transparent"
      android:scaleType="fitCenter"
      android:contentDescription="Like song"
      android:src="@drawable/ic_heart"/>
  </LinearLayout>
</LinearLayout>
EOF

cat > "$PROJECT/app/src/main/res/layout/wavelength_widget_compact.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
  android:id="@+id/widget_root"
  android:layout_width="match_parent"
  android:layout_height="match_parent"
  android:orientation="horizontal"
  android:gravity="center_vertical"
  android:background="@drawable/widget_bg"
  android:paddingLeft="8dp"
  android:paddingRight="4dp"
  android:paddingTop="6dp"
  android:paddingBottom="6dp">

  <ImageView
    android:id="@+id/widget_art"
    android:layout_width="44dp"
    android:layout_height="44dp"
    android:scaleType="centerCrop"
    android:background="@drawable/widget_art_bg"
    android:contentDescription="Album art"/>

  <LinearLayout
    android:layout_width="0dp"
    android:layout_height="wrap_content"
    android:layout_weight="1"
    android:layout_marginStart="10dp"
    android:layout_marginEnd="6dp"
    android:orientation="vertical">

    <TextView
      android:id="@+id/widget_title"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:text="Wavelength"
      android:textColor="#FFFFFFFF"
      android:textSize="13sp"
      android:fontFamily="sans-serif-medium"
      android:maxLines="1"
      android:ellipsize="end"/>

    <TextView
      android:id="@+id/widget_artist"
      android:layout_width="match_parent"
      android:layout_height="wrap_content"
      android:text="Tap to open"
      android:textColor="#B3FFFFFF"
      android:textSize="11sp"
      android:maxLines="1"
      android:ellipsize="end"/>

    <ProgressBar
      android:id="@+id/widget_progress"
      style="?android:attr/progressBarStyleHorizontal"
      android:layout_width="match_parent"
      android:layout_height="3dp"
      android:layout_marginTop="5dp"
      android:max="1000"
      android:progress="0"
      android:indeterminate="false"
      android:progressDrawable="@drawable/widget_progress"/>
  </LinearLayout>

  <ImageButton
    android:id="@+id/widget_prev"
    android:layout_width="38dp"
    android:layout_height="44dp"
    android:background="@android:color/transparent"
    android:contentDescription="Previous"
    android:src="@android:drawable/ic_media_previous"
    android:tint="#FFFFFFFF"/>

  <ImageButton
    android:id="@+id/widget_play"
    android:layout_width="44dp"
    android:layout_height="44dp"
    android:background="@android:color/transparent"
    android:scaleType="fitCenter"
    android:contentDescription="Play"/>

  <ImageButton
    android:id="@+id/widget_next"
    android:layout_width="38dp"
    android:layout_height="44dp"
    android:background="@android:color/transparent"
    android:contentDescription="Next"
    android:src="@android:drawable/ic_media_next"
    android:tint="#FFFFFFFF"/>
</LinearLayout>
EOF

cat > "$PROJECT/app/src/main/res/drawable/widget_progress.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:id="@android:id/background">
    <shape android:shape="rectangle">
      <corners android:radius="2dp"/>
      <solid android:color="#33FFFFFF"/>
    </shape>
  </item>
  <item android:id="@android:id/progress">
    <clip>
      <shape android:shape="rectangle">
        <corners android:radius="2dp"/>
        <solid android:color="#F2FFFFFF"/>
      </shape>
    </clip>
  </item>
</layer-list>
EOF

cat > "$PROJECT/app/src/main/res/drawable/ic_heart.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#CCFFFFFF"
    android:pathData="M16.5,3c-1.74,0 -3.41,0.81 -4.5,2.09C10.91,3.81 9.24,3 7.5,3 4.42,3 2,5.42 2,8.5c0,3.78 3.4,6.86 8.55,11.54L12,21.35l1.45,-1.32C18.6,15.36 22,12.28 22,8.5 22,5.42 19.58,3 16.5,3zM12.1,18.55l-0.1,0.1 -0.1,-0.1C7.14,14.24 4,11.39 4,8.5 4,6.5 5.5,5 7.5,5c1.54,0 3.04,0.99 3.57,2.36h1.87C13.46,5.99 14.96,5 16.5,5c2,0 3.5,1.5 3.5,3.5 0,2.89 -3.14,5.74 -7.9,10.05z"/>
</vector>
EOF

cat > "$PROJECT/app/src/main/res/drawable/ic_heart_filled.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="24dp"
  android:height="24dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFFF4FA3"
    android:pathData="M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z"/>
</vector>
EOF

cat > "$PROJECT/app/src/main/res/drawable/ic_shortcut_search.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFD71921"
    android:pathData="M15.5,14h-0.79l-0.28,-0.27C15.41,12.59 16,11.11 16,9.5 16,5.91 13.09,3 9.5,3S3,5.91 3,9.5 5.91,16 9.5,16c1.61,0 3.09,-0.59 4.23,-1.57l0.27,0.28v0.79l5,4.99L20.49,19l-4.99,-5zM9.5,14C7.01,14 5,11.99 5,9.5S7.01,5 9.5,5 14,7.01 14,9.5 11.99,14 9.5,14z"/>
</vector>
EOF

cat > "$PROJECT/app/src/main/res/drawable/ic_shortcut_heart.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFD71921"
    android:pathData="M12,21.35l-1.45,-1.32C5.4,15.36 2,12.28 2,8.5 2,5.42 4.42,3 7.5,3c1.74,0 3.41,0.81 4.5,2.09C13.09,3.81 14.76,3 16.5,3 19.58,3 22,5.42 22,8.5c0,3.78 -3.4,6.86 -8.55,11.54L12,21.35z"/>
</vector>
EOF

cat > "$PROJECT/app/src/main/res/drawable/ic_shortcut_shuffle.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="48dp"
  android:height="48dp"
  android:viewportWidth="24"
  android:viewportHeight="24">
  <path
    android:fillColor="#FFD71921"
    android:pathData="M10.59,9.17L5.41,4 4,5.41l5.17,5.17 1.42,-1.41zM14.5,4l2.04,2.04L4,18.59 5.41,20 17.96,7.46 20,9.5L20,4h-5.5zM14.83,13.41l-1.41,1.41 3.13,3.13L14.5,20L20,20v-5.5l-2.04,2.04 -3.13,-3.13z"/>
</vector>
EOF

cat > "$PROJECT/app/src/main/res/drawable/widget_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
  android:shape="rectangle">
  <corners android:radius="24dp"/>
  <solid android:color="#E6101014"/>
  <stroke android:width="1dp" android:color="#33FFFFFF"/>
</shape>
EOF

cat > "$PROJECT/app/src/main/res/drawable/widget_art_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
  android:shape="rectangle">
  <corners android:radius="18dp"/>
  <solid android:color="#1FFFFFFF"/>
</shape>
EOF

cat > "$PROJECT/app/src/main/res/values/strings.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_description">Current track, progress and playback controls. Resize it shorter for a compact strip.</string>
  <string name="shortcut_search_short">Search</string>
  <string name="shortcut_search_long">Search for music</string>
  <string name="shortcut_liked_short">Liked songs</string>
  <string name="shortcut_liked_long">Play your liked songs</string>
  <string name="shortcut_shuffle_short">Smart shuffle</string>
  <string name="shortcut_shuffle_long">Smart shuffle your library</string>
</resources>
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
  <style name="Theme.NowPlaying" parent="@android:style/Theme.Material.NoActionBar">
    <item name="android:windowBackground">#000000</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowFullscreen">true</item>
    <item name="android:windowShowWallpaper">false</item>
    <item name="android:statusBarColor">#000000</item>
    <item name="android:navigationBarColor">#000000</item>
    <item name="android:windowAnimationStyle">@android:style/Animation.Activity</item>
  </style>
</resources>
EOF

# The native shell lives in scripts/android so it stays readable and diffable.
cp "$ROOT/scripts/android/MainActivity.java" "$PROJECT/app/src/main/java/app/wavelength/music/MainActivity.java"
cp "$ROOT/scripts/android/PlaybackService.java" "$PROJECT/app/src/main/java/app/wavelength/music/PlaybackService.java"
cp "$ROOT/scripts/android/WavelengthWidget.java" "$PROJECT/app/src/main/java/app/wavelength/music/WavelengthWidget.java"
cp "$ROOT/scripts/android/NowPlayingActivity.java" "$PROJECT/app/src/main/java/app/wavelength/music/NowPlayingActivity.java"
cp "$ROOT/scripts/android/VizView.java" "$PROJECT/app/src/main/java/app/wavelength/music/VizView.java"
cp "$ROOT/scripts/android/WebUpdater.java" "$PROJECT/app/src/main/java/app/wavelength/music/WebUpdater.java"
if [ -f "$ROOT/update-pubkey.pem" ]; then cp "$ROOT/update-pubkey.pem" "$PROJECT/app/src/main/assets/update-pubkey.pem"; fi
cp "$ROOT/scripts/android/AudioTap.java" "$PROJECT/app/src/main/java/app/wavelength/music/AudioTap.java"
cp "$ROOT/scripts/android/LoudnessAnalyzer.java" "$PROJECT/app/src/main/java/app/wavelength/music/LoudnessAnalyzer.java"

mkdir -p "$ROOT/dist"

# Make local builds find the Android SDK the same way Android Studio does.
if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
    for CAND in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk" "/usr/local/share/android-sdk"; do
        if [ -d "$CAND" ]; then
            export ANDROID_HOME="$CAND"
            break
        fi
    done
fi

# Android Gradle Plugin 8.2.x supports Gradle 8.2–8.7, but developers may have
# Gradle 9+ installed locally. CI pins Gradle 8.7; for a newer local Gradle we
# generate a throwaway 8.7 wrapper so the same script works in both places.
GRADLE_CMD="gradle"
if command -v gradle >/dev/null 2>&1; then
    GRADLE_MAJOR="$(gradle --version 2>/dev/null | awk '/^Gradle /{split($2,a,"."); print a[1]; exit}')"
    if [ "${GRADLE_MAJOR:-0}" -ge 9 ]; then
        echo "Gradle ${GRADLE_MAJOR} is newer than AGP 8.2 supports — using a local Gradle 8.7 wrapper."
        WRAP_DIR="$(mktemp -d)"
        : > "$WRAP_DIR/settings.gradle"
        (cd "$WRAP_DIR" && gradle wrapper --gradle-version 8.7 --distribution-type bin --no-daemon >/dev/null)
        cp -R "$WRAP_DIR/gradle" "$PROJECT/gradle"
        cp "$WRAP_DIR/gradlew" "$PROJECT/gradlew"
        [ -f "$WRAP_DIR/gradlew.bat" ] && cp "$WRAP_DIR/gradlew.bat" "$PROJECT/gradlew.bat"
        chmod +x "$PROJECT/gradlew"
        rm -rf "$WRAP_DIR"
        GRADLE_CMD="$PROJECT/gradlew"

        # Gradle 8.7 runs on JDK 17–21. If the default JDK is newer (for
        # example 25), reuse a JDK 21 that Gradle already provisioned.
        JAVA_MAJOR="$(java -version 2>&1 | awk -F'[\".]' '/version/{print ($2=="1"?$3:$2); exit}')"
        if [ "${JAVA_MAJOR:-0}" -gt 21 ]; then
            for CAND in "$HOME/.gradle/jdks"/*/jdk-21*/Contents/Home /Library/Java/JavaVirtualMachines/*21*/Contents/Home; do
                if [ -x "$CAND/bin/java" ]; then
                    export JAVA_HOME="$CAND"
                    echo "Using JDK 21 from $JAVA_HOME"
                    break
                fi
            done
        fi
    fi
fi

"$GRADLE_CMD" -p "$PROJECT" assembleDebug --no-daemon

APK="$(find "$PROJECT/app/build/outputs/apk/debug" -name '*.apk' -print -quit)"
if [ -z "$APK" ]; then
    echo "APK build produced no output" >&2
    exit 1
fi
cp "$APK" "$ROOT/dist/Wavelength-${VERSION}-android.apk"
echo "APK: $ROOT/dist/Wavelength-${VERSION}-android.apk"
