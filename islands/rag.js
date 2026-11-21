'use strict';
// Open-Book Reef: Polly guesses without the handbook; then you retrieve the right page and she answers from it.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).rag = {
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    const chat = h('div', { class: 'chat', 'aria-live': 'polite' });
    const controls = h('div', { class: 'row center', style: 'margin-top:12px' });
    const panel = h('div', { class: 'panel' }, h('h2', {}, '🦜 ', t.ask), chat, controls);
    stage.replaceChildren(panel);
    const say = (who, ...kids) => { const m = h('div', { class: `msg ${who}` }, who === 'bot' ? h('span', { class: 'who' }, '🦜') : null, ...kids); chat.append(m); m.scrollIntoView({ block: 'nearest' }); return m; };

    // 1. No book: confident guess.
    say('you', t.q0); await wait(700);
    const meter = h('i', { style: '--w:0%' });
    const bad = say('bot', t.h0, h('div', { class: 'meter' }, t.sure, meter, h('b', {}, '100%')));
    requestAnimationFrame(() => requestAnimationFrame(() => meter.style.setProperty('--w', '100%')));
    await wait(1100); bad.append(h('span', { class: 'stamp no' }, '✗')); sfx.thud();
    await g.say(t.oops, 'point');
    await choose(controls, ['📖 ' + t.open], 'btn leaf'); controls.replaceChildren();
    if (!alive()) return null;

    // 2. Retrieval: pick the page that answers each question.
    const shelf = h('div', { class: 'shelf' });
    const pages = t.pages.map(([title, text], i) => h('button', { class: 'page', disabled: true, style: `--i:${i}` }, h('b', {}, title), h('span', {}, text)));
    shelf.append(...pages);
    stage.append(h('div', { class: 'panel' }, h('h2', {}, '📖 ', t.shelf), shelf));
    chat.replaceChildren();
    let score = 0;
    for (const [q, right, answer] of t.qs) {
      if (!alive()) return null;
      say('you', q); g.say(t.fetch, 'curious');
      for (let tries = 0; ; tries++) {
        const i = await new Promise(res => pages.forEach((p, k) => { p.disabled = false; p.onclick = () => res(k); }));
        pages.forEach(p => { p.disabled = true; });
        const pg = pages[i]; sfx.whoosh();
        // The fetched page flies into the chat as context.
        const r = pg.getBoundingClientRect(), c = chat.getBoundingClientRect();
        pg.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${c.left - r.left}px, ${c.bottom - r.top - 60}px) scale(.4)`, opacity: .2 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: api.reduced ? 1 : 900, easing: 'ease-in-out' });
        await wait(700);
        say('ctx', '📄 ', t.pages[i][0]);
        await wait(500);
        if (i === right) {
          if (tries === 0) score++;
          const m = say('bot', answer); sfx.ding(); burst(m, 0, 30, 7); pg.classList.add('used');
          await g.say(t.right, 'cheer'); break;
        }
        say('bot', t.wrongPage); sfx.buzz();
      }
      await wait(400); await g.next(ui.next);
    }
    return Math.max(1, score);
  },
};
