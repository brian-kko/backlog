import { describe, expect, it } from "vitest";

import {
  baseTitle,
  isExactEditionMatch,
  normalizeEditionTitle,
  normalizeSteamPackageTitle,
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

describe("baseTitle", () => {
  it.each([
    "deluxe edition",
    "gold",
    "ultimate edition",
    "definitive edition",
    "complete",
    "game of year edition",
    "goty",
    "premium edition",
    "legendary",
    "standard edition",
    "digital deluxe edition",
    "edition",
  ])("removes the trailing %s label", (label) => {
    expect(baseTitle(`need for speed heat ${label}`)).toBe(
      "need for speed heat",
    );
  });

  it("preserves words within the base title", () => {
    expect(baseTitle("ultimate chicken horse deluxe edition")).toBe(
      "ultimate chicken horse",
    );
    expect(baseTitle("ultimate chicken horse")).toBe("ultimate chicken horse");
  });
});

describe("normalizeSteamPackageTitle", () => {
  it("removes a trailing USD price and ignores trademarks", () => {
    expect(
      normalizeSteamPackageTitle(
        "Need for Speed™ Heat Deluxe Edition - $69.99",
      ),
    ).toBe("need for speed heat deluxe edition");
    expect(normalizeSteamPackageTitle("Example® Edition - $1,299.99")).toBe(
      "example edition",
    );
    expect(normalizeSteamPackageTitle("Example - $5.00 Bonus Edition")).toBe(
      "example 5 00 bonus edition",
    );
  });

  it.each(["Deluxe", "Standard", "Ultimate"])(
    "matches a %s package only to the same edition",
    (edition) => {
      const packageTitle = normalizeSteamPackageTitle(
        `Need for Speed™ Heat ${edition} Edition - $69.99`,
      );
      expect(
        ["Deluxe", "Standard", "Ultimate"].filter(
          (offerEdition) =>
            normalizeEditionTitle(
              `Need for Speed Heat ${offerEdition} Edition`,
            ) === packageTitle,
        ),
      ).toEqual([edition]);
    },
  );
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

  it("preserves the package identity and USD price of an edition match", () => {
    const match = {
      steamAppId: 1222680,
      packageId: 432906,
      price: 69.99,
      matchedBy: "edition-package",
    };
    expect(SteamMatchSchema.parse(match)).toEqual(match);
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
