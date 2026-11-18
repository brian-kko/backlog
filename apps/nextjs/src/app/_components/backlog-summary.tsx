"use client";

import Link from "next/link";

import { cn } from "@acme/ui";
import { purchaseStoreNames, toCents } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { useBacklog } from "~/components/backlog-provider";
import { plural, price } from "~/components/game-ui";
import { useWishlistPrices } from "~/components/price-ui";

interface Metric {
  label: string;
  value: string | number;
  href: string;
  note?: string;
  /** Qualifies the value (coverage, failures); never hidden on phones. */
  essential?: boolean;
}

/** "$80 on Steam · $40 on GOG" for recorded purchases. */
function storeBreakdown(paid: BacklogItem[]) {
  const totals = new Map<string, number>();
  for (const item of paid) {
    const store = item.purchaseStore
      ? purchaseStoreNames[item.purchaseStore]
      : "store not set";
    totals.set(store, (totals.get(store) ?? 0) + toCents(item.amountPaid ?? 0));
  }
  if (totals.size < 2) return undefined;
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(
      ([store, total]) =>
        `${price(total / 100)} ${store === "store not set" ? "unassigned" : `on ${store}`}`,
    )
    .join(" · ");
}

function spending(items: BacklogItem[]) {
  const recorded = items.filter((item) => item.amountPaid != null);
  const cents = recorded.reduce(
    (sum, item) => sum + toCents(item.amountPaid ?? 0),
    0,
  );
  const coverage = !recorded.length
    ? "No purchase price recorded"
    : recorded.length < items.length
      ? `${recorded.length} of ${items.length} prices recorded`
      : undefined;
  return {
    recorded,
    cents,
    value: recorded.length ? price(cents / 100) : "—",
    coverage,
  };
}

export function BacklogSummary({ ledger = false }: { ledger?: boolean }) {
  const { items, isLoading } = useBacklog();
  const owned = items.filter((item) => item.isOwned);
  const total = spending(owned);
  const byStatus = (value: NonNullable<BacklogItem["completionStatus"]>) =>
    owned.filter((item) => (item.completionStatus ?? "backlog") === value);
  const unplayed = byStatus("backlog");
  const unplayedSpend = spending(unplayed);
  const prices = useWishlistPrices(ledger ? [] : items);
  const paid = total.recorded;
  const unplayedNote =
    unplayedSpend.coverage ??
    `across ${plural(unplayed.length, "unplayed game")}`;
  const metrics: Metric[] = ledger
    ? [
        {
          label: "Total spent",
          value: total.value,
          href: "/library",
          note:
            [total.coverage, storeBreakdown(paid)]
              .filter(Boolean)
              .join(" · ") || undefined,
          essential: Boolean(total.coverage),
        },
        {
          label: "Paid for, never played",
          value: unplayedSpend.value,
          href: "/library?status=backlog",
          note: unplayedNote,
          essential: Boolean(unplayedSpend.coverage),
        },
        {
          label: "Completed",
          value: owned.length
            ? `${byStatus("completed").length} of ${owned.length}`
            : 0,
          href: "/library?status=completed",
        },
        {
          label: "Average paid",
          value: paid.length
            ? price(Math.round(total.cents / paid.length) / 100)
            : "—",
          href: "/library",
          note: paid.length
            ? `per game, ${plural(paid.length, "purchase")} recorded`
            : "No purchase price recorded",
          essential: paid.length < owned.length,
        },
      ]
    : [
        // Counts of playing/owned live in the heading strip; these are the
        // money questions the strip can't answer.
        {
          label: "Price alerts",
          value: prices.pending ? "…" : prices.alerts.length,
          href: "/wishlist",
          note:
            !prices.pending && prices.unchecked.length
              ? `${plural(prices.unchecked.length, "game")} couldn’t be checked`
              : "free, at target or lowest ever",
          essential: !prices.pending && prices.unchecked.length > 0,
        },
        {
          label: "Total spent",
          value: total.value,
          href: "/library",
          note: total.coverage,
          essential: Boolean(total.coverage),
        },
        {
          label: "Paid, never played",
          value: unplayedSpend.value,
          href: "/library?status=backlog",
          note: unplayedNote,
          essential: Boolean(unplayedSpend.coverage),
        },
      ];
  // Nothing owned yet: one useful line beats a row of $0.00 blocks.
  if (!owned.length && (ledger || !prices.rows.length))
    return (
      <p className="empty-inline">
        Spending shows up here once you add games you own and what you paid.
      </p>
    );
  return (
    <section aria-label={ledger ? "Spending and progress" : "At a glance"}>
      <dl className="metrics-rail">
        {metrics.map(({ label, value, href, note, essential }) => (
          <div key={label} className="metric-card">
            <dt>{label}</dt>
            <dd>
              <Link href={href}>
                {/* Final values at once: money shouldn't tick through made-up amounts. */}
                {isLoading ? "…" : value}
              </Link>
            </dd>
            {note && (
              <dd className={cn("metric-note", essential && "essential")}>
                {note}
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
