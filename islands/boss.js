'use strict';
// AI Help Desk Castle: one villager ticket per concept; answer each with the concept card that explains it.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).boss = {
  // Pure: the right concept plus 3 others, order fixed per ticket so replays are fair.
  options(ids, right, seed) {
    const others = ids.filter(id => id !== right);
    const pick = [0, 1, 2].map(k => others[(seed * 3 + k * 4) % others.length]);
    const set = [...new Set([right, ...pick])].slice(0, 4);
    return set.sort((a, b) => ((a.charCodeAt(0) + seed) % 7) - ((b.charCodeAt(0) + seed) % 7));
  },
  async play(stage, api) {
    const { t, all, ui, g, h, sfx, burst, wait, alive, choose } = api;
    const every = [...all.islands, ...all.islands2]; // the castle closes Voyage 2 and tests both voyages
    const isl = Object.fromEntries(every.map(x => [x.id, x]));
    const ids = every.filter(x => x.id !== 'boss').map(x => x.id);
    const progress = h('div', { class: 'progress' }, t.tickets.map(() => h('i')));
    const card = h('div', { class: 'ticket' }), opts = h('div', { class: 'ingrs answers' });
    stage.replaceChildren(h('div', { class: 'panel' }, progress, card, h('h3', { style: 'margin:14px 0 8px' }, t.pick), opts));
    let score = 0;
    for (const [n, [text, right]] of t.tickets.entries()) {
      if (!alive()) return null;
      card.replaceChildren(h('span', { class: 'tag' }, `🎫 ${t.ticket} ${n + 1} ${t.of} ${t.tickets.length}`), h('p', {}, h('span', { class: 'who' }, ['🧔', '👩‍💼', '👵', '🧑‍🔧', '👨‍🏫'][n % 5]), ' “', text, '”'));
      card.animate([{ transform: 'translateY(-30px) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 450, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      const choices = this.options(ids, right, n);
      const [i, btn] = await choose(opts, choices.map(id => h('span', {}, h('span', { class: 'ic' }, isl[id].icon), h('b', {}, isl[id].concept))), 'ingr');
      const ok = choices[i] === right;
      progress.children[n].className = ok ? 'ok' : 'no';
      if (ok) { score++; sfx.ding(); burst(btn, 0, 30, 8); await g.say(t.right, 'cheer'); }
      else { sfx.buzz(); await g.say(`${t.wrong} ${isl[right].icon} ${isl[right].concept}`, 'curious'); }
      await wait(700);
    }
    await g.say(`🏆 ${score} / ${t.tickets.length} ${t.score}`, 'cheer'); await g.next(ui.go);
    const n = t.tickets.length;
    return score >= n - 1 ? 3 : score >= n * .6 ? 2 : 1;
  },
};
