import { describe, expect, test } from "bun:test";
import { bump, plainNotes } from "../src/updater.js";

describe("bump", () => {
  test("patch, minor and major", () => {
    expect(bump("1.4.0", "1.4.1")).toBe("patch");
    expect(bump("1.4.3", "1.5.0")).toBe("minor");
    expect(bump("1.9.9", "2.0.0")).toBe("major");
  });
});

describe("plainNotes", () => {
  test("strips GitHub's HTML into lines", () => {
    expect(plainNotes("<p>Faster &amp; calmer.</p><ul><li>Fixed a crash</li></ul>")).toBe(
      "Faster & calmer.\nFixed a crash",
    );
  });
  test("empty when there are no notes", () => {
    expect(plainNotes(null)).toBe("");
  });
  test("long notes are cut short", () => {
    expect(plainNotes("a".repeat(900)).length).toBe(601);
  });
});
