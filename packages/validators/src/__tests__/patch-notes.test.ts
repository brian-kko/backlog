import { describe, expect, it } from "vitest";

import {
  AiPatchSummarySchema,
  classifyChange,
  parsePatchNotes,
  PatchNotesInputSchema,
  patchVersion,
  subjectGroup,
  summarizePatch,
} from "../patch-notes";

// Trimmed from a real Helldivers 2 patch post (7.2.2).
const helldivers = `[p][i][b]*** INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND ***[/b][/i][/p][p][/p][img]{STEAM_CLAN_IMAGE}/1234/hero.png[/img][h3][b]Stratagems[/b][/h3][p][i]AMW-20 APEX[/i][/p][p]Problem we want to solve:[/p][list][*][p]Demolition strength was too low[/p][/*][/list][p]Changes:[/p][list][*][p]Decreased caliber from 60 to 20[/p][/*][*][p]Fixed, so it correctly displays armor penetration is “Anti-Tank”[/p][/*][*][p]Increased demolition strength to 30[/p][/*][/list][p][i]LAS-44 NOVA[/i][/p][p]Changes:[/p][list][*][p]Fixed so it correctly displays armor penetration as “Anti-Tank”[/p][/*][/list][h3]Fixes[/h3][list][*]Fixed a crash when joining a squad[/*][*]Fixed audio cutting out[/*][/list]`;

describe("Patch notes parsing", () => {
  const parsed = parsePatchNotes(helldivers, "Devoid of Liberty: 7.2.2");

  it("extracts the version, hero image and intro", () => {
    expect(parsed.version).toBe("7.2.2");
    expect(parsed.heroImage).toBe(
      "https://clan.akamai.steamstatic.com/images/1234/hero.png",
    );
    expect(parsed.intro).toEqual([
      "INCOMING TRANSMISSION FROM SUPER EARTH HIGH COMMAND",
    ]);
  });

  it("builds sections and subjects, keeping developer context separate", () => {
    expect(parsed.sections.map((section) => section.title)).toEqual([
      "Stratagems",
      "Fixes",
    ]);
    const [apex, nova] = parsed.sections[0]?.subjects ?? [];
    expect(apex?.name).toBe("AMW-20 APEX");
    expect(apex?.context).toEqual(["Demolition strength was too low"]);
    expect(apex?.changes.map((change) => change.kind)).toEqual([
      "nerf",
      "fix",
      "buff",
    ]);
    expect(apex?.group).toBe("adjusted");
    expect(nova?.group).toBe("fix");
  });

  it("treats a heading-level list in a fixes section as one fix group", () => {
    const fixes = parsed.sections[1]?.subjects[0];
    expect(fixes?.name).toBe("Fixes");
    expect(fixes?.group).toBe("fix");
    expect(fixes?.changes).toHaveLength(2);
  });

  it("summarizes counts, groups, a headline and highlights", () => {
    const summary = summarizePatch(parsed);
    expect(summary.counts).toMatchObject({ buff: 1, nerf: 1, fix: 4 });
    expect(summary.groups).toEqual([
      { group: "adjusted", subjects: ["AMW-20 APEX"] },
      { group: "fix", subjects: ["LAS-44 NOVA", "Fixes"] },
    ]);
    expect(summary.headline).toBe(
      "1 buff, 1 nerf, and 4 fixes across Stratagems and Fixes.",
    );
    expect(summary.highlights[0]).toMatch(/^AMW-20 APEX: /);
  });

  it("handles posts with no structure", () => {
    const plain = parsePatchNotes("Thanks for playing! See you next week.");
    expect(plain.sections).toEqual([]);
    expect(summarizePatch(plain).headline).toBe(
      "A short update without itemised changes.",
    );
  });

  it.each([
    "🧠 Known Issues",
    "Known Issues:",
    "[b]🧠 Known Issues[/b]",
    "[b]Known issues:[/b]",
    "[h3]🧠 Known Issues[/h3]",
    "<h3>Known Issues</h3>",
    "- 🧠 Known Issues",
  ])(
    "keeps %s and its bullets out of change counts and highlights",
    (heading) => {
      const patch = parsePatchNotes(
        `[h3]Fixes[/h3][list][*]Fixed a crash.[/*][/list]\n${heading}\n[list][*]Crashes can still occur on exit.[/*][*]Increased damage is not applied yet.[/*][/list][h3]Audio[/h3][list][*]Improved footsteps.[/*][/list]`,
      );
      const issues = patch.sections[1];
      expect(issues?.title).toMatch(/^Known Issues$/i);
      expect(issues?.subjects[0]?.changes).toEqual([]);
      expect(issues?.subjects[0]?.context).toEqual([
        "Crashes can still occur on exit.",
        "Increased damage is not applied yet.",
      ]);
      const summary = summarizePatch(patch);
      expect(summary.counts).toEqual({
        new: 0,
        buff: 1,
        nerf: 0,
        adjusted: 0,
        fix: 1,
        removed: 0,
        note: 0,
      });
      expect(summary.groups.flatMap((group) => group.subjects)).toEqual([
        "Audio",
        "Fixes",
      ]);
      expect(summary.headline).toBe("1 buff and 1 fix across Fixes and Audio.");
      expect(summary.highlights).toEqual([
        "Audio: Improved footsteps.",
        "Fixes: Fixed a crash.",
      ]);
    },
  );

  it("does not classify a Known Issues-only post as changes", () => {
    const patch = parsePatchNotes(
      "🧠 Known Issues\n- Fixed damage values are not applied yet.",
    );
    const summary = summarizePatch(patch);
    expect(summary.counts.fix).toBe(0);
    expect(summary.groups).toEqual([]);
    expect(summary.highlights).toEqual([]);
    expect(summary.headline).toBe("A short update without itemised changes.");
  });
});

describe("Change classification", () => {
  it.each([
    ["Increased damage from 50 to 60", "buff"],
    ["Reduced reload time by 0.5s", "buff"],
    ["Increased cooldown from 8s to 10s", "nerf"],
    ["Decreased magazine size", "nerf"],
    ["Added a new map: Frost Peak", "new"],
    ["Fixed a crash on startup", "fix"],
    ["Removed the old tutorial", "removed"],
    ["Reworked the passive", "adjusted"],
    ["See you on the battlefield", "note"],
  ])("classifies %s as %s", (text, kind) => {
    expect(classifyChange(text)).toBe(kind);
  });

  it("groups subjects by their combined changes", () => {
    expect(subjectGroup([{ text: "", kind: "buff" }])).toBe("buff");
    expect(
      subjectGroup([
        { text: "", kind: "buff" },
        { text: "", kind: "nerf" },
      ]),
    ).toBe("adjusted");
    expect(subjectGroup([{ text: "", kind: "new" }])).toBe("new");
    expect(subjectGroup([{ text: "", kind: "fix" }])).toBe("fix");
  });
});

describe("Patch helpers and schemas", () => {
  it("reads versions from titles", () => {
    expect(patchVersion("Patch 1.17")).toBe("1.17");
    expect(patchVersion("Update v2.5.1 is live")).toBe("2.5.1");
    expect(patchVersion("Winter festival")).toBeNull();
  });

  it("validates patch inputs and AI summaries", () => {
    expect(
      PatchNotesInputSchema.safeParse({ steamAppId: 1, gid: "123456" }).success,
    ).toBe(true);
    expect(
      PatchNotesInputSchema.safeParse({ steamAppId: 1, gid: "../x" }).success,
    ).toBe(false);
    expect(
      AiPatchSummarySchema.safeParse({
        overview: "x",
        highlights: ["a"],
        subjects: [{ name: "A", group: "buff" }],
      }).success,
    ).toBe(true);
  });
});

describe("Flat 'Name: change' patch notes (Deadlock style)", () => {
  const flat = [
    "[p]- Healbane: Stacks now diminish 20% more aggressively[/p]",
    "[p]- Apollo: Riposte - Pommel Hit now also disarms the enemy[/p]",
    "[p]- Apollo: Riposte - T2 increased from +0.6s duration to +0.7s[/p]",
    "[p]- Baba: Spirit Resistance scaling reduced from 0.7 to 0.5[/p]",
    "[p]- Baba: Baba's Brew - Cooldown increased from 27s to 28s[/p]",
  ].join("");

  it("treats dash lines as changes and groups them by their name prefix", () => {
    const patch = parsePatchNotes(flat, "Minor Update - 11-04-2026");
    expect(patch.intro).toEqual([]);
    const subjects = patch.sections.flatMap((section) => section.subjects);
    expect(subjects.map((subject) => subject.name)).toEqual([
      "Healbane",
      "Apollo",
      "Baba",
    ]);
    const apollo = subjects.find((subject) => subject.name === "Apollo");
    expect(apollo?.changes.map((change) => change.text)).toEqual([
      "Riposte - Pommel Hit now also disarms the enemy",
      "Riposte - T2 increased from +0.6s duration to +0.7s",
    ]);
    expect(apollo?.group).toBe("buff");
    // More cooldown is worse, and less resistance scaling is a nerf.
    expect(subjects.find((subject) => subject.name === "Baba")?.group).toBe(
      "nerf",
    );
  });

  it("turns bold category labels into sections", () => {
    const patch = parsePatchNotes(
      [
        "[h3][b]Gameplay Update[/b][/h3][p]",
        "[b]General:[/b]",
        "- Mid-Boss: Health increased by 20%",
        "- Mid-Boss: Bounty reduced from 3000 to 1500",
        "- Mid-Boss: Roar now happens at 25% HP instead of 50%",
        "- Mid-Boss: Rejuvenator now drops as 3 crystals",
        "[b]Known issues:[/b]",
        "- Some masks clip through hats",
        "[/p]",
      ].join("\n"),
    );
    expect(patch.sections.map((section) => section.title)).toEqual([
      "General",
      "Known issues",
    ]);
    const subjects = patch.sections[0]?.subjects ?? [];
    const midBoss = subjects.find((subject) => subject.name === "Mid-Boss");
    expect(midBoss?.changes).toHaveLength(4);
    // Unresolved issues stay readable in their own section, outside changes.
    const issues = patch.sections[1]?.subjects[0];
    expect(issues?.changes).toEqual([]);
    expect(issues?.context).toEqual(["Some masks clip through hats"]);
  });

  it("leaves 'Label: sentence' lists alone when no name repeats", () => {
    const patch = parsePatchNotes(
      [
        "[h3]Fixes[/h3]",
        "- Crash: fixed a crash when joining",
        "- Audio: fixed missing footsteps",
        "- UI: fixed overlapping text",
        "- Netcode: improved reconnects",
      ].join("\n"),
    );
    expect(patch.sections[0]?.subjects).toHaveLength(1);
    expect(patch.sections[0]?.subjects[0]?.changes).toHaveLength(4);
  });
});

describe("Digest wording stays defensible", () => {
  it("doesn't call a change a buff from a comparative alone", () => {
    expect(classifyChange("Stacks now diminish 20% more aggressively")).toBe(
      "adjusted",
    );
    expect(classifyChange("Cooldown increased from 27s to 28s")).toBe("nerf");
    expect(classifyChange("Damage increased from 50 to 60")).toBe("buff");
  });

  it("counts items when a post has no section headings", () => {
    const summary = summarizePatch(
      parsePatchNotes(
        [
          "[p]- Apollo: Damage increased from 50 to 60[/p]",
          "[p]- Apollo: Range increased from 10m to 12m[/p]",
          "[p]- Baba: Damage reduced from 40 to 35[/p]",
          "[p]- Baba: Cooldown increased from 20s to 22s[/p]",
        ].join(""),
      ),
    );
    expect(summary.headline).toBe("2 buffs and 2 nerfs across 2 items.");
  });

  it("strips emoji from section names", () => {
    const patch = parsePatchNotes(
      "[h3]🔧 Fixes[/h3][list][*]Fixed a crash[/*][/list]",
    );
    expect(patch.sections[0]?.title).toBe("Fixes");
  });
});

describe("Deadlock-style wording", () => {
  it.each([
    ["Scorn - Heal from heroes increased from 1.2x to 1.3x", "buff"],
    [
      "Sand Blast - T2 slow from -24% Slow and -26% Dash distance to -28% for both",
      "adjusted",
    ],
    ["Radiant Daggers - Range reduced from 30m to 25m (moved to T2)", "nerf"],
    ["Lurking Terrors - Fear buildup time reduced from 2s to 1.75s", "buff"],
  ])("preserves the source wording and classifies %s as %s", (text, kind) => {
    const parsed = parsePatchNotes(`[list][*]${text}[/*][/list]`);
    expect(parsed.sections[0]?.subjects[0]?.changes).toEqual([{ text, kind }]);
    expect(classifyChange(text)).toBe(kind);
  });

  it.each(["buildup", "build-up", "build up"])(
    "treats longer %s time as a nerf and shorter time as a buff",
    (stat) => {
      expect(classifyChange(`Fear ${stat} time increased from 2s to 3s`)).toBe(
        "nerf",
      );
      expect(classifyChange(`Fear ${stat} time reduced from 2s to 1.75s`)).toBe(
        "buff",
      );
    },
  );

  it("treats a longer cycle time as a nerf, like a longer cooldown", () => {
    expect(
      classifyChange("Baba's Brew - Cycle time increased from 1.5s to 1.6s"),
    ).toBe("nerf");
    expect(classifyChange("Cast delay reduced from 0.4s to 0.3s")).toBe("buff");
  });

  it("labels new behaviour as a change rather than a note", () => {
    expect(
      classifyChange("Riposte - Pommel Hit now also disarms the enemy"),
    ).toBe("adjusted");
    expect(classifyChange("See you on the battlefield")).toBe("note");
  });
});

describe("classifyChange context notes", () => {
  it("treats a line that introduces values as a note", () => {
    expect(classifyChange("The correct values are:")).toBe("note");
  });

  it("treats context about an earlier patch as a note", () => {
    expect(
      classifyChange(
        "The Bushwacker changes in the previous patch were calculated incorrectly",
      ),
    ).toBe("note");
  });

  it("counts a value moved from one number to another as a change", () => {
    expect(
      classifyChange(
        "Sand Blast - T2 slow from -24% Slow and -26% Dash distance to -28% for both",
      ),
    ).toBe("adjusted");
  });

  it("still counts a change that leads with what was done", () => {
    expect(
      classifyChange("Reverted the recoil changes from the previous patch"),
    ).not.toBe("note");
    expect(classifyChange("Fixed a crash introduced in the last update")).toBe(
      "fix",
    );
  });
});
