'use strict';
// Brick Workshop: chop words into tokens, see brick IDs, then the "count the letters" gag.
// ponytail: splits and IDs are illustrative (labelled), not a real tokenizer's output.
(() => {
  const ZWJ = '‍';
  // Arabic letters that never connect to the following letter (plus hamza, which connects to nothing).
  const NO_LEFT = new Set(Array.from('اأإآدذرزوؤةء'));
  const isAr = c => /[ؠ-ي]/.test(c);
  const joinsLeft = c => isAr(c) && !NO_LEFT.has(c);
  const joinsRight = c => isAr(c) && c !== 'ء';
  // Letter i, with zero-width joiners so Arabic keeps its connected shape even when split into tiles.
  function shaped(letters, i) {
    const p = letters[i - 1], c = letters[i], n = letters[i + 1];
    return (p && joinsLeft(p) && joinsRight(c) ? ZWJ : '') + c + (n && joinsLeft(c) && joinsRight(n) ? ZWJ : '');
  }
  const brickId = s => { let x = 7; for (const ch of s) x = (x * 31 + ch.codePointAt(0)) % 49999; return 1000 + x; };
  const PALETTE = ['#ff6f61', '#22a6bd', '#35b779', '#8a5cf6', '#f59e0b'];

  (globalThis.ISLANDS = globalThis.ISLANDS || {}).tokens = {
    shaped, brickId,
    async play(stage, api) {
      const { t, ui, g, h, sfx, burst, wait, alive } = api, c = t.chop;
      const bricks = (parts) => h('div', { class: 'bricks' }, parts.map((s, i) => h('div', { class: 'brick', style: `--i:${i};--c:${PALETTE[i % PALETTE.length]}` }, h('b', {}, s), h('small', {}, '#' + brickId(s)))));
      const title = h('h2', {}, c.title), hint = h('p', { class: 'hint' }, c.hint);
      const belt = h('div', { class: 'conveyor' }), result = h('div', { class: 'compare', 'aria-live': 'polite' });
      const chopBtn = h('button', { class: 'btn coral big' }, '🔪 ', c.go);
      const panel = h('div', { class: 'panel' }, h('span', { class: 'tag' }, ui.illustrative), title, hint, belt, h('div', { class: 'row center', style: 'margin-top:16px' }, chopBtn), result);
      stage.replaceChildren(panel);

      let exact = 0;
      for (const { word, split } of c.words) {
        if (!alive()) return null;
        const letters = Array.from(word), cuts = new Set();
        const row = h('div', { class: 'letters', dir: 'auto' });
        letters.forEach((ch, i) => {
          row.append(h('span', { class: 'ch' }, shaped(letters, i)));
          if (i < letters.length - 1) row.append(h('button', { class: 'cut', 'aria-pressed': 'false', 'aria-label': `${letters.slice(0, i + 1).join('')} | ${letters.slice(i + 1).join('')}`,
            onclick: e => { const on = !cuts.has(i + 1); on ? cuts.add(i + 1) : cuts.delete(i + 1); e.currentTarget.setAttribute('aria-pressed', String(on)); on ? sfx.chop() : sfx.tap(); } }));
        });
        belt.replaceChildren(row); result.replaceChildren(); chopBtn.hidden = false; chopBtn.disabled = false;
        await new Promise(r => { chopBtn.onclick = r; });
        chopBtn.disabled = true; sfx.chop();
        // Compare the learner's cut positions to the illustrative split.
        const truth = new Set(); let pos = 0; for (const s of split.slice(0, -1)) { pos += Array.from(s).length; truth.add(pos); }
        const mine = []; let last = 0; [...cuts].sort((a, b) => a - b).forEach(k => { mine.push(letters.slice(last, k).join('')); last = k; }); mine.push(letters.slice(last).join(''));
        const same = cuts.size === truth.size && [...cuts].every(k => truth.has(k));
        row.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15) rotate(-2deg)', opacity: 0 }], { duration: 300, fill: 'forwards' });
        await wait(280);
        belt.replaceChildren(bricks(split));
        result.replaceChildren(
          h('div', { class: 'mine' }, '✂ ', mine.map(s => `[${s}]`).join(' ')),
          h('div', {}, '🦜 ', split.map(s => `[${s}]`).join(' ')),
          h('div', { class: 'hint', style: 'margin:0' }, c.ids));
        if (same) { exact++; sfx.ding(); burst(belt, 0, 50, 9); g.say(c.exact, 'cheer'); } else { sfx.pop(); g.say(c.close, 'curious'); }
        chopBtn.hidden = true;
        await wait(700); await g.next(ui.next);
      }
      if (!alive()) return null;

      // The famous letter-counting slip.
      const gag = t.gag;
      title.textContent = gag.title; hint.textContent = gag.question; chopBtn.remove(); result.replaceChildren();
      const opts = h('div', { class: 'row center' });
      belt.replaceChildren(h('div', { style: 'display:grid;gap:14px;justify-items:center' }, h('div', { class: 'char', style: 'font-size:2.6rem' }, '🦜'), h('strong', { style: 'font-size:1.3rem' }, gag.polly), opts));
      g.pose('curious'); g.say(gag.question);
      const pick = await new Promise(r => gag.options.forEach(o => opts.append(h('button', { class: 'btn big ghost', onclick: e => r([o, e.currentTarget]) }, o))));
      opts.querySelectorAll('button').forEach(b => { b.disabled = true; });
      if (pick[0] === gag.answer) { sfx.ding(); burst(pick[1], 0, 40, 8); } else sfx.buzz();
      belt.append(bricks(gag.bricks));
      await g.say(gag.why, 'point'); await g.next(ui.next);
      if (!alive()) return null;
      await g.say(t.fact, 'cheer'); await g.next(ui.go);
      return exact === 3 ? 3 : exact ? 2 : 1;
    },
  };
})();
