"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@acme/ui";
import { itemPlatform, platformNames } from "@acme/validators";

import type { Prices } from "~/components/price-ui";
import { BacklogEditor } from "~/components/backlog-editor";
import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { canLaunch } from "~/components/collection";
import { headerArt, LaunchLink, money, storeName } from "~/components/game-ui";
import {
  bestOffer,
  lowLabel,
  priceLabel,
  PricesChecked,
  steamDelta,
  targetGap,
} from "~/components/price-ui";
import { useTRPC } from "~/trpc/react";
import { BacklogFeed } from "../../_components/backlog-feed";

/** True when most letters are capitals, e.g. "THE CRITICALLY ACCLAIMED…". */
const shouting = (text: string) => {
  const letters = text.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  return letters.length >= 4 && upper.length / letters.length >= 0.8;
};
/** Steam sometimes stores names and blurbs in all caps; display them calmly. */
const titleCase = (text: string) =>
  shouting(text)
    ? text
        .toLowerCase()
        .replace(
          /(^|[\s:–-])(\p{L})/gu,
          (_, p, c: string) => `${p}${c.toUpperCase()}`,
        )
    : text;
// Words that stay capitalised when a shouting sentence is calmed down.
const keepUpper = new Set([
  "RPG",
  "ARPG",
  "JRPG",
  "FPS",
  "RTS",
  "MMO",
  "MMORPG",
  "DLC",
  "PC",
  "VR",
  "AI",
  "PVP",
  "PVE",
  "2D",
  "3D",
  "II",
  "III",
  "IV",
  "VI",
  "VII",
  "VIII",
  "IX",
  "XI",
  "XII",
]);

/**
 * Calms each shouting sentence on its own; mixed-case text is untouched.
 * Acronyms and words from the game's title keep their capitals.
 */
const sentenceCase = (text: string, title: string) => {
  const titleWords = new Map(
    title
      .split(/\s+/)
      .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .map((word) => [word.toUpperCase(), word]),
  );
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      shouting(sentence)
        ? sentence
            .split(/(\s+)/)
            .map((token) => {
              const bare = token.replace(/[^\p{L}\p{N}]/gu, "");
              if (keepUpper.has(bare)) return token;
              const fromTitle = titleWords.get(bare.toUpperCase());
              return fromTitle
                ? token.replace(bare, fromTitle)
                : token.toLowerCase();
            })
            .join("")
            .replace(
              /^(\P{L}*)(\p{L})/u,
              (_, p: string, c: string) => `${p}${c.toUpperCase()}`,
            )
        : sentence,
    )
    .join(" ");
};

/** Steam first as the baseline, then other stores, cheapest first. */
function StorePrices({
  prices,
  steamUrl,
  collapsed = false,
}: {
  prices: Prices;
  steamUrl: string;
  /** Owned games tuck the comparison away behind a toggle. */
  collapsed?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const steamDeal = prices.deals.find((deal) => deal.storeID === "1");
  const steam = steamDeal?.price ?? prices.steamPrice;
  const others = prices.deals.filter((deal) => deal.storeID !== "1");
  // Owned games show the baseline and two cheapest; the rest on request.
  const preview = collapsed ? 2 : 5;
  const visible = showAll ? others : others.slice(0, preview);
  const total = others.length + (steam != null ? 1 : 0);
  return (
    <>
      <ul className="store-prices">
        {steam != null && (
          <li className="store-baseline">
            <a
              href={steamDeal?.url ?? steamUrl}
              target="_blank"
              rel="noreferrer"
            >
              Steam <span className="baseline-tag">baseline</span>
              <span aria-hidden="true"> ↗</span>
            </a>
            <span className="store-price">
              <strong>{money(steam)}</strong>
            </span>
          </li>
        )}
        {visible.map((deal) => (
          <li key={deal.dealID}>
            <a href={deal.url} target="_blank" rel="noreferrer">
              {storeName(deal.storeID)}
              <span aria-hidden="true"> ↗</span>
            </a>
            <span className="store-price">
              {steam != null && deal.price < steam && (
                <span className="store-saving">
                  −{money(steam - deal.price)}
                </span>
              )}
              {deal.retailPrice > deal.price && (
                <s>
                  <span className="sr-only">was </span>
                  {money(deal.retailPrice)}
                </s>
              )}
              <strong>{money(deal.price)}</strong>
            </span>
          </li>
        ))}
      </ul>
      {others.length > preview && (
        <button
          type="button"
          className="text-link"
          aria-expanded={showAll}
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Show fewer stores" : `Compare all ${total} stores`}
        </button>
      )}
    </>
  );
}

export function GameHub({ steamAppId }: { steamAppId: number }) {
  const trpc = useTRPC();
  const game = useQuery(
    trpc.backlog.getGameDetails.queryOptions({ steamAppId }),
  );
  const { items } = useBacklog();
  const item = items.find((value) => value.steamAppId === steamAppId);
  const title =
    item?.title ??
    featuredGames.find((value) => value.steamAppId === steamAppId)?.title ??
    titleCase(
      game.data?.metadata?.name ??
        game.data?.prices?.title ??
        `Steam app ${steamAppId}`,
    );
  const prices = game.data?.prices ?? undefined;
  const offer = bestOffer(prices);
  const description = game.data?.metadata?.short_description
    ?.replace(/<[^>]*>/g, "")
    .trim();
  const steamUrl = `https://store.steampowered.com/app/${steamAppId}/`;
  const back = item?.isOwned
    ? { href: "/library", label: "Library" }
    : item
      ? { href: "/wishlist", label: "Wishlist" }
      : { href: "/deals", label: "Deals" };
  return (
    <main className="page-shell">
      <Link className="back-link" href={back.href}>
        ← {back.label}
      </Link>
      <section data-reveal className="game-hero">
        <Image
          className="hub-art"
          src={game.data?.metadata?.header_image ?? headerArt(steamAppId)}
          width={460}
          height={215}
          unoptimized
          priority
          alt={`${title} Steam header artwork`}
        />
        <div className="space-y-4">
          <h1 className="hero-title">{title}</h1>
          {description && (
            <p
              className={cn(
                "text-muted-foreground max-w-prose leading-relaxed",
                item?.isOwned && "max-sm:hidden",
              )}
            >
              {sentenceCase(description, title)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {canLaunch(item) ? (
              <LaunchLink
                steamAppId={steamAppId}
                title={title}
                testId="launch-game-btn"
              />
            ) : offer && !item?.isOwned ? (
              <a
                className="action"
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {offer.state === "cached"
                  ? `Check price at ${offer.store}`
                  : `Buy for ${money(offer.price)} at ${offer.store}`}
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}
            <a
              className="action secondary"
              href={steamUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Steam store page <span aria-hidden="true">↗</span>
            </a>
          </div>
          {item?.isOwned && !canLaunch(item) && (
            <p className="hero-meta">
              Plays on {platformNames[itemPlatform(item)]}. Launch it from
              there.
            </p>
          )}
        </div>
      </section>
      {game.isError && (
        <p role="alert">
          Game details are unavailable right now.{" "}
          <button className="text-link" onClick={() => void game.refetch()}>
            Try again
          </button>
        </p>
      )}
      <section data-reveal className="hub-grid">
        {/* Owned games lead with collection controls, in DOM and visual order. */}
        {item?.isOwned && (
          <BacklogEditor
            steamAppId={steamAppId}
            title={title}
            loading={game.isPending && game.fetchStatus !== "paused" && !item}
          />
        )}
        <div className="panel space-y-4">
          <div className="section-heading">
            <h2>Prices across stores</h2>
          </div>
          {game.fetchStatus === "paused" ? (
            <p role="status" className="filter-help">
              You’re offline. Prices will load when you reconnect.
            </p>
          ) : game.isPending ? (
            <p role="status">Checking stores…</p>
          ) : offer && prices ? (
            <>
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">
                  {priceLabel(prices)}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="hub-price">{money(offer.price)}</p>
                  <p className="text-sm font-medium">
                    {steamDelta(prices) ?? `at ${offer.store}`}
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">
                  {lowLabel(prices)}{" "}
                  {prices.historicalLow == null
                    ? "not recorded"
                    : money(prices.historicalLow)}
                  {item && !item.isOwned ? ` · ${targetGap(item, prices)}` : ""}
                </p>
              </div>
              {offer.state !== "cached" && game.dataUpdatedAt ? (
                <PricesChecked at={game.dataUpdatedAt} />
              ) : null}
              {offer.state === "cached" && (
                <p className="price-source-note">
                  Live prices couldn’t be reached. Saved prices from{" "}
                  {offer.checkedOn}; check the store before buying.
                </p>
              )}
              {offer.state === "steam-only" && (
                <p className="price-source-note">
                  Other stores couldn’t be checked right now; this is Steam’s
                  price.
                </p>
              )}
              <StorePrices
                prices={prices}
                steamUrl={steamUrl}
                collapsed={item?.isOwned}
              />
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No store is listing a price for this game right now.{" "}
              <a
                className="text-link"
                href={steamUrl}
                target="_blank"
                rel="noreferrer"
              >
                Check Steam ↗
              </a>
            </p>
          )}
        </div>

        {!item?.isOwned && (
          <BacklogEditor
            steamAppId={steamAppId}
            title={title}
            loading={game.isPending && game.fetchStatus !== "paused" && !item}
          />
        )}
      </section>
      <section data-reveal className="space-y-5">
        <div className="section-heading">
          <h2>Patch notes &amp; events</h2>
        </div>
        {game.fetchStatus === "paused" ? (
          <p role="status" className="filter-help">
            You’re offline. News will load when you reconnect.
          </p>
        ) : game.isPending ? (
          <p role="status">Loading Steam news…</p>
        ) : (
          <BacklogFeed
            key={steamAppId}
            steamAppId={steamAppId}
            initialFeed={game.data?.feed ?? undefined}
          />
        )}
      </section>
    </main>
  );
}
