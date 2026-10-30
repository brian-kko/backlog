"use client";

import type { RouterOutputs } from "@acme/api";
import { storeNames } from "@acme/validators";

import { GameArt, GameLink, money, TrackActions } from "./game-ui";

export function DealCards({
  deals,
  compact = false,
  list = false,
}: {
  deals: RouterOutputs["backlog"]["searchDeals"];
  compact?: boolean;
  list?: boolean;
}) {
  if (compact)
    return (
      <div className="deal-list">
        {deals.map((deal) => (
          <article className="deal-row" key={deal.id} data-testid="deal-card">
            <GameArt
              appId={deal.steamAppId}
              title={deal.title}
              src={deal.thumb}
            />
            <div>
              <h3>{deal.title}</h3>
              <p className="deal-store">
                {deal.storeId
                  ? (storeNames[deal.storeId] ?? "Partner store")
                  : "PC game offer"}
              </p>
              {deal.steamAppId ? (
                <GameLink steamAppId={deal.steamAppId}>Inspect Game</GameLink>
              ) : (
                <a
                  className="text-link"
                  href={`https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View store deal →
                </a>
              )}
              {deal.source === "catalog" && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Cached offer
                </p>
              )}
              {deal.url && (
                <a
                  className="text-link deal-buy"
                  href={deal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View offer ↗
                </a>
              )}
            </div>
            <div className="deal-row-price">
              <strong>{money(deal.cheapestPrice)}</strong>
              {deal.normalPrice > deal.cheapestPrice && (
                <s>{money(deal.normalPrice)}</s>
              )}
              {deal.savingsPercent > 0 && (
                <span className="discount-label">
                  −{Math.round(deal.savingsPercent)}%
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    );
  return (
    <div className={list ? "deal-grid deal-grid-list" : "deal-grid"}>
      {deals.map((deal) => (
        <article
          key={deal.id}
          className="game-card deal-card"
          data-testid="deal-card"
        >
          <div className="deal-art relative">
            <GameArt
              appId={deal.steamAppId}
              title={deal.title}
              src={deal.thumb}
            />
            {deal.savingsPercent > 0 && (
              <span className="savings">
                -{Math.round(deal.savingsPercent)}%
              </span>
            )}
          </div>
          <div className="deal-content space-y-4 p-5">
            <h3 className="font-semibold">{deal.title}</h3>
            <p className="deal-store">
              {deal.storeId
                ? (storeNames[deal.storeId] ?? "Partner store")
                : "PC game offer"}
              {deal.steamRedeemable ? " · Steam activation" : ""}
            </p>
            <p className="flex flex-wrap items-center gap-3">
              <strong className="deal-price">
                {money(deal.cheapestPrice)}
              </strong>
              {deal.normalPrice > deal.cheapestPrice && (
                <s className="text-muted-foreground text-sm">
                  {money(deal.normalPrice)}
                </s>
              )}
            </p>
            {deal.source === "catalog" && (
              <p className="text-sm text-amber-500">
                Cached USD offer · confirm at the store
              </p>
            )}
            {deal.url && (
              <a
                className="action secondary w-full"
                href={deal.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                View offer ↗
              </a>
            )}
            {deal.steamAppId ? (
              <>
                <GameLink steamAppId={deal.steamAppId}>Inspect Game</GameLink>
                <TrackActions
                  steamAppId={deal.steamAppId}
                  title={deal.title}
                  price={deal.cheapestPrice}
                />
              </>
            ) : (
              <a
                className="text-link"
                href={`https://www.cheapshark.com/redirect?dealID=${encodeURIComponent(deal.id)}`}
                target="_blank"
                rel="noreferrer"
              >
                View store deal →
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
