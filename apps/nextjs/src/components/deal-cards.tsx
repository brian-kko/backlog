"use client";

import { Fragment, useState } from "react";
import Link from "next/link";

import type { RouterOutputs } from "@acme/api";
import { cn } from "@acme/ui";
import { compareToSteam, purchaseStoreFromDeal } from "@acme/validators";

import { AddGameButton } from "./add-game";
import {
  GameArt,
  libraryHero,
  price,
  storeName,
  TrackActions,
} from "./game-ui";

type Deal = RouterOutputs["backlog"]["searchDeals"]["offers"][number];
export interface DealGroup {
  deal: Deal;
  /** Distinct other stores selling the same game among loaded offers. */
  otherStores: number;
}

/** "Borderlands 3 Super Deluxe (EPIC)" and "…Deluxe™" name the same game. */
const normalTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, " ")
    .replace(/[™®©:–—-]/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Collapses one-offer-per-store results into one row per game. */
export function groupDeals(deals: Deal[]): DealGroup[] {
  const groups = new Map<string, { deal: Deal; stores: Set<string> }>();
  // Offers without a Steam match join a matched offer with the same title.
  const appByTitle = new Map<string, number>();
  for (const deal of deals)
    if (deal.steamAppId)
      appByTitle.set(normalTitle(deal.title), deal.steamAppId);
  for (const deal of deals) {
    const appId = deal.steamAppId ?? appByTitle.get(normalTitle(deal.title));
    const key = appId ? `app-${appId}` : normalTitle(deal.title);
    const group = groups.get(key);
    if (!group)
      groups.set(key, { deal, stores: new Set([deal.storeId ?? deal.id]) });
    else {
      group.stores.add(deal.storeId ?? deal.id);
      if (deal.cheapestPrice < group.deal.cheapestPrice) group.deal = deal;
    }
  }
  return [...groups.values()].map(({ deal, stores }) => ({
    deal,
    otherStores: stores.size - 1,
  }));
}

const offerUrl = (deal: Deal) =>
  deal.url ??
  `https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.id)}`;

function PriceLine({ deal }: { deal: Deal }) {
  return (
    <p className="price-line">
      <strong className="deal-price">{price(deal.cheapestPrice)}</strong>
    </p>
  );
}

function OfferDetails({ deal }: { deal: Deal }) {
  return (
    <p className="deal-price-meta">
      {deal.normalPrice > deal.cheapestPrice && (
        <s>
          <span className="sr-only">was </span>
          {price(deal.normalPrice)}
        </s>
      )}
      {deal.savingsPercent >= 1 && deal.cheapestPrice > 0 && (
        <span className="discount-label">
          −{Math.round(deal.savingsPercent)}%
        </span>
      )}
      {deal.source === "catalog" && (
        <span className="saved-price">Saved price</span>
      )}
    </p>
  );
}

function StoreLine({ group }: { group: DealGroup }) {
  const { deal, otherStores } = group;
  return (
    <p className="deal-store">
      {storeName(deal.storeId)}
      {deal.steamRedeemable && deal.storeId !== "1" ? " · Steam key" : ""}
      {otherStores > 0 && deal.steamAppId ? (
        <>
          {" · "}
          <Link className="text-link" href={`/game/${deal.steamAppId}`}>
            +{otherStores} {otherStores === 1 ? "store" : "stores"}
          </Link>
        </>
      ) : null}
    </p>
  );
}

function Title({ deal, level }: { deal: Deal; level: "h2" | "h3" }) {
  const Heading = level;
  return (
    <Heading className="deal-title">
      {deal.steamAppId ? (
        <Link href={`/game/${deal.steamAppId}`}>{deal.title}</Link>
      ) : (
        deal.title
      )}
    </Heading>
  );
}

/** On phones, wishlist/own actions sit behind one "Track" button. */
function TrackToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="track-toggle" data-open={open || undefined}>
      <button
        type="button"
        className="quiet-button track-toggle-button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Track {open ? "▴" : "▾"}
      </button>
      <div className="track-toggle-body">{children}</div>
    </div>
  );
}

/** Steam's own price minus this offer, in cents (positive = offer is cheaper). */
export function steamGap(deal: Deal, steam?: number) {
  if (deal.source === "catalog" || !deal.steamAppId || steam == null)
    return null;
  if (deal.storeId === "1") return 0;
  const comparison = compareToSteam(deal.cheapestPrice, steam);
  if (!comparison) return null;
  return comparison.kind === "cheaper"
    ? comparison.savingCents
    : comparison.kind === "same"
      ? 0
      : -comparison.extraCents;
}

/** "Steam $X · save $Y", or that Steam matches or beats this offer. */
function SteamLine({
  deal,
  steam,
  checking,
}: {
  deal: Deal;
  steam?: number;
  /** Steam prices for this batch are still loading. */
  checking: boolean;
}) {
  const reason = (text: string) => (
    <p className="steam-line steam-line-muted">{text}</p>
  );
  // A saved offer cannot support a saving against today's Steam price.
  if (deal.source === "catalog")
    return reason("Steam: compare once prices are live");
  if (!deal.steamAppId)
    return reason("Steam comparison unavailable for this edition");
  const gap = steamGap(deal, steam);
  if (gap == null || steam == null)
    return reason(
      checking ? "Checking Steam…" : "Steam price unavailable right now",
    );
  return (
    <p className="steam-line">
      <span className="ledger-label">Steam</span>{" "}
      <span className="ledger-value">
        {price(deal.storeId === "1" ? deal.cheapestPrice : steam)}
      </span>{" "}
      <span className="deal-comparison-dot" aria-hidden="true">
        ·
      </span>{" "}
      {gap > 0 ? (
        <strong className="deal-comparison">save {price(gap / 100)}</strong>
      ) : (
        <span className="deal-comparison">
          {gap === 0 ? "same price" : "cheaper on Steam"}
        </span>
      )}
    </p>
  );
}

export function DealCards({
  deals,
  steamPrices,
  bestDeals = false,
}: {
  deals: Deal[];
  /** Steam's current price by AppID, for the comparison line. */
  steamPrices?: Record<number, number>;
  bestDeals?: boolean;
}) {
  const groups = groupDeals(deals);
  const baseline = (group: DealGroup) =>
    group.deal.steamAppId != null
      ? steamPrices?.[group.deal.steamAppId]
      : undefined;
  const gap = (group: DealGroup) => steamGap(group.deal, baseline(group));
  // Compare grouped offers, so a cheaper unmatched edition cannot inherit a win.
  const featured = groups.reduce<DealGroup | undefined>(
    (best, group) =>
      (gap(group) ?? 0) > (best ? (gap(best) ?? 0) : 0) ? group : best,
    undefined,
  );
  const remaining = groups.filter((group) => group !== featured);
  const ranked = bestDeals
    ? [
        ...remaining.filter((group) => gap(group) != null),
        ...remaining.filter((group) => gap(group) == null),
      ]
    : remaining;
  const firstUnmatched = bestDeals
    ? ranked.findIndex((group) => gap(group) == null)
    : -1;
  return (
    <div className="deal-results">
      {featured && (
        <DealCard
          key={featured.deal.id}
          group={featured}
          steam={baseline(featured)}
          checking={false}
          featured
        />
      )}
      {ranked.length > 0 && (
        <div className="deal-grid">
          {ranked.map((group, index) => (
            <Fragment key={group.deal.id}>
              {index === firstUnmatched && (
                <p className="deal-divider">
                  Other editions · no Steam match to compare
                </p>
              )}
              <DealCard
                group={group}
                steam={baseline(group)}
                checking={steamPrices === undefined}
              />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function DealCard({
  group,
  steam,
  checking,
  featured = false,
}: {
  group: DealGroup;
  steam?: number;
  checking: boolean;
  featured?: boolean;
}) {
  const { deal } = group;
  const gap = steamGap(deal, steam);
  return (
    <article
      className={cn("game-card deal-card", featured && "deal-featured")}
      data-testid="deal-card"
    >
      <div className="deal-art">
        <GameArt
          appId={deal.steamAppId}
          title={deal.title}
          src={
            featured && deal.steamAppId
              ? libraryHero(deal.steamAppId)
              : deal.thumb
          }
          priority={featured}
        />
        {gap != null && gap > 0 && (
          <span className="deal-ribbon">Beats Steam −{price(gap / 100)}</span>
        )}
      </div>
      <div className="deal-content">
        <div className="deal-heading min-w-0 space-y-1">
          <Title deal={deal} level={featured ? "h2" : "h3"} />
          <StoreLine group={group} />
        </div>
        <div className="deal-ledger">
          <a
            className="price-link"
            href={offerUrl(deal)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${deal.source === "catalog" ? "Saved price " : ""}${price(deal.cheapestPrice)} at ${storeName(deal.storeId)} (opens store)`}
          >
            <span className="ledger-label" aria-hidden="true">
              {deal.source === "catalog"
                ? "Saved"
                : gap != null && gap < 0
                  ? "Offer"
                  : "Best"}{" "}
              · {storeName(deal.storeId)}
            </span>
            <PriceLine deal={deal} />
            <span className="price-link-cue" aria-hidden="true">
              {deal.source === "catalog"
                ? "Check saved price"
                : `at ${storeName(deal.storeId)}`}{" "}
              ↗
            </span>
          </a>
          <SteamLine deal={deal} steam={steam} checking={checking} />
        </div>
        <OfferDetails deal={deal} />
        <div className="deal-actions">
          {gap != null && gap < 0 && deal.steamAppId ? (
            <a
              className="action secondary deal-buy"
              href={`https://store.steampowered.com/app/${deal.steamAppId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy at Steam<span aria-hidden="true">↗</span>
            </a>
          ) : (
            <a
              className={cn("action deal-buy", !featured && "secondary")}
              href={offerUrl(deal)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {deal.source === "catalog" ? "Check price at" : "Buy at"}{" "}
              {storeName(deal.storeId)}
              <span aria-hidden="true">↗</span>
            </a>
          )}
          {deal.steamAppId ? (
            <TrackToggle>
              <TrackActions
                steamAppId={deal.steamAppId}
                title={deal.title}
                price={deal.cheapestPrice}
                store={purchaseStoreFromDeal(deal.storeId)}
                saved={deal.source === "catalog"}
              />
            </TrackToggle>
          ) : (
            <AddGameButton
              label="Find it on Steam to track"
              initialQuery={deal.title}
              className="action secondary deal-find"
            />
          )}
        </div>
      </div>
    </article>
  );
}
