"use client";

import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import { evaluateDealAlert } from "@acme/validators";

import type { BacklogItem } from "./backlog-provider";
import { useTRPC } from "~/trpc/react";
import { money, storeName } from "./game-ui";

export type Prices = NonNullable<
  RouterOutputs["backlog"]["getGamePrices"]["prices"]
>;

/**
 * How much to trust a price:
 * - live: compared across stores just now
 * - steam-only: only Steam's own price could be checked
 * - cached: a saved catalog price, possibly stale
 * - unavailable / checking: no usable price yet
 */
export type PriceState =
  | "checking"
  | "live"
  | "steam-only"
  | "cached"
  | "unavailable";
export type AlertState = "ALL_TIME_LOW" | "TARGET_MET" | "WAIT" | null;

export function priceState(
  prices: Prices | null | undefined,
  pending: boolean,
): PriceState {
  if (pending) return "checking";
  if (prices?.currentPrice == null) return "unavailable";
  return prices.source === "cheapshark"
    ? "live"
    : prices.source === "steam"
      ? "steam-only"
      : "cached";
}

export function alertFor(
  item: BacklogItem,
  prices: Prices | null | undefined,
): AlertState {
  if (prices?.currentPrice == null) return null;
  const result = evaluateDealAlert({
    isOwned: item.isOwned,
    currentPrice: prices.currentPrice,
    targetPrice: item.targetPrice ?? null,
    // "Lowest ever" needs live price history; a saved catalog low can't
    // support that claim, though targets still count.
    historicalLow:
      prices.historicalLowSource === "cheapshark"
        ? (prices.historicalLow ?? -1)
        : -1,
  });
  return result.reason ?? "WAIT";
}

/** Prices for each wishlist game. Only fresh prices count as alerts. */
export function useWishlistPrices(items: BacklogItem[]) {
  const trpc = useTRPC();
  const wishlist = items.filter((item) => !item.isOwned);
  const queries = useQueries({
    queries: wishlist.map((item) =>
      trpc.backlog.getGamePrices.queryOptions(
        { steamAppId: item.steamAppId },
        { retry: false, staleTime: 5 * 60 * 1000 },
      ),
    ),
  });
  const rows = wishlist.map((item, index) => {
    const query = queries[index];
    const prices = query?.data?.prices ?? undefined;
    // Offline queries pause rather than fail; treat them as unavailable.
    const state = priceState(
      prices,
      (query?.isPending ?? false) && query?.fetchStatus !== "paused",
    );
    return {
      item,
      prices,
      state,
      alert: state === "checking" ? null : alertFor(item, prices),
    };
  });
  const verified = (row: (typeof rows)[number]) =>
    row.state === "live" || row.state === "steam-only";
  return {
    rows,
    pending: queries.some(
      (query) => query.isPending && query.fetchStatus !== "paused",
    ),
    offline: queries.some((query) => query.fetchStatus === "paused"),
    refreshing: queries.some((query) => query.isFetching),
    /** Most recent check that reached live stores, in ms. */
    checkedAt: Math.max(
      0,
      ...queries.map((query) =>
        query.data?.prices?.source === "cheapshark" ? query.dataUpdatedAt : 0,
      ),
    ),
    refresh: () => Promise.all(queries.map((query) => query.refetch())),
    alerts: rows.filter(
      (row) =>
        verified(row) &&
        (row.alert === "ALL_TIME_LOW" || row.alert === "TARGET_MET"),
    ),
    unchecked: rows.filter(
      (row) => row.state === "unavailable" || row.state === "cached",
    ),
  };
}

export function AlertBadge({
  state,
  alert,
}: {
  state: PriceState;
  alert: AlertState;
}) {
  const label =
    state === "checking"
      ? "Checking prices…"
      : state === "unavailable"
        ? "Price unavailable"
        : alert === "ALL_TIME_LOW"
          ? "Lowest ever"
          : alert === "TARGET_MET"
            ? "Target met"
            : "Waiting for a drop";
  const stale =
    state === "cached" && (alert === "ALL_TIME_LOW" || alert === "TARGET_MET");
  return (
    <span
      className="watch-state"
      data-alert-state={
        state === "checking" || state === "unavailable"
          ? "UNKNOWN"
          : (alert ?? "WAIT")
      }
      data-stale={stale || undefined}
    >
      {label}
      {stale ? " (last known price)" : ""}
    </span>
  );
}

/** Cheapest offer and how confident we are in it. */
export function bestOffer(prices: Prices | null | undefined) {
  const deal = prices?.deals[0];
  if (!prices || !deal) return null;
  return {
    price: prices.currentPrice,
    store: storeName(deal.storeID),
    url: deal.url,
    stores: new Set(prices.deals.map((value) => value.storeID)).size,
    state: priceState(prices, false),
    checkedOn: prices.verifiedAt.slice(0, 10),
  };
}

/** Label for the headline price, honest about how it was obtained. */
export function priceLabel(prices: Prices | null | undefined) {
  const state = priceState(prices, false);
  return state === "steam-only"
    ? "Steam price"
    : state === "cached"
      ? "Last known price"
      : "Best price";
}

/** One line describing where the price came from. */
export function offerSource(offer: NonNullable<ReturnType<typeof bestOffer>>) {
  if (offer.state === "steam-only") return "Other stores couldn’t be checked";
  if (offer.state === "cached") return `Saved ${offer.checkedOn}`;
  return offer.stores > 1
    ? `at ${offer.store} · ${offer.stores} stores compared`
    : `at ${offer.store}`;
}

/** The saving versus Steam, the price most people would otherwise pay. */
export function steamDelta(prices: Prices | null | undefined) {
  if (prices?.currentPrice == null || prices.steamPrice == null) return null;
  if (priceState(prices, false) !== "live") return null;
  const saving = prices.steamPrice - prices.currentPrice;
  return saving >= 0.01
    ? `${money(saving)} less than Steam`
    : "Steam has the best price";
}

/** Plain-language distance between the best price and the user's target. */
export function targetGap(
  item: BacklogItem,
  prices: Prices | null | undefined,
) {
  if (prices?.currentPrice == null) return null;
  if (item.targetPrice === undefined)
    return prices.historicalLow == null
      ? "No target set"
      : `No target · ${lowLabel(prices).toLowerCase()} ${money(prices.historicalLow)}`;
  const gap = prices.currentPrice - item.targetPrice;
  return gap <= 0
    ? `${money(-gap)} under your ${money(item.targetPrice)} target`
    : `${money(gap)} above your ${money(item.targetPrice)} target`;
}

/** Label for a game's historical low, honest about where it came from. */
export function lowLabel(prices: Prices | null | undefined) {
  return prices?.historicalLowSource === "catalog"
    ? `Lowest recorded (saved ${prices.historicalLowAsOf ?? "data"})`
    : "Lowest ever";
}

/**
 * A truthful price track: current best price, the user's target, and the
 * lowest ever (only from live history), placed on a real numeric scale.
 * Renders nothing when there is no current price or nothing to compare.
 */
export function PriceTrack({
  current,
  target,
  low,
}: {
  current: number | null | undefined;
  target: number | undefined;
  low: number | null | undefined;
}) {
  if (current == null || (target === undefined && low == null)) return null;
  const marks = [
    { key: "low", value: low ?? null, label: "Lowest ever" },
    { key: "target", value: target ?? null, label: "Your target" },
    { key: "now", value: current, label: "Now" },
  ].filter(
    (mark): mark is { key: string; value: number; label: string } =>
      mark.value != null,
  );
  const values = marks.map((mark) => mark.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const position = (value: number) =>
    max === min ? 50 : 6 + ((value - min) / span) * 88;
  const met = target !== undefined && current <= target;
  return (
    <figure className="price-track" data-met={met || undefined}>
      <div className="price-track-rail" aria-hidden="true">
        {target !== undefined && (
          <span
            className="price-track-zone"
            style={{ width: `${position(target)}%` }}
          />
        )}
        {marks.map((mark) => (
          <span
            key={mark.key}
            className="price-track-mark"
            data-mark={mark.key}
            style={{ left: `${position(mark.value)}%` }}
          />
        ))}
      </div>
      <figcaption className="price-track-legend">
        {marks.map((mark) => (
          <span key={mark.key} data-mark={mark.key}>
            <span className="price-track-key" aria-hidden="true" />
            {mark.label}
            <span className="sr-only"> {money(mark.value)}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** "just now" / "5 min ago", refreshed each minute. */
export function useRelativeTime(time: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes} min ago`
      : new Date(time).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        });
}

/** When prices were actually fetched, from the query's own timestamp. */
export function PricesChecked({ at }: { at: number }) {
  const when = useRelativeTime(at);
  if (!at) return null;
  return <p className="prices-checked">Prices checked {when} · USD</p>;
}
