"use client";

import type { QueryFunctionContext } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useQueries } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import {
  compareToSteam,
  evaluateDealAlert,
  isRiotGame,
  toCents,
} from "@acme/validators";

import type { BacklogItem } from "./backlog-provider";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { money, price, storeName } from "./game-ui";

export type Prices = NonNullable<
  RouterOutputs["backlog"]["getGamePrices"]["prices"]
>;

/**
 * How much to trust a price:
 * - live: compared across stores just now
 * - steam-only: only Steam's own price could be checked
 * - cached: a retained offer or a saved catalog price
 * - unavailable / checking: no usable price yet
 */
export type PriceState =
  | "checking"
  | "live"
  | "steam-only"
  | "cached"
  | "unavailable";
export type AlertState = "ALL_TIME_LOW" | "TARGET_MET" | "WAIT" | null;

// Keep the connection change across route changes and query observers.
let connectionChangedAt = 0;

export const priceRefetchOptions = {
  refetchOnReconnect: "always",
  refetchOnMount: (query: { state: { dataUpdatedAt: number } }) =>
    query.state.dataUpdatedAt <= connectionChangedAt ? "always" : true,
} as const;

function subscribeConnection(onChange: () => void) {
  const onConnectionChange = () => {
    connectionChangedAt = Date.now();
    onChange();
  };
  window.addEventListener("online", onConnectionChange);
  window.addEventListener("offline", onConnectionChange);
  return () => {
    window.removeEventListener("online", onConnectionChange);
    window.removeEventListener("offline", onConnectionChange);
  };
}

export function usePriceConnection() {
  const connection = useSyncExternalStore(
    subscribeConnection,
    () => (navigator.onLine ? connectionChangedAt : -1),
    () => 0,
  );
  return { online: connection >= 0, changedAt: connection };
}

export function hasFreshPrices(
  query: { isSuccess: boolean; dataUpdatedAt: number; fetchStatus: string },
  connection: ReturnType<typeof usePriceConnection>,
) {
  return (
    connection.online &&
    query.fetchStatus !== "paused" &&
    query.isSuccess &&
    query.dataUpdatedAt > connection.changedAt
  );
}

export function priceState(
  prices: Prices | null | undefined,
  { pending = false, fresh = true } = {},
): PriceState {
  if (prices?.currentPrice == null) return pending ? "checking" : "unavailable";
  if (!fresh) return "cached";
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
    currentPrice: toCents(prices.currentPrice),
    targetPrice:
      item.targetPrice === undefined ? null : toCents(item.targetPrice),
    // "Lowest ever" needs live price history; a saved catalog low can't
    // support that claim, though targets still count.
    historicalLow:
      prices.source === "cheapshark" &&
      prices.historicalLowSource === "cheapshark" &&
      prices.historicalLow != null
        ? toCents(prices.historicalLow)
        : -1,
  });
  return result.reason ?? "WAIT";
}

export function useGamePriceOptions() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  return (steamAppId: number, enabled = true) => {
    const input = { steamAppId };
    const options = trpc.backlog.getGamePrices.queryOptions(input, {
      enabled,
      retry: false,
      staleTime: 5 * 60 * 1000,
      ...priceRefetchOptions,
    });
    return {
      ...options,
      queryFn: async ({ client: cache, signal }: QueryFunctionContext) => {
        const result = await client.backlog.getGamePrices.query(input, {
          signal,
        });
        const previous = cache.getQueryData(options.queryKey)?.prices;
        // Keep the prior check time if the provider can't verify today's price.
        if (
          !result.prices ||
          (result.prices.source === "catalog" &&
            previous &&
            previous.source !== "catalog")
        ) {
          throw new Error("Prices didn’t load");
        }
        return result;
      },
    };
  };
}

/** Prices for each wishlist game. Only fresh prices count as alerts. */
export function useWishlistPrices(items: BacklogItem[]) {
  const gamePriceOptions = useGamePriceOptions();
  const connection = usePriceConnection();
  const wishlist = items.filter(
    (item) => !item.isOwned && !isRiotGame(item.steamAppId),
  );
  const queries = useQueries({
    queries: wishlist.map((item) => gamePriceOptions(item.steamAppId)),
  });
  const rows = wishlist.map((item, index) => {
    const query = queries[index];
    const prices = query?.data?.prices ?? undefined;
    const state = priceState(prices, {
      pending: connection.online && query?.fetchStatus === "fetching",
      fresh: query !== undefined && hasFreshPrices(query, connection),
    });
    const verified = state === "live" || state === "steam-only";
    const alert = verified ? alertFor(item, prices) : null;
    const free = verified && prices?.currentPrice === 0;
    return {
      item,
      prices,
      state,
      alert,
      free,
      buyNow: free || alert === "ALL_TIME_LOW" || alert === "TARGET_MET",
      checkedAt:
        prices?.source === "catalog"
          ? prices.verifiedAt
          : (query?.dataUpdatedAt ?? 0),
    };
  });
  return {
    rows,
    pending: rows.some((row) => row.state === "checking"),
    offline:
      !connection.online ||
      queries.some((query) => query.fetchStatus === "paused"),
    refreshing: queries.some((query) => query.isFetching),
    /** Most recent check that reached live stores, in ms. */
    checkedAt: Math.max(
      0,
      ...queries.map((query) =>
        query.data?.prices?.source === "cheapshark" ||
        query.data?.prices?.source === "steam"
          ? query.dataUpdatedAt
          : 0,
      ),
    ),
    refresh: () => Promise.all(queries.map((query) => query.refetch())),
    alerts: rows.filter((row) => row.buyNow),
    unchecked: rows.filter(
      (row) => row.state === "unavailable" || row.state === "cached",
    ),
  };
}

export function AlertBadge({
  state,
  alert,
  children,
}: {
  state: PriceState;
  alert: AlertState;
  children?: string;
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
  return (
    <span
      className="watch-state"
      data-alert-state={
        state === "checking" || state === "unavailable" || state === "cached"
          ? "UNKNOWN"
          : (alert ?? "WAIT")
      }
    >
      {children ?? label}
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
  };
}

export function lastChecked(at: string | number) {
  const dayOnly = typeof at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(at);
  const date = new Date(at);
  return `Last checked ${date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    ...(dayOnly ? { timeZone: "UTC" } : { hour: "numeric", minute: "2-digit" }),
  })}`;
}

/** Label for the headline price, honest about how it was obtained. */
export function priceLabel(state: PriceState) {
  return state === "steam-only"
    ? "Steam price"
    : state === "cached"
      ? "Last known price"
      : state === "live"
        ? "Best price"
        : "Store price";
}

/** The saving versus Steam, the price most people would otherwise pay. */
export function steamDelta(
  prices: Prices | null | undefined,
  state: PriceState,
) {
  if (prices?.currentPrice == null || prices.steamPrice == null) return null;
  if (state !== "live") return null;
  const comparison = compareToSteam(prices.currentPrice, prices.steamPrice);
  if (!comparison) return null;
  return comparison.kind === "cheaper"
    ? `${money(comparison.savingCents / 100)} less than Steam`
    : comparison.kind === "same"
      ? "Steam matches the best price"
      : "Steam is cheaper";
}

/** Plain-language distance between the best price and the user's target. */
export function targetGap(
  item: BacklogItem,
  prices: Prices | null | undefined,
  state: PriceState,
  alert: AlertState = null,
) {
  if (prices?.currentPrice == null) return null;
  if (state === "cached") return null;
  if (prices.currentPrice === 0) return "Free right now";
  if (item.targetPrice === undefined)
    return alert === "ALL_TIME_LOW"
      ? "At its lowest ever; worth buying"
      : "Set a target to watch for your price";
  const comparison = compareToSteam(prices.currentPrice, item.targetPrice);
  if (!comparison) return null;
  return comparison.kind === "cheaper"
    ? `${money(comparison.savingCents / 100)} under your target, worth buying`
    : comparison.kind === "same"
      ? "At your target, worth buying"
      : `${alert === "ALL_TIME_LOW" ? "Lowest ever · " : ""}${money(comparison.extraCents / 100)} above your target`;
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
 * Renders nothing when there is no current price.
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
  if (current == null) return null;
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
  const met =
    target !== undefined &&
    compareToSteam(current, target)?.kind !== "steam-cheaper";
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
            <span className="sr-only"> {price(mark.value)}</span>
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
