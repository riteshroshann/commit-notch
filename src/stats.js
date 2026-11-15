// Pure helpers over GitHub's contribution calendar. No Electron here, so tests run in bun.

/** @typedef {{ date: string, count: number, level: number }} Day */

const LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

/**
 * Flatten the GraphQL weeks into days.
 * @param {{ contributionDays: { date: string, contributionCount: number, contributionLevel: string }[] }[]} weeks
 * @returns {Day[]}
 */
function flattenWeeks(weeks) {
  return weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: LEVELS[/** @type {keyof typeof LEVELS} */ (d.contributionLevel)] ?? 0,
    })),
  );
}

/**
 * Streaks the way GitHub counts them: an empty today doesn't break the current streak yet.
 * @param {Day[]} days oldest first, ending today
 */
function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let i = days.length - 1;
  if (i >= 0 && days[i]?.count === 0) i--;
  let current = 0;
  while (i >= 0 && (days[i]?.count ?? 0) > 0) {
    current++;
    i--;
  }
  return { current, longest };
}

/**
 * Month labels and the week column each one starts at.
 * @param {Day[]} days oldest first; days[0] is the first day of the first week column
 */
function monthLabels(days) {
  /** @type {{ label: string, col: number }[]} */
  const out = [];
  let last = -1;
  days.forEach((d, i) => {
    if (i % 7 !== 0) return;
    const m = Number(d.date.slice(5, 7)) - 1;
    if (m === last) return;
    last = m;
    const col = i / 7;
    const label = new Date(2000, m, 1).toLocaleString("en", { month: "short" });
    if (col < 50) out.push({ label, col });
  });
  if (out.length > 1 && (out[1]?.col ?? 0) - (out[0]?.col ?? 0) < 3) out.shift();
  return out;
}

/** @param {Day[]} days */
function summary(days) {
  return {
    ...streaks(days),
    today: days.at(-1)?.count ?? 0,
    week: days.slice(-7).map((d) => d.count),
  };
}

module.exports = { flattenWeeks, streaks, monthLabels, summary };
