'use strict';
// Isle of Tall Tales: a 100%-confident peacock answers; you stamp each answer against the Island Book.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).hallucination = {
  REFS: [0, 1, 2, 3, null], // which book fact settles each question (null = the book never mentions it)
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive } = api, P = t.play;
    const facts = t.book.facts.map(f => h('li', {}, f));
    const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
    stage.replaceChildren(h('div', { class: 'tales' },
      h('aside', { class: 'book' }, h('h3', {}, '📖 ', t.book.title), h('ol', {}, facts)),
      h('div', { class: 'panel', style: 'width:100%' }, h('h2', {}, P.title), h('p', { class: 'hint' }, P.hint), chat)));
    const scroll = el => el.scrollIntoView({ behavior: api.reduced ? 'auto' : 'smooth', block: 'nearest' });

    let score = 0;
    for (const [i, item] of P.qs.entries()) {
      if (!alive()) return null;
      facts.forEach(f => f.classList.remove('lit'));
      const you = h('div', { class: 'msg you' }, item.q); chat.append(you); scroll(you); sfx.tap();
      await wait(450);
      const dots = h('div', { class: 'msg bot' }, h('span', { class: 'who' }, '🦚'), h('span', { class: 'typing' }, h('span'), h('span'), h('span')));
      chat.append(dots); scroll(dots);
      await wait(900);
      const meter = h('i', { style: '--w:0%' });
      const stamps = h('div', { class: 'row', style: 'margin-top:10px' });
      const bot = h('div', { class: 'msg bot' }, h('span', { class: 'who' }, '🦚'), item.a,
        h('div', { class: 'meter' }, P.sure, meter, h('b', {}, '100%')), stamps);
      dots.replaceWith(bot); scroll(bot); sfx.sparkle();
      requestAnimationFrame(() => requestAnimationFrame(() => meter.style.setProperty('--w', '100%')));
      const saysTrue = await new Promise(res => stamps.append(
        h('button', { class: 'btn leaf', onclick: () => res(true) }, P.true),
        h('button', { class: 'btn coral', onclick: () => res(false) }, P.made)));
      stamps.remove();
      const right = saysTrue === item.ok;
      bot.append(h('span', { class: 'stamp ' + (item.ok ? 'ok' : 'no') }, item.ok ? P.true : P.made));
      sfx.thud();
      const ref = this.REFS[i];
      if (ref != null) { facts[ref].classList.add('lit'); }
      if (right) { score++; setTimeout(() => sfx.ding(), 150); burst(bot, 0, 30, 7); }
      else setTimeout(() => sfx.buzz(), 150);
      await g.say(`${right ? P.right : P.wrong}${ref == null ? ' ' + P.notInBook : ''}`, right ? 'cheer' : 'curious');
      await wait(500);
      if (i < P.qs.length - 1) await g.next(ui.next);
    }
    if (!alive()) return null;
    facts.forEach(f => f.classList.remove('lit'));
    chat.querySelectorAll('.meter').forEach((m, k) => setTimeout(() => { m.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)', background: '#ffe08a' }, { transform: 'scale(1)' }], { duration: 500 }); sfx.tap(); }, k * 180));
    await wait(1100);
    await g.say(P.aha, 'point'); await g.next(ui.go);
    return score === 5 ? 3 : score >= 3 ? 2 : 1;
  },
};
