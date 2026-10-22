import { z } from "zod/v4";

export const BacklogExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  items: z.array(
    z.object({
      steamAppId: z.number().int().positive(),
      title: z.string().min(1),
      isOwned: z.boolean(),
      amountPaid: z.number().min(0).optional(),
      targetPrice: z.number().min(0).optional(),
    }),
  ),
});

export function classifyAndCleanSteamNews(item: {
  title: string;
  contents: string;
  tags?: string[];
}): { category: "patch_note" | "event" | "general"; cleanSummary: string } {
  const cleanSummary = item.contents
    .replace(/\[\/?[a-z0-9=*#"&\s\-_:/\.]+?\]/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);

  const isPatch =
    item.tags?.includes("patchnotes") ||
    /\b(patch|hotfix|update|changelog|balance|bug\s*fixes|v\d+\.\d+)\b/i.test(
      item.title,
    );

  if (isPatch) return { category: "patch_note", cleanSummary };

  const isEvent =
    /\b(event|double\s*xp|free\s*weekend|season|tournament|drops|raid|festival|limited\s*time)\b/i.test(
      item.title,
    );

  if (isEvent) return { category: "event", cleanSummary };

  return { category: "general", cleanSummary };
}

export function evaluateDealAlert(params: {
  isOwned: boolean;
  currentPrice: number;
  targetPrice: number | null;
  historicalLow: number;
}): { shouldAlert: boolean; reason: "TARGET_MET" | "ALL_TIME_LOW" | null } {
  if (params.isOwned) return { shouldAlert: false, reason: null };
  if (params.targetPrice !== null && params.currentPrice <= params.targetPrice) {
    return { shouldAlert: true, reason: "TARGET_MET" };
  }
  if (params.currentPrice > 0 && params.currentPrice <= params.historicalLow) {
    return { shouldAlert: true, reason: "ALL_TIME_LOW" };
  }
  return { shouldAlert: false, reason: null };
}
