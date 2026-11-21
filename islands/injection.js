'use strict';
// Sneaky Note Rock: Bolt summarises documents; some hide instructions aimed at Bolt. Spot them, find the line, quarantine it.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).injection = {
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    let score = 0;
    for (const doc of t.docs) {
      if (!alive()) return null;
      const lines = doc.lines.map((l, i) => h('button', { class: 'line' + (doc.hidden && i === doc.sneak ? ' sneak' : ''), disabled: true }, l));
      const paper = h('div', { class: 'paper' }, h('h3', {}, doc.title), lines);
      const lens = h('button', { class: 'btn ghost', 'aria-pressed': 'false', onclick: e => { const on = paper.classList.toggle('lens'); e.currentTarget.setAttribute('aria-pressed', String(on)); sfx.pop(); } }, t.lens);
      const out = h('div', { class: 'chat', 'aria-live': 'polite' }), controls = h('div', { class: 'row center', style: 'margin-top:12px' });
      const jail = h('div', { class: 'jail', 'aria-hidden': 'true' }, '🧯');
      stage.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'tag' }, `${t.docs.indexOf(doc) + 1} / ${t.docs.length}`), lens), paper, out, controls, jail));
      await choose(controls, ['🤖 ' + t.summarise], 'btn violet');
      const m = h('div', { class: 'msg bot' + (doc.sneak != null ? ' alarm' : '') }, h('span', { class: 'who' }, '🤖'), doc.summary);
      out.append(m); doc.sneak != null ? sfx.buzz() : sfx.ding();
      await wait(600);
      g.say(t.q, 'curious');
      const [i] = await choose(controls, ['🕵️ ' + t.yes, '✅ ' + t.no]);
      const sneaky = doc.sneak != null, saidSneaky = i === 0;
      if (saidSneaky === sneaky) score++;
      if (!sneaky) {
        controls.replaceChildren(); saidSneaky ? sfx.buzz() : sfx.ding();
        await g.say(saidSneaky ? t.wrongSneaky : t.rightSafe, saidSneaky ? 'curious' : 'cheer');
      } else {
        if (!saidSneaky) { sfx.buzz(); await g.say(t.wrongSafe, 'curious'); }
        controls.replaceChildren(); g.say(t.find, 'point');
        // Find the line (the magnifier reveals hidden text). Wrong taps just wiggle.
        await new Promise(res => lines.forEach((b, k) => { b.disabled = false; b.onclick = () => {
          if (k !== doc.sneak) { sfx.tap(); b.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 300 }); return; }
          res();
        }; }));
        lines.forEach(b => { b.disabled = true; });
        const s = lines[doc.sneak]; s.classList.add('caught'); sfx.chop(); burst(s, 0, 30, 7);
        const a = s.getBoundingClientRect(), b = jail.getBoundingClientRect();
        s.animate([{ transform: 'none', opacity: 1 }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(.2) rotate(20deg)`, opacity: 0 }], { duration: api.reduced ? 1 : 800, easing: 'ease-in', fill: 'forwards' });
        await wait(800); jail.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)' }, { transform: 'scale(1)' }], { duration: 400 }); sfx.thud();
        await g.say(t.caught, 'cheer');
      }
      await g.next(ui.next);
    }
    return Math.max(1, score);
  },
};
