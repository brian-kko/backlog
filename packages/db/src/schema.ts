import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, numeric, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  steamAppId: integer("steam_app_id").notNull().unique(),
  itadId: text("itad_id"),
  title: text("title").notNull(),
  headerImage: text("header_image").notNull(),
  currentBestPrice: numeric("current_best_price", { precision: 10, scale: 2 }).notNull(),
  bestStore: text("best_store").notNull(),
  historicalLow: numeric("historical_low", { precision: 10, scale: 2 }).notNull(),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
});

export const gameFeedItems = pgTable("game_feed_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  steamAppId: integer("steam_app_id").notNull(),
  externalGid: text("external_gid").notNull().unique(),
  category: text("category").notNull(), // 'patch_note' | 'event'
  title: text("title").notNull(),
  cleanSummary: text("clean_summary").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at").notNull(),
});

export const userBacklog = pgTable("user_backlog", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  steamAppId: integer("steam_app_id").notNull(),
  title: text("title").notNull(),
  isOwned: boolean("is_owned").default(false).notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }),
  targetPrice: numeric("target_price", { precision: 10, scale: 2 }),
  notifyPatches: boolean("notify_patches").default(true).notNull(),
  notifyEvents: boolean("notify_events").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("user_backlog_game_idx").on(t.userId, t.steamAppId),
]);

// Keep starter Post table temporarily so default UI screens compile cleanly
export const Post = pgTable("post", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  title: t.varchar({ length: 256 }).notNull(),
  content: t.text().notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp({ mode: "date", withTimezone: true })
    .$onUpdateFn(() => sql`now()`),
}));

export const CreatePostSchema = createInsertSchema(Post, {
  title: z.string().max(256),
  content: z.string().max(256),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export * from "./auth-schema";
