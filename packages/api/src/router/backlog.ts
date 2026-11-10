import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod/v4";

import { and, asc, eq, sql } from "@acme/db";
import { userBacklog } from "@acme/db/schema";
import {
  BacklogExportSchema,
  CollectionFeedInputSchema,
  DealItemSchema,
  cleanSteamText,
  GameSearchInputSchema,
  GameSearchResultSchema,
  parsePatchNotes,
  PatchNotesInputSchema,
  summarizePatch,
  SearchDealsInputSchema,
  SteamFeedInputSchema,
  UpsertBacklogItemSchema,
} from "@acme/validators";

import { catalogVerifiedAt } from "../curated-games";
import {
  fetchCollectionFeed,
  fetchDealsWithStatus,
  fetchGameMetadata,
  fetchGamePrices,
  fetchSteamFeed,
  fetchSteamPost,
  fetchSteamPrices,
  searchGames,
} from "../steam-discovery";
import { summarizePatchWithAi } from "../patch-ai";
import { protectedProcedure, publicProcedure } from "../trpc";

async function loadPatch(steamAppId: number, gid: string) {
  const result = await fetchSteamPost(steamAppId, gid);
  if (!result.available)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Steam news is unavailable right now.",
    });
  if (!result.post)
    throw new TRPCError({ code: "NOT_FOUND", message: "Post not found." });
  const post = result.post;
  return { post, parsed: parsePatchNotes(post.contents, post.title) };
}

export const backlogRouter = {
  getSteamFeed: publicProcedure
    .input(SteamFeedInputSchema)
    .query(async ({ input }) => {
      const feed = await fetchSteamFeed(input.steamAppId ?? 1091500);
      return {
        available: feed.available,
        patchNotes:
          input.category === "event"
            ? []
            : feed.patchNotes.slice(0, input.limit),
        events:
          input.category === "patch_note"
            ? []
            : feed.events.slice(0, input.limit),
      };
    }),

  searchGames: publicProcedure
    .input(GameSearchInputSchema)
    .output(
      z.object({
        source: z.enum(["steam", "catalog"]),
        results: z.array(GameSearchResultSchema),
      }),
    )
    .query(({ input }) => searchGames(input.query)),

  getCollectionFeed: publicProcedure
    .input(CollectionFeedInputSchema)
    .query(({ input }) => fetchCollectionFeed(input.steamAppIds, input.limit)),

  searchDeals: publicProcedure
    .input(SearchDealsInputSchema)
    .output(
      z.object({
        offers: z.array(DealItemSchema),
        /** False when stores were unreachable; offers are then saved ones. */
        live: z.boolean(),
        snapshotAt: z.string().nullable(),
      }),
    )
    .query(async ({ input }) => {
      const result = await fetchDealsWithStatus(input?.query, input);
      return {
        ...result,
        snapshotAt: result.live ? null : catalogVerifiedAt,
      };
    }),

  // Free for everyone: structured notes plus a rules-based summary.
  getPatchNotes: publicProcedure
    .input(PatchNotesInputSchema)
    .query(async ({ ctx, input }) => {
      const { post, parsed } = await loadPatch(input.steamAppId, input.gid);
      return {
        steamAppId: input.steamAppId,
        gid: post.gid,
        title: cleanSteamText(post.title),
        url: post.url,
        publishedAt: new Date(post.date * 1000),
        patch: parsed,
        summary: summarizePatch(parsed),
        /** The AI summary (premium preview) can be requested. */
        aiAvailable: ctx.features.patchAi,
      };
    }),

  // Premium preview: a Claude-written summary, one cached call per post.
  // TODO(premium tier): gate on the user's plan here.
  getPatchAiSummary: publicProcedure
    .input(PatchNotesInputSchema)
    .query(async ({ ctx, input }) => {
      if (!ctx.features.patchAi)
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "AI summaries aren't enabled on this server.",
        });
      const { post, parsed } = await loadPatch(input.steamAppId, input.gid);
      const summary = await summarizePatchWithAi(
        `${input.steamAppId}:${post.gid}`,
        {
          game: post.feedlabel ?? `Steam app ${input.steamAppId}`,
          title: cleanSteamText(post.title),
          text: cleanSteamText(post.contents),
          parsed,
        },
      );
      if (!summary)
        throw new TRPCError({
          code: "UNPROCESSABLE_CONTENT",
          message: "Couldn't summarize this post.",
        });
      return summary;
    }),

  getSteamPrices: publicProcedure
    .input(
      z.object({
        steamAppIds: z.array(z.number().int().positive().max(2147483647)).max(60),
      }),
    )
    .query(({ input }) => fetchSteamPrices(input.steamAppIds)),

  getGamePrices: publicProcedure
    .input(
      z.object({ steamAppId: z.number().int().positive().max(2147483647) }),
    )
    .query(async ({ input }) => ({
      prices: await fetchGamePrices(input.steamAppId),
    })),

  removeBacklogItem: protectedProcedure
    .input(
      z.object({ steamAppId: z.number().int().positive().max(2147483647) }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userBacklog)
        .where(
          and(
            eq(userBacklog.userId, ctx.session.user.id),
            eq(userBacklog.steamAppId, input.steamAppId),
          ),
        );
      return { removed: input.steamAppId };
    }),

  getGameDetails: publicProcedure
    .input(
      z.object({ steamAppId: z.number().int().positive().max(2147483647) }),
    )
    .query(async ({ input }) => {
      const metadata = fetchGameMetadata(input.steamAppId);
      const [feed, game, prices] = await Promise.all([
        fetchSteamFeed(input.steamAppId),
        metadata,
        fetchGamePrices(input.steamAppId, metadata),
      ]);
      return {
        steamAppId: input.steamAppId,
        feed,
        metadata: game,
        prices,
      };
    }),

  getBacklog: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select()
      .from(userBacklog)
      .where(eq(userBacklog.userId, ctx.session.user.id))
      .orderBy(asc(userBacklog.title));
    return items.map((item) => ({
      ...item,
      amountPaid: item.amountPaid === null ? null : Number(item.amountPaid),
      targetPrice: item.targetPrice === null ? null : Number(item.targetPrice),
    }));
  }),

  // Moves guest games into an account without overwriting games it already has.
  importGuestItems: protectedProcedure
    .input(BacklogExportSchema)
    .mutation(async ({ ctx, input }) => {
      if (!input.items.length) return { added: 0, skipped: 0 };
      const added = await ctx.db
        .insert(userBacklog)
        .values(
          input.items.map((item) => ({
            ...item,
            userId: ctx.session.user.id,
            amountPaid: item.amountPaid?.toFixed(2) ?? null,
            targetPrice: item.targetPrice?.toFixed(2) ?? null,
            completionStatus: item.completionStatus ?? "backlog",
            notifyPatches: item.notifyPatches ?? true,
            notifyEvents: item.notifyEvents ?? true,
          })),
        )
        .onConflictDoNothing({
          target: [userBacklog.userId, userBacklog.steamAppId],
        })
        .returning({ steamAppId: userBacklog.steamAppId });
      return {
        added: added.length,
        skipped: input.items.length - added.length,
      };
    }),

  importBacklogJson: protectedProcedure
    .input(BacklogExportSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        for (const item of input.items) {
          const values = {
            ...item,
            amountPaid: item.amountPaid?.toFixed(2) ?? null,
            targetPrice: item.targetPrice?.toFixed(2) ?? null,
            completionStatus: item.completionStatus ?? "backlog",
            notifyPatches: item.notifyPatches ?? true,
            notifyEvents: item.notifyEvents ?? true,
          };
          await tx
            .insert(userBacklog)
            .values({ ...values, userId: ctx.session.user.id })
            .onConflictDoUpdate({
              target: [userBacklog.userId, userBacklog.steamAppId],
              set: values,
            });
        }
      });
      return { imported: input.items.length };
    }),

  getBacklogStats: protectedProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        totalSpent: sql<string>`coalesce(sum(${userBacklog.amountPaid}) filter (where ${userBacklog.isOwned}), 0)`,
        ownedCount:
          sql<number>`count(*) filter (where ${userBacklog.isOwned})`.mapWith(
            Number,
          ),
        wishlistedCount:
          sql<number>`count(*) filter (where not ${userBacklog.isOwned})`.mapWith(
            Number,
          ),
      })
      .from(userBacklog)
      .where(eq(userBacklog.userId, ctx.session.user.id));
    return {
      totalSpent: Number(stats?.totalSpent ?? 0),
      ownedCount: stats?.ownedCount ?? 0,
      wishlistedCount: stats?.wishlistedCount ?? 0,
    };
  }),

  upsertBacklogItem: protectedProcedure
    .input(UpsertBacklogItemSchema)
    .mutation(async ({ ctx, input }) => {
      // Undefined fields stay unchanged on conflict; null explicitly clears a price.
      const values = {
        ...input,
        amountPaid:
          input.amountPaid == null
            ? input.amountPaid
            : input.amountPaid.toFixed(2),
        targetPrice:
          input.targetPrice == null
            ? input.targetPrice
            : input.targetPrice.toFixed(2),
      };
      const [item] = await ctx.db
        .insert(userBacklog)
        .values({ ...values, userId: ctx.session.user.id })
        .onConflictDoUpdate({
          target: [userBacklog.userId, userBacklog.steamAppId],
          set: values,
        })
        .returning();
      return item;
    }),

  exportBacklogJson: protectedProcedure
    .output(BacklogExportSchema)
    .query(async ({ ctx }) => {
      const items = await ctx.db
        .select({
          steamAppId: userBacklog.steamAppId,
          title: userBacklog.title,
          isOwned: userBacklog.isOwned,
          amountPaid: userBacklog.amountPaid,
          targetPrice: userBacklog.targetPrice,
          completionStatus: userBacklog.completionStatus,
          notifyPatches: userBacklog.notifyPatches,
          notifyEvents: userBacklog.notifyEvents,
          purchaseStore: userBacklog.purchaseStore,
          platform: userBacklog.platform,
        })
        .from(userBacklog)
        .where(eq(userBacklog.userId, ctx.session.user.id))
        .orderBy(asc(userBacklog.steamAppId));
      return {
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        items: items.map((item) => ({
          ...item,
          amountPaid:
            item.amountPaid === null ? undefined : Number(item.amountPaid),
          targetPrice:
            item.targetPrice === null ? undefined : Number(item.targetPrice),
          purchaseStore: item.purchaseStore ?? undefined,
          platform: item.platform ?? undefined,
        })),
      };
    }),
} satisfies TRPCRouterRecord;
