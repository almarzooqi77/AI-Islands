'use strict';
// Backpack Bay: every message takes a slot; when the backpack is full the oldest falls out — including your name.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).context = {
  SMALL: 6, BIG: 14,
  async play(stage, api) {
    const { t, g, h, sfx, burst, wait, alive, choose } = api;
    const chat = h('div', { class: 'chat ctx-chat', 'aria-live': 'polite' });
    const slotsEl = h('div', { class: 'slots' }), count = h('span', { class: 'tag' });
    const controls = h('div', { class: 'row center', style: 'margin-top:14px' });
    stage.replaceChildren(h('div', { class: 'tales ctx' },
      h('div', { class: 'panel', style: 'width:100%' }, h('h2', {}, t.chat), chat, controls),
      h('aside', { class: 'backpack' }, h('h3', {}, '🎒 ', t.pack), count, slotsEl)));

    let score = 0;
    for (const size of [this.SMALL, this.BIG]) {
      if (!alive()) return null;
      chat.replaceChildren(); slotsEl.replaceChildren();
      slotsEl.style.setProperty('--n', size);
      const cards = [];
      const setCount = () => { count.textContent = `${cards.length} / ${size} ${t.slots}`; };
      setCount();
      const pack = async (text, who, isName) => {
        const card = h('div', { class: `pcard ${who}${isName ? ' name' : ''}` }, isName ? '⭐ ' : '', text);
        cards.push(card); slotsEl.append(card); sfx.tap(); setCount();
        if (cards.length > size) {
          const old = cards.shift();
          old.classList.add('falling'); sfx.whoosh();
          old.append(h('b', {}, ' ', t.fell));
          await wait(api.reduced ? 0 : 750); old.remove(); setCount();
        }
      };
      const say = (text, who) => { const m = h('div', { class: `msg ${who}` }, who === 'bot' ? h('span', { class: 'who' }, '🦜') : null, text); chat.append(m); m.scrollIntoView({ block: 'nearest' }); };
      const fast = size === this.BIG;
      for (const [i, [mine, reply]] of t.msgs.entries()) {
        if (!alive()) return null;
        if (!fast) await choose(controls, [`💬 ${t.send}: “${mine}”`], 'btn');
        controls.replaceChildren();
        say(mine, 'you'); await pack(mine, 'you', i === 0); await wait(fast ? 250 : 450);
        say(reply, 'bot'); await pack(reply, 'bot'); await wait(fast ? 250 : 300);
      }
      g.say(t.predict, 'curious');
      const [p] = await choose(controls, [t.yes, t.no]);
      controls.replaceChildren();
      say(t.ask, 'you'); await pack(t.ask, 'you'); await wait(700);
      const remembers = !!slotsEl.querySelector('.name');
      say(remembers ? t.remember : t.forgot, 'bot');
      if ((p === 0) === remembers) { score++; sfx.ding(); burst(chat.lastChild, 0, 30, 7); } else sfx.buzz();
      if (!remembers) {
        await g.say(t.whyForgot, 'point');
        await choose(controls, ['🎒 ' + t.bigger], 'btn leaf');
        controls.replaceChildren(); g.say(t.round2, 'cheer'); await wait(600);
      } else { await g.say(t.whyRemember, 'cheer'); await g.next(api.ui.go); }
    }
    return 1 + score;
  },
};
