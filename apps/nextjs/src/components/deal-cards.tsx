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
import { lastChecked } from "./price-ui";

type Deal = RouterOutputs["backlog"]["searchDeals"]["offers"][number] & {
  lastCheckedAt?: string | number;
};
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
      const saved = isSaved(deal);
      const previousSaved = isSaved(group.deal);
      if (
        saved === previousSaved
          ? deal.cheapestPrice < group.deal.cheapestPrice
          : !saved
      )
        group.deal = deal;
    }
  }
  return [...groups.values()].map(({ deal, stores }) => ({
    deal,
    otherStores: stores.size - 1,
  }));
}

const isSaved = (deal: Deal) =>
  deal.source === "catalog" || deal.lastCheckedAt !== undefined;

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
      {!isSaved(deal) && deal.normalPrice > deal.cheapestPrice && (
        <s>
          <span className="sr-only">was </span>
          {price(deal.normalPrice)}
        </s>
      )}
      {!isSaved(deal) && deal.savingsPercent >= 1 && (
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

function StoreLine({
  group,
  comparison,
}: {
  group: DealGroup;
  comparison?: React.ReactNode;
}) {
  const { deal, otherStores } = group;
  return (
    <p className={cn("deal-store", comparison && "whitespace-normal")}>
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
      {comparison && <> · {comparison}</>}
      {deal.lastCheckedAt !== undefined && (
        <> · {lastChecked(deal.lastCheckedAt)}</>
      )}
    </p>
  );
}

function Title({
  deal,
  level,
  compact,
}: {
  deal: Deal;
  level: "h2" | "h3";
  compact?: boolean;
}) {
  const Heading = level;
  return (
    <Heading
      className={cn(
        "deal-title",
        compact && "max-sm:line-clamp-none max-sm:wrap-anywhere",
      )}
    >
      {deal.steamAppId ? (
        <Link href={`/game/${deal.steamAppId}`}>{deal.title}</Link>
      ) : (
        deal.title
      )}
    </Heading>
  );
}

/** Compact rows and phone cards disclose wishlist/own actions together. */
function TrackToggle({
  children,
  compact,
}: {
  children: React.ReactNode;
  compact: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="track-toggle" data-open={open || undefined}>
      <button
        type="button"
        className={cn(
          "track-toggle-button",
          compact
            ? "action secondary deal-find min-w-28 justify-center"
            : "quiet-button",
        )}
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
/**
 * Steam's price for this offer: the game's live Steam price, or, for an
 * edition matched to its own Steam package, that package's price.
 */
export const steamBaseline = (
  deal: Deal,
  steamPrices: Record<number, number> | undefined,
) =>
  deal.steamAppId != null
    ? steamPrices?.[deal.steamAppId]
    : deal.steamMatch?.price;

export function steamGap(deal: Deal, steam?: number) {
  if (isSaved(deal) || (!deal.steamAppId && !deal.steamMatch) || steam == null)
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

export function rankDeals(
  groups: DealGroup[],
  steamPrices: Record<number, number>,
) {
  const gap = (group: DealGroup) =>
    steamGap(group.deal, steamBaseline(group.deal, steamPrices));
  const rank = (group: DealGroup, value: number | null) =>
    value != null ? 0 : group.deal.steamAppId ? 1 : 2;
  return [...groups].sort((a, b) => {
    const left = gap(a);
    const right = gap(b);
    return rank(a, left) - rank(b, right) || (right ?? 0) - (left ?? 0);
  });
}

interface SteamRequest {
  checking: boolean;
  retry?: () => void;
}

function SteamUnavailable({ request }: { request?: SteamRequest }) {
  if (request?.checking) return <span>Checking Steam…</span>;
  return (
    <span>
      Steam price unavailable
      {request?.retry && (
        <>
          {" "}
          ·{" "}
          <button
            type="button"
            className="text-link pointer-coarse:min-h-11 pointer-coarse:min-w-11"
            onClick={request.retry}
          >
            Retry
          </button>
        </>
      )}
    </span>
  );
}

/** "Steam $X · save $Y", or that Steam matches or beats this offer. */
function SteamLine({
  deal,
  steam,
  request,
  featured = false,
}: {
  deal: Deal;
  steam?: number;
  request?: SteamRequest;
  featured?: boolean;
}) {
  const reason = (text: React.ReactNode) => (
    <p className="steam-line steam-line-muted">{text}</p>
  );
  // A saved offer cannot support a saving against today's Steam price.
  if (isSaved(deal)) return reason("Steam: compare once prices are live");
  if (!deal.steamAppId && !deal.steamMatch)
    return reason("Steam comparison unavailable for this edition");
  const gap = steamGap(deal, steam);
  if (gap == null || steam == null)
    return reason(<SteamUnavailable request={request} />);
  return (
    <p className="steam-line">
      {/* A title-matched edition compares with that edition's Steam package. */}
      <span className="ledger-label">
        {deal.steamAppId ? "Steam" : "Steam edition"}
      </span>{" "}
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
  steamRequests,
  steamOnlyAction,
  bestDeals = false,
}: {
  groups: DealGroup[];
  /** Steam's current price by AppID, for the comparison line. */
  steamPrices: Record<number, number>;
  steamRequests: ReadonlyMap<number, SteamRequest>;
  steamOnlyAction?: { count: number; onClick: () => void };
  bestDeals?: boolean;
}) {
  const baseline = (group: DealGroup) => steamBaseline(group.deal, steamPrices);
  const gap = (group: DealGroup) => steamGap(group.deal, baseline(group));
  const request = (group: DealGroup) =>
    steamRequests.get(group.deal.steamAppId ?? 0);
  // Compare grouped offers, so a cheaper unmatched edition cannot inherit a win.
  const featured = groups.reduce<DealGroup | undefined>(
    (best, group) =>
      (gap(group) ?? 0) > (best ? (gap(best) ?? 0) : 0) ? group : best,
    undefined,
  );
  const remaining = groups.filter((group) => group !== featured);
  const matched = bestDeals
    ? remaining.filter((group) => gap(group) != null)
    : remaining;
  const unmatched = bestDeals
    ? remaining.filter((group) => gap(group) == null)
    : [];
  const compared = matched.length + Number(Boolean(featured));
  const checking = groups.some((group) => request(group)?.checking);
  return (
    <div className="deal-results">
      {featured && (
        <DealCard
          key={featured.deal.id}
          group={featured}
          steam={baseline(featured)}
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
              request={request(group)}
            />
          ))}
        </div>
      )}
      {unmatched.length > 0 && (
        <div className="deal-editions">
          {steamOnlyAction && !checking && compared < 3 && (
            <p className="glance-note px-3 py-2">
              {compared === 0 ? "None" : `Only ${compared}`} of these{" "}
              {groups.length} {compared === 1 ? "has" : "have"} a Steam price to
              compare.{" "}
              <button
                type="button"
                className="text-link pointer-coarse:min-h-11"
                onClick={steamOnlyAction.onClick}
              >
                Show deals that activate on Steam ({steamOnlyAction.count}) →
              </button>
            </p>
          )}
          <p className="deal-divider">
            {checking
              ? "Store offers"
              : compared > 0
                ? "Other editions: no live Steam price to compare"
                : "No live Steam price to compare for these editions"}
          </p>
          <div className="deal-edition-list">
            {unmatched.map((group) => (
              <DealRow
                key={group.deal.id}
                group={group}
                request={request(group)}
              />
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
  request,
  featured = false,
}: {
  group: DealGroup;
  steam?: number;
  request?: SteamRequest;
  featured?: boolean;
}) {
  const { deal } = group;
  const [noArt, setNoArt] = useState(false);
  // Art much narrower than the billboard sits at its own size, not stretched.
  const [inset, setInset] = useState(false);
  const gap = steamGap(deal, steam);
  return (
    <article
      // Same anchor as an edition row, so the radar can link either.
      id={`offer-${encodeURIComponent(deal.id)}`}
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
            aria-label={`${isSaved(deal) ? "Saved price " : ""}${price(deal.cheapestPrice)} at ${storeName(deal.storeId)} (opens store)`}
          >
            <span className="ledger-label" aria-hidden="true">
              {isSaved(deal)
                ? "Saved"
                : deal.cheapestPrice === 0
                  ? "Free"
                  : (gap != null && gap < 0) ||
                      (gap == null && deal.storeId !== "1")
                    ? "Offer"
                    : "Best"}{" "}
              · {storeName(deal.storeId)}
            </span>
            <PriceLine deal={deal} />
            <span className="price-link-cue" aria-hidden="true">
              {isSaved(deal)
                ? "Check saved price"
                : `at ${storeName(deal.storeId)}`}{" "}
              <span aria-hidden="true">↗</span>
            </span>
          </a>
          {deal.storeId === "1" && !isSaved(deal) ? (
            <p className="deal-best-note">Steam has the best price</p>
          ) : (
            <SteamLine
              deal={deal}
              steam={steam}
              request={request}
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
  const saved = isSaved(deal);
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
          aria-label={`${saved ? "Check price" : deal.cheapestPrice === 0 ? "Get it free" : "Buy"} at ${storeName(deal.storeId)} (opens store)`}
        >
          {compact
            ? saved
              ? "Check price"
              : deal.cheapestPrice === 0
                ? "Get free"
                : "Buy"
            : `${saved ? "Check price at" : deal.cheapestPrice === 0 ? "Get it free at" : "Buy at"} ${storeName(deal.storeId)}`}
          <span aria-hidden="true">↗</span>
        </a>
      )}
      {deal.steamAppId ? (
        <TrackToggle compact={compact}>
          <TrackActions
            steamAppId={deal.steamAppId}
            title={deal.title}
            price={deal.cheapestPrice}
            store={purchaseStoreFromDeal(deal.storeId)}
            saved={saved}
            offer={{
              store: storeName(deal.storeId),
              url: offerUrl(deal),
              source: saved ? "catalog" : (deal.source ?? "cheapshark"),
            }}
          />
        </TrackToggle>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          className={cn("action secondary deal-find", compact && "min-w-28")}
          onClick={() => openAddGame(deal.title)}
        >
          {compact ? "Find on Steam" : "Find it on Steam to track"}
        </button>
      )}
    </div>
  );
}

/** Offers without a live Steam comparison stay scannable below the divider. */
function DealRow({
  group,
  request,
}: {
  group: DealGroup;
  request?: SteamRequest;
}) {
  const { deal } = group;
  return (
    <article
      id={`offer-${encodeURIComponent(deal.id)}`}
      className="deal-row"
      data-testid="deal-card"
    >
      <div className="deal-row-art">
        <GameArt
          appId={deal.steamAppId}
          title={deal.title}
          src={deal.steamAppId ? undefined : storeArt(deal)}
        />
      </div>
      <div className="deal-row-heading">
        <Title deal={deal} level="h3" compact />
        <StoreLine
          group={group}
          comparison={
            deal.steamAppId && deal.storeId !== "1" && !isSaved(deal) ? (
              <SteamUnavailable request={request} />
            ) : undefined
          }
        />
      </div>
      <div className="deal-row-price">
        <a
          className="price-link"
          href={offerUrl(deal)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${isSaved(deal) ? "Saved price " : ""}${price(deal.cheapestPrice)} at ${storeName(deal.storeId)} (opens store)`}
        >
          <PriceLine deal={deal} />
          <OfferDetails deal={deal} />
        </a>
      </div>
      <DealActions group={group} compact />
    </article>
  );
}
