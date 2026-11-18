import { describe, expect, it } from "vitest";

import {
  isExactEditionMatch,
  normalizeEditionTitle,
  SteamMatchSchema,
} from "../edition-match";

describe("normalizeEditionTitle", () => {
  it("strips punctuation, trademarks and standalone articles", () => {
    expect(
      normalizeEditionTitle(
        "  The   Witcher® 3:Wild Hunt™ — Complete Edition ",
      ),
    ).toBe("witcher 3 wild hunt complete edition");
    expect(normalizeEditionTitle("Baldur’s Gate™ 3")).toBe("baldurs gate 3");
    expect(normalizeEditionTitle("Theater of the Night")).toBe(
      "theater of night",
    );
  });

  it.each(["Deluxe", "Gold", "Ultimate", "Definitive", "Complete", "GOTY"])(
    "retains the %s edition label",
    (edition) => {
      expect(normalizeEditionTitle(`Example (${edition})`)).toBe(
        `example ${edition.toLowerCase()}`,
      );
    },
  );

  it("retains the full Game of the Year label after article removal", () => {
    expect(normalizeEditionTitle("Example: Game of the Year Edition")).toBe(
      "example game of year edition",
    );
  });
});

describe("isExactEditionMatch", () => {
  it("accepts the same edition with different punctuation and case", () => {
    expect(
      isExactEditionMatch("The Example™: Deluxe", "EXAMPLE – Deluxe"),
    ).toBe(true);
  });

  it("requires all edition words to match", () => {
    expect(isExactEditionMatch("Example", "Example Deluxe")).toBe(false);
    expect(isExactEditionMatch("Example Deluxe", "Example Gold")).toBe(false);
    expect(
      isExactEditionMatch("Example GOTY", "Example Game of the Year"),
    ).toBe(false);
  });

  it("rejects titles with no words left", () => {
    expect(isExactEditionMatch("The®", "™")).toBe(false);
  });
});

describe("SteamMatchSchema", () => {
  it("accepts a title match with a confirmed free price", () => {
    expect(
      SteamMatchSchema.safeParse({
        steamAppId: 730,
        price: 0,
        matchedBy: "title",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown price or match method", () => {
    expect(
      SteamMatchSchema.safeParse({
        steamAppId: 730,
        price: null,
        matchedBy: "title",
      }).success,
    ).toBe(false);
    expect(
      SteamMatchSchema.safeParse({
        steamAppId: 730,
        price: 10,
        matchedBy: "fuzzy",
      }).success,
    ).toBe(false);
  });
});
