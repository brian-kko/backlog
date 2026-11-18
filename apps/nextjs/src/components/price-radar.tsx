"use client";

import { useState } from "react";

import { compareToSteam, toCents } from "@acme/validators";

import type { DealGroup } from "./deal-cards";
import { steamGap } from "./deal-cards";
import { price, storeName } from "./game-ui";

export function getRadarComparisons(
  groups: DealGroup[],
  steamPrices: Record<number, number>,
) {
  // DealCards places its featured direct match before the other results.
  const featured = groups.reduce<{ group: DealGroup; gap: number } | undefined>(
    (leader, group) => {
      const gap = steamGap(group.deal, steamPrices[group.deal.steamAppId ?? 0]);
      return gap != null && gap > (leader?.gap ?? 0) ? { group, gap } : leader;
    },
    undefined,
  );
  const ordered = featured
    ? [featured.group, ...groups.filter((group) => group !== featured.group)]
    : groups;
  return ordered.flatMap(({ deal }) => {
    if (deal.source === "catalog" || deal.lastCheckedAt !== undefined)
      return [];

    const liveSteam =
      deal.steamAppId == null ? undefined : steamPrices[deal.steamAppId];
    const match = liveSteam == null ? deal.steamMatch : undefined;
    const steam = liveSteam ?? match?.price;
    const comparison = compareToSteam(deal.cheapestPrice, steam);
    if (!comparison || steam == null) return [];

    const savingCents =
      comparison.kind === "cheaper"
        ? comparison.savingCents
        : comparison.kind === "steam-cheaper"
          ? -comparison.extraCents
          : 0;
    return [
      {
        deal,
        savingCents,
        savingFraction: savingCents > 0 ? savingCents / toCents(steam) : 0,
        titleMatch: match?.matchedBy === "title",
      },
    ];
  });
}

const centre = { x: 140, y: 77 };
// Deals usually save 30–95% vs Steam, so the radar spans 0–100%.
const ringRadius = (fraction: number) => fraction * 66;
const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});
const rings = [
  { fraction: 0.25, label: "−25%" },
  { fraction: 0.5, label: "−50%" },
  { fraction: 0.75, label: "−75%" },
];

export function PriceRadar({
  comparisons,
  total,
  loading,
}: {
  comparisons: ReturnType<typeof getRadarComparisons>;
  total: number;
  loading: boolean;
}) {
  const [hovered, setHovered] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const dots = loading
    ? []
    : comparisons.filter(({ savingCents }) => savingCents >= 0);
  const best = dots.reduce<(typeof dots)[number] | undefined>(
    (leader, dot) =>
      dot.savingFraction > (leader?.savingFraction ?? 0) ? dot : leader,
    undefined,
  );
  const labelFor = ({ deal, savingCents, titleMatch }: (typeof dots)[number]) =>
    `${deal.title}: ${price(toCents(deal.cheapestPrice) / 100)} at ${storeName(deal.storeId)}, ${savingCents > 0 ? `${price(savingCents / 100)} less than Steam` : "same price as Steam"}${titleMatch ? " (matched by title)" : ""}`;
  const active = dots.find(({ deal }) => deal.id === (hovered ?? focused));

  return (
    <figure className="price-radar" role="group" aria-label="Price Radar">
      <div className="price-visual-heading" aria-hidden="true">
        Price Radar
      </div>
      <svg
        className="price-radar-plot"
        viewBox="0 0 280 154"
        role="group"
        aria-label="Offers plotted on rings at 25%, 50% and 75% below Steam"
      >
        <g className="price-radar-grid" aria-hidden="true">
          <path d="M 74 77 H 206 M 140 11 V 143" />
          <circle cx={centre.x} cy={centre.y} r="4.5" />
          {rings.map(({ fraction, label }) => {
            const radius = ringRadius(fraction);
            // Each ring is labelled just above its top, beside the axis.
            return (
              <g key={label}>
                <circle cx={centre.x} cy={centre.y} r={radius} />
                <text x={centre.x + 3} y={centre.y - radius - 2}>
                  {label}
                </text>
              </g>
            );
          })}
        </g>
        {dots.map((dot, index) => {
          const { deal, savingFraction, savingCents, titleMatch } = dot;
          // Half a step off vertical, so no dot sits on the ring labels.
          const angle =
            ((index + 0.5) / dots.length) * 2 * Math.PI - Math.PI / 2;
          const radius =
            savingCents === 0 ? 4.5 : ringRadius(Math.min(1, savingFraction));
          const x = centre.x + Math.cos(angle) * radius;
          const y = centre.y + Math.sin(angle) * radius;
          const anchor = `offer-${encodeURIComponent(deal.id)}`;
          return (
            <a
              key={deal.id}
              className="price-radar-link"
              href={
                deal.steamAppId == null
                  ? `#${encodeURIComponent(anchor)}`
                  : `/game/${deal.steamAppId}`
              }
              tabIndex={0}
              aria-label={labelFor(dot)}
              aria-description={
                savingCents > 0
                  ? `${percent.format(savingFraction)} below Steam${dot === best ? " · Biggest percentage saving" : ""}`
                  : undefined
              }
              data-match={titleMatch ? "title" : "app"}
              data-saving={savingCents > 0 ? "yes" : "tie"}
              onPointerEnter={() => setHovered(deal.id)}
              onPointerLeave={() => setHovered(undefined)}
              onFocus={() => setFocused(deal.id)}
              onBlur={() => setFocused(undefined)}
              onClick={(event) => {
                if (deal.steamAppId != null || document.getElementById(anchor))
                  return;
                // Other sorts render editions as cards without row anchors.
                const url =
                  deal.url ??
                  `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.id)}`;
                const offer = Array.from(
                  document.querySelectorAll<HTMLAnchorElement>(
                    ".deal-results a.price-link",
                  ),
                ).find((link) => link.getAttribute("href") === url);
                if (!offer) return;
                event.preventDefault();
                offer.focus();
              }}
            >
              <circle className="price-visual-hit" cx={x} cy={y} r="8" />
              <g
                className="price-radar-dot"
                style={{
                  animationDelay: `${(index / Math.max(dots.length - 1, 1)) * 140}ms`,
                }}
                aria-hidden="true"
              >
                <circle className="price-radar-focus" cx={x} cy={y} r="11" />
                {dot === best && (
                  <circle className="price-radar-best" cx={x} cy={y} r="8" />
                )}
                <circle
                  className="price-radar-mark"
                  cx={x}
                  cy={y}
                  r={savingCents > 0 ? 4 : 3}
                />
              </g>
            </a>
          );
        })}
      </svg>
      <figcaption className="price-radar-caption">
        <span role="status">
          {loading
            ? "Comparing with Steam…"
            : comparisons.length === 0
              ? "No Steam prices to compare in these results"
              : `${comparisons.length} of ${total} offers compared with Steam`}
        </span>
        <span className="price-radar-detail">
          {active ? labelFor(active) : null}
        </span>
      </figcaption>
    </figure>
  );
}
