"use client";

import { useEffect, useState } from "react";

import type { NewsTab } from "../_components/backlog-feed";
import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import { followedGames } from "~/components/collection";
import { PageHeading } from "~/components/game-ui";
import { markNewsSeen, useNewsSeen } from "~/components/news-seen";
import {
  BacklogFeed,
  CollectionFeed,
  ownPosts,
  useCollectionFeed,
} from "../_components/backlog-feed";

const maxFollowed = 24;

function readGame() {
  const value = Number(new URLSearchParams(window.location.search).get("game"));
  return Number.isSafeInteger(value) && value > 0 ? value : "all";
}

export default function UpdatesPage() {
  const { items, isLoading } = useBacklog();
  const games = followedGames(items);
  const [selected, setSelected] = useState<number | "all">("all");
  const [tab, setTab] = useState<NewsTab>("patches");
  const seen = useNewsSeen();
  // Posts newer than the previous visit stay marked "New" during this visit.
  const [newSince, setNewSince] = useState<number | null>(null);
  useEffect(() => {
    const restore = () => setSelected(readGame());
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (newSince !== null) return;
    // The stored timestamp is only readable after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNewSince(seen);
    // First visit: start tracking from now rather than flagging everything.
    if (seen === 0) markNewsSeen();
  }, [seen, newSince]);
  function choose(value: number | "all") {
    setSelected(value);
    const url = value === "all" ? "/updates" : `/updates?game=${value}`;
    window.history.pushState(null, "", url);
  }
  const current =
    selected === "all"
      ? undefined
      : games.find((game) => game.steamAppId === selected);
  const following = games.slice(0, maxFollowed);
  const feed = useCollectionFeed(following.map((game) => game.steamAppId));
  const [countSince] = useState(() => Date.now() - 30 * 24 * 60 * 60 * 1000);
  const titles = new Map(games.map((game) => [game.steamAppId, game.title]));
  const posts = ownPosts(feed.data?.items ?? [], titles);
  const countLabel = tab === "patches" ? "Patch notes" : "Events";
  const recentPosts = posts.filter(
    (item) =>
      (tab === "patches"
        ? item.category === "patch_note"
        : item.category !== "patch_note") &&
      item.publishedAt.getTime() > countSince,
  );
  const recent = new Map<number, number>();
  for (const item of recentPosts)
    recent.set(item.steamAppId, (recent.get(item.steamAppId) ?? 0) + 1);
  const unread =
    (newSince ?? 0) > 0 &&
    Boolean(
      feed.data?.items.some(
        (item) => item.publishedAt.getTime() > (newSince ?? 0),
      ),
    );
  return (
    <main className="page-shell updates-page">
      <PageHeading
        title="Updates"
        stat={
          feed.data ? (
            <>
              <strong>{recentPosts.length}</strong>{" "}
              {tab === "patches"
                ? recentPosts.length === 1
                  ? "patch"
                  : "patches"
                : recentPosts.length === 1
                  ? "event"
                  : "events"}{" "}
              in the last 30 days
            </>
          ) : null
        }
        deck={following.map(({ steamAppId, title }) => ({ steamAppId, title }))}
      >
        Official patch notes and events from the games you own and watch, in one
        feed. Store promotions are left out.
      </PageHeading>
      {!isLoading && !games.length ? (
        <div className="empty-state space-y-4">
          <p>
            Add games to your library or wishlist and their patch notes and
            events will appear here.
          </p>
          <AddGameButton />
        </div>
      ) : (
        <div className="updates-layout">
          <div className="updates-filter">
            <p className="rail-label" aria-hidden="true">
              Your games
            </p>
            {games.length <= 8 && (
              <p className="updates-count-help">
                {countLabel} in the last 30 days
              </p>
            )}
            {games.length > 8 ? (
              <label className="inline-select self-start">
                Show news for
                <select
                  className="form-control"
                  value={selected}
                  onChange={(event) =>
                    choose(
                      event.target.value === "all"
                        ? "all"
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="all">
                    {games.length > maxFollowed
                      ? `${maxFollowed} prioritized games`
                      : "All my games"}
                  </option>
                  {games.map((game) => (
                    <option key={game.steamAppId} value={game.steamAppId}>
                      {game.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div
                role="group"
                aria-label="Show news for"
                className="chip-scroller"
              >
                <button
                  className="filter-pill"
                  aria-pressed={selected === "all"}
                  onClick={() => choose("all")}
                >
                  {games.length > maxFollowed
                    ? `${maxFollowed} prioritized games`
                    : "All my games"}
                </button>
                {games.map((game) => {
                  const count =
                    feed.data &&
                    !feed.data.unavailable.includes(game.steamAppId)
                      ? (recent.get(game.steamAppId) ?? 0)
                      : undefined;
                  return (
                    <button
                      className="filter-pill"
                      key={game.steamAppId}
                      aria-labelledby={`updates-game-${game.steamAppId}`}
                      aria-describedby={`updates-count-${game.steamAppId}`}
                      aria-pressed={selected === game.steamAppId}
                      onClick={() => choose(game.steamAppId)}
                    >
                      <span id={`updates-game-${game.steamAppId}`}>
                        {game.title}
                      </span>
                      <span
                        className="pill-count"
                        data-empty={count === undefined || count === 0}
                        aria-hidden="true"
                        title={`${countLabel} in the last 30 days`}
                      >
                        {count !== undefined && count > 0 && (
                          <>
                            {count}
                            <span className="updates-count-period">
                              in 30 days
                            </span>
                          </>
                        )}
                      </span>
                      <span
                        className="sr-only"
                        id={`updates-count-${game.steamAppId}`}
                      >
                        {count === undefined
                          ? feed.isPending && feed.fetchStatus !== "paused"
                            ? `Loading ${countLabel.toLowerCase()} count`
                            : `${countLabel} count unavailable`
                          : `${count} ${tab === "patches" ? (count === 1 ? "patch note" : "patch notes") : count === 1 ? "event" : "events"} in the last 30 days`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {current ? (
            <section data-reveal className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {current.title}
              </h2>
              <BacklogFeed
                key={current.steamAppId}
                steamAppId={current.steamAppId}
                level={2}
                tab={tab}
                onTabChange={setTab}
                countSince={countSince}
              />
            </section>
          ) : (
            <section data-reveal className="space-y-4">
              {games.length > following.length && (
                <p className="filter-help">
                  Following {following.length} of your games, prioritized as
                  playing, then unplayed, then wishlisted. Choose any other game
                  above to see its news.
                </p>
              )}
              <CollectionFeed
                games={following}
                newSince={newSince ?? 0}
                level={2}
                tab={tab}
                onTabChange={setTab}
                countSince={countSince}
              >
                {unread && (
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      markNewsSeen();
                      setNewSince(Date.now());
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </CollectionFeed>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
