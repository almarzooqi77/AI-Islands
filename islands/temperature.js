'use strict';
// Dial Volcano: reuse Polly's word bars from Word Lagoon; temperature reshapes them, Generate samples a sentence.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).temperature = {
  // Pure: probabilities (percent) reshaped by temperature T. T≈0 → all weight on the top word.
  reshape(ps, T) {
    if (T < 0.05) { const m = Math.max(...ps); return ps.map(p => (p === m ? 100 : 0)); }
    const w = ps.map(p => Math.pow(p, 1 / T)), s = w.reduce((a, b) => a + b, 0);
    return w.map(x => (x / s) * 100);
  },
  sample(ps, rnd = Math.random()) { let acc = 0; for (let i = 0; i < ps.length; i++) { acc += ps[i]; if (rnd * 100 < acc) return i; } return ps.length - 1; },
  async play(stage, api) {
    const { t, all, g, h, sfx, burst, alive } = api, steps = all.llm.build.steps;
    let T = 0.7, presses = 0;
    const volcano = h('div', { class: 'char volcano', 'aria-hidden': 'true' }, '🌋');
    const val = h('output', { class: 'dial-val' }), mood = h('span', { class: 'hint', style: 'margin:0' });
    const dial = h('input', { type: 'range', min: '0', max: '2', step: '0.1', value: String(T), class: 'dial', 'aria-label': t.dial });
    const bars = h('div', { class: 'bars locked' });
    const outs = h('ol', { class: 'outs' });
    const checks = t.challenges.map(c => h('li', {}, h('span', { class: 'box' }, '⬜'), c));
    const gen = h('button', { class: 'btn coral big' }, '🎲 ', t.gen);
    stage.replaceChildren(h('div', { class: 'panel' },
      h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, '🌡️ ', t.dial, ' ', val), volcano),
      dial, mood,
      h('p', { class: 'sentence', style: 'font-size:1.2rem;margin:12px 0 6px' }, steps[0].prefix, ' …'), bars,
      h('div', { class: 'row center', style: 'margin:16px 0' }, gen),
      h('h3', {}, t.history), outs,
      h('ul', { class: 'checks' }, checks)));

    const draw = () => {
      val.textContent = T.toFixed(1);
      mood.textContent = T < 0.4 ? '❄️ ' + t.low : T > 1.3 ? '🔥 ' + t.high : '⚖️ ' + t.mid;
      const ps = this.reshape(steps[0].options.map(o => o[1]), T);
      bars.replaceChildren(...steps[0].options.map(([w], i) => h('div', { class: 'bar' + (i === 0 ? ' top' : ''), style: `--w:${ps[i].toFixed(1)}%` }, h('span', {}, w), h('span', { class: 'pct' }, Math.round(ps[i]) + '%'))));
      volcano.style.transform = `scale(${0.8 + T * 0.35})`;
      volcano.style.filter = `drop-shadow(0 0 ${T * 18}px rgba(255,90,40,${T / 2}))`;
      dial.style.setProperty('--p', `${(T / 2) * 100}%`);
    };
    dial.addEventListener('input', () => { T = +dial.value; draw(); if (Math.round(T * 10) % 3 === 0) sfx.tap(); });
    draw();

    const done = [false, false, false], history = [];
    let balancedSeen = new Set();
    const tick = i => { if (done[i]) return; done[i] = true; checks[i].classList.add('ok'); checks[i].querySelector('.box').textContent = '✅'; sfx.win(); burst(checks[i], 0, 40, 8); g.say(t.done, 'cheer'); };
    while (done.includes(false)) {
      await new Promise(r => { gen.onclick = r; });
      if (!alive()) return null;
      presses++;
      const picks = steps.map(s => { const ps = this.reshape(s.options.map(o => o[1]), T); return s.options[this.sample(ps)]; });
      const sentence = steps.map((s, i) => `${s.prefix} ${picks[i][0]}`).join(' ') + all.llm.build.end;
      const rare = picks.some(p => p[1] <= 5);
      history.unshift(sentence); history.length = Math.min(history.length, 4);
      outs.replaceChildren(...history.map((s, i) => h('li', { class: i === 0 ? 'new' : '' }, s)));
      sfx.pop(); if (T > 1.3) volcano.animate([{ translate: '0 0' }, { translate: '-4px 2px' }, { translate: '4px -2px' }, { translate: '0 0' }], { duration: 300 });
      if (history.length >= 3 && history[0] === history[1] && history[1] === history[2]) tick(0);
      if (rare) tick(1);
      if (T >= 0.6 && T <= 1.2) { balancedSeen.add(sentence); if (balancedSeen.size >= 2) tick(2); } else balancedSeen = new Set();
    }
    await g.say(t.all, 'point'); await g.next(api.ui.go);
    return presses <= 12 ? 3 : presses <= 20 ? 2 : 1;
  },
};
