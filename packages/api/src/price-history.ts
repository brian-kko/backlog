import type { db as database } from "@acme/db/client";
import type { PriceHistoryPoint } from "@acme/validators";
import { and, between, eq, sql } from "@acme/db";
import { priceSnapshots } from "@acme/db/schema";
import { toCents } from "@acme/validators";

interface PriceObservation {
  storeID: string;
  price: number;
  retailPrice: number;
  source: (typeof priceSnapshots.$inferInsert)["source"];
}

export async function recordPriceSnapshots(
  steamAppId: number,
  verifiedAt: string,
  observations: readonly PriceObservation[],
) {
  if (!process.env.POSTGRES_URL || !observations.length) return;

  try {
    const { db } = await import("@acme/db/client");
    const byStore = new Map<string, PriceObservation>();
    for (const observation of observations) {
      const previous = byStore.get(observation.storeID);
      if (!previous || toCents(observation.price) < toCents(previous.price))
        byStore.set(observation.storeID, observation);
    }
    // Overlapping batches acquire row locks in the same order.
    const stores = [...byStore.values()].sort((a, b) =>
      a.storeID.localeCompare(b.storeID),
    );
    await db
      .insert(priceSnapshots)
      .values(
        stores.map((offer) => ({
          steamAppId,
          storeId: offer.storeID,
          price: (toCents(offer.price) / 100).toFixed(2),
          regularPrice: (toCents(offer.retailPrice) / 100).toFixed(2),
          source: offer.source,
          observedOn: verifiedAt.slice(0, 10),
        })),
      )
      .onConflictDoUpdate({
        target: [
          priceSnapshots.steamAppId,
          priceSnapshots.storeId,
          priceSnapshots.observedOn,
        ],
        set: {
          price: sql`excluded.price`,
          regularPrice: sql`excluded.regular_price`,
          source: sql`excluded.source`,
        },
        setWhere: sql`excluded.price < ${priceSnapshots.price}`,
      });
  } catch {
    // Snapshot writes are optional in guest and database-free environments.
  }
}

export async function getObservedPriceHistory(
  db: typeof database | undefined,
  steamAppId: number,
  days: number,
): Promise<{ points: PriceHistoryPoint[]; observedSince: string | null }> {
  const empty = { points: [], observedSince: null };
  if (!db) return empty;

  const start = new Date();
  const today = start.toISOString().slice(0, 10);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const firstDay = start.toISOString().slice(0, 10);

  try {
    const app = eq(priceSnapshots.steamAppId, steamAppId);
    const [rows, [first]] = await Promise.all([
      db
        .selectDistinctOn([priceSnapshots.observedOn], {
          date: priceSnapshots.observedOn,
          price: priceSnapshots.price,
          storeId: priceSnapshots.storeId,
        })
        .from(priceSnapshots)
        .where(and(app, between(priceSnapshots.observedOn, firstDay, today)))
        .orderBy(
          priceSnapshots.observedOn,
          priceSnapshots.price,
          priceSnapshots.storeId,
        ),
      db
        .select({ date: priceSnapshots.observedOn })
        .from(priceSnapshots)
        .where(app)
        .orderBy(priceSnapshots.observedOn)
        .limit(1),
    ]);
    return {
      points: rows.map((row) => ({ ...row, price: Number(row.price) })),
      observedSince: first?.date ?? rows[0]?.date ?? null,
    };
  } catch {
    return empty;
  }
}
