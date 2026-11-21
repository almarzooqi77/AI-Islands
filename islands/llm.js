'use strict';
// Word Lagoon: an old script bot vs an AI chatbot, then you write a sentence by picking next words,
// then you watch a chatbot answer appear one guessed word at a time.
// ponytail: probabilities are hand-authored illustrations (labelled), not live model logprobs.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).llm = {
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;

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

    // Beat 2: help Polly (the word-guesser inside) write a sentence.
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

    // Beat 3: watch a chatbot answer appear the same way, one most-likely word at a time.
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
