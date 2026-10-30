import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { and, asc, eq, sql } from "@acme/db";
import { userBacklog } from "@acme/db/schema";
import {
  BacklogExportSchema,
  DealItemSchema,
  SearchDealsInputSchema,
  SteamFeedInputSchema,
  UpsertBacklogItemSchema,
} from "@acme/validators";

import {
  fetchDeals,
  fetchGameMetadata,
  fetchGamePrices,
  fetchSteamFeed,
} from "../steam-discovery";
import { protectedProcedure, publicProcedure } from "../trpc";

export const backlogRouter = {
  getSteamFeed: publicProcedure
    .input(SteamFeedInputSchema)
    .query(async ({ input }) => {
      const feed = await fetchSteamFeed(input.steamAppId ?? 1091500);
      return {
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

  searchDeals: publicProcedure
    .input(SearchDealsInputSchema)
    .output(z.array(DealItemSchema))
    .query(({ input }) => fetchDeals(input?.query, input)),

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
        })),
      };
    }),
} satisfies TRPCRouterRecord;
