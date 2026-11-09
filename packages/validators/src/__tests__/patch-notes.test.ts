import { describe, expect, it } from "vitest";

import {
  AiPatchSummarySchema,
  classifyChange,
  parsePatchNotes,
  patchVersion,
  PatchNotesInputSchema,
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
