"use client";

import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import { evaluateDealAlert } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { useBacklog } from "~/components/backlog-provider";
import {
  GameArt,
  GameLink,
  money,
  PageHeading,
  PriceField,
  RemoveGameButton,
} from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";

type Prices = RouterOutputs["backlog"]["getGameDetails"]["prices"];
function alertFor(item: BacklogItem, prices: Prices | undefined) {
  return prices?.currentPrice == null
    ? { shouldAlert: false, reason: null }
    : evaluateDealAlert({
        isOwned: item.isOwned,
        currentPrice: prices.currentPrice,
        targetPrice: item.targetPrice ?? null,
        historicalLow: prices.historicalLow ?? -1,
      });
}

function WatchCard({
  item,
  prices,
  pending,
}: {
  item: BacklogItem;
  prices: Prices | undefined;
  pending: boolean;
}) {
  const { save } = useBacklog();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const alert = alertFor(item, prices);
  async function update(change: Partial<BacklogItem>) {
    setSaving(true);
    try {
      await save({
        steamAppId: item.steamAppId,
        title: item.title,
        isOwned: false,
        ...change,
      });
      setMessage("Price watch updated.");
    } catch {
      setMessage("Unable to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="game-card">
      <GameArt appId={item.steamAppId} title={item.title} />
      <div className="space-y-5 p-5">
        <h2 className="text-xl font-semibold">{item.title}</h2>
        <span className="watch-state" data-alert-state={alert.reason ?? "WAIT"}>
          {alert.reason === "ALL_TIME_LOW"
            ? "All-time low"
            : alert.reason === "TARGET_MET"
              ? "Target met"
              : "Watching for a drop"}
        </span>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Current Best Price ($)</dt>
            <dd className="mt-1 text-xl font-semibold">
              {pending ? "Loading…" : money(prices?.currentPrice)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Historical Low ($)</dt>
            <dd className="mt-1 text-xl font-semibold">
              {pending
                ? "Loading…"
                : prices?.historicalLow == null
                  ? "Not recorded"
                  : money(prices.historicalLow)}
            </dd>
          </div>
        </dl>
        {prices?.source === "catalog" && (
          <p className="text-sm text-amber-500">
            Cached USD prices · checked {prices.verifiedAt?.slice(0, 10)}.
            Confirm at the store.
          </p>
        )}
        <PriceField
          label="Your Target Price ($)"
          ariaLabel={`Target price for ${item.title}`}
          value={item.targetPrice}
          onSave={(targetPrice) => update({ targetPrice })}
        />
        <div className="space-y-3">
          {(["notifyPatches", "notifyEvents"] as const).map((field) => (
            <label
              key={field}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span>
                {field === "notifyPatches"
                  ? "Notify on Patch Notes"
                  : "Notify on Live Events"}
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={`${field === "notifyPatches" ? "Notify on Patch Notes" : "Notify on Live Events"} for ${item.title}`}
                checked={item[field] ?? true}
                disabled={saving}
                onChange={(event) =>
                  void update({ [field]: event.target.checked })
                }
                className="h-5 w-5 accent-emerald-500"
              />
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-5">
          <GameLink steamAppId={item.steamAppId} />
          <button
            className="action secondary"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await save({
                  steamAppId: item.steamAppId,
                  title: item.title,
                  isOwned: true,
                });
              } catch {
                setMessage("Couldn’t move the game to your library.");
              } finally {
                setSaving(false);
              }
            }}
          >
            Mark Owned
          </button>
          <RemoveGameButton steamAppId={item.steamAppId} title={item.title} />
          <a
            className="text-link"
            href={
              prices?.deals[0]?.url ??
              `https://store.steampowered.com/app/${item.steamAppId}`
            }
            target="_blank"
            rel="noreferrer"
          >
            View store deal ↗
          </a>
        </div>
        {!pending && prices?.currentPrice == null && (
          <p className="text-muted-foreground text-sm">
            Live pricing is unavailable. Your target and notification
            preferences are saved.
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default function WishlistPage() {
  const { items, isGuest, isDemo, isLoading, error } = useBacklog();
  const trpc = useTRPC();
  const wishlist = items.filter((item) => !item.isOwned);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("title");
  const prices = useQueries({
    queries: wishlist.map((item) =>
      trpc.backlog.getGamePrices.queryOptions(
        { steamAppId: item.steamAppId },
        { retry: false },
      ),
    ),
  });
  const visible = wishlist
    .map((item, index) => ({ item, price: prices[index] }))
    .filter(({ item }) =>
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price"
        ? (a.price?.data?.prices?.currentPrice ?? Infinity) -
          (b.price?.data?.prices?.currentPrice ?? Infinity)
        : sort === "target"
          ? (a.price?.data?.prices?.currentPrice ?? Infinity) -
            (a.item.targetPrice ?? 0) -
            ((b.price?.data?.prices?.currentPrice ?? Infinity) -
              (b.item.targetPrice ?? 0))
          : a.item.title.localeCompare(b.item.title),
    );
  const alertCount = wishlist.filter(
    (item, index) => alertFor(item, prices[index]?.data?.prices).shouldAlert,
  ).length;
  return (
    <main className="page-shell">
      <PageHeading eyebrow="PRICE WATCH" title="Your wishlist">
        Track prices and set a target for the games you want.
      </PageHeading>
      <aside className="guest-banner">
        <div>
          <strong>{alertCount} games meet a target or all-time low</strong>
          <p>
            {isGuest
              ? isDemo
                ? "Starter watchlist · preferences stay in this browser. "
                : "Your watchlist and preferences stay in this browser. "
              : "Notification preferences are saved to your account. "}
            Automatic notification delivery is coming in a future milestone.
          </p>
        </div>
      </aside>
      <div className="collection-search">
        <label className="field-label">
          Find in your wishlist
          <input
            type="search"
            disabled={isLoading}
            className="form-control mt-2 w-full"
            placeholder="Game title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field-label">
          Sort wishlist
          <select
            className="form-control mt-2 w-full"
            value={sort}
            disabled={isLoading}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="title">Title A–Z</option>
            <option value="price">Lowest price</option>
            <option value="target">Closest to target</option>
          </select>
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      {isLoading ? (
        <p role="status">Loading your wishlist…</p>
      ) : visible.length ? (
        <section
          aria-label="Price watches"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {visible.map(({ item, price }) => (
            <WatchCard
              key={item.steamAppId}
              item={item}
              prices={price?.data?.prices}
              pending={price?.isPending ?? false}
            />
          ))}
        </section>
      ) : (
        <p className="empty-state">
          {wishlist.length
            ? "No games match your search."
            : "Your wishlist is empty. Add a game from Deals to start watching its price."}
        </p>
      )}
    </main>
  );
}
