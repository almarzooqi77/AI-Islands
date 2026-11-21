'use strict';
// Safe Harbour: decide what may be pasted into a public AI, then hide the private details in a real request.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).safety = {
  // Pure: stars from mistakes (leaks and needless blocks both count).
  stars: mistakes => mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1,
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    // Round 1: one request at a time. Safe ones go to Chatty; private ones get blocked at the shield.
    const chat = h('div', { class: 'chat safe-chat', 'aria-live': 'polite' }, h('div', { class: 'chat-head' }, '☁️ ', t.chatty));
    const req = h('div', { class: 'safe-req' }), controls = h('div', { class: 'row center' }), dots = h('div', { class: 'progress' }, t.items.map(() => h('i')));
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, t.sortTitle), dots, req, controls, chat));
    let mistakes = 0;
    for (const [n, [text, safe, why]] of t.items.entries()) {
      if (!alive()) return null;
      req.replaceChildren(h('span', { class: 'who', 'aria-hidden': 'true' }, '📝'), h('p', {}, text));
      req.animate([{ transform: 'translateY(-16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 350, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      const [i] = await choose(controls, ['✅ ' + t.ok, '⛔ ' + t.never]);
      const pasted = i === 0, right = pasted === safe;
      if (!right) mistakes++;
      dots.children[n].className = right ? 'ok' : 'no';
      controls.replaceChildren();
      if (pasted) {
        chat.append(h('div', { class: 'msg you' + (safe ? '' : ' alarm') }, text));
        chat.scrollTop = chat.scrollHeight;
        if (safe) { sfx.ding(); await g.say(`${t.sent} ${why}`, 'cheer'); }
        else { sfx.buzz(); chat.animate([{ translate: '0' }, { translate: '-8px' }, { translate: '8px' }, { translate: '0' }], { duration: 300, iterations: 2 }); await g.say(`😱 ${t.leaked} ${why}`, 'curious'); }
      } else if (!safe) { sfx.thud(); burst(req, 0, 24, 6); await g.say(`🛡️ ${t.blocked} ${why}`, 'cheer'); }
      else { sfx.tap(); await g.say(`${t.keptBack} ${why}`, 'curious'); }
      await g.next(ui.next);
    }
    if (!alive()) return null;
    // Round 2: the same kind of request can be made safe by hiding the private parts.
    const parts = t.fix.parts.map(([txt, label]) => label ? h('button', { class: 'line pii', 'data-label': label, dir: label === 'name' ? 'auto' : 'ltr' }, txt) : h('span', {}, txt));
    const left = h('span', { class: 'tag' }), out = h('div', { class: 'chat', 'aria-live': 'polite' });
    const count = () => { const n = parts.filter(p => p.dataset.label && !p.disabled).length; left.textContent = `🔒 ${n}`; return n; };
    stage.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', {}, t.fixTitle), left), h('p', { class: 'safe-msg' }, parts), out));
    count();
    g.say(t.fixHint, 'point');
    await new Promise(res => parts.forEach(p => {
      if (!p.dataset.label) { p.onclick = () => { sfx.tap(); p.animate([{ translate: '0' }, { translate: '-5px' }, { translate: '5px' }, { translate: '0' }], { duration: 250 }); }; return; }
      p.onclick = () => {
        p.disabled = true; p.classList.add('masked'); p.textContent = `[${t.fix.labels[p.dataset.label]}]`; sfx.chop(); burst(p, 0, 16, 5);
        if (!count()) res();
      };
    }));
    await wait(300);
    out.append(h('div', { class: 'msg bot' }, h('span', { class: 'who' }, '☁️'), t.fix.answer)); sfx.ding();
    await g.say(t.fixDone, 'cheer');
    await g.next(ui.go);
    return this.stars(mistakes);
  },
};
