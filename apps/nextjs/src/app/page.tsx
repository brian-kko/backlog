"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { DealCards } from "~/components/deal-cards";
import {
  GameArt,
  GameLink,
  LaunchLink,
  PageHeading,
} from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";
import { NewsCards } from "./_components/backlog-feed";
import { BacklogSummary } from "./_components/backlog-summary";

export default function HomePage() {
  const { items, isGuest, error } = useBacklog();
  const trpc = useTRPC();
  const deals = useQuery(trpc.backlog.searchDeals.queryOptions({}));
  const feed = useQuery(
    trpc.backlog.getSteamFeed.queryOptions({ steamAppId: 1091500 }),
  );
  const owned = items
    .filter((item) => item.isOwned)
    .sort(
      (a, b) =>
        Number(b.completionStatus === "playing") -
        Number(a.completionStatus === "playing"),
    );
  const quickLaunch = (owned.length ? owned : featuredGames).slice(0, 3);
  const featured = quickLaunch[0];
  const completed = owned.filter(
    (item) => item.completionStatus === "completed",
  ).length;
  const updates = [
    ...(feed.data?.patchNotes ?? []),
    ...(feed.data?.events ?? []),
  ]
    .filter((item) => item.official !== false)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 4);
  return (
    <main className="page-shell">
      <PageHeading eyebrow="YOUR COLLECTION" title="Dashboard">
        Your games, prices, and recent updates in one place.
      </PageHeading>
      {isGuest && (
        <aside className="guest-banner">
          <div>
            <strong>You’re exploring in Guest Mode</strong>
            <p>
              Your collection stays in this browser. Sign in to save it to your
              account.
            </p>
          </div>
          <Link href="/deals" className="action secondary">
            Explore live sales →
          </Link>
        </aside>
      )}
      {error && <p role="alert">{error}</p>}
      <BacklogSummary />
      <section className="space-y-5">
        <div className="section-heading">
          <h2>Jump Back In</h2>
          <Link className="text-link" href="/library">
            Your library →
          </Link>
        </div>
        <div className="feature-layout">
          {featured && (
            <article className="feature-game">
              <GameArt
                appId={featured.steamAppId}
                title={featured.title}
                priority
              />
              <div className="feature-copy">
                <p className="eyebrow">
                  {owned.length ? "From your library" : "Explore a game"}
                </p>
                <h3>{featured.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {items.find((item) => item.steamAppId === featured.steamAppId)
                    ?.completionStatus === "playing"
                    ? "Currently playing"
                    : owned.length
                      ? "Ready for your next session"
                      : "Add a game from Deals to start your collection."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-5">
                  {owned.length > 0 && (
                    <LaunchLink steamAppId={featured.steamAppId} />
                  )}
                  <GameLink steamAppId={featured.steamAppId}>Details</GameLink>
                </div>
              </div>
            </article>
          )}
          <aside
            className="collection-queue"
            aria-label="Your collection at a glance"
          >
            <div className="queue-heading">
              <h3>
                {owned.length ? "In your library" : "Explore these games"}
              </h3>
              <span className="eyebrow">
                {owned.length ? `${owned.length} GAMES` : "Featured"}
              </span>
            </div>
            {quickLaunch.map((game, index) => (
              <div className="queue-item" key={game.steamAppId}>
                <span className="queue-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <GameArt appId={game.steamAppId} title={game.title} />
                <div className="space-y-2">
                  <h4>{game.title}</h4>
                  <GameLink steamAppId={game.steamAppId}>Open game</GameLink>
                </div>
              </div>
            ))}
            <p className="queue-footer">
              {owned.length
                ? `${completed} of ${owned.length} games completed.`
                : "Browse Deals to build your library."}
            </p>
          </aside>
        </div>
      </section>
      <div className="journal-columns">
        <section className="space-y-5">
          <div className="section-heading">
            <h2>Top Live Deals</h2>
            <Link className="text-link" href="/deals">
              View All Deals →
            </Link>
          </div>
          {deals.isPending ? (
            <p role="status">Loading live deals…</p>
          ) : deals.isError ? (
            <p role="alert">
              Deals are temporarily unavailable.{" "}
              <button
                className="text-link"
                onClick={() => void deals.refetch()}
              >
                Try again
              </button>
            </p>
          ) : deals.data.length ? (
            <DealCards compact deals={deals.data.slice(0, 4)} />
          ) : (
            <p className="empty-state">
              No featured deals available right now.
            </p>
          )}
        </section>
        <section className="space-y-5">
          <div className="section-heading">
            <h2>Latest Game Updates</h2>
            <Link className="text-link" href="/updates">
              View All Updates →
            </Link>
          </div>
          {feed.isPending ? (
            <p role="status">Loading Steam news…</p>
          ) : feed.isError ? (
            <p role="alert">
              Steam news is temporarily unavailable.{" "}
              <button className="text-link" onClick={() => void feed.refetch()}>
                Try again
              </button>
            </p>
          ) : updates.length ? (
            <NewsCards compact items={updates} />
          ) : (
            <p className="empty-state">No recent announcements.</p>
          )}
        </section>
      </div>
    </main>
  );
}
