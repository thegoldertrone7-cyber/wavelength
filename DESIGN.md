# Wavelength — design and motion

Wavelength is built to feel like a small, well-made piece of audio hardware: dark, tactile,
quietly technical, and a little strange in the details. It should disappear while music is
playing, but still feel designed when you stop to look at it.

## The idea

The interface is a late-night radio room rather than a streaming catalogue. It uses deep
backgrounds, soft light, dotted rhythms and monospaced labels to suggest a machine that is
alive but not demanding. Nothing flashes for attention. The music is the brightest object
on screen.

Three ideas run through the whole app:

1. **One surface, not a pile of pages.** Cards, rows and player controls share the same
   rounded geometry and fade into each other. Navigation changes the content, not the mood.
2. **Small mechanical details.** Dot-matrix play/pause symbols, a spinning record, dotted
   progress tracks and tiny numeric labels make the app feel handled rather than scrolled.
3. **Calm motion.** Movement is soft and springy, never bouncy for its own sake. Reduced
   motion is a first-class setting, not an afterthought.

## Colour

There are 14 palettes in three groups:

- **Essentials:** Dark, Light, System.
- **Colour themes:** Rose, Amber, Teal, Sky, Violet, Lime, Slate.
- **Catppuccin:** Latte, Frappé, Macchiato, Mocha.

Each palette supplies the page background, two surface levels, three text levels, the
dotted-pattern colour, an inverted colour for active pills, and a default accent. The
accent can be replaced with a classic colour, any Catppuccin accent, or a custom colour
picker. The accent drives progress, focus rings, the active navigation dot, the play ring
and the ambient glow.

Dark themes use true black or near-black backgrounds with almost-black cards. Light themes
are cool paper grey rather than pure white. Catppuccin themes keep their own muted contrast
and mauve-led accents. High-contrast mode strengthens secondary text and borders without
changing the chosen palette.

Colour is never the only signal: active states also change shape, weight, a dot, or a fill.

## Interface styles

The palette is separate from the interface style. Switching styles changes geometry, type
treatment and control weight, but never recolours the app.

- **Nothing OS** — the signature look: monochrome, dot-matrix, minimal, brand-first.
- **Classic** — a familiar rounded music app with bold headings and straightforward buttons.
- **Windows 11** — Fluent-like surfaces, tight corners, compact desktop controls.
- **macOS** — compact translucent panels, SF-style type and restrained controls.
- **macOS Glass** — liquid-glass cards, heavy blur, layered highlights and stronger accent light.
- **Linux / GNOME** — soft cards, simple controls and restrained accent use.
- **KDE Plasma** — dense rows, square-ish corners, technical type and information-first layout.
- **Samsung One UI** — large pill controls and generous touch targets for phones and tablets.

## Type

Wavelength uses three families:

- **Doto** for display type, the logo and large titles. Its dot construction carries the
  dot-matrix identity into the words themselves.
- **Space Mono** for metadata, labels, durations and utility text. It makes small print feel
  like readouts from a piece of equipment.
- **Inter** for body copy, song titles and controls that need to stay plain and readable.

Some interface styles swap the display and mono families for platform-native type, but keep
the same scale and spacing logic. Reading comfort settings (Default, Large, Extra large) scale
the whole type system rather than only the body text.

## Shape and surfaces

Cards use a large 28–34 px radius, while pills and the player use fully rounded ends.
The player is a floating capsule on desktop and a near-edge-to-edge bar on phones.

Surfaces are layered:

- page background;
- card surface;
- raised inner surface for rows and inputs;
- translucent glass for the player, queue and now-playing overlay.

Blur and saturation are used only where something floats over something else. The result
should feel like smoked glass, not a stack of frosted rectangles.

A very soft radial accent glow drifts behind the main layout. It is intentionally almost
invisible: you notice the page breathing before you notice the light source.

## The dot language

Dots are the app's recurring mark:

- the logo is a 2×2 dot block;
- dotted progress bars replace flat sliders in the default style;
- hero and empty-art patterns use fine dot grids;
- the play/pause icon is a 5×5 dot matrix whose cells switch on in sequence;
- active navigation items get a small glowing dot.

The dots are a rhythm, not decoration. They should stay sparse; if every surface were dotted,
the motif would stop meaning anything.

## Motion

Two curves define the feel:

- **Spring** — `cubic-bezier(.34, 1.56, .64, 1)`, used for presses, hover lifts, artwork
  entrances and small state changes. It overshoots very slightly.
- **Soft** — `cubic-bezier(.22, 1, .36, 1)`, used for fades, view changes and larger surfaces.
  It settles without a visible bounce.

Typical movement:

- page views fade and rise a few pixels, with a short blur on exit;
- tiles lift and tilt less than a degree on hover;
- the album art in the player rotates slowly while music plays;
- the play button grows a soft ring in time with playback;
- now-playing artwork bobs gently, while its background is a heavily blurred copy of the cover;
- the queue and sheets slide in on a spring;
- progress fills continuously, while the scrub thumb blooms on touch;
- the full-screen player fades and scales in from the player bar.

Motion is deliberately slow enough to read: 0.4–0.8 seconds for surfaces, 0.1–0.2 seconds for
press feedback. Playing states are the only continuous animations. When reduced motion is on,
ambient drift and record spin stop, and transitions collapse to near-instant changes. The app
also respects the system preference by default.

## Layout

On desktop, a persistent left sidebar holds the logo, primary navigation and playlists. The
main area is a single scrolling view with a sticky search header. The player spans the bottom
as a floating capsule with three zones: track identity, transport and seek, and queue/volume.

On phones, the sidebar becomes a compact icon row in the header. The player becomes a
two-column bar: artwork and track identity on the left, transport on the right. A thin,
touchable seek track sits along the top edge of that bar, so the most important control is
still available without opening the full player. The full-screen player uses a fixed metadata
area: one-line or two-line titles cannot push the artwork, progress or transport around.

The queue is a side panel on desktop and a bottom sheet on phones. Dialogs follow the same
pattern: floating card on desktop, sheet from the bottom on mobile. Safe-area insets keep the
player, sheets and now-playing controls clear of notches, status bars and Android navigation
gestures.

## The player

The player is the emotional centre of the app. It shows a circular record-style cover, title,
artist, like button, shuffle, previous, play/pause, next and repeat. The desktop version adds
queue, full-screen and volume controls.

The full-screen view is a quiet, blurred room built from the current cover. It contains the
large artwork, title, artist, like control, optional audio visualiser, seek bar and transport.
The visualiser has four modes (Matrix, Bars, Wave, Radial) and reacts to the actual audio
signal rather than a canned animation.

Track changes cross-fade and slide the metadata; the cover art updates with a short fade. The
player never jumps height because of a long title or artist name.

## Features the design supports

- Search YouTube and play ad-free.
- Playlists, liked songs, listening history and a queue with play next, add, remove and clear.
- Shuffle that stays inside the active list, plus Smart Shuffle and Remix across playlists.
- Playlist sorting by recently added, A-Z, artist, duration or album, with list and grid views.
- Full-screen player, queue, volume, seeking and sleep timer.
- Smart volume that evens out quiet and loud tracks on desktop/browser.
- No AI and blocked-artist filtering, labelled as best effort.
- Metadata-based credits/outro skipping, labelled as best effort.
- Spotify playlist/album/song links, pasted song lists and optional account import (desktop).
- MP3 downloads with selectable quality (desktop).
- Local lossless files at native bit depth and sample rate (desktop).
- Device sync for playlists, liked songs, history and listening stats, with additive Merge data and
  a checklist for items removed here but still on another copy; settings and downloads stay local.
- Listening recap with year presets and custom start/end dates.
- 14 palettes, custom accents, 8 interface styles, text-size and contrast controls.
- Reduced motion, keyboard shortcuts, focus-visible rings and touch-sized controls.
- Android lock-screen, notification, Bluetooth, headset and home-screen widget controls.
- Standalone Android playback through NewPipeExtractor, with optional computer sync.

## Android character

The Android build keeps the same visual language but changes the physical behaviour:

- the interface runs from the APK and searches/streams directly on the phone;
- the bottom player gets a compact seek track and larger touch targets;
- system status and navigation bars are transparent, with the app's background showing
  through and icon brightness following the light/dark theme;
- safe-area variables keep content above gesture navigation, three-button navigation and
  display cutouts;
- the back gesture closes overlays or returns through history instead of exiting abruptly.

The goal is for Android to feel like Wavelength, not like a web page in a phone-shaped box.

## What to avoid

- No bright gradients competing with album art.
- No fake audio visualisation; movement should follow real playback.
- No layout shift when titles, artists or queue contents change.
- No tiny touch targets or hover-only actions on phones.
- No style that makes the transport hard to find. The play button is always the strongest
  control on the screen.

## Tuning it

Most of the visual system is controlled from **Settings → Appearance** (palette, accent,
interface style) and **Settings → Reading / Motion**. The underlying tokens live in
`public/css/style.css`; interface styles are attribute selectors on `data-style`, and motion
preferences are represented by `data-motion` and the system media query. New styles should
change shape and hierarchy without changing the palette contract.
