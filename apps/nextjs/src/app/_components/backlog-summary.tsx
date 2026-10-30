"use client";

import Link from "next/link";
import { useQueries } from "@tanstack/react-query";

import { evaluateDealAlert } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { useBacklog } from "~/components/backlog-provider";
import { money } from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";

export function useCurrentValues(items: BacklogItem[]) {
  const trpc = useTRPC();
  const queries = useQueries({
    queries: items.map((item) =>
      trpc.backlog.getGamePrices.queryOptions(
        { steamAppId: item.steamAppId },
        { retry: false },
      ),
    ),
  });
  const available = queries.flatMap((query, index) =>
    query.data?.prices?.currentPrice == null
      ? []
      : [
          {
            item: items[index],
            value: query.data.prices.currentPrice,
            historicalLow: query.data.prices.historicalLow,
            cached: query.data.prices.source === "catalog",
          },
        ],
  );
  return {
    available,
    pending: queries.some((query) => query.isPending),
    complete: available.length === items.length,
  };
}

export function BacklogSummary({ ledger = false }: { ledger?: boolean }) {
  const { items, isLoading } = useBacklog();
  const owned = items.filter((item) => item.isOwned);
  const totalSpent = owned.reduce(
    (sum, item) => sum + (item.amountPaid ?? 0),
    0,
  );
  const values = useCurrentValues(items);
  const currentValue = values.available.reduce(
    (sum, price) => sum + price.value,
    0,
  );
  const backlogValue = values.available
    .filter(
      (price) =>
        price.item?.isOwned &&
        (price.item.completionStatus ?? "backlog") === "backlog",
    )
    .reduce((sum, price) => sum + price.value, 0);
  const alerts = values.available.filter(
    ({ item, value, historicalLow }) =>
      item &&
      evaluateDealAlert({
        isOwned: item.isOwned,
        currentPrice: value,
        targetPrice: item.targetPrice ?? null,
        historicalLow: historicalLow ?? -1,
      }).shouldAlert,
  ).length;
  const valuation = (value: number) =>
    values.pending
      ? "Loading…"
      : values.available.length
        ? `${money(value)}${values.complete ? "" : "*"}`
        : items.length
          ? "Check Steam"
          : money(0);
  const metrics = ledger
    ? [
        ["Total Spent", money(totalSpent)],
        ["Owned Count", owned.length],
        ["Backlog Value", valuation(backlogValue)],
        ["Cost-Per-Game", money(owned.length ? totalSpent / owned.length : 0)],
      ]
    : [
        ["Total Spent", money(totalSpent)],
        ["Owned Library", owned.length],
        ["Wishlist Alerts", values.pending ? "…" : alerts],
        ["Estimated Value", valuation(currentValue)],
      ];
  return (
    <section aria-label="Library analytics" className="space-y-2">
      <dl className="metrics-rail">
        {metrics.map(([label, value]) => (
          <div key={label} className="metric-card">
            <dt>{label}</dt>
            <dd>
              <Link
                href={label === "Wishlist Alerts" ? "/wishlist" : "/library"}
                aria-label={`View ${label}`}
              >
                {isLoading ? "…" : value}
              </Link>
            </dd>
          </div>
        ))}
      </dl>
      {owned.some((item) => item.amountPaid === undefined) && (
        <p className="filter-help">
          {owned.filter((item) => item.amountPaid === undefined).length} owned
          games have no purchase amount recorded. Spending totals include
          recorded amounts only.
        </p>
      )}
      {!values.pending && values.available.some((price) => price.cached) && (
        <p className="filter-help">
          Estimate includes saved catalog prices. Check the store before buying.
        </p>
      )}
      {!values.pending && !values.complete && values.available.length > 0 && (
        <p className="text-muted-foreground text-xs">
          * Partial estimate: some live prices are unavailable. Prices in USD.
        </p>
      )}
    </section>
  );
}
