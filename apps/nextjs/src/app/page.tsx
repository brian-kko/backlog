"use client";

import { useState } from "react";
import Link from "next/link";

import { storeNames } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import { canLaunch, followedGames } from "~/components/collection";
import {
  CoverArt,
  GameArt,
  LaunchLink,
  money,
  PageHeading,
  plural,
} from "~/components/game-ui";
import { GuestBanner } from "~/components/guest-banner";
import { useNewsSeen } from "~/components/news-seen";
import {
  AlertBadge,
  bestOffer,
  steamDelta,
  targetGap,
  useWishlistPrices,
} from "~/components/price-ui";
import {
  FeedGaps,
  NewsCards,
  ownPosts,
  useCollectionFeed,
} from "./_components/backlog-feed";
import { BacklogSummary } from "./_components/backlog-summary";

function PriceWatch() {
  const { items } = useBacklog();
  const { rows } = useWishlistPrices(items);
  const rank = (row: (typeof rows)[number]) =>
    (row.state === "live" || row.state === "steam-only") &&
    (row.alert === "ALL_TIME_LOW" || row.alert === "TARGET_MET")
      ? 0
      : row.state === "checking" || row.state === "unavailable"
        ? 2
        : 1;
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  if (!rows.length)
    return (
      <div className="empty-state space-y-4">
        <p>
          Wishlist a game and set the price you’d pay. Backlog compares{" "}
          {Object.keys(storeNames).length} stores and flags it when it’s worth
          buying.
        </p>
        <AddGameButton secondary label="Add a game to watch" />
      </div>
    );
  return (
    <ul className="watch-list">
      {sorted.map(({ item, prices, state, alert }) => {
        const offer = bestOffer(prices);
        const delta = steamDelta(prices);
        return (
          <li key={item.steamAppId} className="watch-row">
            <GameArt appId={item.steamAppId} title={item.title} />
            <div className="min-w-0 space-y-1">
              <h3>
                <Link href={`/game/${item.steamAppId}`}>{item.title}</Link>
              </h3>
              <AlertBadge state={state} alert={alert} />
              <p className="watch-row-meta">
                {state === "checking"
                  ? "Comparing stores…"
                  : state === "unavailable"
                    ? "Prices couldn’t be checked right now"
                    : [targetGap(item, prices), delta]
                        .filter(Boolean)
                        .map((part) => (
                          <span key={part} className="meta-part">
                            {part}
                          </span>
                        ))}
              </p>
            </div>
            <div className="watch-row-price">
              {offer ? (
                <>
                  <a href={offer.url} target="_blank" rel="noopener noreferrer">
                    <strong>{money(offer.price)}</strong>
                    <span className="sr-only">
                      {" "}
                      at {offer.store} (opens store)
                    </span>
                  </a>
                  <span>
                    {offer.state === "cached"
                      ? "last known"
                      : offer.state === "steam-only"
                        ? "on Steam"
                        : `at ${offer.store}`}
                  </span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function WhatChanged() {
  const { items } = useBacklog();
  const [since] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000);
  const seen = useNewsSeen();
  const games = followedGames(items).slice(0, 24);
  const feed = useCollectionFeed(games.map((game) => game.steamAppId));
  const titles = new Map(games.map((game) => [game.steamAppId, game.title]));
  if (!games.length)
    return (
      <p className="empty-state">
        Patch notes and events from your games will show up here.
      </p>
    );
  if (feed.isPending)
    return (
      <p role="status" className="filter-help">
        {feed.fetchStatus === "paused"
          ? "You’re offline. News will load when you reconnect."
          : "Loading Steam news…"}
      </p>
    );
  if (feed.isError || feed.data.unavailable.length === games.length)
    return (
      <p role="alert">
        Steam news is unavailable right now.{" "}
        <button className="text-link" onClick={() => void feed.refetch()}>
          Try again
        </button>
      </p>
    );
  // Patch notes and events only, newest per game, so one busy game can't
  // fill the preview. General announcements stay on Updates.
  const perGame = new Set<number>();
  const owned = new Set(
    games.filter((game) => game.isOwned).map((game) => game.steamAppId),
  );
  const recent = ownPosts(feed.data.items, titles).filter(
    (item) => item.publishedAt.getTime() > since,
  );
  // Wishlist patches stay on Updates; count them so "nothing new" is honest.
  const wishlistPatches = recent.filter(
    (item) => !owned.has(item.steamAppId) && item.category === "patch_note",
  ).length;
  const posts = recent
    // Patches for games you own, events for any of your games.
    .filter((item) =>
      owned.has(item.steamAppId)
        ? item.category !== "general"
        : item.category === "event",
    )
    .filter((item) => {
      if (perGame.has(item.steamAppId)) return false;
      perGame.add(item.steamAppId);
      return true;
    })
    .slice(0, 4);
  return (
    <div className="space-y-3">
      <FeedGaps
        unavailable={feed.data.unavailable}
        titles={titles}
        retry={() => void feed.refetch()}
      />
      {posts.length ? (
        <>
          <NewsCards compact items={posts} titles={titles} newSince={seen} />
          {posts.length < 4 && (
            <p className="filter-help">
              Nothing else in the last 30 days.{" "}
              <Link className="text-link" href="/updates">
                All updates
              </Link>
            </p>
          )}
        </>
      ) : (
        <p className="empty-inline">
          {owned.size
            ? "No patches for games you own in the last 30 days."
            : "Nothing new from your games in the last 30 days."}
          {wishlistPatches > 0 && (
            <Link className="text-link" href="/updates">
              {plural(wishlistPatches, "patch note")} for wishlist games
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

const statusLabel = {
  playing: "Playing",
  backlog: "Unplayed",
  completed: "Completed",
} as const;

function QueueCard({ game }: { game: BacklogItem }) {
  const { save } = useBacklog();
  const [error, setError] = useState(false);
  const playing = game.completionStatus === "playing";
  return (
    <article
      className="queue-card cover-card"
      data-status={game.completionStatus ?? "backlog"}
    >
      <Link href={`/game/${game.steamAppId}`} tabIndex={-1} aria-hidden="true">
        <CoverArt appId={game.steamAppId} title={game.title} />
      </Link>
      <div className="cover-body">
        <h3 className="queue-title">
          <Link href={`/game/${game.steamAppId}`}>{game.title}</Link>
        </h3>
        <p className="queue-status">
          {statusLabel[game.completionStatus ?? "backlog"]}
        </p>
        <div className="cover-actions">
          {playing && canLaunch(game) ? (
            <LaunchLink steamAppId={game.steamAppId} title={game.title}>
              Play
            </LaunchLink>
          ) : null}
          {!playing && (
            <button
              className="action secondary compact"
              onClick={() =>
                void save({
                  steamAppId: game.steamAppId,
                  title: game.title,
                  isOwned: true,
                  completionStatus: "playing",
                }).catch(() => setError(true))
              }
            >
              Mark as playing
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="field-error">
            Couldn’t update. Try again.
          </p>
        )}
      </div>
    </article>
  );
}

function PlayNext() {
  const { items, isLoading } = useBacklog();
  const queue = followedGames(items.filter((item) => item.isOwned))
    .filter((item) => item.completionStatus !== "completed")
    .slice(0, 6);
  if (isLoading) return <p role="status">Loading your library…</p>;
  if (!queue.length)
    return (
      <div className="empty-state space-y-4">
        <p>
          Nothing in progress. Add the games you own and pick one to play next.
        </p>
        <AddGameButton secondary />
      </div>
    );
  return (
    <div className="cover-shelf">
      {queue.map((game) => (
        <QueueCard key={game.steamAppId} game={game} />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="page-shell">
      <PageHeading title="Dashboard">
        What’s worth buying, what changed in your games, and what to play next,
        with prices from {Object.keys(storeNames).length} stores, not just
        Steam.
      </PageHeading>
      <GuestBanner />
      <div className="dash-grid">
        <section className="space-y-4" data-reveal>
          <div className="section-heading">
            <h2>Price watch</h2>
            <Link className="text-link" href="/wishlist">
              Wishlist
            </Link>
          </div>
          <PriceWatch />
          <Link className="text-link" href="/deals">
            Browse deals across stores
          </Link>
        </section>
        <section className="space-y-4" data-reveal>
          <div className="section-heading">
            <h2>Play next</h2>
            <Link className="text-link" href="/library">
              Library
            </Link>
          </div>
          <PlayNext />
        </section>
      </div>
      <section className="space-y-4" data-reveal>
        <div className="section-heading">
          <h2>What changed</h2>
          <Link className="text-link" href="/updates">
            All updates
          </Link>
        </div>
        <WhatChanged />
      </section>
      <BacklogSummary />
    </main>
  );
}
