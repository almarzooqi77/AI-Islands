'use strict';
// Echo Cove: try to spot AI fakes by eye and ear (a coin toss, which is the lesson), then pick the habit that works.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).deepfake = {
  // Pure: stars from the habit round only; spotting fakes is meant to be hard.
  stars: safe => Math.max(1, safe),
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    // Round 1: real or fake? No score shame: the reveal shows how hard it is.
    const card = h('div', { class: 'safe-req' }), controls = h('div', { class: 'row center' }), dots = h('div', { class: 'progress' }, t.items.map(() => h('i')));
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t.spotTitle), dots, card, controls));
    let spotted = 0;
    for (const [n, [icon, text, fake, truth]] of t.items.entries()) {
      if (!alive()) return null;
      card.replaceChildren(h('span', { class: 'who', 'aria-hidden': 'true' }, icon), h('p', {}, text));
      card.animate([{ filter: 'blur(6px)', opacity: 0 }, { filter: 'none', opacity: 1 }], { duration: 400 });
      const [i] = await choose(controls, ['👤 ' + t.isReal, '🎭 ' + t.isFake]);
      const right = (i === 1) === fake;
      if (right) spotted++;
      dots.children[n].className = right ? 'ok' : 'no';
      controls.replaceChildren();
      right ? sfx.ding() : sfx.boing();
      await g.say(`${fake ? t.truthFake : t.truthReal} ${truth}`, fake ? 'curious' : 'point');
      await g.next(ui.next);
    }
    if (!alive()) return null;
    await g.say(`${t.score} ${spotted} ${t.of} ${t.items.length}. ${t.aha}`, 'point');
    await g.next(ui.next);
    // Round 2: the habit. Verify the request through a channel you already trust.
    let safe = 0;
    const box = h('div', { class: 'safe-req' }), opts = h('div', { class: 'ingrs answers' });
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t.habitTitle), box, opts));
    for (const [text, options, rightIdx, why] of t.cases) {
      if (!alive()) return null;
      box.replaceChildren(h('p', {}, text));
      const [i, btn] = await choose(opts, options, 'btn ghost wide');
      if (i === rightIdx) { safe++; sfx.ding(); burst(btn, 0, 24, 6); await g.say(`✅ ${t.safe} ${why}`, 'cheer'); }
      else { sfx.buzz(); opts.children[rightIdx].classList.add('right'); await g.say(`⚠️ ${t.risky} ${why}`, 'curious'); }
      await g.next(ui.next);
    }
    await wait(100);
    return this.stars(safe);
  },
};
