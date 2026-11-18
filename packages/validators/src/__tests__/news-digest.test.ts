import { describe, expect, it } from "vitest";

import { cleanSteamText } from "../backlog-parser";
import { digestNews, stripNewsIntro } from "../news-digest";
import { parsePatchNotes } from "../patch-notes";

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

  it("finds an actual change beyond the excerpt and preserves its subject", () => {
    const contents = `INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND.
      ${"Our scientists have a problem to solve. ".repeat(12)}
      [h3]Stratagems[/h3]
      [p][i]AMW-20 APEX[/i][/p]
      [p]Problem we want to solve:[/p]
      [list][*]Increased demolition strength would help.[/*][/list]
      [p]Changes:[/p]
      [list][*]Increased demolition strength to 30.[/*][/list]`;
    expect(
      contents.indexOf("Increased demolition strength to 30."),
    ).toBeGreaterThan(280);
    expect(
      digestNews(
        cleanSteamText(contents),
        "Patch 7.2.2",
        parsePatchNotes(contents, "Patch 7.2.2"),
      ).line,
    ).toBe("AMW-20 APEX: Increased demolition strength to 30.");
  });

  it("does not repeat a subject already present or add a generic section label", () => {
    const contents =
      "[h3]Fixes[/h3][list][*]Fixed a crash on startup.[/*][/list]";
    expect(
      digestNews(cleanSteamText(contents), "Hotfix", parsePatchNotes(contents))
        .line,
    ).toBe("Fixed a crash on startup.");
    const named =
      "[h3]Weapons[/h3]\n[b]APEX[/b]\n[list][*]APEX: Increased damage to 30.[/*][/list]";
    expect(
      digestNews(cleanSteamText(named), "Patch", parsePatchNotes(named)).line,
    ).toBe("APEX: Increased damage to 30.");
  });

  it("keeps a subject and a long change within the 140-character limit", () => {
    const contents = `[h3]Weapons[/h3]\n[b]AMW-20 APEX[/b]\n[list][*]Increased damage ${"during combat ".repeat(15)}.[/*][/list]`;
    const { line } = digestNews(
      cleanSteamText(contents),
      "Patch",
      parsePatchNotes(contents),
    );
    expect(line).toMatch(/^AMW-20 APEX: Increased damage /);
    expect(line?.length).toBeLessThanOrEqual(140);
  });

  it("does not fall back to a developer problem statement when no change exists", () => {
    const contents =
      "[h3]Weapons[/h3]\n[b]APEX[/b]\nProblem we want to solve:\n[list][*]Increased damage makes this weapon too strong.[/*][/list]";
    expect(
      digestNews(cleanSteamText(contents), "Patch", parsePatchNotes(contents))
        .line,
    ).toBeNull();
  });

  it("skips uppercase publisher prose even when it contains a change verb", () => {
    expect(
      digestNews("WE HAVE IMPROVED OUR COMMUNITY. Fixed matchmaking.", "Update")
        .line,
    ).toBe("Fixed matchmaking.");
  });
});

describe("stripNewsIntro", () => {
  it.each([
    "INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND.",
    "Attention Helldivers, Captain Morris here…",
  ])("drops the Helldivers opener %s when no change line exists", (opener) => {
    const text = `${opener} The operation begins tomorrow.`;
    expect(digestNews(text, "Dispatch").line).toBeNull();
    expect(stripNewsIntro(text)).toBe("The operation begins tomorrow.");
  });

  it("skips greetings and sentences with more than 60 percent uppercase letters", () => {
    expect(
      stripNewsIntro(
        "Hello, players! HIGH COMMAND REPORT reporting. Details tomorrow.",
      ),
    ).toBe("Details tomorrow.");
    expect(stripNewsIntro("ABCde. Details tomorrow.")).toBe(
      "ABCde. Details tomorrow.",
    );
  });

  it("preserves ordinary announcements and handles an empty remainder", () => {
    expect(stripNewsIntro("Join us for the festival! Details tomorrow.")).toBe(
      "Join us for the festival! Details tomorrow.",
    );
    expect(stripNewsIntro("Greetings, Helldivers!")).toBe("");
    expect(stripNewsIntro("")).toBe("");
  });
});
