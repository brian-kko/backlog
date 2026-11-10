import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

import type { AiPatchSummary, ParsedPatch } from "@acme/validators";
import { AiPatchSummarySchema } from "@acme/validators";

// Premium-preview AI summaries. One request per patch post, cached in memory
// for the life of the server and shared by every viewer.
const cache = new Map<string, Promise<AiPatchSummary | null>>();
let client: Anthropic | null = null;

const SYSTEM = `You summarize video game patch notes for players deciding whether a patch matters to them.

Return:
- overview: 2-3 plain sentences on what the patch is about and who it affects most. No hype, no marketing tone.
- highlights: 3-6 short bullets, the changes a typical player would most want to know, most important first. Keep the game's own names for weapons, characters, items and modes.
- subjects: every named thing that changed (weapon, character, item, mode, map, or a system such as matchmaking), each with one group:
  buff (stronger or better for players), nerf (weaker or worse), adjusted (mixed or neutral rework), new (added content), system (broad gameplay/UI/performance changes), fix (bug fixes only).

Judge buffs and nerfs by the effect on the player, not the wording: a reduced cooldown is a buff, an increased cost is a nerf. Use only what the notes say.`;

/**
 * Summarizes a patch post with Claude. Returns null when the model declines
 * or the response can't be parsed, so the caller falls back to the free
 * rules-based summary.
 */
export function summarizePatchWithAi(
  key: string,
  input: { game: string; title: string; text: string; parsed: ParsedPatch },
) {
  const cached = cache.get(key);
  if (cached) return cached;
  const request = (async () => {
    // Reads ANTHROPIC_API_KEY (or another configured credential) itself.
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: {
        // Summarizing is a light task; low effort keeps it fast and cheap.
        effort: "low",
        format: betaZodOutputFormat(AiPatchSummarySchema),
      },
      // If the model declines, the API retries on a suitable fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Game: ${input.game}\nPost title: ${input.title}\n\n<patch_notes>\n${input.text}\n</patch_notes>`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    return response.parsed_output ?? null;
  })();
  cache.set(key, request);
  // Don't cache failures: the next viewer can retry.
  request.catch(() => cache.delete(key));
  void request.then((value) => {
    if (!value) cache.delete(key);
  });
  return request;
}
