import { z } from "zod/v4";

export const SteamMatchSchema = z.object({
  steamAppId: z.number().int().positive().max(2147483647),
  packageId: z.number().int().positive().optional(),
  price: z.number().nonnegative(),
  matchedBy: z.enum(["title", "edition-package"]),
});
export type SteamMatch = z.infer<typeof SteamMatchSchema>;

export function normalizeEditionTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/[™®'’]/gu, "")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && word !== "the")
    .join(" ");
}

export function baseTitle(normalized: string) {
  return normalized.replace(
    /(?:^| )(?:(?:digital deluxe|game of (?:the )?year|deluxe|gold|ultimate|definitive|complete|goty|premium|legendary|standard)(?: edition)?|edition)$/u,
    "",
  );
}

export function normalizeSteamPackageTitle(optionText: string) {
  return normalizeEditionTitle(
    optionText.replace(/\s+-\s+\$[\d,]+(?:\.\d{2})?(?:\s+USD)?\s*$/iu, ""),
  );
}

export function isExactEditionMatch(offerTitle: string, steamTitle: string) {
  const title = normalizeEditionTitle(offerTitle);
  return title.length > 0 && title === normalizeEditionTitle(steamTitle);
}
