"use client";

import { useState } from "react";
import Link from "next/link";

import type { RouterOutputs } from "@acme/api";
import { cn } from "@acme/ui";
import {
  compareToSteam,
  purchaseStoreFromDeal,
  toCents,
} from "@acme/validators";

import { useAddGame } from "./add-game";
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

/** Store art, unless it's CheapShark's generic "no box art" placeholder. */
const storeArt = (deal: Deal) =>
  deal.thumb.includes("/default_box_art") ? undefined : deal.thumb;

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
      {deal.savingsPercent >= 1 && (
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

/** Compact rows and phone cards disclose wishlist/own actions together. */
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
  featured = false,
}: {
  deal: Deal;
  steam?: number;
  /** Steam prices for this batch are still loading. */
  checking: boolean;
  featured?: boolean;
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
        <>
          <strong className="deal-comparison">save {price(gap / 100)}</strong>{" "}
          {featured && toCents(steam) > 0 && (
            <span className="deal-steam-discount">
              (−{Math.round((gap / toCents(steam)) * 100)}%)
            </span>
          )}
        </>
      ) : (
        <span className="deal-comparison">
          {gap === 0 ? "same price" : "cheaper on Steam"}
        </span>
      )}
    </p>
  );
}

export function DealCards({
  groups,
  steamPrices,
  bestDeals = false,
}: {
  groups: DealGroup[];
  /** Steam's current price by AppID, for the comparison line. */
  steamPrices?: Record<number, number>;
  bestDeals?: boolean;
}) {
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
  const matched = bestDeals
    ? remaining
        .filter((group) => gap(group) != null)
        .sort((a, b) => (gap(b) ?? 0) - (gap(a) ?? 0))
    : remaining;
  const unmatched = bestDeals
    ? remaining.filter((group) => gap(group) == null)
    : [];
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
      {matched.length > 0 && (
        <div
          className={cn("deal-grid", matched.length <= 2 && "deal-grid-pair")}
        >
          {matched.map((group) => (
            <DealCard
              key={group.deal.id}
              group={group}
              steam={baseline(group)}
              checking={steamPrices === undefined}
            />
          ))}
        </div>
      )}
      {unmatched.length > 0 && (
        <div className="deal-editions">
          <p className="deal-divider">
            Other editions: no live Steam price to compare
          </p>
          <div className="deal-edition-list">
            {unmatched.map((group) => (
              <DealRow key={group.deal.id} group={group} />
            ))}
          </div>
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
  const [noArt, setNoArt] = useState(false);
  // Art much narrower than the billboard sits at its own size, not stretched.
  const [inset, setInset] = useState(false);
  const gap = steamGap(deal, steam);
  return (
    <article
      className={cn(
        "game-card deal-card",
        featured && "deal-featured",
        featured && noArt && "no-art",
        featured && inset && "art-inset",
      )}
      data-testid="deal-card"
    >
      <div className="deal-art">
        <GameArt
          appId={deal.steamAppId}
          title={deal.title}
          // The billboard wants the wide hero. Other Steam games use sharp
          // Steam card art (store thumbnails can be 120px); editions without
          // a Steam game keep the store's banner.
          src={
            deal.steamAppId
              ? featured
                ? libraryHero(deal.steamAppId)
                : undefined
              : storeArt(deal)
          }
          priority={featured}
          onMissing={featured ? () => setNoArt(true) : undefined}
          onArtLoad={
            featured
              ? (image) => {
                  const card = image.closest(".deal-featured");
                  if (card)
                    setInset(image.naturalWidth < card.clientWidth * 0.8);
                }
              : undefined
          }
        />
      </div>
      <div className="deal-content">
        <div className="deal-heading min-w-0">
          {featured && (
            <p className="deal-featured-eyebrow">Biggest saving vs Steam</p>
          )}
          {gap != null && gap > 0 && (
            <span className="deal-ribbon">Beats Steam −{price(gap / 100)}</span>
          )}
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
                : deal.cheapestPrice === 0
                  ? "Free"
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
              <span aria-hidden="true">↗</span>
            </span>
          </a>
          {deal.storeId === "1" && deal.source !== "catalog" ? (
            <p className="deal-best-note">Steam has the best price</p>
          ) : (
            <SteamLine
              deal={deal}
              steam={steam}
              checking={checking}
              featured={featured}
            />
          )}
        </div>
        <OfferDetails deal={deal} />
        <DealActions group={group} gap={gap} featured={featured} />
      </div>
    </article>
  );
}

function DealActions({
  group,
  gap = null,
  featured = false,
  compact = false,
}: {
  group: DealGroup;
  gap?: number | null;
  featured?: boolean;
  compact?: boolean;
}) {
  const { deal } = group;
  const openAddGame = useAddGame();
  return (
    <div className="deal-actions">
      {gap != null && gap < 0 && deal.steamAppId ? (
        <a
          className="action secondary deal-buy"
          href={`https://store.steampowered.com/app/${deal.steamAppId}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Buy at Steam (opens store)"
        >
          {compact ? "Buy" : "Buy at Steam"}
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <a
          className={cn("action deal-buy", !featured && "secondary")}
          href={offerUrl(deal)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${deal.source === "catalog" ? "Check price" : deal.cheapestPrice === 0 ? "Get it free" : "Buy"} at ${storeName(deal.storeId)} (opens store)`}
        >
          {compact
            ? deal.source === "catalog"
              ? "Check price"
              : deal.cheapestPrice === 0
                ? "Get free"
                : "Buy"
            : `${deal.source === "catalog" ? "Check price at" : deal.cheapestPrice === 0 ? "Get it free at" : "Buy at"} ${storeName(deal.storeId)}`}
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
            offer={{
              store: storeName(deal.storeId),
              url: offerUrl(deal),
              source: deal.source ?? "cheapshark",
            }}
          />
        </TrackToggle>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          className="action secondary deal-find"
          onClick={() => openAddGame(deal.title)}
        >
          {compact ? "Find on Steam" : "Find it on Steam to track"}
        </button>
      )}
    </div>
  );
}

/** Offers without a live Steam comparison stay scannable below the divider. */
function DealRow({ group }: { group: DealGroup }) {
  const { deal } = group;
  return (
    <article className="deal-row" data-testid="deal-card">
      <div className="deal-row-art">
        <GameArt
          appId={deal.steamAppId}
          title={deal.title}
          src={deal.steamAppId ? undefined : storeArt(deal)}
        />
      </div>
      <div className="deal-row-heading">
        <Title deal={deal} level="h3" />
        <StoreLine group={group} />
      </div>
      <div className="deal-row-price">
        <a
          className="price-link"
          href={offerUrl(deal)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${deal.source === "catalog" ? "Saved price " : ""}${price(deal.cheapestPrice)} at ${storeName(deal.storeId)} (opens store)`}
        >
          <PriceLine deal={deal} />
          <OfferDetails deal={deal} />
        </a>
      </div>
      <DealActions group={group} compact />
    </article>
  );
}
