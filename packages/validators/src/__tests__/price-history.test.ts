import { describe, expect, it } from "vitest";

import {
  PriceHistoryInputSchema,
  PriceHistoryOutputSchema,
  priceHistorySteps,
} from "../price-history";

describe("priceHistorySteps", () => {
  it("keeps the first observation and changes in either direction without filling gaps", () => {
    const points = [
      { date: "2026-11-01", price: 20, storeId: "1" },
      { date: "2026-11-02", price: 20, storeId: "2" },
      { date: "2026-11-06", price: 19.99, storeId: "2" },
      { date: "2026-11-09", price: 19.99, storeId: "1" },
      { date: "2026-11-12", price: 20, storeId: "1" },
    ];
    expect(priceHistorySteps(points)).toEqual([
      points[0],
      points[2],
      points[4],
    ]);
  });

  it("compares in cents and keeps a verified free price", () => {
    const points = [
      { date: "2026-11-01", price: 0.1 + 0.2, storeId: "1" },
      { date: "2026-11-02", price: 0.3, storeId: "2" },
      { date: "2026-11-03", price: 0, storeId: "1" },
    ];
    expect(priceHistorySteps(points)).toEqual([points[0], points[2]]);
    expect(priceHistorySteps([])).toEqual([]);
  });
});

describe("PriceHistoryInputSchema", () => {
  it.each([30, 90, 365])("accepts the %d-day window", (days) => {
    expect(
      PriceHistoryInputSchema.safeParse({ steamAppId: 730, days }).success,
    ).toBe(true);
  });

  it("rejects unsupported windows and IDs", () => {
    expect(
      PriceHistoryInputSchema.safeParse({ steamAppId: 730, days: 31 }).success,
    ).toBe(false);
    expect(
      PriceHistoryInputSchema.safeParse({ steamAppId: -1, days: 30 }).success,
    ).toBe(false);
  });
});

describe("PriceHistoryOutputSchema", () => {
  it("accepts empty history and a dated CheapShark low", () => {
    const empty = {
      points: [],
      observedSince: null,
      allTimeLow: null,
      steps: [],
    };
    expect(PriceHistoryOutputSchema.safeParse(empty).success).toBe(true);
    const point = { date: "2026-11-08", price: 10, storeId: "1" };
    expect(
      PriceHistoryOutputSchema.safeParse({
        points: [point],
        observedSince: "2026-11-08",
        allTimeLow: {
          price: 8,
          date: "2026-08-08T00:00:00.000Z",
          source: "cheapshark",
        },
        steps: [point],
      }).success,
    ).toBe(true);
  });

  it("rejects a saved catalog low as all-time history", () => {
    expect(
      PriceHistoryOutputSchema.safeParse({
        points: [],
        observedSince: null,
        allTimeLow: {
          price: 8,
          date: "2026-08-08T00:00:00.000Z",
          source: "catalog",
        },
        steps: [],
      }).success,
    ).toBe(false);
  });
});
