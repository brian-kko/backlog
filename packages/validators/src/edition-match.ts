import { z } from "zod/v4";

export const SteamMatchSchema = z.object({
  steamAppId: z.number().int().positive().max(2147483647),
  price: z.number().nonnegative(),
  matchedBy: z.literal("title"),
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

export function isExactEditionMatch(offerTitle: string, steamTitle: string) {
  const title = normalizeEditionTitle(offerTitle);
  return title.length > 0 && title === normalizeEditionTitle(steamTitle);
}
