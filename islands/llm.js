'use strict';
// Word Lagoon: an old script bot vs an AI chatbot, then you cook an LLM in a pot, then you write a sentence by picking next words,
// then you watch a chatbot answer appear one guessed word at a time.
// ponytail: probabilities are hand-authored illustrations (labelled), not live model logprobs.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).llm = {
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose, reduced } = api;

    // Beat 1: same message, two chatbots. Which one understood you?
    const C = t.chat, opts = h('div', { class: 'row center' });
    const bubble = (who, name, text, cls) => h('div', { class: `chat-col ${cls}` }, h('b', {}, who, ' ', name), h('p', { class: 'msg bot' }, text));
    stage.replaceChildren(h('div', { class: 'panel' }, h('h2', {}, C.title),
      h('div', { class: 'chat' }, h('p', { class: 'msg you' }, '🙋 ', C.user)),
      h('div', { class: 'chat-pair' }, bubble('📟', C.oldName, C.old, 'old'), bubble('✨', C.newName, C.new, 'new')),
      h('p', { class: 'hint' }, C.q), opts));
    const [i, btn] = await choose(opts, ['📟 ' + C.oldName, '✨ ' + C.newName]);
    if (!alive()) return null;
    const right = i === 1;
    right ? (sfx.ding(), burst(btn, 0, 24, 6)) : sfx.boing();
    await g.say(`${right ? C.right : C.wrong} ${C.why}`, right ? 'cheer' : 'point');
    await g.next(ui.next);
    if (!alive()) return null;

    // Beat 2: what an LLM IS. Throw a mountain of text into the pot, stir, and a model comes out.
    const P = t.pot, pot = h('div', { class: 'pot', 'aria-hidden': 'true' }, '🍲');
    const fill = h('i'), meter = h('div', { class: 'pot-meter', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': P.items.length, 'aria-valuenow': 0 }, fill);
    const count = h('p', { class: 'hint pot-count' }, `0 / ${P.items.length}`), stirRow = h('div', { class: 'row center' });
    let thrown = 0, allIn;
    const allThrown = new Promise(r => { allIn = r; });
    const throwIn = (btn, ic) => {
      btn.disabled = true; sfx.pop(); thrown++;
      const a = btn.getBoundingClientRect(), b = pot.getBoundingClientRect();
      const fly = h('span', { class: 'pot-fly', 'aria-hidden': 'true', style: `left:${a.left + a.width / 2}px;top:${a.top + a.height / 2}px` }, ic);
      document.body.append(fly);
      fly.animate([{ transform: 'translate(-50%,-50%)' }, { transform: `translate(calc(${b.left + b.width / 2 - a.left - a.width / 2}px - 50%), calc(${b.top + b.height / 2 - a.top - a.height / 2}px - 50%)) scale(.3) rotate(200deg)`, opacity: .2 }], { duration: reduced ? 1 : 520, easing: 'ease-in' }).finished.then(() => fly.remove());
      fill.style.width = `${(thrown / P.items.length) * 100}%`; meter.setAttribute('aria-valuenow', thrown);
      pot.classList.remove('gulp'); void pot.offsetWidth; pot.classList.add('gulp');
      count.textContent = thrown < P.items.length ? `${thrown} / ${P.items.length}` : P.full;
      if (thrown === P.items.length) allIn();
    };
    stage.replaceChildren(h('div', { class: 'panel pot-panel' }, h('span', { class: 'tag' }, ui.illustrative), h('h2', {}, P.title), pot, meter, count,
      h('div', { class: 'ingrs pot-shelf' }, P.items.map(([ic, name]) => h('button', { class: 'ingr', onclick: e => throwIn(e.currentTarget, ic) }, h('span', { class: 'ic' }, ic), h('b', {}, name)))),
      stirRow));
    g.say(P.hint, 'point');
    await allThrown;
    if (!alive()) return null;
    sfx.win(); await wait(500);
    const [, stirBtn] = await choose(stirRow, [P.stir], 'btn coral big');
    pot.classList.add('stir'); sfx.tap(); await wait(1400);
    if (!alive()) return null;
    pot.classList.remove('stir'); pot.textContent = '🦜'; pot.classList.add('born'); burst(pot, 0, 60, 10); sfx.ding(); stirBtn.remove();
    await g.say(P.out, 'cheer'); await g.next(ui.next);
    await g.say(P.name, 'point'); await g.next(ui.next);
    if (!alive()) return null;

    // Beat 3: help Polly (the word-guesser that came out of the pot) write a sentence.
    const polly = h('div', { class: 'char', 'aria-hidden': 'true' }, '🦜');
    const react = cls => { polly.classList.remove('react', 'spin'); void polly.offsetWidth; polly.classList.add(cls); };
    const sentence = h('div', { class: 'sentence', 'aria-live': 'polite' });
    const bars = h('div', { class: 'bars' });
    const title = h('h2', {}, t.build.title), hint = h('p', { class: 'hint' }, t.build.hint);
    stage.replaceChildren(polly, h('div', { class: 'panel' }, h('span', { class: 'tag' }, ui.illustrative), title, hint, sentence, bars));

    const showBars = (options, top) => {
      bars.replaceChildren(...options.map(([w, p]) => h('button', { class: `bar${p === top ? ' top' : ''}`, 'data-p': p, style: '--w:0%' }, h('span', {}, w), h('span', { class: 'pct' }, p + '%'))));
      requestAnimationFrame(() => requestAnimationFrame(() => bars.querySelectorAll('.bar').forEach(b => b.style.setProperty('--w', b.dataset.p + '%'))));
    };
    const word = (txt, cls = 'w') => h('span', { class: cls }, txt);
    for (const step of t.build.steps) {
      if (!alive()) return null;
      sentence.querySelector('.blank')?.remove();
      sentence.append(word(step.prefix), word('', 'blank'));
      bars.classList.remove('locked');
      showBars(step.options, Math.max(...step.options.map(o => o[1])));
      const [b, [w, p]] = await new Promise(res => bars.querySelectorAll('.bar').forEach((el, k) => el.addEventListener('click', () => {
        bars.classList.add('locked'); el.classList.add('chosen'); sfx.pop(); res([el, step.options[k]]);
      })));
      sentence.querySelector('.blank').replaceWith(word(w, p >= 15 ? 'pick' : 'pick odd'));
      if (p >= 15) { sfx.ding(); react('react'); burst(b, 0, 24, 6); g.say(t.build.likely); }
      else { sfx.boing(); react('spin'); g.say(t.build.unlikely, 'curious'); }
      await wait(1100);
    }
    sentence.append(word(t.build.end));
    bars.replaceChildren();
    g.pose('cheer'); burst(sentence, 0, 50, 9); sfx.win();
    await g.say(t.build.done); await g.next(ui.next);
    if (!alive()) return null;

    // Beat 4: watch a chatbot answer appear the same way, one most-likely word at a time.
    const T = t.typing;
    title.textContent = T.title; hint.textContent = T.q; g.pose('point');
    sentence.replaceChildren(); bars.classList.add('locked');
    g.say(T.watch);
    for (const options of T.flow) {
      if (!alive()) return null;
      const top = Math.max(...options.map(o => o[1]));
      showBars(options, top);
      await wait(900);
      sentence.append(word(options.find(o => o[1] === top)[0], 'pick')); sfx.tap();
      await wait(350);
    }
    bars.replaceChildren(); sfx.win(); burst(sentence, 0, 50, 9);
    await g.say(T.done, 'cheer'); await g.next(ui.next);
    return right ? 3 : 2;
  },
};
