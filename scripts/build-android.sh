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
    </activity>
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
  android:minHeight="90dp"
  android:targetCellWidth="4"
  android:targetCellHeight="2"
  android:updatePeriodMillis="0"
  android:initialLayout="@layout/wavelength_widget"
  android:resizeMode="horizontal|vertical"
  android:widgetCategory="home_screen"
  android:description="@string/widget_description"/>
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

  <TextView
    android:layout_width="wrap_content"
    android:layout_height="wrap_content"
    android:text="WAVELENGTH"
    android:textColor="#99FFFFFF"
    android:textSize="9sp"
    android:letterSpacing="0.2"
    android:fontFamily="sans-serif-medium"/>

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

  <LinearLayout
    android:layout_width="match_parent"
    android:layout_height="wrap_content"
    android:layout_marginTop="8dp"
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
      android:background="@drawable/widget_play_bg"
      android:contentDescription="Play"
      android:src="@android:drawable/ic_media_play"
      android:tint="#FFFFFFFF"/>

    <ImageButton
      android:id="@+id/widget_next"
      android:layout_width="44dp"
      android:layout_height="44dp"
      android:background="@android:color/transparent"
      android:contentDescription="Next"
      android:src="@android:drawable/ic_media_next"
      android:tint="#FFFFFFFF"/>
  </LinearLayout>
</LinearLayout>
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

cat > "$PROJECT/app/src/main/res/drawable/widget_play_bg.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
  android:shape="oval">
  <solid android:color="#26FFFFFF"/>
</shape>
EOF

cat > "$PROJECT/app/src/main/res/values/strings.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_description">Current track and playback controls</string>
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
</resources>
EOF

# The native shell lives in scripts/android so it stays readable and diffable.
cp "$ROOT/scripts/android/MainActivity.java" "$PROJECT/app/src/main/java/app/wavelength/music/MainActivity.java"
cp "$ROOT/scripts/android/PlaybackService.java" "$PROJECT/app/src/main/java/app/wavelength/music/PlaybackService.java"
cp "$ROOT/scripts/android/WavelengthWidget.java" "$PROJECT/app/src/main/java/app/wavelength/music/WavelengthWidget.java"

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
