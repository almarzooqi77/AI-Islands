'use strict';
// Mirror Lake: Polly learns "good hire" from one-sided examples (everyone wore a cap) and ranks by hats, not skill.
// You spot why, rebalance her lessons, and she ranks by skill. Hats stand in for any group, on purpose.
(globalThis.ISLANDS = globalThis.ISLANDS || {}).bias = {
  HAT: { cap: '🧢', hat: '🎩' },
  // Pure: Polly's score is skill plus a bonus for looking like her lessons (share of examples with that hat).
  rank(applicants, lessons) {
    const share = k => lessons.filter(x => x === k).length / lessons.length;
    return [...applicants].sort((a, b) => (b[2] + 4 * share(b[1])) - (a[2] + 4 * share(a[1])) || b[2] - a[2]);
  },
  async play(stage, api) {
    const { t, ui, g, h, sfx, burst, wait, alive, choose } = api;
    const lessons = ['cap', 'cap', 'cap', 'cap', 'cap', 'cap'];
    const lessonRow = h('div', { class: 'lessons', 'aria-label': t.lessons });
    const drawLessons = () => lessonRow.replaceChildren(...lessons.map(k => h('span', { class: 'hire', title: t[k] }, this.HAT[k], h('small', {}, '⭐'))));
    const ranking = h('ol', { class: 'ranking' }), head = h('h3', {}, t.ranked), panel = h('div', { class: 'quiz-panel' });
    const drawRank = () => ranking.replaceChildren(...this.rank(t.applicants, lessons).map(([name, k, skill]) =>
      h('li', { class: 'cand' }, h('span', { class: 'hat', 'aria-hidden': 'true' }, this.HAT[k]), h('b', {}, `${t.applicant} ${name}`), h('span', { class: 'sk' }, `${t.skill} `, '★'.repeat(skill) + '☆'.repeat(4 - skill)))));
    stage.replaceChildren(h('div', { class: 'panel' }, h('h3', {}, t.lessons), lessonRow, head, ranking, panel));
    drawLessons(); drawRank();
    ranking.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 500 });
    let score = 0;
    const ask = async c => {
      const [i, btn] = await choose(panel, Math.random() < .5 ? [c.right, c.wrong] : [c.wrong, c.right], 'btn ghost wide');
      const ok = btn.textContent === c.right;
      if (ok) { score++; sfx.ding(); burst(btn, 0, 24, 6); } else { sfx.buzz(); }
      await g.say(`${ok ? t.right : t.wrong} ${c.why}`, ok ? 'cheer' : 'curious');
      await g.next(ui.next);
      return i;
    };
    g.say(t.q1.q, 'curious'); await ask(t.q1);
    if (!alive()) return null;
    // Rebalance: three taps add great top-hat hires; Polly re-learns after each.
    const add = h('button', { class: 'btn leaf' }, '➕ ', t.fix);
    panel.replaceChildren(add); add.focus({ preventScroll: true });
    for (let k = 0; k < 3; k++) {
      await new Promise(r => { add.onclick = r; });
      lessons.push('hat'); sfx.pop(); drawLessons();
      lessonRow.lastChild.animate([{ transform: 'scale(0)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 400 });
    }
    lessons.splice(0, 3); // ponytail: 3 caps + 3 top hats = a balanced lesson set
    drawLessons(); head.textContent = t.reranked; drawRank(); sfx.whoosh();
    ranking.animate([{ opacity: .2 }, { opacity: 1 }], { duration: 600 });
    await wait(500);
    if (!alive()) return null;
    g.say(t.q2.q, 'point'); await ask(t.q2);
    g.say(t.q3.q, 'point'); await ask(t.q3);
    return Math.max(1, score);
  },
};
