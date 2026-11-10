"use client";

import Link from "next/link";

import { cn } from "@acme/ui";
import { purchaseStoreNames } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { useBacklog } from "~/components/backlog-provider";
import { money, plural } from "~/components/game-ui";
import { CountUp } from "~/components/motion";
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
    totals.set(store, (totals.get(store) ?? 0) + (item.amountPaid ?? 0));
  }
  if (totals.size < 2) return undefined;
  return [...totals]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(
      ([store, total]) =>
        `${money(total)} ${store === "store not set" ? "unassigned" : `on ${store}`}`,
    )
    .join(" · ");
}

export function BacklogSummary({ ledger = false }: { ledger?: boolean }) {
  const { items, isLoading } = useBacklog();
  const owned = items.filter((item) => item.isOwned);
  const paid = owned.filter((item) => item.amountPaid !== undefined);
  const totalSpent = paid.reduce(
    (sum, item) => sum + (item.amountPaid ?? 0),
    0,
  );
  const byStatus = (value: NonNullable<BacklogItem["completionStatus"]>) =>
    owned.filter((item) => (item.completionStatus ?? "backlog") === value);
  const unplayed = byStatus("backlog");
  const unplayedSpend = unplayed.reduce(
    (sum, item) => sum + (item.amountPaid ?? 0),
    0,
  );
  const prices = useWishlistPrices(ledger ? [] : items);
  const unplayedRecorded = unplayed.filter(
    (item) => item.amountPaid !== undefined,
  ).length;
  const unplayedCoverage =
    unplayedRecorded < unplayed.length
      ? `${unplayedRecorded} of ${unplayed.length} recorded`
      : undefined;
  const coverage =
    paid.length < owned.length
      ? `${paid.length} of ${owned.length} purchases recorded`
      : undefined;
  const metrics: Metric[] = ledger
    ? [
        {
          label: "Total spent",
          value: money(totalSpent),
          href: "/library",
          note:
            [coverage, storeBreakdown(paid)].filter(Boolean).join(" · ") ||
            undefined,
          essential: Boolean(coverage),
        },
        {
          label: "Paid for, never played",
          value: money(unplayedSpend),
          href: "/library?status=backlog",
          note: unplayedCoverage
            ? `${unplayedCoverage} · ${plural(unplayed.length, "unplayed game")}`
            : `across ${plural(unplayed.length, "unplayed game")}`,
          essential: Boolean(unplayedCoverage),
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
          value: paid.length ? money(totalSpent / paid.length) : "—",
          href: "/library",
          note: paid.length
            ? `per game, ${plural(paid.length, "purchase")} recorded`
            : "no purchases recorded",
          essential: paid.length < owned.length,
        },
      ]
    : [
        {
          label: "Playing now",
          value: byStatus("playing").length,
          href: "/library?status=playing",
        },
        {
          label: "Unplayed",
          value: unplayed.length,
          href: "/library?status=backlog",
          note: unplayedSpend ? `${money(unplayedSpend)} paid` : undefined,
        },
        {
          label: "Price alerts",
          value: prices.pending ? "…" : prices.alerts.length,
          href: "/wishlist",
          note:
            !prices.pending && prices.unchecked.length
              ? `${plural(prices.unchecked.length, "game")} couldn’t be checked`
              : "at target or lowest ever",
          essential: !prices.pending && prices.unchecked.length > 0,
        },
        {
          label: "Total spent",
          value: money(totalSpent),
          href: "/library",
          note: coverage,
          essential: Boolean(coverage),
        },
      ];
  return (
    <section aria-label={ledger ? "Spending and progress" : "At a glance"}>
      <dl className="metrics-rail">
        {metrics.map(({ label, value, href, note, essential }) => (
          <div key={label} className="metric-card">
            <dt>{label}</dt>
            <dd>
              <Link href={href}>
                {isLoading ? "…" : <CountUp value={value} />}
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
