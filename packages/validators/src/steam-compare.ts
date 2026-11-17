/**
 * How an offer compares with Steam's own price, in whole cents so that
 * floating-point dollars ($29.99 vs $29.98) can't flip the answer.
 */
export type SteamComparison =
  | { kind: "cheaper"; savingCents: number }
  | { kind: "same" }
  | { kind: "steam-cheaper"; extraCents: number };

export const toCents = (dollars: number) => Math.round(dollars * 100);

export function compareToSteam(
  price: number | null | undefined,
  steamPrice: number | null | undefined,
): SteamComparison | null {
  if (price == null || steamPrice == null) return null;
  const gap = toCents(steamPrice) - toCents(price);
  if (gap > 0) return { kind: "cheaper", savingCents: gap };
  if (gap === 0) return { kind: "same" };
  return { kind: "steam-cheaper", extraCents: -gap };
}
