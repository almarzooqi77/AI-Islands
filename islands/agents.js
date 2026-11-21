'use strict';
// Toolbelt Cove: pack Bolt's toolbelt, run the think → act → observe loop, approve the risky step.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).agents = {
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    const belt = new Set();
    const toolBtns = t.tools.map(([id, ic, name]) => h('button', { class: 'ingr tool', 'aria-pressed': 'false', onclick: e => {
      const on = !belt.has(id); on ? belt.add(id) : belt.delete(id); e.currentTarget.setAttribute('aria-pressed', String(on)); on ? sfx.pop() : sfx.tap();
    } }, h('span', { class: 'ic' }, ic), h('b', {}, name)));
    const run = h('button', { class: 'btn coral big' }, '▶️ ', t.run);
    const trace = h('ol', { class: 'trace', 'aria-live': 'polite' });
    const bolt = h('span', { class: 'char', 'aria-hidden': 'true', style: 'font-size:2.4rem' }, '🤖');
    stage.replaceChildren(h('div', { class: 'panel' },
      h('div', { class: 'customer' }, bolt, h('div', {}, h('span', { class: 'tag' }, t.goal), h('p', { style: 'margin:0;font-weight:700' }, t.goalText))),
      h('h3', { style: 'margin-top:14px' }, '🧰 ', t.belt), h('div', { class: 'ingrs tools' }, toolBtns),
      h('div', { class: 'row center', style: 'margin:16px 0' }, run), trace));

    const step = async (kind, text, cls = '') => {
      const label = { think: '💭 ' + t.think, act: '🔧 ' + t.act, see: '👀 ' + t.see, warn: '⚠️', ask: '✋', done: '🏁' }[kind];
      const li = h('li', { class: `st ${kind} ${cls}` }, h('b', {}, label), ' ', text);
      trace.append(li); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); sfx.tap();
      await wait(650); return li;
    };
    for (let attempt = 1; ; attempt++) {
      await new Promise(r => { run.onclick = r; });
      if (!alive()) return null;
      run.disabled = true; toolBtns.forEach(b => { b.disabled = true; }); trace.replaceChildren();
      bolt.classList.add('busy');
      let stuck = false;
      for (const id of t.need) {
        const [thought, call, result, without] = t.steps[id];
        await step('think', thought);
        if (!belt.has(id)) { await step('warn', without, 'bad'); if (id === 'email') { stuck = true; break; } continue; }
        await step('act', call);
        if (id === 'email') {
          // Human in the loop: Bolt asks before sending anything.
          const ok = h('button', { class: 'btn leaf' }, t.approveBtn);
          const li = await step('ask', t.approve, 'ask'); li.append(' ', ok); ok.focus();
          await new Promise(r => { ok.onclick = r; }); ok.remove(); sfx.ding();
        }
        await step('see', result, 'good');
      }
      if (!stuck && ['weather', 'calc'].some(id => !belt.has(id))) stuck = true; // finished on guesses: not a real success
      for (const id of belt) if (!t.need.includes(id)) await step('warn', id === 'bank' ? t.bank : `${t.tools.find(x => x[0] === id)[1]} ${t.extra}`, id === 'bank' ? 'bad' : '');
      bolt.classList.remove('busy');
      if (stuck) {
        sfx.buzz(); await g.say(t.stuck, 'curious');
        run.disabled = false; toolBtns.forEach(b => { b.disabled = false; }); continue;
      }
      const extras = [...belt].filter(id => !t.need.includes(id)).length;
      await step('done', t.done, 'good'); sfx.win(); burst(bolt, 0, 80, 11);
      await g.say(extras ? t.heavy : t.lean, extras ? 'point' : 'cheer'); await g.next(ui.next);
      if (!alive()) return null;
      // A bigger job: a team of agents, one task each (and MCP, the plug they use for tools). Not scored.
      const T = t.team, opts = h('div', { class: 'row center' });
      const agent = ([ic, name, task], cls = '') => h('li', { class: 'st ' + cls }, h('b', {}, ic, ' ', name), ' — ', task);
      stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, T.title),
        h('p', { style: 'font-weight:700' }, '🎯 ', T.goal),
        h('ol', { class: 'trace' }, agent(T.lead, 'think'), ...T.members.map(m => agent(m))),
        h('p', { class: 'hint' }, T.q), opts));
      const [i, btn] = await choose(opts, T.opts);
      i === 1 ? (sfx.ding(), burst(btn, 0, 24, 6)) : sfx.boing();
      await g.say(`${i === 1 ? T.yes : T.no} ${T.why}`, i === 1 ? 'cheer' : 'point'); await g.next(ui.go);
      return Math.max(1, (extras ? 2 : 3) - (attempt > 1 ? 1 : 0));
    }
  },
};
