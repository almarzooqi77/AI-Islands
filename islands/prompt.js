'use strict';
// Recipe Kitchen: toggle prompt "ingredients"; the dish (a simulated answer) rebuilds live; serve it to the customer.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).prompt = {
  // Pure: what Polly cooks for a set of ingredient ids.
  cook(out, on) {
    const kids = on.has('audience'), lines = [];
    if (on.has('tone')) lines.push(out.fun);
    if (!on.has('task')) lines.push(kids ? out.blandKids : out.bland);
    else {
      let steps = kids ? out.kidSteps : out.steps;
      if (on.has('limit')) steps = steps.slice(0, 3);
      lines.push(on.has('format') ? steps.map((s, i) => `${i + 1}. ${s}`).join('\n') : steps.join(' '));
      if (on.has('limit')) lines.push(out.short);
    }
    return lines.join('\n');
  },
  async play(stage, api) {
    const { t, g, h, sfx, burst, wait, alive } = api;
    const on = new Set();
    const request = h('p', { class: 'req' });
    const dish = h('pre', { class: 'dish' });
    const meter = h('i', { style: '--w:10%' });
    const refresh = () => {
      request.textContent = [t.baseText, ...t.ingredients.filter(x => on.has(x.id)).map(x => x.text)].join(' ');
      dish.textContent = this.cook(t.out, on);
      dish.animate([{ transform: 'scale(.97)', opacity: .4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 350, easing: 'ease-out' });
      meter.style.setProperty('--w', `${10 + on.size * 18}%`);
    };
    const chips = t.ingredients.map(x => h('button', { class: 'ingr', 'aria-pressed': 'false', onclick: e => {
      const b = e.currentTarget, now = !on.has(x.id);
      now ? on.add(x.id) : on.delete(x.id); b.setAttribute('aria-pressed', String(now));
      now ? (sfx.pop(), burst(b, 0, 14, 5)) : sfx.tap(); refresh();
    } }, h('span', { class: 'ic' }, x.icon), h('b', {}, x.name), h('small', {}, x.text)));
    const serve = h('button', { class: 'btn coral big' }, '🍽️ ', t.serve);
    const customer = h('div', { class: 'customer' }, h('span', { class: 'char', style: 'font-size:2.4rem' }, '🧕'), h('div', {}, h('span', { class: 'tag' }, t.order), h('p', { style: 'margin:0;font-weight:700' }, '“', t.orderText, '”')));
    stage.replaceChildren(h('div', { class: 'panel kitchen' },
      customer,
      h('div', { class: 'kgrid' },
        h('div', {}, h('h3', {}, '🥣 ', t.pot), h('div', { class: 'ingrs' }, chips)),
        h('div', {}, h('h3', {}, '📝 ', t.base), request, h('div', { class: 'meter' }, '🍲', meter), h('h3', {}, '🍽️ ', t.result), dish)),
      h('div', { class: 'row center', style: 'margin-top:16px' }, serve)));
    refresh();

    for (let tries = 1; ; tries++) {
      await new Promise(r => { serve.onclick = r; });
      if (!alive()) return null;
      const missing = t.need.filter(id => !on.has(id));
      if (!missing.length) {
        sfx.win(); burst(customer, 0, 90, 12); customer.querySelector('.char').textContent = '😍';
        await g.say(t.happy, 'cheer'); await g.next(api.ui.go);
        return tries === 1 ? 3 : tries === 2 ? 2 : 1;
      }
      sfx.buzz(); customer.querySelector('.char').animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(12deg)' }, { transform: 'rotate(0)' }], { duration: 450 });
      g.say(`${t.missing} ${missing.map(id => t.names[id]).join(' + ')}`, 'curious'); // not awaited: Serve stays live
    }
  },
};
