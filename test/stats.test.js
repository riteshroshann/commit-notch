import { expect, test } from "bun:test";
import { flattenWeeks, monthLabels, streaks } from "../src/stats.js";

/** @param {number[]} counts */
const days = (counts) =>
  counts.map((count, i) => ({
    date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    count,
    level: count ? 1 : 0,
  }));

test("current streak survives an empty today", () => {
  expect(streaks(days([1, 0, 2, 3, 4, 0]))).toEqual({ current: 3, longest: 3 });
});

test("current streak counts today when active", () => {
  expect(streaks(days([5, 5, 0, 1, 1]))).toEqual({ current: 2, longest: 2 });
});

test("two empty days end the streak", () => {
  expect(streaks(days([1, 1, 1, 0, 0]))).toEqual({ current: 0, longest: 3 });
});

test("flattenWeeks maps levels", () => {
  const out = flattenWeeks([
    { contributionDays: [{ date: "2026-01-01", contributionCount: 9, contributionLevel: "FOURTH_QUARTILE" }] },
  ]);
  expect(out).toEqual([{ date: "2026-01-01", count: 9, level: 4 }]);
});

test("month labels land on week columns", () => {
  const labels = monthLabels(days(new Array(70).fill(0)));
  expect(labels.map((l) => l.label)).toEqual(["Jan", "Feb", "Mar"]);
  expect(labels[1]?.col).toBe(5);
});
