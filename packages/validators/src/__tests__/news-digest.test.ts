import { describe, expect, it } from "vitest";

import { digestNews } from "../news-digest";

describe("digestNews", () => {
  it("skips the Helldivers greeting and leads with the first change", () => {
    expect(
      digestNews(
        "Greetings, Helldivers! We have news from Super Earth. Fixed a crash when joining a squad. Improved performance on missions.",
        "Patch 01.002",
      ),
    ).toEqual({
      topics: ["Crash fixes", "Performance"],
      line: "Fixed a crash when joining a squad.",
    });
  });

  it("skips an all-caps transmission intro", () => {
    expect(
      digestNews(
        "INCOMING TRANSMISSION…\nAdded new missions to the galactic map. Reduced weapon recoil.",
        "Dispatch",
      ),
    ).toEqual({
      topics: ["New content"],
      line: "Added new missions to the galactic map.",
    });
  });

  it("returns no change line for a pure announcement", () => {
    expect(
      digestNews("Join us for a festival this weekend! See you there.", "News"),
    ).toEqual({ topics: ["Events"], line: null });
  });

  it("limits topics to two distinct source-supported labels", () => {
    expect(
      digestNews(
        "Balance changes. Added new maps, skins and events. Improved matchmaking performance.",
        "Update",
      ).topics,
    ).toEqual(["Balance", "New content"]);
  });

  it("does not infer topics from the game or the word patch", () => {
    expect(digestNews("Greetings, Helldivers!", "Helldivers 2 patch")).toEqual({
      topics: [],
      line: null,
    });
  });

  it("can use explicit title topics without turning the title into a lead", () => {
    expect(
      digestNews("Details tomorrow.", "Matchmaking and cosmetics"),
    ).toEqual({
      topics: ["Cosmetics", "Matchmaking"],
      line: null,
    });
  });

  it("truncates at a word boundary without exceeding 140 characters", () => {
    const prefix = "Fixed a crash when joining a squad ";
    const text = `${prefix}${"during combat ".repeat(15)}on distant planets.`;
    const { line } = digestNews(text, "Hotfix");
    const expected = text.slice(0, text.lastIndexOf(" ", 140));
    expect(line).toBe(expected);
    expect(line?.length).toBeLessThanOrEqual(140);
    expect(line && text.startsWith(line)).toBe(true);
  });

  it("preserves short sentences and punctuation verbatim", () => {
    expect(digestNews("Increased damage from 405 to 486.", "Update").line).toBe(
      "Increased damage from 405 to 486.",
    );
  });

  it("does not present planned or unfixed changes as completed", () => {
    expect(
      digestNews(
        "Performance will be improved next month. We have not fixed the menu yet.",
        "Roadmap",
      ).line,
    ).toBeNull();
  });

  it("skips a greeting even when it mentions a change verb", () => {
    expect(
      digestNews(
        "Welcome to our improved community! Adjusted matchmaking regions.",
        "News",
      ).line,
    ).toBe("Adjusted matchmaking regions.");
  });

  it("handles empty text and avoids cutting an unbroken long word", () => {
    expect(digestNews("", "")).toEqual({ topics: [], line: null });
    expect(digestNews(`${"x".repeat(141)} added.`, "").line).toBeNull();
  });
});
