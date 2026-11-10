"use client";

import { useEffect, useState } from "react";

import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import { followedGames } from "~/components/collection";
import { PageHeading } from "~/components/game-ui";
import { markNewsSeen, useNewsSeen } from "~/components/news-seen";
import {
  BacklogFeed,
  CollectionFeed,
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
  const unread =
    (newSince ?? 0) > 0 &&
    Boolean(
      feed.data?.items.some(
        (item) => item.publishedAt.getTime() > (newSince ?? 0),
      ),
    );
  return (
    <main className="page-shell">
      <PageHeading title="Updates">
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
        <>
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
              {games.map((game) => (
                <button
                  className="filter-pill"
                  key={game.steamAppId}
                  aria-pressed={selected === game.steamAppId}
                  onClick={() => choose(game.steamAppId)}
                >
                  {game.title}
                </button>
              ))}
            </div>
          )}
          {current ? (
            <section data-reveal className="space-y-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {current.title}
              </h2>
              <BacklogFeed
                key={current.steamAppId}
                steamAppId={current.steamAppId}
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
              <CollectionFeed games={following} newSince={newSince ?? 0}>
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
        </>
      )}
    </main>
  );
}
