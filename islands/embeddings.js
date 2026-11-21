'use strict';
// Meaning Map: words are points; guess which neighbourhood a new word lands in, then king − man + woman.
// ponytail: 2-D coordinates are hand-placed illustrations of real high-dimensional embeddings (labelled).
(globalThis.ISLANDS = globalThis.ISLANDS || {}).embeddings = {
  nearest(words, x, y, n = 2) { return [...words].sort((a, b) => Math.hypot(a[1] - x, a[2] - y) - Math.hypot(b[1] - x, b[2] - y)).slice(0, n); },
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive } = api;
    const ZONE_IC = ['🐾', '🍎', '🚗', '💛'];
    const board = h('div', { class: 'board', dir: 'ltr' });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none');
    const zones = t.zones.map((z, i) => h('button', { class: `zone z${i}`, disabled: true }, h('span', {}, ZONE_IC[i], ' ', z)));
    board.append(...zones, svg);
    const dot = (w, x, y, cls = '') => { const d = h('span', { class: 'dot ' + cls, style: `left:${x}%;top:${y}%` }, w); board.append(d); return d; };
    const words = t.words.map(w => [...w]); // local copy: rounds add to it
    words.forEach(([w, x, y]) => dot(w, x, y));
    const ask = h('div', { class: 'drop' });
    const panel = h('div', { class: 'panel' }, h('span', { class: 'tag' }, ui.illustrative), h('h2', {}, t.title), ask, board);
    stage.replaceChildren(panel);
    const lines = (x, y, near) => { svg.innerHTML = near.map(([, nx, ny]) => `<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" />`).join(''); };
    const pickZone = () => new Promise(res => zones.forEach((z, i) => { z.disabled = false; z.onclick = () => { zones.forEach(b => { b.disabled = true; }); sfx.pop(); res(i); }; }));
    const land = async (w, x, y) => {
      const d = dot(w, 50, 50, 'new');
      d.animate([{ left: '50%', top: '-10%', transform: 'translate(-50%,-50%) scale(2)' }, { left: x + '%', top: y + '%', transform: 'translate(-50%,-50%) scale(1)' }], { duration: api.reduced ? 1 : 900, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'forwards' });
      d.style.left = x + '%'; d.style.top = y + '%';
      await wait(900); sfx.thud(); lines(x, y, this.nearest(words, x, y)); return d;
    };

    let score = 0;
    for (const [w, x, y, zone] of t.rounds) {
      if (!alive()) return null;
      ask.replaceChildren(h('b', { class: 'word-chip' }, w));
      const z = await pickZone();
      const d = await land(w, x, y);
      if (z === zone) { score++; sfx.ding(); burst(d, 0, 30, 7); g.say(t.right, 'cheer'); } else { sfx.buzz(); g.say(t.wrong, 'curious'); }
      zones[zone].classList.add('flash'); setTimeout(() => zones[zone].classList.remove('flash'), 900);
      await wait(500); await g.next(ui.next);
      d.classList.remove('new'); words.push([w, x, y]);
    }
    if (!alive()) return null;
    // Twist: a word with two meanings sits between neighbourhoods.
    const [tw, tx, ty] = t.twistWord;
    ask.replaceChildren(h('span', {}, t.twist), ' ', h('b', { class: 'word-chip' }, tw));
    await pickZone(); await land(tw, tx, ty); svg.innerHTML = `<line x1="${tx}" y1="${ty}" x2="18" y2="20"/><line x1="${tx}" y1="${ty}" x2="16" y2="66"/>`;
    await g.say(t.twistWhy, 'point'); await g.next(ui.next);
    if (!alive()) return null;

    // Word arithmetic.
    const [pm, pw, pk, pq] = t.mathPts;
    const math = h('div', { class: 'math' });
    math.innerHTML = `<svg viewBox="0 0 220 130" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="#6d2a5e"/></marker></defs>
      <line x1="40" y1="105" x2="150" y2="105" class="v" marker-end="url(#ah)"/><line x1="60" y1="30" x2="170" y2="30" class="v q" marker-end="url(#ah)"/>
      <circle cx="40" cy="105" r="6"/><circle cx="160" cy="105" r="6"/><circle cx="60" cy="30" r="6"/><circle cx="180" cy="30" r="6" class="qd"/>
      <text x="40" y="125">${pm}</text><text x="160" y="125">${pw}</text><text x="60" y="18">${pk}</text><text x="180" y="18" class="qt">?</text></svg>`;
    const opts = h('div', { class: 'row center' });
    ask.replaceChildren(h('h3', {}, t.math), h('b', { class: 'word-chip', dir: 'auto' }, t.mathQ));
    board.replaceWith(h('div', {}, math, opts));
    const [i] = await api.choose(opts, t.mathOpts);
    math.querySelector('.qt').textContent = pq; math.querySelector('svg').classList.add('solved');
    if (i === 0) { score++; sfx.win(); burst(math, 0, 60, 10); await g.say(t.mathRight, 'cheer'); } else { sfx.buzz(); await g.say(t.mathWrong, 'curious'); }
    await g.next(ui.go);
    return score >= 5 ? 3 : score >= 3 ? 2 : 1;
  },
};
