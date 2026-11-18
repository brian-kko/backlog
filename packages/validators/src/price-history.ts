import { z } from "zod/v4";

import { toCents } from "./steam-compare";

export const PriceHistoryInputSchema = z.object({
  steamAppId: z.number().int().positive().max(2147483647),
  days: z.literal([30, 90, 365]),
});

const pricePointSchema = z.object({
  date: z.iso.date(),
  price: z.number().nonnegative(),
  storeId: z.string(),
});
export type PriceHistoryPoint = z.infer<typeof pricePointSchema>;

export const PriceHistoryOutputSchema = z.object({
  points: z.array(pricePointSchema),
  observedSince: z.iso.date().nullable(),
  allTimeLow: z
    .object({
      price: z.number().nonnegative(),
      date: z.iso.datetime(),
      source: z.literal("cheapshark"),
    })
    .nullable(),
  steps: z.array(pricePointSchema),
});

/** Keep the first observation and subsequent price changes in date order. */
export function priceHistorySteps(points: readonly PriceHistoryPoint[]) {
  let previousCents: number | undefined;
  return points.filter(({ price }) => {
    const cents = toCents(price);
    if (cents === previousCents) return false;
    previousCents = cents;
    return true;
  });
}
