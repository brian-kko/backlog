import { describe, expect, it } from "vitest";

import { compareToSteam, toCents } from "../steam-compare";

describe("compareToSteam", () => {
  it("counts a one-cent saving that floating point would lose", () => {
    expect(29.99 - 29.98 >= 0.01).toBe(false);
    expect(compareToSteam(29.98, 29.99)).toEqual({
      kind: "cheaper",
      savingCents: 1,
    });
  });

  it("treats equal prices as the same, not cheaper on either side", () => {
    expect(compareToSteam(59.99, 59.99)).toEqual({ kind: "same" });
    expect(compareToSteam(0.1 + 0.2, 0.3)).toEqual({ kind: "same" });
  });

  it("reports when Steam is cheaper", () => {
    expect(compareToSteam(1.5, 1.49)).toEqual({
      kind: "steam-cheaper",
      extraCents: 1,
    });
  });

  it("makes no claim without both prices", () => {
    expect(compareToSteam(null, 9.99)).toBeNull();
    expect(compareToSteam(9.99, undefined)).toBeNull();
  });

  it("rounds dollars to whole cents", () => {
    expect(toCents(19.995)).toBe(2000);
    expect(toCents(0.07)).toBe(7);
  });
});
