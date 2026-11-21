'use strict';
// AI Islands engine: state, sound, particles, guide, map, island runner, reveal, album.
// ponytail: one file, no framework. Islands live in islands/*.js and register on globalThis.ISLANDS.
const S = globalThis.STRINGS, ISL = globalThis.ISLANDS || {};
const app = document.getElementById('app');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(r => setTimeout(r, reduced ? Math.min(ms, 60) : ms));

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

/* ---------- state (localStorage with in-memory fallback) ---------- */
const KEY = 'ai-islands-v1';
let memory = null;
function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return memory || {}; } }
const state = Object.assign({ stars: {}, ch: 1, lang: (navigator.language || '').startsWith('ar') ? 'ar' : 'en', muted: false, last: null }, load());
function save() { memory = state; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: keep in memory */ } }
const T = () => S[state.lang];
const totalStars = () => Object.values(state.stars).reduce((a, b) => a + b, 0);
// Two voyages of about the same length: 1 = how AI works (8), 2 = using AI safely at work (6 + the castle, which
// tests all 14 ideas). Voyage 2 opens once Voyage 1 is done. Lookups use every island.
const voyage1Done = () => T().islands.every(x => state.stars[x.id]);
const voyage2Open = () => voyage1Done() || T().islands2.some(x => state.stars[x.id]); // stays open for players who began it before Twin Isles was added
const islandList = () => (state.ch === 2 && voyage2Open() ? T().islands2 : T().islands);
const allIslands = () => [...T().islands, ...T().islands2];
const voyage2Done = () => T().islands2.every(x => state.stars[x.id]);
const built = id => !!ISL[id];

/* ---------- server calls: best effort, the game never waits on them ---------- */
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
  .then(r => r.ok ? r.json() : null).catch(() => null);
// Anonymous learning stats: island + right/wrong or stars. No name, no time of day (server.py record_event).
const track = (island, kind, extra) => post('/api/event', { island, kind, ...extra });

/* ---------- sound: tiny WebAudio synth, no files ---------- */
let ac;
function audio() { if (!ac) { try { ac = new AudioContext(); } catch { return null; } } if (ac.state === 'suspended') ac.resume(); return ac; }
function tone(freq, dur = .12, type = 'sine', vol = .16, delay = 0, slide) {
  if (state.muted) return; const c = audio(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .05);
}
function noise(dur = .3, freq = 1200, vol = .12, delay = 0) {
  if (state.muted) return; const c = audio(); if (!c) return;
  const t = c.currentTime + delay, buf = c.createBuffer(1, c.sampleRate * dur, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(freq * 3, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
const sfx = {
  tap: () => tone(560, .05, 'triangle', .1),
  pop: () => { tone(640, .07, 'triangle', .14); tone(980, .07, 'sine', .08, .04); },
  type: () => tone(1100 + Math.random() * 300, .018, 'square', .015),
  ding: () => { tone(988, .25, 'sine', .14); tone(1480, .35, 'sine', .07, .06); },
  buzz: () => tone(190, .22, 'sawtooth', .07, 0, 120),
  boing: () => tone(220, .35, 'triangle', .16, 0, 660),
  thud: () => { tone(120, .22, 'sine', .32, 0, 50); noise(.08, 400, .1); },
  chop: () => { noise(.12, 2400, .14); tone(420, .1, 'square', .05, 0, 90); },
  whoosh: () => noise(.45, 300, .1),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, .3, 'triangle', .13, i * .08)),
  sparkle: () => [1568, 2093, 2637].forEach((f, i) => tone(f, .18, 'sine', .05, i * .05)),
};

/* ---------- particles ---------- */
const cv = document.getElementById('fx'), cx = cv.getContext('2d');
let parts = [], raf = 0;
const COLORS = ['#ffc63a', '#ff6f61', '#35b779', '#8a5cf6', '#22a6bd', '#ffffff'];
function sizeCanvas() { const d = devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener('resize', sizeCanvas); sizeCanvas();
function burst(x = innerWidth / 2, y = innerHeight / 2, n = 90, power = 11) {
  if (reduced) return;
  if (x && x.getBoundingClientRect) { const r = x.getBoundingClientRect(); y = r.top + r.height / 2; x = r.left + r.width / 2; }
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * power + 2;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4, r: Math.random() * 6 + 3, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: Math.random() * .3 - .15, life: 1, shape: i % 3 });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 40);
  for (const p of parts) {
    p.vy += .32; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= .011; // about 1.5 s: celebration over before the lesson appears
    cx.save(); cx.globalAlpha = Math.max(p.life, 0); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
    if (p.shape === 0) cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
    else if (p.shape === 1) { cx.beginPath(); cx.arc(0, 0, p.r / 1.4, 0, 7); cx.fill(); }
    else { cx.beginPath(); for (let k = 0; k < 5; k++) { cx.lineTo(Math.cos(k * 1.257) * p.r, Math.sin(k * 1.257) * p.r); cx.lineTo(Math.cos(k * 1.257 + .628) * p.r / 2.3, Math.sin(k * 1.257 + .628) * p.r / 2.3); } cx.fill(); }
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(tick) : 0;
}

/* ---------- Shurooq, the guide ---------- */
const POSES = { point: 'assets/noor-point.webp', curious: 'assets/noor-curious.webp', cheer: 'assets/noor-cheer.webp' };
function makeGuide(pose = 'point') {
  const img = h('img', { src: POSES[pose], alt: '' });
  const text = h('span', { class: 'say', 'aria-hidden': 'true' }), actions = h('div', { class: 'actions' });
  const said = h('span', { class: 'sr-only', role: 'status' }); // screen readers hear the whole line once, not the typewriter
  const bubble = h('div', { class: 'bubble' }, h('span', { class: 'name' }, state.lang === 'ar' ? 'شروق' : 'Shurooq'), text, said, actions);
  const el = h('div', { class: 'guide' }, bubble, img);
  let skip = null, token = 0;
  bubble.addEventListener('click', () => skip && skip());
  const g = {
    el,
    pose(p) { if (!POSES[p] || img.getAttribute('src') === POSES[p]) return; img.src = POSES[p]; img.classList.remove('swap'); void img.offsetWidth; img.classList.add('swap'); },
    async say(line, p) {
      const my = ++token; if (p) g.pose(p); actions.replaceChildren(); text.textContent = ''; said.textContent = line;
      const chars = Array.from(line); let done = reduced;
      skip = () => { done = true; };
      const caret = h('span', { class: 'caret' }, '▍');
      for (let i = 0; i < chars.length && !done; i++) {
        if (my !== token) return;
        text.textContent = chars.slice(0, i + 1).join(''); text.append(caret);
        if (i % 3 === 0) sfx.type();
        await new Promise(r => setTimeout(r, 24));
      }
      if (my === token) text.textContent = line; skip = null;
    },
    next(label = T().ui.next, cls = '') {
      return new Promise(res => {
        const b = h('button', { class: 'btn ' + cls, onclick: e => { e.stopPropagation(); sfx.pop(); actions.replaceChildren(); res(); } }, label);
        actions.replaceChildren(b); b.focus({ preventScroll: true });
      });
    },
    async lines(arr, last = T().ui.next, pose) {
      for (let i = 0; i < arr.length; i++) { await g.say(arr[i], pose); await g.next(i === arr.length - 1 ? last : T().ui.next); }
    },
  };
  return g;
}

/* ---------- shared chrome ---------- */
function toast(msg) { const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t); setTimeout(() => t.remove(), 2500); }
function topbar(...middle) {
  const ui = T().ui;
  return h('header', { class: 'topbar' },
    h('button', { class: 'brand', onclick: () => go('#map'), 'aria-label': ui.map }, h('b', {}, state.lang === 'ar' ? 'ذ.ا' : 'AI'), state.lang === 'ar' ? 'الجزر' : 'Islands'),
    ...middle, h('span', { class: 'spacer' }),
    h('span', { class: 'counter', id: 'star-count', title: ui.stars }, '⭐ ', totalStars()),
    h('span', { class: 'counter cards', title: ui.cards }, '🃏 ', allIslands().filter(x => x.id !== 'boss' && state.stars[x.id]).length, '/', allIslands().length - 1),
    h('button', { class: 'btn ghost icon-btn', onclick: () => go('#album'), title: ui.album, 'aria-label': ui.album }, '📖'),
    h('button', { class: 'btn ghost icon-btn', 'aria-pressed': String(!state.muted), title: ui.sound, 'aria-label': ui.sound, onclick: e => { state.muted = !state.muted; save(); e.currentTarget.textContent = state.muted ? '🔇' : '🔊'; e.currentTarget.setAttribute('aria-pressed', String(!state.muted)); sfx.pop(); } }, state.muted ? '🔇' : '🔊'),
    h('button', { class: 'btn ghost', lang: state.lang === 'ar' ? 'en' : 'ar', onclick: () => { state.lang = state.lang === 'ar' ? 'en' : 'ar'; save(); render(); } }, ui.lang),
  );
}
function applyLang() { const ar = state.lang === 'ar'; document.documentElement.lang = state.lang; document.documentElement.dir = ar ? 'rtl' : 'ltr'; document.title = T().ui.title; }

/* ---------- router ---------- */
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
addEventListener('hashchange', render);
function render() {
  applyLang(); document.querySelector('.overlay')?.remove();
  const [, name, id] = (location.hash || '#title').match(/^#(\w+)\/?(\w*)/) || [];
  window.scrollTo(0, 0);
  if (name === 'map') return mapScreen();
  if (name === 'island' && built(id)) return islandScreen(id);
  if (name === 'album') return albumScreen();
  if (name === 'stats') return statsScreen();
  return titleScreen();
}

/* ---------- title ---------- */
function titleScreen() {
  const ui = T().ui, g = makeGuide('point');
  const words = ui.title.split(' ');
  let i = 0;
  const logo = h('h1', { class: 'logo' }, words.map((w, wi) => h('span', { class: wi === 0 ? 'chip' : '', style: `--i:${i++}` }, w)));
  const started = totalStars() > 0;
  app.replaceChildren(h('section', { class: 'screen title' }, topbar(),
    h('div', { class: 'title-body' }, g.el,
      h('div', {}, logo, h('p', { class: 'tagline' }, ui.tagline),
        h('div', { class: 'title-actions' },
          h('button', { class: 'btn big coral', onclick: () => { sfx.whoosh(); go('#map'); } }, '⛵ ', started ? ui.cont : ui.start),
          h('button', { class: 'btn big ghost', onclick: () => go('#album') }, '📖 ', ui.album))))));
  (async () => { for (const line of ui.greet) { await g.say(line); await wait(900); } g.pose('cheer'); })();
}

/* ---------- map ---------- */
// Percent positions; RTL mirrors x. Portrait layout zig-zags downward.
const LAND = [[10, 26], [32, 34], [55, 22], [82, 30], [84, 68], [60, 76], [36, 64], [12, 74]];
const LAND2 = [[10, 28], [32, 36], [55, 24], [84, 32], [86, 70], [62, 78], [38, 68], [14, 74]];
// Phones: a zig-zag down the screen, with ~70 px kept free at the top and bottom so the first and last island (and the boat) never touch the edge.
const port = (n, H) => Array.from({ length: n }, (_, i) => [n > 3 && i === n - 1 ? 50 : (i % 2 ? 72 : 28) + (i % 4 === 1 ? 4 : 0), n > 3 ? (70 + (H - 140) * i / (n - 1)) / H * 100 : 16 + i * 32]);
function nextIsland() { return islandList().find(x => built(x.id) && !state.stars[x.id]); }
function playable(i) { const list = islandList(); return built(list[i].id) && (!!state.stars[list[i].id] || list.slice(0, i).every(x => !built(x.id) || state.stars[x.id])); } // won islands stay replayable when a new one is added before them
function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function mapScreen() {
  const ui = T().ui, list = islandList(), nxt = nextIsland();
  const portrait = innerWidth < 700;
  const map = h('div', { class: 'map' + (portrait ? ' portrait' : '') });
  const v2 = list === T().islands2;
  const hint = nxt ? `👉 ${nxt.name}` : v2 ? ui.allDone2 : voyage2Open() && !voyage2Done() ? ui.voyage2Open : ui.allDone;
  const tabs = voyage2Open() ? h('div', { class: 'voyages' }, [1, 2].map(n => h('button', { class: 'btn ghost voyage' + ((v2 ? 2 : 1) === n ? ' on' : ''), 'aria-pressed': String((v2 ? 2 : 1) === n),
    onclick: () => { state.ch = n; save(); sfx.whoosh(); mapScreen(); } }, n === 1 ? ui.voyage1 : ui.voyage2))) : null;
  const won = allIslands().filter(x => state.stars[x.id] && T().learn[x.id]).length;
  const reviewBtn = h('button', { class: 'btn ghost review-btn', disabled: won < 2, title: won < 2 ? ui.reviewNeed : ui.reviewHint, onclick: review }, '🧠 ', ui.review);
  app.replaceChildren(h('section', { class: 'screen map-screen' }, topbar(), h('div', { class: 'map-hint' }, tabs, h('p', {}, hint), totalStars() ? reviewBtn : null), h('div', { class: 'map-wrap' }, map)));
  for (let c = 0; c < 3; c++) map.append(h('div', { class: 'cloud', style: `top:${12 + c * 30}%;animation-duration:${50 + c * 17}s;animation-delay:${-c * 19}s;opacity:${.5 - c * .1}` }));
  const W = map.clientWidth, H = map.clientHeight, rtl = state.lang === 'ar';
  const land = v2 ? LAND2 : LAND;
  const pts = (portrait ? port(land.length, H) : land).map(([x, y]) => [((rtl ? 100 - x : x) / 100) * W, (y / 100) * H]);
  const firstSoon = list.findIndex(x => !built(x.id));
  const doneIdx = nxt ? list.indexOf(nxt) : firstSoon < 0 ? list.length - 1 : firstSoon;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<path class="trail" d="${smoothPath(pts)}"/>` + (doneIdx > 0 ? `<path class="trail-done" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" d="${smoothPath(pts.slice(0, doneIdx + 1))}"/>` : '');
  map.append(svg);
  svg.querySelector('.trail-done')?.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: reduced ? 1 : 1400, easing: 'ease-in-out', fill: 'forwards' });
  list.forEach((isl, i) => {
    const ok = playable(i), soon = !built(isl.id), isNext = nxt && nxt.id === isl.id, stars = state.stars[isl.id] || 0;
    const btn = h('button', {
      class: `isle${soon ? ' soon' : ''}${!ok && !soon ? ' locked' : ''}${isNext ? ' next' : ''}${isl.id === 'boss' ? ' boss' : ''}`,
      style: `left:${pts[i][0]}px;top:${pts[i][1]}px;--i:${i}`,
      'aria-label': `${isl.name} — ${isl.concept}${soon ? ' — ' + ui.soon : !ok ? ' — ' + ui.locked : stars ? ` — ${'★'.repeat(stars)} ${stars}/3` : ''}`,
      onclick: e => {
        if (soon) { sfx.buzz(); return toast(`${isl.icon} ${isl.name}: ${ui.soon}`); }
        if (!ok) { sfx.buzz(); return toast(ui.locked); }
        sfx.whoosh(); burst(e.currentTarget, 0, 30, 6);
        const r = e.currentTarget.getBoundingClientRect(), m = map.getBoundingClientRect();
        map.style.transformOrigin = `${r.left - m.left + r.width / 2}px ${r.top - m.top + r.height / 2}px`;
        map.animate([{ transform: 'scale(1)' }, { transform: 'scale(2.6)', opacity: 0 }], { duration: reduced ? 1 : 550, easing: 'ease-in', fill: 'forwards' });
        setTimeout(() => go('#island/' + isl.id), reduced ? 0 : 500);
      },
    },
      isNext ? h('span', { class: 'arrow', 'aria-hidden': 'true' }, '⬇️') : null,
      h('span', { class: 'land', 'aria-hidden': 'true' }, soon ? '❔' : isl.icon),
      h('span', { class: 'label' }, soon ? `${isl.name}` : isl.name),
      h('span', { class: 'mini-stars', 'aria-hidden': 'true' }, built(isl.id) ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''));
    map.append(btn);
  });
  // Boat: sails from the island just finished to the next one, along the trail.
  const target = nxt ? list.indexOf(nxt) : doneIdx;
  const boat = h('div', { class: 'boat', 'aria-hidden': 'true' }, h('span', {}, '⛵'));
  map.append(boat);
  const from = state.last ? list.findIndex(x => x.id === state.last) : -1;
  const offset = ([x, y]) => [x + (rtl ? 58 : -58), y + 4];
  if (from >= 0 && from < target && !reduced && CSS.supports('offset-path', 'path("M0,0")')) {
    boat.style.offsetPath = `path("${smoothPath(pts.slice(from, target + 1).map(offset))}")`;
    boat.style.offsetAnchor = '50% 50%';
    boat.animate([{ offsetDistance: '0%' }, { offsetDistance: '100%' }], { duration: 1800, delay: 600, easing: 'ease-in-out', fill: 'forwards' });
  } else { const [bx, by] = offset(pts[Math.max(target, 0)]); boat.style.transform = `translate(${bx}px, ${by}px) translate(-50%, -50%)`; }
  state.last = null; save();
}
addEventListener('resize', () => { if ((location.hash || '').startsWith('#map')) { clearTimeout(mapScreen.t); mapScreen.t = setTimeout(mapScreen, 200); } });

/* ---------- island runner ---------- */
// Every island uses assets/<id>-bg.webp except these three older names. Safe Harbour, Time Capsule Reef,
// Echo Cove and Mirror Lake are painted by tools/paint_backgrounds.py.
const BG = { llm: 'lagoon-bg', tokens: 'tokens-bg', hallucination: 'tales-bg' };
let runId = 0;
async function islandScreen(id) {
  const my = ++runId, t = T(), ui = t.ui, isl = allIslands().find(x => x.id === id);
  const g = makeGuide('point'), stage = h('div', { class: 'stage' });
  app.replaceChildren(h('section', { class: 'screen island', style: `--bg:url(assets/${BG[id] || id + '-bg'}.webp)` },
    topbar(h('span', { class: 'island-title' }, `${isl.icon} ${isl.name}`)),    h('div', { class: 'island-body' }, g.el, stage)));
  const alive = () => my === runId && document.body.contains(stage);
  // Keyboard players never lose their place: when the focused control disappears, focus the first live one (Shurooq's button first).
  new MutationObserver(() => {
    const a = document.activeElement;
    if (alive() && !document.querySelector('.overlay') && (!a || a === document.body || a.disabled || !document.body.contains(a)))
      app.querySelector('.island-body button:not([disabled]), .island-body input:not([disabled])')?.focus({ preventScroll: true });
  }).observe(stage, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  // choose(box, labels): shows buttons in box, resolves [index, button] on click.
  const choose = (box, labels, cls = 'btn ghost') => new Promise(res => box.replaceChildren(...labels.map((l, i) => h('button', { class: cls,
    onclick: e => { sfx.pop(); box.querySelectorAll('button').forEach(b => { if (b !== e.currentTarget) b.disabled = true; }); e.currentTarget.style.pointerEvents = 'none'; res([i, e.currentTarget]); } }, l))));
  const api = { t: t[id], all: t, ui, g, h, sfx, burst, wait, reduced, alive, choose, lang: state.lang };
  const star = () => stage.replaceChildren(h('div', { class: 'char', 'aria-hidden': 'true', style: 'font-size:4.5rem' }, isl.icon)); // the island's star waits on stage during the intro
  // Memory callback (spaced recall): the previous finished island's quick check comes back before this one starts.
  const list = allIslands(), prev = list.slice(0, list.findIndex(x => x.id === id)).reverse().find(x => state.stars[x.id] && t.learn[x.id]);
  if (prev) {
    g.say(`🧠 ${ui.memory} ${prev.icon} ${prev.name}`, 'curious');
    const box = h('div', { class: 'panel quiz-panel' });
    stage.replaceChildren(box);
    track(prev.id, 'memory', { ok: await quiz(box, t.learn[prev.id].check) });
    await g.next(ui.thanks);
    if (!alive()) return;
  }
  star();
  await g.lines(t[id].intro, ui.go, 'point');
  if (!alive()) return;
  g.pose('curious');
  const stars = await ISL[id].play(stage, api);
  if (!alive() || stars == null) return;
  const opened = !voyage1Done();
  state.stars[id] = Math.max(state.stars[id] || 0, stars); state.last = id;
  if (opened && voyage1Done()) state.ch = 2; // finishing Voyage 1 opens Voyage 2: the map shows it next
  save(); sync();
  track(id, 'play', { stars });
  const sc = document.getElementById('star-count'); if (sc) { sc.textContent = '⭐ ' + totalStars(); sc.classList.add('bump'); }
  reveal(id, stars);
}

/* ---------- one tap-only check: resolves true when right; a wrong pick explains, never blocks ---------- */
function quiz(box, chk) {
  const ui = T().ui, opts = Math.random() < .5 ? [chk.right, chk.wrong] : [chk.wrong, chk.right];
  const row = h('div', { class: 'quiz-opts' }), fb = h('p', { class: 'quiz-fb', 'aria-live': 'polite' });
  box.replaceChildren(h('p', { class: 'quiz-q' }, chk.q), row, fb);
  return new Promise(res => { row.append(...opts.map(o => h('button', { class: 'btn ghost quiz-opt', onclick: e => {
    const ok = o === chk.right;
    row.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.textContent === chk.right) b.classList.add('right'); });
    if (!ok) e.currentTarget.classList.add('wrong');
    if (ok) { sfx.ding(); burst(e.currentTarget, 0, 30, 7); } else sfx.buzz();
    fb.textContent = `${ok ? ui.correct : ui.notQuite} ${chk.why}`;
    res(ok);
  } }, o))); row.firstChild.focus({ preventScroll: true }); });
}
const clicked = btn => new Promise(r => { btn.onclick = () => { sfx.pop(); r(); }; });

/* ---------- quick review: three checks from cards already won (spaced repetition, no new content) ---------- */
async function review() {
  const t = T(), ui = t.ui;
  const pool = allIslands().filter(x => state.stars[x.id] && t.learn[x.id]).sort(() => Math.random() - .5).slice(0, 3);
  if (pool.length < 2) return toast(ui.reviewNeed);
  document.querySelector('.overlay')?.remove();
  const body = h('div', { class: 'quiz-panel' }), head = h('h3', { class: 'lesson-title' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': ui.review },
    h('div', { class: 'reveal' }, h('div', { class: 'panel review-panel' }, h('div', { class: 'kicker' }, '🧠 ', ui.review), head, body)));
  const close = () => { overlay.remove(); render(); };
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.body.append(overlay);
  let right = 0;
  for (const [n, isl] of pool.entries()) {
    if (!document.body.contains(overlay)) return;
    head.textContent = `${n + 1} / ${pool.length} · ${isl.icon} ${isl.concept}`;
    const ok = await quiz(body, t.learn[isl.id].check);
    right += ok; track(isl.id, 'review', { ok });
    const nxt = h('button', { class: 'btn big' }, n < pool.length - 1 ? ui.next : ui.gotIt);
    body.append(h('div', { class: 'row center' }, nxt)); nxt.focus({ preventScroll: true });
    await clicked(nxt);
  }
  if (!document.body.contains(overlay)) return;
  head.textContent = `⭐ ${right} / ${pool.length} ${ui.reviewDone} ${right === pool.length ? ui.reviewGood : ui.reviewMore}`;
  if (right === pool.length) { sfx.win(); burst(innerWidth / 2, innerHeight * .3, 60, 10); }
  const again = h('button', { class: 'btn coral', onclick: review }, '↻ ', ui.reviewAgain);
  body.replaceChildren(h('div', { class: 'actions' }, again, h('button', { class: 'btn ghost', onclick: close }, ui.back)));
  again.focus();
}

/* ---------- reveal + card ---------- */
function cardEl(id, flipped = false) {
  const t = T(), r = t[id].reveal, ui = t.ui;
  const card = h('div', { class: 'card' + (flipped ? ' flipped' : '') },
    h('div', { class: 'card-inner' },
      h('div', { class: 'card-face' },
        h('div', { class: 'card-top' }, h('span', { class: 'ic' }, r.icon), h('h3', {}, r.term)),
        h('div', { class: 'card-body' },
          h('h4', {}, ui.what), h('p', {}, r.what),
          h('h4', {}, ui.like), h('p', {}, r.like),
          h('h4', {}, ui.tip), h('p', {}, r.tip),
          h('h4', {}, ui.links), h('div', { class: 'chips' }, r.links.map(l => h('span', {}, l))))),
      h('div', { class: 'card-back' }, '✨')));
  // Holographic tilt follows the pointer.
  card.addEventListener('pointermove', e => {
    const b = card.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    card.style.setProperty('--mx', `${x * 100}%`); card.style.setProperty('--my', `${y * 100}%`);
    if (!reduced) { card.style.setProperty('--rx', `${(x - .5) * 18}deg`); card.style.setProperty('--ry', `${(.5 - y) * 14}deg`); }
  });
  card.addEventListener('pointerleave', () => { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); });
  return card;
}
function reveal(id, stars, fromAlbum = false) {
  const t = T(), ui = t.ui, r = t[id].reveal;
  let i = 0;
  // Word by word (never letter by letter), so Arabic stays joined and lines wrap between words.
  const term = h('div', { class: 'term' }, r.term.split(' ').map(w => h('span', { style: `--i:${i++ * 3}` }, w + ' ')));
  const card = cardEl(id), realBox = h('div', { class: 'real-box', hidden: true });
  const askBtn = h('button', { class: 'btn violet', hidden: !realAi, onclick: () => askReal(r.real, realBox, askBtn) }, '🤖 ', ui.askReal);
  const close = () => { overlay.remove(); if (!fromAlbum) go('#map'); };
  const collect = h('button', { class: 'btn coral big', onclick: close, 'aria-label': fromAlbum ? ui.back : null }, fromAlbum ? '✕' : ui.collect);
  const actions = h('div', { class: 'actions' }, collect,
    fromAlbum ? null : h('button', { class: 'btn ghost', onclick: () => { overlay.remove(); islandScreen(id); } }, '↻ ', ui.replay),
    t.islands.some(x => x.id === id) && voyage1Done() ? h('button', { class: 'btn leaf', onclick: () => certificate(1) }, '🎓 ', ui.certificate) : null,
    t.islands2.some(x => x.id === id) && voyage2Done() ? h('button', { class: 'btn leaf', onclick: () => certificate(2) }, '🛡️ ', ui.cert2Title) : null,
    askBtn);
  const lesson = h('div', { class: 'lesson', 'aria-live': 'polite' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': r.term },
    h('div', { class: 'rays' }),
    h('div', { class: 'reveal' },
      fromAlbum ? null : h('div', { class: 'kicker' }, ui.discovered),
      term,
      fromAlbum ? null : h('div', { class: 'stars', 'aria-label': `${stars}/3` }, [0, 1, 2].map(k => h('span', { class: k < stars ? 'on' : '', style: `--i:${k}` }, '★'))),
      lesson, card, actions, realBox));
  overlay.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  document.body.append(overlay);
  if (fromAlbum) { lesson.remove(); card.classList.add('flipped'); return collect.focus(); }
  card.hidden = true; actions.hidden = true;
  sfx.win(); setTimeout(() => burst(innerWidth / 2, innerHeight * .3, 80, 12), 300);
  for (let k = 0; k < stars; k++) setTimeout(() => { sfx.sparkle(); }, 1250 + k * 250);
  // The learning beats: what just happened (your move → inside the AI → why it matters), one quick check, then the card.
  (async () => {
    const learn = T().learn[id];
    await wait(1500);
    if (!document.body.contains(overlay)) return;
    const got = h('button', { class: 'btn big' }, ui.gotIt, state.lang === 'ar' ? ' ←' : ' →');
    lesson.replaceChildren(h('h3', { class: 'lesson-title' }, '💡 ', ui.happened),
      h('ol', { class: 'strip' }, learn.strip.map(([ic, txt], k) => h('li', { class: 'beat', style: `--i:${k}` }, h('span', { class: 'beat-ic', 'aria-hidden': 'true' }, ic), h('p', {}, txt)))),
      h('div', { class: 'row center' }, got));
    learn.strip.forEach((_, k) => setTimeout(() => sfx.pop(), reduced ? 0 : 250 + k * 450));
    got.focus({ preventScroll: true });
    await clicked(got);
    const qbox = h('div', { class: 'quiz-panel' }), show = h('button', { class: 'btn big coral' }, '🃏 ', ui.showCard);
    lesson.replaceChildren(h('h3', { class: 'lesson-title' }, '⚡ ', ui.quick), qbox);
    track(id, 'check', { ok: await quiz(qbox, learn.check) });
    lesson.append(h('div', { class: 'row center' }, show)); show.focus({ preventScroll: true });
    await clicked(show);
    lesson.remove(); card.hidden = false; actions.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { card.classList.add('flipped'); sfx.whoosh(); }));
    collect.focus({ preventScroll: true });
  })();
}
async function askReal(prompt, box, btn) {
  const ui = T().ui;
  btn.disabled = true; box.hidden = false;
  box.replaceChildren(h('div', { class: 'lbl' }, ui.realLabel), h('q', {}, ui.realPrompt, ' ', prompt), h('p', {}, h('span', { class: 'typing' }, h('span'), h('span'), h('span')), ' ', ui.realThinking));
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 120000);
  try {
    const res = await fetch('/api/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: ctl.signal });
    const data = await res.json();
    if (!res.ok || !data.answer) throw new Error(data.error || 'no answer');
    box.replaceChildren(h('div', { class: 'lbl' }, `${ui.realLabel} · ${data.model || ''}`), h('q', {}, ui.realPrompt, ' ', prompt), h('p', {}, data.answer.trim()));
    sfx.ding();
  } catch {
    box.replaceChildren(h('p', {}, ui.realDown)); btn.hidden = true;
  } finally { clearTimeout(timer); }
}

/* ---------- certificate (printable; the name stays in this browser) ---------- */
function certificate(ch = 1) {
  const ui = T().ui, list = (ch === 2 ? T().islands2 : T().islands).filter(x => x.id !== 'boss');
  document.querySelector('.overlay')?.remove();
  if (!state.name) state.name = (state.lang === 'ar' ? me.nameAr : me.nameEn) || me.nameEn || me.nameAr || ''; // the portal name, still editable
  const nameEl = h('div', { class: 'cert-name' }, state.name || '…');
  const input = h('input', { class: 'cert-input', maxlength: '60', value: state.name || '', placeholder: ui.yourName, 'aria-label': ui.yourName,
    oninput: e => { state.name = e.target.value.trim(); nameEl.textContent = state.name || '…'; save(); } });
  const date = new Date().toLocaleDateString(state.lang === 'ar' ? 'ar-AE' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': ui.certificate },
    h('div', { class: 'reveal' },
      h('div', { class: 'cert' },
        h('div', { class: 'cert-seal', 'aria-hidden': 'true' }, ch === 2 ? '🛡️' : '🏝️'),
        h('div', { class: 'cert-kicker' }, ch === 2 ? ui.cert2Title : ui.certTitle),
        h('div', { class: 'cert-for' }, ui.certFor), nameEl,
        h('p', { class: 'cert-text' }, ch === 2 ? ui.cert2Text : ui.certText),
        h('div', { class: 'cert-icons' }, list.map(x => h('span', { title: x.concept }, x.icon))),
        h('div', { class: 'cert-foot' }, h('span', {}, '⭐ ', totalStars()), h('span', {}, date), h('span', {}, state.lang === 'ar' ? '— شروق' : '— Shurooq'))),
      input,
      h('div', { class: 'actions' },
        h('button', { class: 'btn leaf', onclick: () => print() }, '🖨️ ', ui.print),
        h('button', { class: 'btn coral', onclick: () => overlay.remove(), 'aria-label': ui.back }, '✕'))));
  document.body.append(overlay); input.focus(); sfx.win(); burst(innerWidth / 2, innerHeight * .25, 160, 15);
}

/* ---------- album ---------- */
function albumScreen() {
  const t = T(), ui = t.ui, have = allIslands().filter(x => x.id !== 'boss');
  const n = have.filter(x => state.stars[x.id]).length;
  const grid = h('div', { class: 'album-grid' }, have.map(isl => state.stars[isl.id]
    ? (() => { const c = cardEl(isl.id, true); c.addEventListener('click', () => { sfx.pop(); reveal(isl.id, state.stars[isl.id], true); }); c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-label', T()[isl.id].reveal.term);
        c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.click(); } }); return c; })()
    : h('div', { class: 'slot' }, h('div', {}, h('div', { class: 'ic' }, isl.icon), isl.name, h('br'), h('small', {}, built(isl.id) ? '❔' : ui.soon)))));
  app.replaceChildren(h('section', { class: 'screen album-screen' }, topbar(),
    h('h1', { class: 'page-title' }, ui.albumTitle),
    h('p', { class: 'page-sub' }, n ? `${n} / ${have.length} ${ui.cards} · ⭐ ${totalStars()}` : ui.albumEmpty),
    grid,
    n ? h('p', { class: 'row center' }, voyage1Done() ? h('button', { class: 'btn leaf', onclick: () => certificate(1) }, '🎓 ', ui.certificate) : null,
      voyage2Done() ? h('button', { class: 'btn leaf', onclick: () => certificate(2) }, '🛡️ ', ui.cert2Title) : null, h('button', { class: 'btn ghost', onclick: () => { if (confirm(ui.resetAsk)) { state.stars = {}; save(); sync(true); render(); } } }, ui.reset)) : null,
    canStats ? h('p', { class: 'row center' }, h('button', { class: 'btn ghost', onclick: () => go('#stats') }, '📊 ', ui.statsTitle)) : null));
}

/* ---------- learning stats (STATS_USERS only): where people still get confused ---------- */
async function statsScreen() {
  const t = T(), ui = t.ui, body = h('div', { class: 'panel stats' }, h('p', {}, '…'));
  app.replaceChildren(h('section', { class: 'screen album-screen' }, topbar(), h('h1', { class: 'page-title' }, '📊 ', ui.statsTitle), h('p', { class: 'page-sub' }, ui.statsSub), body));
  const res = await fetch('/api/stats').catch(() => null), s = res && res.ok ? await res.json() : null;
  if (!s) return body.replaceChildren(h('p', {}, ui.statsNone));
  const pct = ([ok, n]) => n ? Math.round(ok * 100 / n) : null;
  const cell = ([ok, n]) => { const p = pct([ok, n]); return h('td', { class: p == null ? 'muted' : p < 60 ? 'low' : p >= 85 ? 'high' : '' }, p == null ? '–' : `${p}% `, n ? h('small', {}, `(${n})`) : null); };
  body.replaceChildren(h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [ui.statsIsland, ui.statsPlays, ui.statsStars, ui.quick, ui.statsMemory, ui.statsReview].map(x => h('th', { scope: 'col' }, x)))),
    h('tbody', {}, allIslands().map(isl => { const r = s[isl.id]; if (!r) return null; return h('tr', {},
      h('th', { scope: 'row' }, `${isl.icon} ${isl.concept}`), h('td', {}, r.plays), h('td', {}, r.plays ? (r.stars / r.plays).toFixed(1) : '–'),
      cell(r.check), cell(r.memory), cell(r.review)); })))),
  h('p', { class: 'stats-key' }, ui.statsKey));
}

// The server says whether the optional real-AI button may show, and whether this person may see #stats.
let realAi = false, canStats = false, me = {};
const getJson = url => fetch(url).then(r => r.ok ? r.json() : {}).catch(() => ({}));
getJson('/api/config').then(c => { realAi = !!c.realAi; canStats = !!c.stats; if (canStats && location.hash === '#album') render(); });

/* ---------- progress follows the person: the server keeps the best stars per island, this browser keeps a copy ---------- */
function mergeStars(s = {}) {
  let changed = false;
  for (const [k, v] of Object.entries(s)) if ((state.stars[k] || 0) < v) { state.stars[k] = v; changed = true; }
  if (changed) save();
  return changed;
}
const sync = (reset = false) => post('/api/progress', { stars: state.stars, reset }).then(r => r && mergeStars(r.stars));
getJson('/api/me').then(m => {
  me = m;
  const gained = mergeStars(m.stars), mine = Object.entries(state.stars).some(([k, v]) => (m.stars || {})[k] !== v);
  if (mine) sync(); // stars won on this device before progress was saved on the server
  if (gained && !document.querySelector('.island, .overlay')) render();
});

render();
