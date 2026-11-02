'use strict';
/* ═════════ Wavelength motion ═════════
   One place for everything that moves between states. The rules are the
   stageshow ones: a thing that exists on both sides of a change is the *same
   thing* and travels; a thing that is new arrives whole; a thing that goes
   leaves the way it came. Nothing bounces and nothing idles.

     page()    – page changes crossfade, and a cover that exists on both pages
                 (tile, sidebar playlist, header) physically travels between them
     player()  – the mini player's artwork grows into the full-screen player
     flip()    – lists glide to their new positions when sorted, filtered,
                 shuffled or reordered; new rows arrive, removed rows fade
     glide()   – a single highlight slides between nav items and chips
     smooth()  – the seek bar moves every frame instead of four times a second
     images    – artwork fades in once it has loaded

   Everything falls back to the plain, instant change when the browser lacks
   View Transitions or the person has asked for reduced motion. */
(function () {
  const TRAVEL = 'cubic-bezier(.45,0,.1,1)';
  const ARRIVE = 'cubic-bezier(.25,.8,.25,1)';
  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const reduced = () => typeof window.motionReduced === 'function'
    ? window.motionReduced()
    : (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const hasVT = typeof document.startViewTransition === 'function';
  /* View Transitions snapshot the page, which a slow device can't always do
     quickly. If two in a row take too long to start, they are switched off for
     this device and the plain CSS entrances take over. */
  let adaptive = true, slow = 0, off = false;
  try { off = localStorage.getItem('wl-vt-off') === '1'; } catch {}
  const canVT = () => hasVT && !off && !reduced() && !document.hidden;
  function watch(t) {
    if (!adaptive) return;
    const s = performance.now();
    t.ready.then(() => {
      slow = performance.now() - s > 450 ? slow + 1 : 0;
      if (slow >= 2) { off = true; try { localStorage.setItem('wl-vt-off', '1'); } catch {} }
    }, () => {});
  }

  /* ── view transitions ──────────────────────────────────────────────── */
  let active = null;
  const setName = (el, n) => { if (el && el.style) el.style.viewTransitionName = n; };
  const clearNames = () => $$('[style*="view-transition-name"]').forEach(e => { e.style.viewTransitionName = ''; });

  function transition(update, mode) {
    if (!canVT()) { update(); return Promise.resolve(false); }
    try { if (active) active.skipTransition(); } catch {}
    root.classList.add('vt-' + mode);
    let t;
    try { t = document.startViewTransition(() => { update(); }); }
    catch { root.classList.remove('vt-' + mode); update(); return Promise.resolve(false); }
    active = t; watch(t);
    const done = () => {
      if (active !== t) return;           // a newer transition owns the classes now
      active = null; root.classList.remove('vt-page', 'vt-player'); clearNames();
    };
    t.finished.then(done, done);
    return t.finished.then(() => true, () => false);
  }

  /* The clicked tile or sidebar entry, noted just before the hash changes so
     the next page change knows what to travel from. */
  let mark = null;
  function markFrom(el) {
    const c = el && el.querySelector('.cover, .art');
    mark = c ? { el: c, at: performance.now() } : null;
  }
  const takeMark = () => { const m = mark; mark = null; return m && performance.now() - m.at < 700 ? m.el : null; };

  /* swap() draws the new page. `dest` finds the element it should land on. */
  function page(swap, { from, dest } = {}) {
    if (!canVT()) { swap(); return Promise.resolve(false); }
    if (from && from.isConnected) setName(from, 'cover');
    root.classList.add('vt-page');
    return transition(() => {
      if (from) setName(from, '');
      swap();
      const d = dest && dest();
      if (from && d) setName(d, 'cover');
    }, 'page');
  }

  /* Mini player artwork <-> full-screen artwork. */
  function player(toggle, opening) {
    if (!canVT()) { toggle(); return Promise.resolve(false); }
    const mini = $('#p-art'), big = $('#np-art');
    if (typeof opening !== 'boolean') opening = !$('#np').classList.contains('open');
    setName(opening ? mini : big, 'art');
    return transition(() => {
      setName(opening ? mini : big, '');
      toggle();
      setName(opening ? big : mini, 'art');
    }, 'player');
  }

  /* ── FLIP lists ────────────────────────────────────────────────────── */
  const keysOf = els => {
    const seen = Object.create(null);
    return els.map(el => {
      const k = el.dataset.k; if (k == null) return null;
      const n = seen[k] = (seen[k] || 0) + 1;
      return k + '#' + n;
    });
  };

  function flip(box, mutate, opt = {}) {
    if (!box) { mutate(); return; }
    box.dataset.nr = '1';                          // rows here never replay their entrance
    if (reduced()) { mutate(); return; }
    for (const a of box.__flips || []) { try { a.finish(); } catch {} }
    box.__flips = [];
    for (const g of $$(':scope > .flip-ghost', box)) g.remove();

    const sel = opt.sel || ':scope > [data-k]';
    const oldEls = $$(sel, box), oldKeys = keysOf(oldEls);
    const before = new Map();
    oldEls.forEach((el, i) => { if (oldKeys[i]) before.set(oldKeys[i], { el, r: el.getBoundingClientRect() }); });

    mutate();

    const newEls = $$(sel, box), newKeys = keysOf(newEls), seen = new Set();
    const vh = innerHeight, dur = opt.dur || 480;
    let arrivals = 0;
    newEls.forEach((el, i) => {
      const k = newKeys[i]; if (!k) return;
      seen.add(k);
      const b = before.get(k), r = el.getBoundingClientRect();
      const nearView = r.bottom > -120 && r.top < vh + 120;
      let a = null;
      if (b) {
        const dy = b.r.top - r.top, dx = b.r.left - r.left;
        if (Math.abs(dy) < 1 && Math.abs(dx) < 1) return;
        if (!nearView && !(b.r.bottom > -120 && b.r.top < vh + 120)) return;
        a = el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: dur, easing: TRAVEL });
      } else if (nearView) {
        a = el.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, easing: ARRIVE, delay: Math.min(arrivals++, 10) * 28, fill: 'backwards' });
      }
      if (a) box.__flips.push(a);
    });

    // rows that left fade where they stood
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    const nb = box.getBoundingClientRect();
    for (const [k, b] of before) {
      if (seen.has(k)) continue;
      if (!(b.r.bottom > -60 && b.r.top < vh + 60)) continue;
      const g = b.el.cloneNode(true);
      g.classList.add('flip-ghost'); g.classList.remove('leaving');
      Object.assign(g.style, { position: 'absolute', left: (b.r.left - nb.left) + 'px', top: (b.r.top - nb.top) + 'px',
        width: b.r.width + 'px', height: b.r.height + 'px', margin: '0', pointerEvents: 'none', zIndex: '0' });
      box.appendChild(g);
      const a = g.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-14px)' }],
        { duration: 260, easing: ARRIVE, fill: 'forwards' });
      a.onfinish = a.oncancel = () => g.remove();
      box.__flips.push(a);
    }
  }

  /* ── glide: one highlight that travels between items ───────────────── */
  const gliders = new Map();
  /* Variants other than the default look draw their own selected state, so the
     highlight is only used where it matches the rest of the design. */
  const glideOK = () => (root.dataset.style || 'nothing') === 'nothing' && !reduced();

  function glide(box, itemSel, onSel, { pad = 0 } = {}) {
    if (!box) return;
    let g = gliders.get(box);
    const ok = glideOK();
    box.classList.toggle('gl', ok);
    if (!ok) { if (g) g.el.style.opacity = '0'; return; }
    if (!g || !g.el.isConnected) {
      const el = document.createElement('i');
      el.className = 'glider'; el.setAttribute('aria-hidden', 'true');
      box.prepend(el);
      g = { el, placed: false }; gliders.set(box, g);
    }
    const on = $(onSel, box);
    if (!on) { g.el.style.opacity = '0'; g.placed = false; return; }
    const br = box.getBoundingClientRect(), r = on.getBoundingClientRect();
    if (!r.width) { g.el.style.opacity = '0'; g.placed = false; return; }
    const x = r.left - br.left + box.scrollLeft - pad, y = r.top - br.top + box.scrollTop - pad;
    const w = r.width + pad * 2, h = r.height + pad * 2;
    const css = g.el.style;
    if (!g.placed) {
      css.transition = 'none';
      css.width = w + 'px'; css.height = h + 'px'; css.transform = `translate(${x}px,${y}px)`;
      void g.el.offsetWidth; css.transition = '';
      g.placed = true;
    } else {
      css.width = w + 'px'; css.height = h + 'px'; css.transform = `translate(${x}px,${y}px)`;
    }
    css.opacity = '1';
  }
  function glideAll() {
    for (const b of [...gliders.keys()]) if (!b.isConnected) gliders.delete(b);
    glide($('.nav'), 'a', 'a.on');
    glide($('.mnav'), 'a', 'a.on');
    $$('.sort-chips').forEach(b => glide(b, '.chip', '.chip.on'));
  }
  addEventListener('resize', () => { for (const g of gliders.values()) g.placed = false; glideAll(); });
  document.fonts && document.fonts.ready && document.fonts.ready.then(() => { for (const g of gliders.values()) g.placed = false; glideAll(); });

  /* ── smooth seek bar ───────────────────────────────────────────────── */
  let smoothRaf = 0, smoothFn = null;
  function smooth(fn) {
    smoothFn = fn;
    if (smoothRaf || document.hidden) return;
    const loop = () => {
      smoothRaf = 0;
      if (!smoothFn) return;
      if (smoothFn() === false) return;      // the caller says playback stopped
      smoothRaf = requestAnimationFrame(loop);
    };
    smoothRaf = requestAnimationFrame(loop);
  }
  const stopSmooth = () => { smoothFn = null; if (smoothRaf) cancelAnimationFrame(smoothRaf); smoothRaf = 0; };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (smoothRaf) cancelAnimationFrame(smoothRaf); smoothRaf = 0; } else if (smoothFn) smooth(smoothFn); });

  /* ── artwork fades in when it has loaded ───────────────────────────── */
  const settle = img => { if (img.complete && img.naturalWidth) img.classList.add('ld'); };
  document.addEventListener('load', e => { if (e.target && e.target.tagName === 'IMG') e.target.classList.add('ld'); }, true);
  function sweepImages(rootEl) {
    for (const i of $$('img:not(.ld)', rootEl || document)) settle(i);
  }

  /* ── header artwork eases away as the page scrolls ─────────────────── */
  function parallax(scroller, getTarget) {
    if (!scroller || scroller.__px) return;
    scroller.__px = true;
    let raf = 0;
    scroller.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const t = getTarget(); if (!t) return;
        t.style.setProperty('--sy', Math.min(600, Math.max(0, scroller.scrollTop)));
      });
    }, { passive: true });
  }

  window.WLMotion = {
    TRAVEL, ARRIVE, canVT, hasVT, transition, page, player, markFrom, takeMark,
    flip, glide, glideAll, smooth, stopSmooth, sweepImages, parallax,
    setAdaptive: v => { adaptive = !!v; if (!v) { off = false; slow = 0; } },
  };
})();
