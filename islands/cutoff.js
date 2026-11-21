'use strict';
// Time Capsule Reef: Polly's library stops on a date. Sort what she can know from what is too new or too local,
// watch her answer anyway, then pick the fix (give her the fresh page).
(globalThis.ISLANDS = globalThis.ISLANDS || {}).cutoff = {
  stars: mistakes => mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1,
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, alive, choose } = api;
    const shelf = h('div', { class: 'shelf', 'aria-label': t.shelf }, h('span', { 'aria-hidden': 'true' }, '📚📚📚📚📚'), h('span', { class: 'tag' }, '🔒 ', t.stamp));
    const q = h('div', { class: 'safe-req' }), controls = h('div', { class: 'row center' }), out = h('div', { class: 'chat', 'aria-live': 'polite' });
    const dots = h('div', { class: 'progress' }, t.qs.map(() => h('i')));
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t.sortTitle), shelf, dots, q, controls, out));
    let mistakes = 0;
    for (const [n, [text, knows, answer]] of t.qs.entries()) {
      if (!alive()) return null;
      q.replaceChildren(h('span', { class: 'who', 'aria-hidden': 'true' }, '❓'), h('p', {}, text));
      out.replaceChildren();
      const [i] = await choose(controls, ['✅ ' + t.knows, '⏳ ' + t.tooNew]);
      const right = (i === 0) === knows;
      if (!right) mistakes++;
      dots.children[n].className = right ? 'ok' : 'no';
      controls.replaceChildren();
      out.append(h('div', { class: 'msg bot' + (knows ? '' : ' alarm') }, h('span', { class: 'who' }, '🦜'), knows ? answer : `${t.guessed} ${answer}`));
      right ? sfx.ding() : sfx.buzz();
      await g.say(right ? t.right : `${t.wrong} ${knows ? t.knows : t.tooNew}`, right ? 'cheer' : 'curious');
      await g.next(ui.next);
    }
    if (!alive()) return null;
    // The fix: fresh, internal facts have to be handed to her.
    const opts = h('div', { class: 'ingrs answers' });
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t.fixTitle), opts));
    const [i, btn] = await choose(opts, t.fixOpts, 'btn ghost wide');
    if (i === t.fixRight) { sfx.win(); burst(btn, 0, 30, 8); } else { sfx.buzz(); opts.children[t.fixRight].classList.add('right'); mistakes++; }
    await g.say(t.fixWhy, 'cheer');
    await g.next(ui.go);
    return this.stars(mistakes);
  },
};
