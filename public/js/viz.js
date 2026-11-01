'use strict';
/* ═════════ Wavelength visualizers ═════════
   Twenty styles that share one drawing context. The player feeds them real
   analyser data (desktop/browser) or a track-seeded synthetic spectrum
   (Android), and the style gallery feeds them the synthetic one so every card
   can be previewed live.

   A style is `draw(g, c)`:
     c.w, c.h      canvas size in CSS pixels
     c.t, c.dt     animation clock (seconds) and last step
     c.bins(n)     n eased levels, 0..1, low to high frequency
     c.wave(u)     waveform sample at u in 0..1, -1..1
     c.bass        smoothed low-end energy, 0..1
     c.accent      accent colour, c.a(alpha) the same with alpha
     c.dim         the muted "off" colour
     c.state       per-canvas scratch object (peaks, particles, ...)
   Styles never keep module-level state, so many can run at once. */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  function parseColor(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return [215, 25, 33];
    let h = m[1]; if (h.length === 3) h = h.split('').map(x => x + x).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /* The phone has no sample access, so this stands in for the spectrum. It is
     the same model the app has always used: a spectral tilt, a beat, and slow
     movement, all seeded per song. */
  function synthLevelAt(i, n, t, s) {
    const tilt = Math.pow(Math.max(0, 1 - i / n), 0.72);
    const beat = Math.pow(0.5 + 0.5 * Math.sin(t * 3.05 + s), 3);
    const body = 0.5 + 0.5 * Math.sin(t * 1.31 + i * 0.52 + s * 1.7);
    const air = 0.5 + 0.5 * Math.sin(t * 2.63 + i * 1.17 + s * 3.1);
    const dip = 0.5 + 0.5 * Math.sin(t * 0.47 + i * 0.09 + s * 0.8);
    return Math.min(1, 0.1 + tilt * (0.34 * body + 0.3 * beat) * (0.55 + 0.45 * dip) + 0.16 * air * tilt + 0.06 * beat);
  }
  function synthWaveAt(u, t, s) {
    const amp = 0.08 + 0.34 * Math.pow(0.5 + 0.5 * Math.sin(t * 3.05 + s), 2);
    return Math.sin(u * 21 + t * 3.1) * amp * (0.55 + 0.45 * Math.sin(u * 4.7 + t * 0.8));
  }

  /* Builds the context a style draws with. `source` supplies raw values:
       level(i, n) -> 0..1, wave(u) -> -1..1, live -> boolean */
  function makeCtx(source) {
    const c = {
      w: 0, h: 0, t: 0, dt: 0.033, accent: '#d71921', dim: 'rgba(255,255,255,.17)',
      state: {}, bass: 0, rgb: [215, 25, 33], live: false,
      level: (i, n) => source.level(i, n),
      wave: u => source.wave(u),
      a(alpha) { return `rgba(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]},${alpha})`; },
      bins(n) {
        const key = 'b' + n, d = c.state[key] || (c.state[key] = []);
        for (let i = 0; i < n; i++) {
          const v = source.level(i, n);
          d[i] = (d[i] ?? v) + (v - (d[i] ?? v)) * 0.32;
        }
        return d;
      },
    };
    c.begin = (w, h, t, dt, accent, dim) => {
      c.w = w; c.h = h; c.t = t; c.dt = dt;
      if (accent !== c.accent) { c.accent = accent; c.rgb = parseColor(accent); }
      if (dim) c.dim = dim;
      let b = 0; for (let i = 0; i < 4; i++) b += source.level(i, 24);
      c.bass += (b / 4 - c.bass) * 0.3;
    };
    return c;
  }

  /* ── styles ─────────────────────────────────────────────────────── */
  const styles = [];
  const add = (id, name, hint, draw) => styles.push({ id, name, hint, draw });

  add('matrix', 'Matrix', 'Glowing dot grid', (g, c) => {
    const cols = 34, rows = 11, B = c.bins(cols);
    const cell = Math.min(c.w / cols, c.h / rows), ox = (c.w - cell * cols) / 2, oy = (c.h - cell * rows) / 2, r = cell * 0.3;
    for (let x = 0; x < cols; x++) {
      const lit = Math.round(B[x] * rows);
      for (let y = 0; y < rows; y++) {
        const on = y >= rows - lit;
        g.fillStyle = on ? c.accent : c.dim;
        g.beginPath(); g.arc(ox + x * cell + cell / 2, oy + y * cell + cell / 2, on ? r * 1.08 : r * 0.62, 0, TAU); g.fill();
      }
    }
  });

  add('bars', 'Bars', 'Classic rounded spectrum', (g, c) => {
    const n = 44, bw = c.w / n, B = c.bins(n);
    g.fillStyle = c.accent;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(6, B[i] * c.h * 0.95);
      g.beginPath(); g.roundRect(i * bw + bw * 0.2, c.h - bh, bw * 0.6, bh, bw * 0.3); g.fill();
    }
  });

  add('wave', 'Wave', 'Glowing waveform line', (g, c) => {
    g.strokeStyle = c.accent; g.lineWidth = 3; g.lineCap = g.lineJoin = 'round';
    g.shadowColor = c.accent; g.shadowBlur = 14; g.beginPath();
    for (let x = 0; x <= c.w; x += 3) {
      const y = c.h / 2 + c.wave(x / c.w) * c.h * 0.46;
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke(); g.shadowBlur = 0;
  });

  add('radial', 'Radial', 'Spokes around a ring', (g, c) => {
    const n = 72, cx = c.w / 2, cy = c.h / 2, r0 = Math.min(c.w, c.h) * 0.26, B = c.bins(n / 2);
    g.strokeStyle = c.accent; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU - Math.PI / 2 + c.t * 0.15, l = 4 + B[i < n / 2 ? i : n - 1 - i] * r0 * 1.15;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l)); g.stroke();
    }
  });

  add('mirror', 'Mirror', 'Bars reflected about the centre', (g, c) => {
    const n = 40, bw = c.w / n, B = c.bins(n), mid = c.h / 2;
    g.fillStyle = c.accent;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(4, B[i] * c.h * 0.46);
      g.beginPath(); g.roundRect(i * bw + bw * 0.22, mid - bh, bw * 0.56, bh * 2, bw * 0.28); g.fill();
    }
  });

  add('ribbon', 'Ribbon', 'Smooth filled spectrum', (g, c) => {
    const n = 40, B = c.bins(n), step = c.w / (n - 1), base = c.h * 0.96;
    const grad = g.createLinearGradient(0, 0, 0, c.h);
    grad.addColorStop(0, c.a(0.75)); grad.addColorStop(1, c.a(0.02));
    const pt = i => [i * step, base - Math.max(0.03, B[i]) * c.h * 0.86];
    g.beginPath(); g.moveTo(0, base);
    let p = pt(0); g.lineTo(p[0], p[1]);
    for (let i = 1; i < n; i++) { const q = pt(i); g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); p = q; }
    g.lineTo(p[0], p[1]); g.lineTo(c.w, base); g.closePath();
    g.fillStyle = grad; g.fill();
    g.strokeStyle = c.accent; g.lineWidth = 2.5; g.lineJoin = 'round'; g.stroke();
  });

  add('beads', 'Beads', 'A string of pulsing beads', (g, c) => {
    const n = 26, B = c.bins(n), s = c.w / n, cy = c.h / 2;
    for (let i = 0; i < n; i++) {
      const r = Math.max(2.5, Math.min(s * 0.46, 2.5 + B[i] * Math.min(c.h * 0.36, s * 0.7)));
      g.fillStyle = c.a(0.35 + 0.65 * B[i]);
      g.beginPath(); g.arc(s * (i + 0.5), cy, r, 0, TAU); g.fill();
    }
  });

  add('line', 'Line', 'Thin spectrum trace with peaks', (g, c) => {
    const n = 64, B = c.bins(n), step = c.w / (n - 1), base = c.h * 0.9;
    g.strokeStyle = c.accent; g.lineWidth = 1.8; g.lineJoin = 'round'; g.beginPath();
    for (let i = 0; i < n; i++) { const y = base - B[i] * c.h * 0.8; i ? g.lineTo(i * step, y) : g.moveTo(0, y); }
    g.stroke();
    g.fillStyle = c.accent;
    for (let i = 1; i < n - 1; i++) {
      if (B[i] > B[i - 1] && B[i] >= B[i + 1] && B[i] > 0.2) {
        g.beginPath(); g.arc(i * step, base - B[i] * c.h * 0.8, 3, 0, TAU); g.fill();
      }
    }
  });

  add('rings', 'Rings', 'Concentric rings that breathe', (g, c) => {
    const k = 6, B = c.bins(k), cx = c.w / 2, cy = c.h / 2, m = Math.min(c.w, c.h) * 0.5;
    for (let i = 0; i < k; i++) {
      const r = m * (0.16 + i * 0.13) + B[i] * m * 0.16;
      g.strokeStyle = c.a(0.95 - i * 0.12); g.lineWidth = 2 + B[i] * 3;
      g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke();
    }
  });

  add('orbit', 'Orbit', 'Particles circling the centre', (g, c) => {
    const rings = 3, per = 14, B = c.bins(rings * per), cx = c.w / 2, cy = c.h / 2, m = Math.min(c.w, c.h) * 0.46;
    for (let k = 0; k < rings; k++) {
      const base = m * (0.38 + k * 0.28), speed = (k % 2 ? -1 : 1) * (0.32 + k * 0.12);
      for (let j = 0; j < per; j++) {
        const lv = B[k * per + j], a = c.t * speed + j / per * TAU + k, r = base * (1 + lv * 0.2);
        g.fillStyle = c.a(0.45 + 0.55 * lv);
        g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.92, 2 + lv * 3.6, 0, TAU); g.fill();
      }
    }
  });

  add('sunburst', 'Sunburst', 'Tapered rays from a core', (g, c) => {
    const n = 36, B = c.bins(n / 2), cx = c.w / 2, cy = c.h / 2, r0 = Math.min(c.w, c.h) * 0.16, da = TAU / n * 0.32;
    g.fillStyle = c.accent;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + c.t * 0.1, l = r0 * 0.4 + B[i < n / 2 ? i : n - 1 - i] * Math.min(c.w, c.h) * 0.36;
      g.beginPath();
      g.moveTo(cx + Math.cos(a - da) * r0, cy + Math.sin(a - da) * r0);
      g.lineTo(cx + Math.cos(a) * (r0 + l), cy + Math.sin(a) * (r0 + l));
      g.lineTo(cx + Math.cos(a + da) * r0, cy + Math.sin(a + da) * r0);
      g.closePath(); g.fill();
    }
  });

  add('horizon', 'Horizon', 'Bars with a soft reflection', (g, c) => {
    const n = 38, bw = c.w / n, B = c.bins(n), y0 = c.h * 0.64;
    for (let i = 0; i < n; i++) {
      const bh = Math.max(4, B[i] * y0 * 0.95), x = i * bw + bw * 0.2;
      g.fillStyle = c.accent; g.beginPath(); g.roundRect(x, y0 - bh, bw * 0.6, bh, [bw * 0.3, bw * 0.3, 0, 0]); g.fill();
      const rh = bh * 0.55, grad = g.createLinearGradient(0, y0 + 2, 0, y0 + 2 + rh);
      grad.addColorStop(0, c.a(0.3)); grad.addColorStop(1, c.a(0));
      g.fillStyle = grad; g.fillRect(x, y0 + 2, bw * 0.6, rh);
    }
    g.fillStyle = c.a(0.35); g.fillRect(0, y0, c.w, 1);
  });

  add('segments', 'Segments', 'LED meter with peak hold', (g, c) => {
    const cols = 22, rows = 12, B = c.bins(cols), st = c.state, pk = st.pk || (st.pk = []);
    const cw = c.w / cols, rh = c.h / rows;
    for (let x = 0; x < cols; x++) {
      const lit = Math.round(B[x] * rows);
      pk[x] = Math.max(lit, (pk[x] ?? 0) - c.dt * 5);
      for (let y = 0; y < rows; y++) {
        const on = rows - 1 - y < lit, cap = Math.round(pk[x]) - 1 === rows - 1 - y;
        g.fillStyle = on ? c.a(0.5 + 0.5 * ((rows - y) / rows)) : cap ? c.accent : c.dim;
        g.beginPath(); g.roundRect(x * cw + cw * 0.14, y * rh + rh * 0.14, cw * 0.72, rh * 0.72, 2); g.fill();
      }
    }
  });

  add('peaks', 'Peaks', 'Slim bars with falling caps', (g, c) => {
    const n = 56, bw = c.w / n, B = c.bins(n), pk = c.state.pk || (c.state.pk = []);
    for (let i = 0; i < n; i++) {
      pk[i] = Math.max(B[i], (pk[i] ?? 0) - c.dt * 0.45);
      const x = i * bw + bw * 0.32, w = bw * 0.36, bh = Math.max(3, B[i] * c.h * 0.9);
      g.fillStyle = c.a(0.8); g.fillRect(x, c.h - bh, w, bh);
      g.fillStyle = c.accent; g.fillRect(x, c.h - pk[i] * c.h * 0.9 - 4, w, 3);
    }
  });

  add('aurora', 'Aurora', 'Slow, drifting light bands', (g, c) => {
    const B = c.bins(4), bands = 4, prev = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < bands; k++) {
      const amp = c.h * (0.07 + 0.16 * B[k]), thick = c.h * (0.16 + 0.12 * B[k]), mid = c.h * (0.3 + k * 0.14);
      const f = 2.2 + k * 0.7, sp = 0.35 + k * 0.17;
      const y = x => mid + Math.sin(x / c.w * f * Math.PI + c.t * sp + k * 1.7) * amp + Math.sin(x / c.w * 5 + c.t * 0.6 + k) * amp * 0.35;
      const grad = g.createLinearGradient(0, mid - amp, 0, mid + thick + amp);
      grad.addColorStop(0, c.a(0)); grad.addColorStop(0.45, c.a(0.38)); grad.addColorStop(1, c.a(0));
      g.beginPath(); g.moveTo(0, y(0));
      for (let x = 0; x <= c.w; x += 6) g.lineTo(x, y(x));
      for (let x = c.w; x >= 0; x -= 6) g.lineTo(x, y(x) + thick);
      g.closePath(); g.fillStyle = grad; g.fill();
    }
    g.globalCompositeOperation = prev;
  });

  add('scope', 'Scope', 'Oscilloscope on a grid', (g, c) => {
    g.strokeStyle = c.dim; g.lineWidth = 1; g.beginPath();
    for (let i = 1; i < 8; i++) { const x = c.w * i / 8; g.moveTo(x, 0); g.lineTo(x, c.h); }
    for (let i = 1; i < 4; i++) { const y = c.h * i / 4; g.moveTo(0, y); g.lineTo(c.w, y); }
    g.stroke();
    g.strokeStyle = c.accent; g.lineWidth = 2; g.lineJoin = 'round';
    g.shadowColor = c.accent; g.shadowBlur = 10; g.beginPath();
    for (let x = 0; x <= c.w; x += 2) { const y = c.h / 2 + c.wave(x / c.w) * c.h * 0.44; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.shadowBlur = 0;
  });

  add('pulse', 'Pulse', 'A core that rings on the beat', (g, c) => {
    const st = c.state, cx = c.w / 2, cy = c.h / 2, m = Math.min(c.w, c.h) * 0.5;
    const rip = st.rip || (st.rip = []);
    if (c.bass > 0.5 && c.bass - (st.last ?? 0) > 0.05 && c.t - (st.at ?? -9) > 0.38) { rip.push(0); st.at = c.t; }
    st.last = c.bass;
    for (let i = rip.length - 1; i >= 0; i--) {
      rip[i] += c.dt * 0.55;
      if (rip[i] >= 1) { rip.splice(i, 1); continue; }
      g.strokeStyle = c.a((1 - rip[i]) * 0.6); g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, m * (0.3 + rip[i] * 0.7), 0, TAU); g.stroke();
    }
    g.fillStyle = c.a(0.9); g.beginPath(); g.arc(cx, cy, m * (0.22 + c.bass * 0.16), 0, TAU); g.fill();
  });

  add('ridges', 'Ridges', 'Layered hills that rise with sound', (g, c) => {
    const n = 32, B = c.bins(n), layers = 4;
    for (let k = 0; k < layers; k++) {
      const depth = k / (layers - 1), base = c.h * (0.62 + depth * 0.36), amp = c.h * (0.2 + depth * 0.3);
      const shift = c.t * (0.4 + depth * 0.9);
      const at = u => { const f = ((u * (n - 1) + shift) % (n - 1) + (n - 1)) % (n - 1), i = Math.floor(f); return B[i] + (B[Math.min(n - 1, i + 1)] - B[i]) * (f - i); };
      g.beginPath(); g.moveTo(0, c.h);
      for (let x = 0; x <= c.w; x += 8) g.lineTo(x, base - at(x / c.w) * amp);
      g.lineTo(c.w, c.h); g.closePath();
      g.fillStyle = c.a(0.1 + depth * 0.22); g.fill();
      g.strokeStyle = c.a(0.35 + depth * 0.5); g.lineWidth = 1.5; g.stroke();
    }
  });

  add('fireflies', 'Fireflies', 'Glowing motes that drift up', (g, c) => {
    const st = c.state, ps = st.p || (st.p = []), B = c.bins(8);
    const energy = (B[0] + B[1] + B[2]) / 3;
    st.acc = (st.acc || 0) + c.dt * (3 + energy * 46);
    while (st.acc >= 1 && ps.length < 80) {
      st.acc -= 1;
      ps.push({ x: Math.random() * c.w, y: c.h + 6, vy: 18 + Math.random() * 46, ph: Math.random() * TAU, r: 1.5 + Math.random() * 2.6, life: 0, span: 2.4 + Math.random() * 2.2 });
    }
    st.acc = Math.min(st.acc, 2);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life += c.dt; p.y -= p.vy * c.dt * (0.6 + energy); p.x += Math.sin(p.ph + p.life * 1.7) * 14 * c.dt;
      if (p.life > p.span || p.y < -8) { ps.splice(i, 1); continue; }
      const f = Math.min(1, p.life / 0.5) * Math.min(1, (p.span - p.life) / 0.7);
      g.fillStyle = c.a(0.18 * f); g.beginPath(); g.arc(p.x, p.y, p.r * 3.2, 0, TAU); g.fill();
      g.fillStyle = c.a(0.95 * f); g.beginPath(); g.arc(p.x, p.y, p.r, 0, TAU); g.fill();
    }
  });

  add('spiral', 'Spiral', 'A turning galaxy of dots', (g, c) => {
    const n = 96, B = c.bins(n), cx = c.w / 2, cy = c.h / 2, m = Math.min(c.w, c.h) * 0.46;
    for (let i = 0; i < n; i++) {
      const f = i / n, a = f * TAU * 3.2 + c.t * 0.28, r = m * (0.08 + f * 0.92) + B[i] * m * 0.1;
      g.fillStyle = c.a(0.3 + 0.7 * B[i]);
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2 + B[i] * 4.2 + f * 1.2, 0, TAU); g.fill();
    }
  });

  const byId = Object.fromEntries(styles.map(s => [s.id, s]));
  const CLASSIC = ['matrix', 'bars', 'wave', 'radial'];

  window.WLViz = {
    styles, byId, CLASSIC, ids: styles.map(s => s.id),
    has: id => !!byId[id],
    name: id => (byId[id] || byId.matrix).name,
    makeCtx, synthLevelAt, synthWaveAt,
    draw(id, g, c) { (byId[id] || byId.matrix).draw(g, c); },
  };
})();
