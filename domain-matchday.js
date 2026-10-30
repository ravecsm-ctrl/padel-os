// Match-day essentials: the few things that do more for how you play than any extra session —
// sleep, food and fluids, and a proper warm-up. Shown the day before padel, on the day, and after
// you've played. Plain guidance, not medical advice. Pure function.

// ctx: { padelToday, padelTomorrow, playedToday, nextPadelIn (days, or null), level ('easy'|'normal'|'hard'),
//        long (expect 90+ min) }. Returns { when: 'before'|'day'|'after', title, items[], warmup } or null.
export function matchTips({ padelToday = false, padelTomorrow = false, playedToday = false, nextPadelIn = null, level = 'normal', long = false } = {}) {
  if (playedToday) {
    const items = ['Protein and carbs within a couple of hours: chicken and rice, eggs on toast, or yoghurt and fruit.',
      'Drink through the evening until your pee is pale again.'];
    if (nextPadelIn != null && nextPadelIn <= 2) items.push(`More padel ${nextPadelIn === 1 ? 'tomorrow' : 'in 2 days'}: get to bed early tonight. Sleep is when your legs recover.`);
    return { when: 'after', title: 'After playing', items, warmup: false };
  }
  if (padelToday) {
    const items = ['A proper meal 2–3 hours before you play, then a small snack like a banana 30–60 minutes before.',
      'Drink through the day and take water to court; sip between games.',
      'Warm up for about 10 minutes before you start. It ends with a few jumps and sprints to switch your legs on.'];
    if (long || level === 'hard') items.push('For a long or tough match, a banana or sports drink at changeovers keeps your legs and decisions sharp.');
    return { when: 'day', title: 'Match day', items, warmup: true };
  }
  if (padelTomorrow) {
    const items = ['Aim for 8 hours of sleep tonight. One short night slows your reactions and your shots.',
      'A carb-rich dinner: rice, pasta or potatoes with your usual protein.'];
    if (level === 'hard') items.push('Keep today easy on your legs. Your plan already does.');
    return { when: 'before', title: 'Padel tomorrow', items, warmup: false };
  }
  return null;
}
