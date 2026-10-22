import { describe, expect, it } from "vitest";

import {
  BacklogExportSchema,
  classifyAndCleanSteamNews,
  evaluateDealAlert,
} from "../backlog-parser";

describe("Backlog - Steam Feed & Deal Engine", () => {
  it("strips Steam BBCode tags and classifies hotfixes as patch_note", () => {
    const res = classifyAndCleanSteamNews({
      title: "Hotfix v1.04 - Balance Changes",
      contents:
        "[h1]Notes[/h1] [*] Fixed crash on startup [url=https://steam.com]Details[/url]",
    });
    expect(res.category).toBe("patch_note");
    expect(res.cleanSummary).toBe("Notes Fixed crash on startup Details");
  });

  it("suppresses deal alerts for games already owned in the user's backlog", () => {
    const alert = evaluateDealAlert({
      isOwned: true,
      currentPrice: 9.99,
      targetPrice: 15.0,
      historicalLow: 9.99,
    });
    expect(alert.shouldAlert).toBe(false);
  });

  it("validates exported/imported Backlog JSON backups against corruption", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      items: [
        {
          steamAppId: 1091500,
          title: "Cyberpunk 2077",
          isOwned: false,
          targetPrice: 24.99,
        },
      ],
    };
    expect(BacklogExportSchema.safeParse(payload).success).toBe(true);
  });
});
