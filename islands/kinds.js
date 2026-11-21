'use strict';
// Twin Isles: three quick jobs (sort, predict a number, create), then spot which kind of AI an everyday tool is.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).kinds = {
  // Pure: stars from mistakes in the spotting round.
  stars: mistakes => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1),
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    const box = h('div', { class: 'safe-req' }), opts = h('div', { class: 'row center' }), title = h('h2', {});
    stage.replaceChildren(h('div', { class: 'panel' }, title, box, opts));
    // Round 1: try each kind of job once.
    for (const [icon, name, text, options, right, say] of t.jobs) {
      if (!alive()) return null;
      title.textContent = name;
      box.replaceChildren(h('span', { class: 'who', 'aria-hidden': 'true' }, icon), h('p', { dir: 'auto' }, text));
      const [i, btn] = await choose(opts, options);
      if (i === right) { sfx.ding(); burst(btn, 0, 24, 6); } else { sfx.boing(); opts.children[right].classList.add('right'); }
      await g.say(say, i === right ? 'cheer' : 'point');
      await g.next(ui.next);
      opts.replaceChildren();
    }
    // Round 2: which kind is this everyday tool?
    title.textContent = t.sortTitle;
    const dots = h('div', { class: 'progress' }, t.items.map(() => h('i')));
    title.after(dots);
    let mistakes = 0;
    for (const [n, [icon, text, kind]] of t.items.entries()) {
      if (!alive()) return null;
      box.replaceChildren(h('span', { class: 'who', 'aria-hidden': 'true' }, icon), h('p', {}, text));
      const [i, btn] = await choose(opts, t.kinds);
      const ok = i === kind;
      if (!ok) { mistakes++; opts.children[kind].classList.add('right'); }
      dots.children[n].className = ok ? 'ok' : 'no';
      ok ? (sfx.ding(), burst(btn, 0, 20, 5)) : sfx.buzz();
      await g.say(`${ok ? t.right : t.wrong} ${t.names[kind]}`, ok ? 'cheer' : 'curious');
      await wait(900);
    }
    if (!alive()) return null;
    sfx.win();
    await g.say(t.done, 'cheer'); await g.next(ui.next);
    return this.stars(mistakes);
  },
};
