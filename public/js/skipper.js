'use strict';
/* ═════════ Wavelength smart skipper ═════════
   Decides what part of a song is an intro, an outro or a break, and how sure
   it is. It never touches the player: it takes evidence in, and returns a plan.

   Evidence comes from four independent places, and agreement raises confidence:
     chapter  – the video's own chapter list (titles such as "Intro", "Credits")
     desc     – timestamps written in the video description ("0:00 Intro")
     crowd    – SponsorBlock community submissions (intro / outro / non-music)
     silence  – real audio analysis: quiet lead-in, dead air, long gaps

   Everything here is pure, so it runs the same in the browser and in Node
   (see tests/skipper.test.js). */
(function (root) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = v => Math.round(v * 10) / 10;

  /* ── reading titles ─────────────────────────────────────────────────── */
  const INTRO_RE = /\b(intro(?:duction)?|cold open|prologue|prelude|preamble|pre-?show|opening (?:scene|skit|monologue|remarks)|teaser)\b/i;
  const OUTRO_RE = /\b(outro|end(?:ing)? credits?|credits?|thanks? for (?:watching|listening)|epilogue|postlude|farewell|goodbye|end card|closing (?:remarks|credits|scene)|post[- ]credits?|bonus (?:scene|clip)|behind the scenes|subscribe)\b/i;
  const OFFTOPIC_RE = /\b(skit|ads?|advert(?:isement)?|sponsor(?:ed|ship)?|promo(?:tion)?|shout-?outs?|announcements?|call to action|interview|commentary|dialogue)\b/i;

  /* A title's role, before position is taken into account. */
  function classifyTitle(title) {
    const t = String(title || '').trim();
    if (!t) return null;
    if (OUTRO_RE.test(t)) return 'outro';
    if (INTRO_RE.test(t)) return 'intro';
    if (OFFTOPIC_RE.test(t)) return 'offtopic';
    return null;
  }

  /* ── timestamps written in a description ────────────────────────────── */
  function toSeconds(text) {
    const p = String(text).split(':').map(Number);
    if (p.some(n => !isFinite(n))) return NaN;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const TS = '((?:\\d{1,2}:)?\\d{1,2}:\\d{2})';
  const LEAD_RE = new RegExp('^\\s*(?:[-•*▶►·]|\\d{1,2}[.)])?\\s*[\\[(]?' + TS + '[\\])]?\\s*[-–—:|.]*\\s*(.+?)\\s*$');
  const TRAIL_RE = new RegExp('^\\s*(?:[-•*▶►·]|\\d{1,2}[.)])?\\s*(.+?)\\s*[-–—:|.]*\\s*[\\[(]?' + TS + '[\\])]?\\s*$');
  function parseTimestamps(desc, dur) {
    const out = [];
    for (const raw of String(desc || '').split(/\r?\n/)) {
      const line = raw.trim(); if (!line || line.length > 200) continue;
      let m = LEAD_RE.exec(line), title, at;
      if (m) { at = toSeconds(m[1]); title = m[2]; }
      else if ((m = TRAIL_RE.exec(line))) { at = toSeconds(m[2]); title = m[1]; }
      else continue;
      if (!isFinite(at) || !title) continue;
      out.push({ start: at, title: title.replace(/\s+/g, ' ').slice(0, 120) });
    }
    // YouTube's own rule: at least three, in order, beginning at the very start.
    if (out.length < 3 || out[0].start > 10) return [];
    for (let i = 1; i < out.length; i++) if (out[i].start <= out[i - 1].start) return [];
    if (dur && out[out.length - 1].start >= dur) return [];
    return out;
  }

  /* Position decides what an off-topic section is. */
  function resolveRole(role, start, end, dur) {
    if (role !== 'offtopic') return role;
    if (!dur) return 'break';
    if (start <= Math.max(6, dur * 0.08)) return 'intro';
    if (end >= dur - 6 || start >= dur * 0.8) return 'outro';
    return 'break';
  }

  /* Hours-long mixes and albums use chapters for tracks. Skipping "Intro"
     there would skip a song, so long videos get much stricter rules. */
  const LONG_FORM = 900;
  const lengthOK = (role, len, dur) => {
    if (dur >= LONG_FORM) return role === 'intro' ? len <= 120 : role === 'outro' ? len <= 180 : len <= 240;
    const share = dur ? dur * 0.35 : 120;
    return role === 'intro' ? len <= Math.min(90, share) : role === 'outro' ? len <= Math.min(120, share) : len <= Math.min(150, share);
  };

  /* ── evidence → segments ────────────────────────────────────────────── */
  function fromChapters(chapters, dur, src = 'chapter') {
    const list = (Array.isArray(chapters) ? chapters : []).map(c => ({ start: +c.start || 0, title: String(c.title || '') }))
      .filter(c => isFinite(c.start)).sort((a, b) => a.start - b.start);
    const segs = [], long = dur >= LONG_FORM;
    list.forEach((c, i) => {
      const role0 = classifyTitle(c.title); if (!role0) return;
      const next = list[i + 1];
      let end = next ? next.start : (dur || c.start);
      if (end <= c.start) return;
      const role = resolveRole(role0, c.start, end, dur);
      // Credits run to the end even when later chapters carry odd titles.
      if (role === 'outro' && (!next || classifyTitle(next.title) === 'outro')) end = dur || end;
      const len = end - c.start;
      if (!lengthOK(role, len, dur)) return;
      if (role === 'intro' && c.start > Math.max(8, dur * 0.03)) return;
      if (role === 'outro' && dur && c.start < dur * 0.5) return;
      if (long && role === 'intro' && !/^\s*(intro(?:duction)?|cold open|prologue)\b/i.test(c.title)) return;
      let conf = role0 === 'offtopic' ? 0.78 : 0.92;
      if (long) conf -= 0.2;
      if (src === 'desc') conf -= 0.12;
      segs.push({ kind: role, start: round1(c.start), end: round1(end), src, conf: round1x(conf), label: c.title.slice(0, 60) });
    });
    return segs;
  }
  const round1x = v => Math.round(v * 100) / 100;

  const CROWD_ROLE = { intro: 'intro', outro: 'outro', music_offtopic: 'offtopic', preview: 'intro', sponsor: 'offtopic', selfpromo: 'offtopic', interaction: 'offtopic' };
  const CROWD_CATEGORIES = Object.keys(CROWD_ROLE);
  function fromCrowd(items, dur) {
    const segs = [];
    for (const it of Array.isArray(items) ? items : []) {
      if (!it || !Array.isArray(it.segment) || it.segment.length < 2) continue;
      if (it.actionType && it.actionType !== 'skip') continue;
      const role0 = CROWD_ROLE[it.category]; if (!role0) continue;
      const start = +it.segment[0], end = +it.segment[1];
      if (!isFinite(start) || !isFinite(end) || end - start < 1) continue;
      const votes = +it.votes || 0;
      if (votes < 0) continue;
      // A submission made for a different cut of the video has the wrong timestamps.
      if (dur && it.videoDuration && Math.abs(+it.videoDuration - dur) > 3) continue;
      const e = dur ? Math.min(end, dur) : end;
      const role = resolveRole(role0, start, e, dur);
      if (dur && e - start > dur * 0.6) continue;
      const conf = it.locked ? 0.95 : clamp(0.45 + 0.1 * Math.min(votes, 5), 0.45, 0.93);
      segs.push({ kind: role, start: round1(start), end: round1(e), src: 'crowd', conf: round1x(conf), label: it.category });
    }
    return segs;
  }

  /* silence = { dur, silences: [[start, end], ...] } from ffmpeg's silencedetect */
  function fromSilence(res, dur0) {
    const dur = dur0 || (res && res.dur) || 0, segs = [];
    if (!res || !Array.isArray(res.silences) || !dur || dur < 20) return segs;
    for (const [s, e] of res.silences) {
      const len = e - s;
      if (s <= 0.6 && len >= 1.8 && e < dur * 0.4) {
        segs.push({ kind: 'intro', start: 0, end: round1(e), to: round1(Math.max(0, e - 0.2)), src: 'silence', conf: len >= 2.6 ? 0.9 : 0.72, label: 'quiet lead-in' });
      } else if (e >= dur - 0.8 && len >= 4 && s >= dur * 0.5) {
        segs.push({ kind: 'outro', start: round1(s), end: round1(dur), src: 'silence', conf: len >= 6 ? 0.9 : 0.7, label: 'dead air' });
      } else if (s >= 8 && e <= dur - 3 && len >= 6) {
        segs.push({ kind: 'break', start: round1(s), end: round1(e), to: round1(Math.max(0, e - 0.2)), src: 'silence', conf: len >= 10 ? 0.82 : 0.7, label: 'long gap' });
      }
    }
    return segs;
  }

  /* ── merging evidence into a plan ───────────────────────────────────── */
  const noisyOr = list => 1 - list.reduce((p, c) => p * (1 - c * 0.92), 1);

  /* Candidates of one kind that point at (almost) the same place agree with
     each other. The best-supported cluster wins. */
  function bestCluster(cands, key) {
    if (!cands.length) return null;
    const clusters = [];
    for (const c of cands.slice().sort((a, b) => a[key] - b[key])) {
      const hit = clusters.find(k => Math.abs(k.at - c[key]) <= 4);
      if (hit) { hit.items.push(c); } else clusters.push({ at: c[key], items: [c] });
    }
    for (const k of clusters) {
      k.conf = clamp(noisyOr(k.items.map(i => i.conf)), 0, 0.99);
      k.lead = k.items.slice().sort((a, b) => b.conf - a.conf)[0];
    }
    clusters.sort((a, b) => b.conf - a.conf);
    return clusters[0];
  }

  function shape(kind, k, dur) {
    const lead = k.lead;
    const start = Math.min(...k.items.map(i => i.start));
    // Silence knows the exact moment the sound returns; prefer its end for intros.
    const sil = k.items.find(i => i.src === 'silence' && i.to != null);
    let end = lead.end, to = lead.to != null ? lead.to : lead.end;
    if (kind === 'intro' && sil) { end = sil.end; to = sil.to; }
    const toEnd = !!dur && end >= dur - 1.5;
    return {
      kind, start: round1(start), end: round1(end), to: round1(to), toEnd,
      conf: round1x(k.conf), why: [...new Set(k.items.map(i => i.src))], label: lead.label || '',
    };
  }

  function plan(segments, dur) {
    const by = { intro: [], outro: [], break: [] };
    for (const s of segments) if (by[s.kind]) by[s.kind].push(s);
    const out = { dur: dur || 0, intro: null, outro: null, breaks: [], count: segments.length };
    const i = bestCluster(by.intro.filter(s => !dur || s.end <= dur * 0.5), 'end');
    if (i) out.intro = shape('intro', i, dur);
    const o = bestCluster(by.outro.filter(s => !dur || s.start >= dur * 0.45), 'start');
    if (o) out.outro = shape('outro', o, dur);
    // Mid-song breaks: cluster each one separately so two real breaks both survive.
    const rest = by.break.slice().sort((a, b) => a.start - b.start), groups = [];
    for (const s of rest) { const g = groups.find(x => Math.abs(x.at - s.start) <= 4); g ? g.items.push(s) : groups.push({ at: s.start, items: [s] }); }
    for (const g of groups.slice(0, 6)) {
      g.conf = clamp(noisyOr(g.items.map(i => i.conf)), 0, 0.99);
      g.lead = g.items.slice().sort((a, b) => b.conf - a.conf)[0];
      out.breaks.push(shape('break', g, dur));
    }
    return out;
  }

  /* ── turning confidence into behaviour ──────────────────────────────── */
  const SURE = { careful: { auto: 0.85, button: 0.7 }, balanced: { auto: 0.7, button: 0.5 }, eager: { auto: 0.5, button: 0.35 } };
  const surenessOf = s => SURE[s] || SURE.balanced;

  /* mode: 'off' | 'button' | 'auto'. Returns 'auto' | 'button' | 'none'. */
  function actionFor(seg, mode, sure, remembered) {
    if (!seg || mode === 'off' || remembered === 'none') return 'none';
    const t = surenessOf(sure);
    if (seg.conf < t.button) return 'none';
    if (mode === 'auto' && seg.conf >= t.auto && remembered !== 'button') return 'auto';
    return 'button';
  }

  /* Everything the player should do right now for the given position. */
  function due(plan, pos, opts) {
    const o = opts || {};
    if (!plan) return null;
    const list = [];
    if (plan.intro) list.push([plan.intro, o.intro]);
    for (const b of plan.breaks) list.push([b, o.breaks]);
    if (plan.outro) list.push([plan.outro, o.outro]);
    for (const [seg, mode] of list) {
      const key = seg.kind + '@' + Math.round(seg.start);
      if (o.fired && o.fired[key]) continue;
      if (o.honored && o.honored[key]) continue;
      const lead = seg.kind === 'intro' && seg.start <= 1 ? 0.6 : 0.35;
      if (pos < seg.start - lead || pos >= seg.end - 0.3) continue;
      const act = actionFor(seg, mode, o.sure, o.remembered && o.remembered[seg.kind]);
      if (act !== 'none') return { seg, key, act };
    }
    return null;
  }

  /* ── SponsorBlock ───────────────────────────────────────────────────── */
  async function hashPrefix(id) {
    const subtle = (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);
    if (!subtle) throw new Error('no crypto');
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(id));
    return [...new Uint8Array(buf)].slice(0, 2).map(b => b.toString(16).padStart(2, '0')).join('');   // first 4 hex chars: the id itself never leaves the device
  }
  function crowdUrl(prefix) {
    return 'https://sponsor.ajay.app/api/skipSegments/' + prefix
      + '?service=YouTube&categories=' + encodeURIComponent(JSON.stringify(CROWD_CATEGORIES))
      + '&actionTypes=' + encodeURIComponent('["skip"]');
  }
  /* Pulls this video's segments out of the (hash-prefix) response. */
  function pickCrowd(json, id) {
    const hit = (Array.isArray(json) ? json : []).find(v => v && v.videoID === id);
    return hit && Array.isArray(hit.segments) ? hit.segments : [];
  }

  const api = {
    classifyTitle, parseTimestamps, resolveRole, fromChapters, fromCrowd, fromSilence,
    plan, actionFor, due, surenessOf, hashPrefix, crowdUrl, pickCrowd, CROWD_CATEGORIES, LONG_FORM,
  };
  root.WLSkip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
