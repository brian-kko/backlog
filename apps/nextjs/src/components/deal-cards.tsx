"use client";

import { useState } from "react";
import Link from "next/link";

import type { RouterOutputs } from "@acme/api";
import { purchaseStoreFromDeal } from "@acme/validators";

import { AddGameButton } from "./add-game";
import { GameArt, money, price, storeName, TrackActions } from "./game-ui";

type Deal = RouterOutputs["backlog"]["searchDeals"]["offers"][number];
export interface DealGroup {
  deal: Deal;
  /** Distinct other stores selling the same game among loaded offers. */
  otherStores: number;
}

/** Collapses one-offer-per-store results into one row per game. */
export function groupDeals(deals: Deal[]): DealGroup[] {
  const groups = new Map<string, { deal: Deal; stores: Set<string> }>();
  for (const deal of deals) {
    const key = deal.steamAppId
      ? `app-${deal.steamAppId}`
      : deal.title.toLowerCase();
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
      {deal.normalPrice > deal.cheapestPrice && (
        <s>
          <span className="sr-only">was </span>
          {money(deal.normalPrice)}
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

/** "Steam $X · save $Y", or that Steam itself is cheapest. */
function SteamLine({ deal, steam }: { deal: Deal; steam?: number }) {
  // A saved offer can't support a "save $X" claim against today's Steam price.
  if (deal.source === "catalog") return null;
  if (deal.storeId === "1")
    return <p className="steam-line">This is Steam’s own price</p>;
  if (steam == null) return null;
  const saving = steam - deal.cheapestPrice;
  return (
    <p className="steam-line">
      {saving >= 0.01 ? (
        <>
          Steam {money(steam)} ·{" "}
          <strong>save {money(saving)}</strong>
        </>
      ) : (
        `Steam has this for ${money(steam)}`
      )}
    </p>
  );
}

export function DealCards({
  deals,
  steamPrices,
}: {
  deals: Deal[];
  /** Steam's current price by AppID, for the comparison line. */
  steamPrices?: Record<number, number>;
}) {
  const groups = groupDeals(deals);
  return (
    <div className="deal-grid">
      {groups.map((group) => {
        const { deal } = group;
        return (
          <article
            key={deal.id}
            className="game-card deal-card"
            data-testid="deal-card"
          >
            <div className="deal-art">
              <GameArt
                appId={deal.steamAppId}
                title={deal.title}
                src={deal.thumb}
              />
            </div>
            <div className="deal-content">
              <div className="min-w-0 space-y-1">
                <Title deal={deal} level="h3" />
                <StoreLine group={group} />
              </div>
              <a
                className="price-link"
                href={offerUrl(deal)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${deal.source === "catalog" ? "Saved price " : ""}${price(deal.cheapestPrice)} at ${storeName(deal.storeId)} (opens store)`}
              >
                <PriceLine deal={deal} />
                <span className="price-link-cue" aria-hidden="true">
                  {deal.source === "catalog" ? "Check saved price" : `at ${storeName(deal.storeId)}`}{" "}
                  ↗
                </span>
              </a>
              <SteamLine
                deal={deal}
                steam={
                  deal.steamAppId != null
                    ? steamPrices?.[deal.steamAppId]
                    : undefined
                }
              />
              <div className="deal-actions">
                <a
                  className="action secondary deal-buy"
                  href={offerUrl(deal)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {deal.source === "catalog" ? "Check price at" : "Buy at"}{" "}
                  {storeName(deal.storeId)}
                  <span aria-hidden="true">↗</span>
                </a>
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
                  <div className="deal-untracked">
                    {/* One inline run, so flex layout can't eat the spaces. */}
                    <p>
                      No Steam match
                      <span className="max-sm:hidden"> from the price feed</span>
                      .{" "}
                      <AddGameButton
                        label="Find it on Steam"
                        initialQuery={deal.title}
                        className="text-link"
                      />
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
