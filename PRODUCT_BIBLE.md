# Wavelength — Product Bible

> **A small, well-made music machine.**
>
> Wavelength is a free, ad-free music player that turns a link, a song name, or a folder of
> files into something that plays beautifully and belongs to you. It is designed to feel like
> a late-night radio room and a piece of tactile audio hardware, not a streaming storefront.

**Current state**

| Build | Version | Notes |
| --- | --- | --- |
| Android APK | **v2.4.0** | Standalone, debug-signed, direct install |
| Published desktop installers | **v2.3.0** | macOS universal, Windows NSIS, Linux AppImage / Flatpak |
| Source / browser mode | **v2.4.0 tree** | Runs through the bundled Node server |

The `v2.4.0` tree adds the Android work; the Android APK is built from it and the newest desktop
installers still point at `v2.3.0` until they are republished. The desktop builds are unsigned.
This document describes shipped behaviour first and future direction second.
Anything outside the **Shipped** sections is a plan, not a promise.

---

## 1. The one-page pitch

Wavelength is for the moment when you already know what you want to hear.

Paste a Spotify playlist link, type a song, or point the app at your own FLAC library. Wavelength
finds the audio, strips away the video page and the ad break, and gives you a player that is
quiet, fast, and pleasant to look at. The result can stay: a playlist, a download, a local
lossless file, a library on your own disk.

There is no feed to scroll, no comments, no account requirement, no upsell, and no recommendation
engine deciding what you meant. Search is search. Import is import. Play is play. The app gets
out of the way while the music is playing, and still feels designed when you stop to look at it.

**What it is**

- A player first, a catalogue second.
- A bridge from Spotify links and song lists to playable YouTube audio.
- A local library for playlists, liked songs, history, downloads, and lossless files.
- A sync tool for carrying that library between a computer and a phone.
- A highly themeable interface with a coherent visual and motion system.

**What it is not**

- Not a Spotify client. It imports metadata and finds equivalents on YouTube.
- Not a YouTube front-end. It resolves audio and never shows the video page.
- Not a cloud locker. Your library lives on your devices.
- Not a social network, podcast app, video app, or recommendation feed.
- Not a lossless streaming service. Only local files are lossless.
- Not an ad blocker. It plays audio streams without the video ad experience.
- Not a subscription. It is free.

---

## 2. Strategy

### 2.1 The problem

Most music apps are catalogues that happen to play music. They begin with a feed, a promotion,
or an algorithmic guess. They make the simple act of playing a known song feel like navigating
someone else's store. Your library is rented, your history is mined, and the player is often the
least considered surface in the product.

### 2.2 The insight

The moment of value is not discovery. It is **intent**:

> “I have this link / this song / this file. Play it now, and make it feel good.”

Wavelength is built around that moment. Import is the onboarding. The player is the product. The
library is the memory. Everything else supports those three things.

### 2.3 Five product bets

| Bet | What it means | How it shows up |
| --- | --- | --- |
| **Import is onboarding** | The fastest path to value is bringing an existing playlist over, not building a new one from zero. | Spotify link import, paste-list parsing, preview-before-save, match progress, update-in-place. |
| **The player is the product** | The transport, queue, artwork, and now-playing view deserve more care than the browse pages. | Floating player capsule, full-screen room, real-audio visualizer, stable metadata, sleep timer, resume. |
| **Own your library** | Playlists and files should survive without an account or a subscription. | Local state, MP3 downloads, local lossless playback, optional peer sync. |
| **Sync is a courtesy, not a cloud** | Moving a library between devices should not require a central service. | Host / join with a short code, explicit pull and send, no account, no merge mystery. |
| **One system, platform dialects** | The app should feel like Wavelength everywhere, while respecting the device it is on. | 14 palettes, 8 interface styles, desktop sidebar, phone header, Android system integration. |

### 2.4 Jobs to be done

1. **“I have a Spotify playlist. Make it playable without ads.”**
2. **“I want this one song now, without opening YouTube.”**
3. **“I want my FLACs to sound like my FLACs.”**
4. **“I want my phone to carry my library, even when the computer is off.”**
5. **“I want the app to look like mine, not like everyone else's.”**
6. **“I don't want to lose the library I've built.”**

### 2.5 Who it is for

- **The importer.** Has years of Spotify playlists, a laptop, and no interest in rebuilding them.
  Wants a fast desktop player and an MP3 folder that works anywhere.
- **The collector.** Has local FLAC/WAV/ALAC files and a good pair of headphones. Wants native
  playback, real metadata, and no transcoding.
- **The pocket listener.** Wants a standalone phone app for search, playlists, and lock-screen
  controls, with a computer used only when syncing.
- **The tinkerer.** Cares about themes, type, motion, keyboard shortcuts, and the difference
  between “good” and “made for me.”

### 2.6 Who it is not for

- Someone who wants Spotify's full catalogue, social graph, and licensed streaming.
- Someone who wants podcasts, video, live sessions, or a general media hub.
- Someone who wants an always-on cloud library with automatic conflict-free sync.
- Someone who wants lossless YouTube audio. That does not exist, and the app says so.

---

## 3. Identity and feel

### 3.1 The room

The interface is a **late-night radio room**: deep backgrounds, soft light, dotted rhythms,
monospaced labels, and a machine that feels alive without demanding attention. It is not a
nightclub, a storefront, or a productivity dashboard.

The room has rules:

- **The music is the brightest object on screen.** Album art supplies the colour.
- **Nothing flashes for attention.** No bouncing badges, no red dots, no urgency.
- **The machine is handled, not scrolled.** Small mechanical details reward a second look.
- **The app disappears while playing.** The player remains, but the interface recedes.
- **One surface, not a pile of pages.** Navigation changes the content, not the mood.

### 3.2 Brand attributes

| Attribute | Expression |
| --- | --- |
| **Quiet** | Sentence-case labels, no exclamation marks, generous space. |
| **Tactile** | Press scales, hover lifts, dotted tracks, a spinning record, haptic ticks. |
| **Precise** | Mono metadata, exact durations, stable layout, honest status text. |
| **Nocturnal** | True black, smoked glass, a barely visible accent glow. |
| **Slightly strange** | Dot-matrix glyphs, 2×2 logo, tiny numeric readouts, a machine personality. |
| **Non-corporate** | No mascot, no stock lifestyle photography, no growth language. |

### 3.3 Name and mark

**Wavelength** refers to signal, radio, and the space between people and sound. It is written as
one word, capital W, never “WaveLength” or “Wavelength app.”

The mark is a **2×2 block of dots**. In the hero, the wordmark is split across two lines:

```
WAVE
LENGTH
```

The dots are the smallest unit of the brand. They appear in the logo, the play glyph, the
progress track, empty artwork, genre tiles, and the active navigation indicator. They are a
rhythm, not a texture. If every surface were dotted, the motif would stop meaning anything.

### 3.4 Voice

Wavelength speaks like a good piece of equipment: calm, exact, and slightly dry.

- Say what happened.
- Say what it means.
- Say what to do next, if anything.
- Never perform enthusiasm.
- Never blame the user.
- Never hide a limitation in small print.

Examples of the voice in production:

> “Found 42 songs — preview the import below.”
>
> “Spotify only shares the first 100 songs without signing in.”
>
> “Offline downloads are the next standalone step.”
>
> “Newest send wins, so treat the host as the shared copy.”
>
> “YouTube audio is lossy; lossless playback comes from local files.”

---

## 4. Visual system

### 4.1 The palette contract

A palette supplies every colour in the interface:

- page background;
- card surface;
- raised inner surface for rows, inputs, and controls;
- three text levels;
- dotted-pattern colour;
- inverted colour for active pills and the play button;
- a default accent.

The accent can be replaced with a classic colour, a Catppuccin accent, or any custom colour. It
drives progress, focus rings, the active navigation dot, the play ring, the ambient glow, and
selected states.

**Interface styles never change the palette.** A style may change geometry, type, blur, and
control weight, but switching from Nothing OS to Windows 11 must not recolour the app. This is a
hard contract.

### 4.2 Core tokens

| Token | Dark default | Light default | Job |
| --- | --- | --- | --- |
| `--bg` | `#000000` | `#e6e6e8` | Page |
| `--card` | `#0d0d0e` | `#f7f7f8` | Primary surface |
| `--card2` | `#171718` | `#ebebed` | Raised rows, inputs |
| `--text` | `#f4f4f4` | `#0e0e10` | Primary text |
| `--text2` | `#9b9ba1` | `#68686f` | Secondary text |
| `--text3` | `#5d5d63` | `#a2a2a9` | Tertiary text |
| `--line` | `rgba(255,255,255,.09)` | `rgba(0,0,0,.09)` | Borders |
| `--accent` | `#d71921` | `#d71921` | Signal colour |

Light themes are cool paper grey, not pure white. Dark themes use true black or near-black with
almost-black cards. Catppuccin themes keep their own muted contrast and mauve-led accents.

### 4.3 The 14 palettes

| Group | Palettes |
| --- | --- |
| **Essentials** | Dark, Light, System |
| **Colour themes** | Rose, Amber, Teal, Sky, Violet, Lime, Slate |
| **Catppuccin** | Latte, Frappé, Macchiato, Mocha |

**System** follows the operating system's light/dark preference. Catppuccin Latte is the light
theme; Frappé, Macchiato, and Mocha are dark. Every palette carries its own default accent, and
the accent can be overridden independently.

High-contrast mode strengthens secondary text, borders, dotted tracks, and focus rings without
changing the chosen palette. Colour is never the only signal: active states also change shape,
weight, a dot, or a fill.

### 4.4 The eight interface styles

| Style | Character | What changes |
| --- | --- | --- |
| **Nothing OS** | The signature look: monochrome, dot-matrix, minimal, brand-first. | Dot play glyph, spinning record, dotted progress, uppercase mono labels. |
| **Classic** | A familiar rounded music app with bold headings. | Rounded cards, conventional transport icons, no record spin, solid-ish tracks. |
| **Windows 11** | Fluent surfaces, tight corners, compact desktop controls. | Mica-like translucency, 6–8 px corners, Segoe-style display type. |
| **macOS** | Compact translucent panels, SF-style type, restrained controls. | Smaller radii, solid progress, tight controls, desktop density. |
| **macOS Glass** | Liquid-glass cards, heavy blur, layered highlights. | Strong blur, translucent buttons, accent light, large rounded cards. |
| **Linux / GNOME** | Soft cards, simple controls, restrained accent use. | Gentle radii, inset button shadows, calm surfaces. |
| **KDE Plasma** | Dense rows, square-ish corners, technical type. | 4 px corners, compact density, information-first layout. |
| **Samsung One UI** | Large pill controls and generous touch targets. | Big pills, 64 px artwork, phone-first spacing. |

A style may deliberately remove signature motion. In Nothing OS the player thumbnail is a
slow-spinning record and the play glyph is a 5×5 dot matrix. Most platform styles treat the same
artwork as a static square and use conventional transport icons. That is intentional: the style
is a dialect, not a skin.

### 4.5 Type

Three families do three jobs:

- **Doto** — display, logo, and large titles. Its dot construction carries the dot-matrix
  identity into the words themselves.
- **Space Mono** — metadata, labels, durations, tiny readouts. It makes small print feel like
  equipment.
- **Inter** — body copy, song titles, and controls that need to stay plain and readable.

Some styles substitute platform-native display and mono families while preserving the scale and
spacing logic. The hero is large (roughly 54–116 px depending on viewport); page titles are
34–54 px; body copy starts at 14 px and scales to 15.5 px (Large) or 17 px (Extra large). Reading
comfort scales the whole type system, not just paragraphs.

### 4.6 Shape and surfaces

- Cards use a **28–34 px** radius by default.
- Pills and the player use fully rounded ends.
- The player is a floating capsule on desktop and a near-edge-to-edge bar on phones.
- Surfaces are layered: page → card → raised inner surface → translucent glass for the player,
  queue, and now-playing overlay.
- Blur and saturation are used only where something floats over something else. The result should
  feel like smoked glass, not a stack of frosted rectangles.
- A very soft radial accent glow drifts behind the layout. It is intentionally almost invisible:
  you notice the page breathing before you notice the light source.

### 4.7 The dot language

Dots are the recurring mark:

- the logo is a 2×2 dot block;
- the Nothing OS play/pause icon is a 5×5 matrix whose cells switch on in sequence;
- the default progress track is a row of dots, with a glowing scrub thumb;
- hero and empty-art patterns use fine dot grids;
- active navigation gets a small glowing dot;
- the playing row shows three small equalizer bars instead of a track number.

The dots stay sparse. They appear where they carry rhythm or state, not as wallpaper.

### 4.8 Layout

**Desktop / browser**

```
┌──────────────────┬────────────────────────────────────────────┐
│  ●● Wavelength   │  Search any song or artist…          ⌘ K  │
│                  │                                            │
│  Home            │  Free · no ads · runs on your computer     │
│  Search          │                                            │
│  Library         │  WAVE                                      │
│  Spotify import  │  LENGTH                                    │
│  Downloads       │  Bring your Spotify playlists over…        │
│  Settings        │  [ Import from Spotify ]  [ Search ]       │
│                  │                                            │
│  Playlists       │  Jump back in                              │
│  Late night      │  [ tile ]  [ tile ]  [ tile ]              │
│  Focus           │                                            │
└──────────────────┴────────────────────────────────────────────┘
  ╭──────────────────────────────────────────────────────────╮
  │ art  Title — Artist   ⏮  ▶  ⏭   ─────●────   queue  🔊  │
  ╰──────────────────────────────────────────────────────────╯
```

**Phone**

```
┌──────────────────────────────┐
│  Search any song…      ⌘ K   │
│  ⌂   ▦   ⇩   ↓   ⚙          │
│                              │
│  WAVE                        │
│  LENGTH                      │
│  Search YouTube, play…       │
│  [ Search music ]            │
│                              │
│  Jump back in                │
│  [ tile ]  [ tile ]          │
│                              │
├──────────────────────────────┤
│  ───────●──────────────      │
│  art  Title       ⏮  ▶  ⏭   │
└──────────────────────────────┘
```

On desktop, a persistent sidebar holds the logo, primary navigation, and playlists. The main area
is a single scrolling view with a sticky search header. The player spans the bottom as a floating
capsule with three zones: identity, transport/seek, and queue/volume.

On phones, the sidebar becomes a compact icon row in the header. The player becomes a two-column
bar: artwork and identity on the left, transport on the right. A thin, touchable seek track sits
along the top edge, so the most important control is available without opening the full player.
Safe-area insets keep the player, sheets, and now-playing controls clear of notches, status bars,
and Android navigation gestures.

### 4.9 Artwork and covers

Album art is the main source of colour. The player shows a circular record in Nothing OS and a
rounded square in platform styles. The full-screen player uses a heavily blurred copy of the
current cover as its background, with the artwork floating above it.

Playlists can use:

- a built-in line icon;
- an emoji;
- a colour tone;
- an uploaded picture;
- Spotify artwork (when imported);
- the first song's artwork;
- a combination of icon/emoji with a picture fallback.

Uploaded images are normalised and capped at 512 px, stored locally. The cover studio supports
drag-and-drop, and replacing a cover cleans up the old file. Playlist covers are a first-class
part of the library, not an afterthought.

---

## 5. Motion system

### 5.1 Two curves

| Token | Curve | Used for |
| --- | --- | --- |
| **Spring** | `cubic-bezier(.34, 1.56, .64, 1)` | Presses, hover lifts, artwork entrances, small state changes. Overshoots very slightly. |
| **Soft** | `cubic-bezier(.22, 1, .36, 1)` | Fades, view changes, larger surfaces. Settles without a visible bounce. |

Motion is deliberately slow enough to read: roughly **0.4–0.8 s** for surfaces, **0.1–0.2 s** for
press feedback. Overshoot belongs to touch and small objects, not to page-sized surfaces.

### 5.2 The choreography

| Moment | Behaviour | What it communicates |
| --- | --- | --- |
| **View enter** | 0.5 s soft fade from blur 6 px to sharp. | A new room, same building. |
| **Content rise** | 0.8 s soft rise of 22 px with 0.97 scale; 45 ms stagger per item. | The page assembles rather than appears. |
| **View exit** | 0.14 s fade, 8 px lift, 5 px blur. | The old surface gets out of the way quickly. |
| **Nav hover** | 4 px slide; active dot pops in with spring. | Direction and place. |
| **Tile hover** | 9 px lift, less than 1° tilt, slow image scale. | The object is physical. |
| **Button press** | 0.1–0.12 s scale to 0.86–0.94. | Immediate acknowledgement. |
| **Play ring** | 2.4 s breathing box-shadow, 7 px → 12 px. | Playback is alive. |
| **Record spin** | 18 s linear rotation, only while playing, Nothing OS only. | The machine is running. |
| **Metadata swap** | 0.6 s soft rise from 10 px with 4 px blur. | The track changed. |
| **Now-playing art** | 7 s bob, 12 px lift and 0.8° rotation. | The cover is floating in the room. |
| **Queue open** | 0.7 s spring from the right; bottom sheet on phones. | The next songs slide into reach. |
| **Dialog / sheet** | 0.7 s spring from 34 px and 0.92 scale; 100% slide on phones. | A temporary surface, not a new page. |
| **Scrub thumb** | 0.45 s spring bloom on hover or touch. | The track is grabbable. |
| **Like** | 0.6 s spring beat to 1.5 scale at 40%. | A small, satisfying confirmation. |
| **Skeleton** | 1.5 s shimmer; stagger 35 ms. | Content is coming, not missing. |
| **Loader** | Three dots at 1 s, alternating scale and opacity. | The app is thinking. |
| **Ambient glow** | 28 s and 36 s drift, alternating. | The room is breathing. |

Some details are deliberately subtle:

- The plain play glyph nudges 3 px right when paused, then settles when playing.
- The active row shows three equalizer bars that animate only while the player is playing.
- The full-screen player fades and scales in from the player bar.
- The queue is a side panel on desktop and a bottom sheet on phones.
- The progress fill is continuous; the dotted track is the texture, not the animation.

### 5.3 Reduced motion

Reduced motion is a first-class setting, not an afterthought. It can be set to **Match system** or
**Reduced**. When reduced:

- ambient drift is removed;
- the record stops spinning;
- transitions and animations collapse to near-instant changes;
- the visualizer drops to a lower frame rate;
- the app still changes state, but it does not travel.

The system preference is respected by default. The setting is available in **Settings → Motion &
sound**.

### 5.4 Haptics and sound

There is no interface soundtrack. The only sound is the music.

On touch devices, short haptic ticks (roughly 5–14 ms) acknowledge play/pause, long-press menus,
mute, and gestures. They are never used for decoration or repeated alerts.

### 5.5 Performance rules

- The visualizer runs at roughly 30 fps when audio is live, 15 fps when idle or reduced.
- It pauses when the document is hidden.
- Long lists use staggered but bounded animation delays; the effect does not become slower as the
  library grows.
- No animation should block input, scrolling, or playback.
- The player never changes height because of a long title, a long artist name, or a queue update.

---

## 6. The experience

### 6.1 First open

On desktop and browser, the first screen is the home hero. If `yt-dlp` or `ffmpeg` is missing, a
banner explains exactly what is wrong and what to install. The primary action is **Import from
Spotify**; search is the secondary action.

On Android, the first screen is the same room with a different first move: **Search music**. The
phone build does not need Node, `yt-dlp`, `ffmpeg`, or a Wavelength server. It needs an internet
connection for YouTube playback and notification permission for lock-screen controls.

The default configuration is opinionated but quiet:

- Dark palette, Nothing OS style;
- matrix visualizer;
- endless playback on;
- gapless preparation on (desktop/browser);
- resume last session on;
- volume at 80%;
- best available streaming quality;
- MP3 downloads at 192 kbps.

### 6.2 Import

The import journey is the product's front door.

1. **Paste a link.** A Spotify playlist, album, or track link works in the Import page or directly
   in the search box. The app detects the URL and starts reading it.
2. **Preview before saving.** The preview shows the name, cover, song count, total duration, and
   whether this is a new playlist or an update to an existing one.
3. **See the diff.** For an existing playlist, the preview shows new / kept / removed counts.
   Existing YouTube matches are preserved, so re-importing does not throw away work.
4. **Choose a cover.** Use the Spotify artwork, the first song's artwork, an icon, an emoji, a
   tone, or an uploaded image.
5. **Save, then match.** Wavelength finds each song on YouTube three at a time, with a progress
   bar. Unmatched songs are marked, and a **Match remaining** action retries them later.
6. **Or paste a list.** One song per line. Numbered lists, bullets, CSV rows, M3U files, and
   timestamps are parsed. The order can be Artist–Song or Song–Artist, and the count updates live.
7. **Spotify account import is optional.** It is only needed for playlists over 100 songs and
   liked songs. Without signing in, Spotify shares the first 100 songs of a public playlist.

On Android, the paste-list path is the supported import path. Direct Spotify links and account
import are desktop/browser features for now.

### 6.3 Search

The search landing page offers recent searches (up to six), a clear action, and genre starting
points. Typing is debounced; a Spotify link is detected immediately. Results appear as a top
result card plus a song list, with quick like, add, menu, and play actions.

Search feels fast because the app hides the work:

- results are cached for five minutes;
- a known result set is shown immediately and revalidated in the background;
- skeleton rows match the shape of the coming list;
- hovering a row pre-warms the track after 140 ms;
- pressing Enter searches immediately;
- `/` or `⌘K` / `Ctrl K` focuses the search field.

If there are no matches, the empty state suggests a title, an artist, or a mood rather than
leaving a blank page.

### 6.4 Play

Clicking a row plays that list from that point. The player shows a circular record, title, artist,
like, shuffle, previous, play/pause, next, repeat, seek, queue, full-screen, mute, and volume.

The full-screen player is a quiet room built from the current cover: large artwork, title, artist,
like, optional visualizer, seek, transport, visualizer-style cycle, and queue. It opens from the
artwork, the title, the expand button, `F`, a double-click, or an upward swipe on the player.

While the music plays:

- the record spins in Nothing OS;
- the play button breathes a soft accent ring;
- the active row shows equalizer bars;
- the metadata cross-fades and slides on track change;
- the queue shows what is next and marks auto-added endless tracks;
- the app can keep going with related songs when the queue ends;
- a sleep timer can pause playback after 15, 30, 45, 60, or 90 minutes;
- the session (queue and position) can resume next time.

### 6.5 Collect

Liking a song works from the player, a row, a search result, or the overflow menu. Playlists can
be created from the sidebar or the library, edited with a full cover studio, and filled from any
song's menu.

The library is deliberately small and legible:

- **Liked Songs**;
- **Local files**;
- **Playlists**;
- **History**, surfaced as “Jump back in” on Home.

There are no folders, public profiles, collaborative playlists, or social counts. The library is
yours, not a network.

### 6.6 Own

On desktop and browser, Wavelength can turn YouTube audio into MP3 files at 128, 192, 256, or
320 kbps, into a chosen folder (default `~/Music/Wavelength`). The Downloads page shows the queue,
progress, conversion state, and completion. Finished jobs can be cleared without touching the
files.

Local files are copied into Wavelength's local library, read with `ffprobe`, and played at their
original bit depth and sample rate. FLAC, WAV, AIFF, ALAC, M4A, MP3, OGG, and Opus are supported.
Embedded artwork is extracted automatically. Nothing is transcoded. Local tracks show a quality
badge and are never cached twice.

### 6.7 Move

Device sync is explicit, local, and slightly manual on purpose.

- One device hosts. It shows a pairing code and one or more network addresses.
- Another device joins with the address and code. Current versions merge on connect, so the joining
  device keeps its own playlists too.
- **Merge data** previews the other copy. New playlists, songs and liked songs are added
  automatically. Items this device removed but another copy still has open a checklist; unchecked
  items stay only on the copy that still has them.
- **Pull now** replaces the joining device's library with the host's copy.
- **Send changes** replaces the host's library with the joining device's copy.
- Every paired guest can send. The newest send replaces the host copy; merges are additive.
- The host merge button combines the host with the libraries guests sent during that hosting
  session. It cannot reach a sleeping guest, so host previews only cover copies already sent.
- The host does not push to guests; each device pulls or merges when asked.
- The merge baseline is grow-only: every item this device has ever known stays “known”, which is
  how a later copy offering it back is classified as removed rather than silently new.
- A separate `PUT /api/sync/preview` route returns the checklist data. It is not a library
  replacement, so older hosts that do not know it simply answer 404 and the caller falls back.
- Settings, downloads, and local files stay on each device.
- The host only listens while Wavelength is open.
- Use the same trusted Wi-Fi or Tailscale. The sync port is the next port after the player
  (`38422` for the desktop app).

This is deliberately not a cloud service. It is a way to move a library you already own.

### 6.8 Return

When you come back, Wavelength tries to meet you where you left off:

- the last queue and playback position can be restored;
- Home shows up to eight recent tracks under “Jump back in”;
- the library, liked songs, and playlists are already there;
- if the device is a sync guest, the last synced library is already local.

---

## 7. The surfaces

| Surface | Purpose | Notable details |
| --- | --- | --- |
| **Home** | Orientation and return. | Hero, platform-specific primary action, “Jump back in,” playlist tiles. |
| **Search** | Intent-driven discovery. | Recent searches, genres, top result, skeleton, cached results, prefetch. |
| **Library** | The collection at a glance. | Liked Songs, Local files, playlists, new playlist tile. |
| **Playlist** | A single collection. | Cover, duration, play/shuffle/download all, edit/delete, match remaining. |
| **Local files** | Owned audio. | Native-quality badges, add/rescan, file stats, delete. |
| **Import** | Bring music in. | Spotify link, paste list, optional account import, preview, diff, cover. |
| **Downloads** | MP3 queue. | Quality, progress, converting state, folder, clear finished. |
| **Settings** | Control the machine. | Overview cards, search filter, jump nav, appearance, reading, motion, playback, devices, storage, Spotify, status. |
| **Player** | The constant. | Identity, transport, seek, queue, full-screen, volume. |
| **Queue** | What comes next. | Current marker, remove, clear, endless labels. |
| **Full-screen player** | The listening room. | Blurred cover, large art, visualizer, transport, seek, queue. |

### 7.1 Settings

Settings is designed to be searchable, not scrolled end to end. It opens with three overview cards
(theme, streaming, devices), a “Find a setting” field, and jump chips. Searching filters whole
sections and hides jump targets that no longer apply.

Sections:

- **Appearance** — palette, accent, interface style, style guide.
- **Reading comfort** — Default / Large / Extra large, stronger contrast.
- **Motion & sound** — match system or reduced motion; visualizer visibility, style and size; the
  Android lock-screen now playing toggle and preview.
- **Playback** — endless playback, gapless preparation, resume, streaming quality, sleep timer,
  and on Android a media-volume slider.
- **Devices** — host/join, pair code, addresses, pull/send, counts, last sync.
- **Storage** — MP3 quality, download folder, local files, cache usage, clear cache.
- **Spotify** — client ID, connection state, import entry points.
- **Status** — version, playback engine, `yt-dlp`/`ffmpeg`/`ffprobe` or NewPipeExtractor,
  background audio, ads: none, price: free.

---

## 8. Feature map

### 8.1 Find

- YouTube search with a top result and song list.
- Recent searches (six) with clear.
- Genre starting points.
- Spotify link detection in the search field.
- Search cache and background revalidation.
- Skeleton loading and hover prefetch.
- Quick actions on the top result: like, add to playlist, more, play.

### 8.2 Import

- Spotify playlist, album, and track links.
- Public playlists up to 100 songs without signing in.
- Optional Spotify account for full playlists and liked songs.
- Paste-list parser: line lists, numbered lists, bullets, CSV, M3U, timestamps.
- Artist–Song or Song–Artist ordering.
- Preview before saving, including new/kept/removed counts for updates.
- Cover selection at import time.
- Batched YouTube matching with progress and retry.
- Update-in-place for existing Spotify playlists; no duplicates.

### 8.3 Play

- Ad-free YouTube audio playback.
- Shuffle, repeat off/all/one.
- Shuffle stays inside the active playlist or list. Turning shuffle on drops endless tracks, and
  shuffled queues cannot quietly extend outside the chosen collection.
- Smart shuffle builds a balanced queue from the whole library, rotating across playlists instead of
  letting one collection dominate.
- Remix playlists combine several playlists into a new list with balanced representation.
- Smart volume evens out quiet and loud tracks on desktop and browser. Android playback is not
  processed by the Web Audio chain, so the toggle is not offered there.
- Skip credits when chapter or segment metadata marks an outro or credits section in the second half
  of a track. This is best-effort and does nothing when the metadata is missing.
- Previous, next, play/pause, seek, volume, mute.
- Queue with play next, add to queue, remove, clear.
- Endless related-song playback.
- Gapless preparation on desktop/browser.
- Session resume of queue and position.
- Sleep timer.
- Streaming quality: best available or data saver.
- Full-screen player with four visualizer modes: real audio on desktop/browser, playback-driven on
  Android.
- Broken-track skipping and retry handling.
- Bluetooth or headphone disconnect pauses playback. Android listens for the system noisy-audio
  broadcast; desktop/browser watches output devices on a best-effort basis.

### 8.4 Collect

- Liked Songs.
- Listening history.
- Playlists with create, rename, delete.
- Playlist sorting by recently added, title, artist, duration or album, plus list and grid views.
- Remix playlists that combine several playlists into a new balanced list.
- Custom covers: icon, emoji, tone, image, Spotify art, first song art.
- Add to playlist from any song menu.
- Download all songs in a playlist (desktop/browser).
- Match remaining songs in an imported playlist.
- Start radio from a song.
- Listening recap with total time, plays, top songs, top artists, top playlists and any custom
  start/end date.

### 8.5 Own

- MP3 downloads at 128/192/256/320 kbps.
- Download queue with progress and conversion state.
- Configurable download folder.
- Local lossless import and native-quality playback.
- Automatic metadata and embedded artwork extraction.
- Rescan and delete local files.
- Storage accounting for cache, covers, local files, links, and matches.

### 8.6 Move

- Host a library with a pairing code and LAN/Tailscale addresses.
- Join a host as a guest. Current versions merge on connect so neither library is replaced.
- Merge data previews both copies. New playlists, liked songs and history are added automatically;
  items removed here but still on another copy open a checklist before they return.
- Merge never deletes this device's own items. Unchecked items stay only on the copy that still has
  them, and deletions are not propagated to other devices.
- The host button merges the last libraries guests sent during that hosting session, so it can
  recover data after a replacement.
- Pull the host library.
- Send this library to the host.
- Sync counts and last-sync time.
- Automatic library refresh on the host when another device sends.
- Device sync is separate from settings, downloads, and local files.
- Listening stats are stored per device and merged by newest device snapshot, never summed twice.

### 8.7 Personalize

- 14 palettes.
- Nine classic accent swatches, 14 Catppuccin accents, and a custom colour picker.
- Eight interface styles.
- Three text sizes.
- High-contrast mode.
- Reduced motion.
- Four visualizer styles and four sizes, including a full-screen backdrop.
- Android lock-screen now playing: artwork, song details and the visualizer for a few seconds after
  the screen turns off.
- Custom playlist covers.

### 8.8 Trust and access

- Keyboard shortcuts and a shortcut sheet.
- Visible focus rings.
- ARIA labels and slider values.
- Touch-sized controls on coarse pointers.
- Safe-area handling.
- Explicit platform limitations.
- No AI filter and blocked artists. This is a conservative keyword filter, not reliable AI detection;
  it removes obvious matches from search, related songs, playlists, history and playback.
- Storage and status diagnostics.
- Local-first data with no account requirement.

---

## 9. Quality-of-life catalogue

These are the details that make the app feel planned rather than assembled.

### 9.1 Before the first song

- **Recent searches remember intent.** Six terms, deduplicated case-insensitively, clearable.
- **Search is debounced.** 550 ms for text, 50 ms for a detected Spotify link.
- **Links work anywhere.** A Spotify link pasted into the main search box starts an import
  instead of a text search.
- **The clipboard is one click away.** The Import page has a “Paste link” action.
- **The import preview is honest.** It shows the count, duration, update diff, and the 100-song
  limit before anything is saved.
- **Re-importing does not lose matches.** Existing YouTube IDs are preserved and only new songs
  are matched.
- **Paste lists are forgiving.** Numbered lists, bullets, CSV, M3U, timestamps, and both
  artist/title orders are parsed. Duplicates are removed.
- **Matching is visible.** Three jobs run at once, with a progress bar and a final toast.
- **Unmatched songs are not hidden.** They are marked “no YouTube match” and can be retried.
- **Covers are editable in place.** Click the playlist cover, or use Edit.
- **Deleting a playlist does not threaten the songs.** The confirmation says the songs stay on
  Spotify and YouTube.
- **Empty states teach.** “No playlists yet. Import one from Spotify or create your own from the
  sidebar.”
- **Settings are searchable.** Typing “theme” or “sync” filters the page and the jump nav.
- **The app tells you what is missing.** `yt-dlp`, `ffmpeg`, or `ffprobe` problems get a banner
  with the exact install command.

### 9.2 While music plays

- **Play next and add to queue are separate.** One inserts after the current track; the other
  appends.
- **Shuffle has edges.** It only reorders the active list. Endless tracks are dropped when shuffle
  starts, and a shuffled queue cannot extend behind the user's back.
- **Smart shuffle reads the whole library.** It rotates through playlists so one long collection
  cannot fill the queue; Remix creates the same balance as a saved playlist.
- **Smart volume evens out tracks.** Quiet songs get a lift and loud ones are held back on
  desktop/browser. The setting is absent on Android because its playback path bypasses the Web
  Audio chain.
- **Credits skip is cautious.** It only jumps when chapter metadata clearly names credits or an
  outro in the second half of the track. No metadata means normal playback.
- **Unplugging stops the music.** Android pauses on the system noisy-audio broadcast; desktop and
  browser watch output devices on a best-effort basis.
- **The queue can be edited without stopping playback.** Remove a single item or clear all; clear
  keeps the current track.
- **Endless tracks are labelled.** Auto-added songs show “endless” in the queue.
- **The current row is unmistakable.** Accent background, equalizer bars, and a highlighted title.
- **The player never jumps.** Long titles and artists truncate; the transport stays put.
- **Seek is available everywhere.** The desktop player has a full track; phones have a thin seek
  track along the top edge of the player bar.
- **The scrub thumb blooms on touch.** It is a larger target than it looks.
- **Volume is physical.** Click the volume track to mute; scroll to adjust; Shift for fine steps;
  double-click to mute.
- **Keyboard control is complete.** Space/K, N/P, arrows, M, L, S, R, F, Q, `/`, `?`, Esc.
- **The full-screen player opens from the artwork.** Also from the title, the expand button, `F`,
  a double-click, or a swipe up.
- **The visualizer has four modes and four sizes.** Matrix, Bars, Wave, and Radial read the real
  audio signal on desktop and in the browser. On Android the WebView player exposes no samples, so
  the phone draws a track-seeded spectrum from the playback clock. Sizes range from small to a
  full-screen backdrop.
- **The queue closes with a swipe.** On phones, swipe down on the sheet.
- **The sleep timer survives reloads.** It is stored as an absolute time, not a countdown that
  restarts.
- **Resume restores the queue and position.** Turning it off clears the saved session.
- **Offline is handled.** On desktop/browser, local files always play; YouTube tracks must already
  be cached. The app says “Offline — this song isn't saved” instead of failing silently.
- **Broken tracks do not stop the queue.** The app shows a toast and skips, with retry handling.
- **Buffering is visible.** The play button gets a spinner ring and the UI does not pretend to be
  playing.
- **The visualizer is real where the audio is reachable.** Desktop and browser read the audio
  analyser, not a canned animation, and pause when the tab is hidden. Android cannot reach the
  WebView's samples, so it says playback-driven rather than claiming a real spectrum.

### 9.3 Around the library

- **History is useful, not a log.** Home shows up to eight recent tracks as “Jump back in.”
- **Playlists can be read your way.** Sort by recently added, A–Z, artist, duration or album, and
  switch between list and grid. The choice is remembered.
- **Remix is visible, not magic.** Pick playlists, preview the balanced result, then save it as a new
  playlist or play it immediately.
- **The recap takes dates.** Pick a year chip or any start/end date. Complete years keep full
  rankings; custom ranges use daily detail and say when older days lack it.
- **Listening stats merge by device.** A phone and computer each own their counters; sync keeps the
  newest copy per device instead of double-counting both.
- **Liked Songs is a first-class collection.** It has its own cover and play action.
- **Local files show their quality.** Lossless files get a badge with bit depth and sample rate.
- **Local files are not duplicated into the stream cache.**
- **Custom covers are real files.** They are stored locally and work offline.
- **Replacing a cover cleans up the old one.**
- **Cover images are resized.** The app caps them at 512 px before storing.
- **Start radio is one action.** It builds a queue from related songs and starts playing.
- **Copy song details and YouTube link are in the menu.** Useful for sharing outside the app.
- **Download all is available on a playlist.** It queues each song and takes you to Downloads.
- **Match remaining is visible on imported playlists.** No hidden repair workflow.
- **Storage tells the truth.** Cache count and limit, cover count and bytes, local files, ready
  links, and matched count are shown separately.
- **Clear cache is narrow.** It clears temporary stream files, not downloaded songs or covers.

### 9.4 On a phone

- **The phone build is standalone.** Search, streaming, playlists, liked songs, and history live
  on the device.
- **The home-screen widget is a remote with album context.** It shows artwork, title, artist,
  album, and a Playing/Paused label, and play/pause, previous and next work while the app is
  playing. With no live playback bridge, tapping opens Wavelength.
- **Lock-screen and notification controls work.** Previous, play/pause, and next are available;
  the MediaSession handles headset and Bluetooth commands.
- **Locking the phone during playback shows a brief now-playing screen.** Artwork, song details,
  progress, transport and the visualizer appear over the lock screen, then fade out after about
  nine seconds so unlocking still lands on the normal keyguard. Android 14 and newer require the
  user to allow full-screen notifications; settings says so and links to the switch.
- **Bluetooth disconnect pauses.** The service listens for Android's noisy-audio broadcast and
  pauses instead of blasting the speaker.
- **Merge before you replace.** Devices can merge libraries from the sync panel; Pull now and
  Send changes still replace a copy when that is what you mean.
- **The notification shows artwork and metadata.**
- **The system bars are transparent.** The app background shows through; icon brightness follows
  the light/dark theme.
- **Safe areas are respected.** The player, sheets, and controls stay above gesture navigation,
  three-button navigation, and display cutouts.
- **Back returns through the app's route history.** The back gesture goes back through the app
  before leaving it; overlays also have explicit close controls.
- **Long-press opens the row menu.** No need to hunt for a tiny overflow button.
- **Swipe up opens the full player; swipe down closes it.**
- **Volume is the phone's.** The full-screen player and Settings → Playback control the media
  stream, so the in-app slider follows the hardware keys and Android's volume panel.
- **Touch targets grow.** Coarse pointers get 44 px buttons and taller rows.
- **Haptics acknowledge actions.** Short ticks on play, long-press, mute, and gestures.

### 9.5 When things go wrong

- **Missing dependency:** a banner names the tool and the install command.
- **Spotify not configured:** the Import page explains the redirect URI and Client ID flow.
- **Spotify limit:** the preview says the first 100 songs are all that was shared.
- **No match:** the song is marked, not silently dropped; “Match remaining” retries.
- **No results:** the search empty state suggests what to try.
- **No host address:** the sync panel says to connect Wi-Fi or Tailscale and try again.
- **Wrong pairing code:** the host returns “That pairing code is not right.”
- **Offline:** local files still play; uncached YouTube tracks are skipped with a message.
- **Deleted local file:** the app removes it from the queue, liked songs, history, and playlists.
- **Cleared cache:** downloaded songs and covers stay; only temporary stream files go.

---

## 10. Platforms

Wavelength has one design language and three physical expressions.

### 10.1 Desktop app

**The full instrument.**

- Electron window with a bundled local server.
- Node, `yt-dlp`, `ffmpeg`, and `ffprobe` do the heavy lifting.
- LAN access is enabled automatically so a phone can connect.
- Media keys and a single-instance lock are enabled.
- Full Spotify import, MP3 downloads, local lossless files, visualizers, sync hosting.

The normal macOS/Windows/Linux builds expect `yt-dlp` and `ffmpeg` on the machine. The Flatpak
bundles those tools. Builds are unsigned; macOS needs right-click → Open or `xattr -cr`.

### 10.2 Browser mode

**The same instrument in a tab.**

- Run `./start.sh` (or `start.bat`) and open `http://127.0.0.1:3000`.
- The Node server does search, import, downloads, local files, and sync.
- The default bind is loopback only. Use `HOST=0.0.0.0 ./start.sh` to let a phone or another
  computer connect.
- Installable PWA with a share target when served over HTTPS (for example via Tailscale Serve).
- Service worker registration is limited to HTTPS or localhost.

The browser is a client to whichever Wavelength server it was opened from. It is not a separate
cloud product.

### 10.3 Android

**The pocket instrument.**

- Standalone APK. No desktop app, Node, `yt-dlp`, `ffmpeg`, or Wavelength server required.
- NewPipeExtractor resolves YouTube audio directly on the phone.
- Library stored in the app and survives with the computer off.
- Sync is guest-only: join a desktop host, connect with merge, pull, send, disconnect.
- Home-screen widget with artwork, title, artist, album, state, and play/pause, previous and next.
- Full-screen player visualizer in all four styles and four sizes, including a full-screen backdrop.
  The WebView player exposes no audio samples, so Android draws a track-seeded spectrum driven by
  the playback clock: it moves only while a song plays and settles flat on pause.
- Brief lock-screen now-playing view with artwork, song details, progress, controls, and the
  visualizer as the background. Shown when the screen turns off during playback, auto-hides.
- Bluetooth and headset disconnect pauses playback when the setting is on.
- Import is paste-list only; direct Spotify links and account import are not available.
- Offline downloads and local-file playback are not in this build and are named as the next
  standalone steps.
- No hosting, no gapless toggle, no uploaded image covers, no smart-volume processing.
- Background playback uses a foreground service and MediaSession.
- APK is debug-signed for direct installation, not a Play Store build.

### 10.4 Platform matrix

| Capability | Desktop app | Browser mode | Android |
| --- | --- | --- | --- |
| Ad-free YouTube search and playback | Yes | Yes | Yes |
| Spotify playlist/album/track links | Yes | Yes | No |
| Spotify account import | Yes | Yes | No |
| Paste-list import and matching | Yes | Yes | Yes |
| Playlists, liked songs, history, queue | Yes | Yes | Yes |
| Icon / emoji / tone playlist covers | Yes | Yes | Yes |
| Uploaded image covers | Yes | Yes | No |
| MP3 downloads | Yes | Yes | No |
| Local lossless playback | Yes | Yes | No |
| Visualizers | Yes (real audio) | Yes (real audio) | Yes (playback-driven) |
| Gapless preparation | Yes | Yes | No |
| Endless playback | Yes | Yes | Yes |
| Sleep timer | Yes | Yes | Yes |
| Session resume | Yes | Yes | Yes |
| Full-screen player and queue | Yes | Yes | Yes |
| Sync host | Yes | Yes | No |
| Sync guest | Yes | Yes | Yes |
| PWA install and share target | No | HTTPS only | No |
| Keyboard shortcuts | Yes | Yes | Hardware keyboard |
| OS media keys | Yes | Varies by browser | Yes |
| Lock-screen / notification controls | No (media keys only) | Varies by browser | Yes |
| Themes, styles, accents, reading, contrast, motion | Yes | Yes | Yes |
| Playlist sort and list/grid view | Yes | Yes | Yes |
| Remix playlists and library-wide smart shuffle | Yes | Yes | Yes |
| Listening recap with custom date range | Yes | Yes | Yes |
| Cross-device listening stats | Yes | Yes | Yes |
| Merge libraries without replacing | Yes | Yes | Yes (guest) |
| No AI / blocked artist filter (best effort) | Yes | Yes | Yes |
| Credits / outro skipping (metadata-based) | Yes | Yes | Yes |
| Smart volume | Yes | Yes | No |
| In-app volume control | Yes | Yes | Yes (phone media stream) |
| Bluetooth disconnect pause | Best effort | Best effort | Yes |
| Home-screen widget | No | No | Yes (art, album, transport) |
| Lock-screen now-playing view | No | No | Yes (brief, with visualizer) |

---

## 11. Status ledger

### 11.1 Shipped

**Desktop / browser**

- Search, stream, and play YouTube audio without the video page.
- Spotify links for playlists, albums, and tracks.
- Optional Spotify sign-in for full playlists and liked songs.
- Paste-list import from text, CSV, and M3U.
- Import preview with updates, diffs, covers, and batched matching.
- Playlists, liked songs, history, and queue.
- Custom playlist covers.
- MP3 downloads with quality selection and queue.
- Local lossless files with native bit depth and sample rate.
- Four real-audio visualizer modes.
- Gapless preparation, endless playback, session resume, sleep timer.
- Device sync host and guest.
- 14 palettes, 8 styles, custom accent, 3 text sizes, high contrast, reduced motion.
- Keyboard shortcuts, settings search, storage diagnostics.
- Browser PWA install and share target under HTTPS.

**Android**

- Standalone search and playback through NewPipeExtractor.
- Playlists, liked songs, history, queue.
- Paste-list import with YouTube matching.
- Sync as a guest.
- Background playback, lock-screen/notification controls, Bluetooth/headset controls.
- Home-screen widget with artwork, title, artist, album, state, and transport.
- Visualizer in four styles and four sizes, including a full-screen backdrop.
- Brief lock-screen now-playing view with artwork, progress, controls and the visualizer.
- Transparent system bars, safe areas, back handling.
- The same palette/style/reading/motion system.
- Icon, emoji, and tone playlist covers.

**Current source build (v2.4.0 tree)**

- Merge data on guest and host, with host recovery after a replacement.
- Listening stats per device, merged through sync.
- Listening recap with year presets and custom start/end dates.
- Playlist sort, list/grid view, Remix playlists and library-wide Smart Shuffle.
- Smart volume on desktop/browser; Bluetooth disconnect pause on Android.
- No AI keyword filter and blocked artists.
- Metadata-based credits/outro skipping.
- Android home-screen widget with artwork, album, state and transport.
- Android visualizer in four styles and four sizes, including a full-screen backdrop.
- Android brief lock-screen now-playing view with the visualizer behind it.
- Android volume control bound to the phone's media stream, mirrored in the full-screen player
  and Settings → Playback.

### 11.2 Not in this build

| Item | Status | Notes |
| --- | --- | --- |
| Queue drag-reordering | Not implemented | The queue supports play next, add, remove, and clear only. |
| Playlist drag-reordering | Not implemented | No folder or manual order tools. |
| Android offline downloads | Not implemented | Named in the app as the next standalone step. |
| Android local-file playback | Not implemented | Named in the app as the next standalone step. |
| Android direct Spotify import | Not implemented | Paste a song list instead. |
| Android image cover upload | Not implemented | Icon/emoji/tone covers work. |
| Android sync hosting | Not implemented | Android is a guest only. |
| Automatic background sync | Not implemented | Sync is explicit; Merge data must be chosen on each device. |
| Cloud account / automatic sync | Not implemented | Sync is peer-to-peer over LAN/Tailscale. |
| Video or podcast playback | Not implemented | Music audio only. |
| Lossless YouTube streaming | Not possible | YouTube audio is lossy. |
| Spotify audio playback | Not implemented | Spotify links provide metadata only. |
| External scrobbling (Last.fm and similar) | Not implemented | Listening stats are local and travel through Wavelength sync only. |
| Reliable AI-song detection | Not implemented | No AI is a keyword and blocked-artist filter, not musical detection. |
| Exact credits skipping | Best effort | Needs chapter metadata naming credits or an outro in the second half of the track. |
| Smart volume on Android | Not available | Android playback bypasses the Web Audio processing chain. |
| Real-audio visualizer on Android | Not possible | The WebView's native player exposes no analyser, so the phone draws a track-seeded spectrum from the playback clock. |
| Detailed recap rankings before this version | Partial | Total time is complete; per-song/artist/playlist ranking for older partial ranges starts with daily detail from this version. |
| Merge preview for offline devices | Not available | A host can only preview libraries guests sent during the current hosting session. |
| Deletion propagation | Not implemented | Merge is additive. A grow-only local baseline spots items removed here but still on another copy and offers them back; deleting an item never removes it from another device. |
| Social features | Not implemented | No profiles, comments, or sharing feed. |

### 11.3 Truths the product does not bend

These are repeated in the interface and should remain true in every future release:

1. **Only local files are lossless.** YouTube streams are lossy; the app labels the two sources
   separately.
2. **Spotify import is metadata import.** It finds equivalents on YouTube; it does not play
   Spotify audio.
3. **MP3 downloads come from YouTube.** They are not Spotify downloads.
4. **Sync can merge or replace, and it is not deletion-aware.** Merge adds playlists, liked songs,
   history and per-device listening stats from both copies. A confirmation checklist decides whether
   items removed here are restored from another copy. Pull and Send still replace a copy.
   Deleting a playlist on one device does not delete it from another.
5. **The host is only alive while Wavelength is open.**
6. **Android needs the internet for playback.** Offline downloads are not in this build.
7. **Desktop LAN access is for trusted networks.** The app header and pairing code are not
   encryption; use trusted Wi-Fi or Tailscale.
8. **The published installers are all v2.3.0.** The desktop builds are unsigned, so macOS and
   Windows show the usual first-launch warnings.
9. **The app is free, but YouTube's terms still apply.** Personal use only.
10. **No account and no telemetry.** Wavelength itself ships no analytics or central account
    service.

---

## 12. Release plan

### 12.1 Where the line is now

- **v2.2.4** — native Android setup, LAN discovery, top-result actions.
- **v2.2.5** — standalone Android playback.
- **v2.2.6** — Android title, seek, and system-bar fixes.
- **v2.3.0** — merge data with a removed-item checklist, listening recap with custom dates, smart
  volume, smarter shuffle, Remix playlists, No AI, credits skipping, Android widget. Ships on
  macOS, Windows, Linux (AppImage and Flatpak) and Android.
- **v2.4.0** — Android widget with artwork and album, visualizer settings with four sizes and a
  full-screen backdrop, a playback-driven Android visualizer, a brief lock-screen now-playing
  view, and volume control that follows the phone's media stream. Android APK built from this
  tree; desktop installers remain on `v2.3.0` until republished.
- All published desktop installers are on **v2.3.0**; the newest Android APK is **v2.4.0**.

### 12.2 Phase 1 — Stabilise the instrument

**Goal:** every core journey feels finished on the platform it is on.

- Close Android papercuts: notification reliability, permission onboarding, back behaviour,
  safe areas, sync join errors.
- Keep release notes, checksums, and install instructions accurate, especially when a release ships
  a subset of platforms.
- Audit all 14 palettes × 8 styles at Default / Large / Extra large text.
- Audit reduced motion, high contrast, keyboard focus, and 360 px layouts.
- Reduce cold-start and search latency; keep the player responsive during matching and downloads.
- Remove dead ends: every unavailable feature says why and what to do instead.

**Exit criteria:** no known crash in search → play → queue → resume; every platform states its
limits in the interface; no screen depends on hover to complete a task.

### 12.3 Phase 2 — Complete Android ownership

**Goal:** a phone can own and play a library without a computer after setup.

- Offline downloads on Android (the app already names this as the next step).
- Local-file playback on Android (also named in the app).
- Android image covers, so the cover studio reaches parity.
- Stronger storage management: download size, delete, and free-space visibility.
- Evaluate direct Spotify link import on Android; not committed.
- Keep lock-screen, notification, Bluetooth, and headset behaviour reliable across Android
  versions.

**Exit criteria:** install → import/sync → download or add files → play offline, with no computer
required after the library is on the phone.

### 12.4 Phase 3 — Library intelligence without a feed

**Goal:** make a large library easier to maintain without turning the app into a recommendation
product.

- Merge-aware sync, or at least a conflict choice that does not silently replace work.
- Queue reordering, the most visible gap in the current player.
- Better duplicate and missing-track repair; bulk rematch.
- Playlist search and filtering.
- Optional, local-only listening insights if they can be added without a feed or an account.

**Exit criteria:** library changes are reversible or mergeable; no silent data loss; the first-run
experience stays as simple as it is now.

### 12.5 Phase 4 — Depth for people who stay

Candidates, not commitments:

- Folder watching and automatic rescan for local files.
- Export / backup of the library state.
- Richer local-file metadata editing.
- Additional accessibility preferences.
- More visualizer modes only if they remain real-audio driven.

**Exit criteria:** power features are discoverable but do not complicate the first run.

### 12.6 Not on the roadmap

These would contradict the product thesis:

- a social feed, comments, or public profiles;
- a subscription or paywalled playback;
- a cloud locker or always-on central sync service;
- podcasts, video, or a general media hub;
- Spotify audio playback;
- lossless YouTube streaming;
- mobile hosting;
- engagement metrics, streaks, or notification pressure.

---

## 13. Quality bar

### 13.1 Product rules

1. **The play button is always the strongest control on the screen.**
2. **One clear primary action per surface.**
3. **The app never lies about a source or a quality level.**
4. **Nothing important is hover-only.** Every hover action has a touch path.
5. **Long titles never move the transport.** The player reserves its geometry.
6. **Destructive actions explain their consequences.** Delete, clear, pull, and send are explicit.
7. **Loading looks like the content that is coming.** Skeletons, not blank pages.
8. **Empty states teach the next step.** No dead ends.
9. **Reduced motion is a first-class mode.** It is not a broken version of the design.
10. **Every platform difference is visible in the interface.** No pretending Android has a
    feature it does not.

### 13.2 Definition of done

A feature is not done until it passes:

- [ ] Default, Large, and Extra large text.
- [ ] Dark, Light, and at least one Catppuccin palette.
- [ ] All eight interface styles, at least by spot-check.
- [ ] High contrast and reduced motion.
- [ ] Keyboard-only use (desktop/browser).
- [ ] 360 px width, safe areas, and gesture navigation (phone).
- [ ] Empty, loading, error, offline, and permission-denied states.
- [ ] A very long title and a very long artist name.
- [ ] No console errors and no layout shift in the player.
- [ ] Copy reviewed against the truth list in §11.3.
- [ ] Sync host/guest/pull/send/disconnect, if relevant.
- [ ] No duplicated songs, orphaned covers, or deleted files left in the library.
- [ ] Android back behaviour, if relevant.

### 13.3 Accessibility

- Visible `:focus-visible` ring using the accent colour, offset from the control.
- Icon-only buttons have `aria-label` and a title.
- Sliders expose `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and a text value.
- Dialogs use `role="dialog"` and `aria-modal="true"`.
- Toasts use `role="status"` and `aria-live="polite"`.
- Coarse pointers get at least 44 px targets for primary controls.
- Text sizes scale the whole type system.
- High contrast strengthens secondary text, borders, and focus rings.
- Colour is never the only state signal.
- Reduced motion respects both the app setting and the system preference.

### 13.4 Performance

- The app should feel immediate on a local search, a row click, and a pause.
- Search results should appear as skeletons, not a frozen page.
- The visualizer must not steal playback or scrolling frames.
- Long lists must remain scrollable while matching or downloading.
- The player must not reflow when metadata changes.
- Cache growth must be visible and clearable.

### 13.5 Security and privacy

Wavelength has no account system and ships no analytics or telemetry. The library is local.

- Browser data: `./data`.
- Desktop data: the app's user-data folder.
- Local audio: `data/local` (or the equivalent user-data folder).
- MP3s: `~/Music/Wavelength` by default, changeable in Settings.
- Android library: the app's private files, `state.json`.

Network truth:

- Search and playback contact YouTube.
- Optional Spotify import contacts Spotify and stores OAuth tokens locally.
- The interface loads Doto, Space Mono, and Inter from Google Fonts.
- Sync is direct HTTP over the LAN or Tailscale, protected by a pairing code, not TLS.
- The desktop app listens on the LAN by default; the browser defaults to loopback.
- Writes require an app header, but anyone who can reach the address can use the library. The UI
  says this plainly; users should only do it on a trusted network.

There is no built-in version history. **Pull now** and **Send changes** replace a library. Treat
the host as the shared copy and keep your own backups if the library matters.

---

## 14. Metrics and signals

Wavelength does not ship telemetry. The quality signals are the ones a person can see and the
ones support conversations can reveal:

- time from pasting a link to a usable preview;
- time from clicking a song to hearing audio;
- import match rate and the number of “no YouTube match” rows;
- broken-track skips per session;
- sync confusion: wrong address, wrong port, `127.0.0.1` on Android, newest-send surprises;
- settings dead ends: features that look available but are not;
- theme/style readability complaints at Large and Extra large;
- Android lock-screen and notification reliability.

If telemetry is ever added, it must be opt-in, must never include library contents, search terms,
or filenames, and must be documented in the app. The default remains no telemetry.

---

## 15. Voice and copy

### 15.1 Rules

- Sentence case for labels and buttons.
- No exclamation marks.
- No “oops,” “uh oh,” “something went wrong,” or cute failure copy.
- No hype verbs: unleash, supercharge, elevate, revolutionise.
- Say what happened, what it means, and what to do next.
- Put limits in the main sentence, not a footnote.
- Use “song,” not “track,” in user-facing copy unless the context is technical.
- Use “playlist,” “liked songs,” “history,” “queue,” “downloads,” “local files,” “devices.”
- Use “full-screen player,” not “now playing” in navigation copy.
- Use “streaming quality,” “data saver,” “endless playback,” “gapless transitions.”

### 15.2 Copy in the wild

| Moment | Wavelength says | It does not say |
| --- | --- | --- |
| Missing dependency | “yt-dlp isn't installed, so nothing can play yet. Run brew install yt-dlp ffmpeg.” | “Playback error.” |
| Import found | “Found 42 songs — preview the import below.” | “Success!” |
| Spotify limit | “Spotify only shares the first 100 songs without signing in.” | “Some songs may be missing.” |
| Android downloads | “Offline downloads are the next standalone step.” | “Coming soon!” |
| Sync warning | “Newest send wins, so treat the host as the shared copy.” | “Sync conflict.” |
| Delete local file | “This removes the file from Wavelength.” | “Are you sure?” |
| Empty queue | “Nothing queued.” | “Your queue is empty. Add some songs!” |
| Lossless local file | “Original quality, not a stream.” | “Hi-res audio.” |
| YouTube quality | “YouTube audio is lossy; lossless playback comes from local files.” | “Lossless streaming.” |

---

## 16. Technical map

This is not a developer manual; it is the shape of the machine, so future product decisions stay
grounded.

### 16.1 Stack

- **UI:** one HTML page, vanilla JavaScript, hash routing, no framework or bundler.
- **CSS:** token-driven; palettes on `data-theme`, styles on `data-style`, reading on `data-read`,
  contrast on `data-contrast`, motion on `data-motion`.
- **Server:** Node HTTP server; static UI; YouTube resolution; Spotify import; local files;
  downloads; sync; storage.
- **Desktop:** Electron shell; single-instance lock; media keys; embedded server on port `38421`;
  LAN host enabled.
- **Browser:** the same server and UI; service worker and manifest for installability; share
  target under HTTPS.
- **Android:** WebView UI plus a Java bridge; NewPipeExtractor for YouTube; foreground playback
  service and MediaSession; app-private `state.json`.

### 16.2 Data

- Playlists, liked songs, history, settings, and session state live in app/server state.
- Local audio lives under the local library folder.
- Covers live with app data; replaced covers are cleaned up.
- MP3 downloads live in the configured download folder.
- Sync only moves playlists, liked songs, and history. Settings, downloads, and local files stay
  on their device.

### 16.3 Formats

- Local audio: FLAC, WAV, AIFF, ALAC, M4A, MP3, OGG, Opus.
- Downloads: MP3 at 128, 192, 256, or 320 kbps.
- Covers: PNG, JPG, WebP, GIF; normalised to a maximum of 512 px.
- Lists: plain text, numbered lists, bullets, CSV, M3U, with optional timestamps.

### 16.4 Ports

- Desktop app player/server: `38421`.
- Desktop sync listener: `38422` (next port after the player).
- Browser mode: `3000` by default; sync uses the next port.
- Browser LAN access: `HOST=0.0.0.0 ./start.sh`.
- Android: no local server; the UI runs from the APK and talks to the native bridge.

### 16.5 Keyboard shortcuts

| Action | Keys |
| --- | --- |
| Play / pause | `Space`, `K` |
| Next / previous | `N`, `P` |
| Seek 5 seconds | `←`, `→` |
| Volume | `↑`, `↓` |
| Mute | `M` |
| Like current song | `L` |
| Shuffle | `S` |
| Repeat mode | `R` |
| Full-screen player | `F` |
| Queue | `Q` |
| Focus search | `/`, `⌘K` / `Ctrl K` |
| Shortcuts sheet | `?` |
| Close overlays | `Esc` |

Shortcuts work anywhere except while typing in a field. Arrow keys adjust a focused seek or volume
slider with the expected increments; `Home` and `End` jump to the ends.

### 16.6 Design tokens

```css
--font-d: 'Doto', 'DotGothic16', 'Space Mono', monospace;
--font-m: 'Space Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
--font-b: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

--r: 30px;
--spring: cubic-bezier(.34, 1.56, .64, 1);
--soft: cubic-bezier(.22, 1, .36, 1);

--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
```

The tokens are the contract. A new style should change geometry, type, and control weight without
inventing a second palette or a second motion language.

---

## 17. The short version

Wavelength is a player that respects intent.

It looks like a late-night radio room. It moves like a small mechanical object. It imports the
playlist you already made, finds the songs, and lets you keep them. It plays YouTube audio
without the video page, plays your own files without touching their quality, and tells you which
is which. It syncs only when you ask, replaces only when you say so, and never pretends to have a
feature it does not.

The plan is not to become a bigger catalogue. The plan is to make the act of playing a known song
feel finished: fast, quiet, tactile, honest, and yours.
