import { describe, expect, it } from "vitest";

import { cleanSteamText } from "../backlog-parser";
import { digestNews, stripNewsIntro } from "../news-digest";
import { parsePatchNotes } from "../patch-notes";

describe("digestNews", () => {
  it("leads with the real 7.2.1 retrospective crash fix", () => {
    // Source excerpt reproduced in the round-6 review; keep its wording intact.
    const contents = `[p]This hotfix aims to resolve one of the main crashes we have seen.[/p]
      [h2]🔧 Fixes[/h2][p][b]Crash Fixes[/b][/p]
      [list][*]Fixed a crash that would occur when another player joined or left the squad.[/*][/list]
      [p]🧠 Known Issues[/p]`;
    const expected =
      "Fixed a crash that would occur when another player joined or left the squad.";
    expect(
      digestNews(cleanSteamText(contents), "7.2.1", parsePatchNotes(contents))
        .line,
    ).toBe(expected);
    expect(digestNews(expected, "7.2.1").line).toBe(expected);
  });

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

  it.each([
    "The crash will be fixed next week.",
    "The crash would be fixed with more time.",
    "The crash is not fixed yet.",
    "The crash isn't fixed yet.",
    "We have not yet fixed the crash.",
    "Increased damage would help.",
    "Fixed crashes would improve performance.",
    "Fixed a crash that will be resolved next week.",
    "Fixed crashes that would be resolved next week.",
    "Fixed crashes that would be nice to resolve next week.",
    "Fixed a crash that would occur, but we have not fixed the menu yet.",
  ])("rejects proposed or negated actions: %s", (text) => {
    expect(digestNews(text, "Roadmap").line).toBeNull();
    const contents = `[h3]Changes[/h3][list][*]${text}[/*][/list]`;
    expect(
      digestNews(cleanSteamText(contents), "Roadmap", parsePatchNotes(contents))
        .line,
    ).toBeNull();
  });

  it.each([
    "Fixed an issue where reloading would crash the game.",
    "Resolved a bug which would prevent matchmaking.",
    "Improved stability when players would disconnect.",
  ])("accepts completed actions with retrospective clauses: %s", (text) => {
    expect(digestNews(text, "Hotfix").line).toBe(text);
  });

  it.each([
    "Crash Fixes",
    "Bug fixes",
    "Fix",
    "Misc",
    "Miscellaneous",
    "General",
  ])(
    "omits the generic subject %s without changing the source sentence",
    (subject) => {
      const contents = `[h3]Changes[/h3]\n[b]${subject}[/b]\n[list][*]Fixed a crash on startup.[/*][/list]`;
      expect(
        digestNews(
          cleanSteamText(contents),
          "Hotfix",
          parsePatchNotes(contents),
        ).line,
      ).toBe("Fixed a crash on startup.");
      expect(
        digestNews(`${subject}: Fixed a crash on startup.`, "Hotfix").line,
      ).toBe("Fixed a crash on startup.");
    },
  );

  it("never leads with unresolved Known Issues bullets", () => {
    const contents =
      "[h3]Known Issues[/h3][list][*]Fixed damage values are not applied yet.[/*][/list]";
    expect(
      digestNews(cleanSteamText(contents), "Patch", parsePatchNotes(contents))
        .line,
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
    "Crash Fixes: Fixed a crash on startup.",
    "🧠 Known Issues Some crashes are not fixed yet.",
    "General: More details follow.",
    "Weapons: Rifle damage increased.",
  ])("stops fallback prose before a subsequent section: %s", (heading) => {
    expect(
      stripNewsIntro(
        `Hello, players! The operation begins tomorrow. ${heading}`,
      ),
    ).toBe("The operation begins tomorrow.");
  });

  it("bounds fallback excerpts to 140 characters at a word boundary", () => {
    const text = `The operation begins tomorrow ${"with reinforcements ".repeat(12)}.`;
    const excerpt = stripNewsIntro(text);
    expect(excerpt).toBe(text.slice(0, text.lastIndexOf(" ", 140)));
    expect(excerpt.length).toBeLessThanOrEqual(140);
    expect(text.startsWith(excerpt)).toBe(true);
    expect(stripNewsIntro("x".repeat(141))).toBe("");
  });

  it("does not restore a heading-only fallback", () => {
    expect(stripNewsIntro("🧠 Known Issues")).toBe("");
  });

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

  it("preserves ordinary announcements and never empties a greeting-only post", () => {
    expect(stripNewsIntro("Join us for the festival! Details tomorrow.")).toBe(
      "Join us for the festival! Details tomorrow.",
    );
    expect(stripNewsIntro("Greetings, Helldivers!")).toBe(
      "Greetings, Helldivers!",
    );
    expect(stripNewsIntro("")).toBe("");
  });
});
