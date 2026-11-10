"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import { isAboutSequel } from "@acme/validators";

import { useTRPC } from "~/trpc/react";

type Feed = RouterOutputs["backlog"]["getSteamFeed"];
type NewsItem = Feed["events"][number];

const categoryLabel = (category: NewsItem["category"]) =>
  category === "patch_note"
    ? "Patch notes"
    : category === "general"
      ? "Announcement"
      : "Event";

export function NewsCards({
  items,
  compact = false,
  titles,
  newSince = 0,
}: {
  items: NewsItem[];
  compact?: boolean;
  /** Game titles by AppID; when given, each post names its game. */
  titles?: Map<number, string>;
  /** Posts published after this time (ms) are marked "New". */
  newSince?: number;
}) {
  return (
    <div className={compact ? "news-list news-list-compact" : "news-list"}>
      {items.map((item) => (
        <article key={item.id} className="news-entry">
          <div className="news-meta">
            {titles && (
              <Link className="news-game" href={`/game/${item.steamAppId}`}>
                {titles.get(item.steamAppId) ?? `Steam app ${item.steamAppId}`}
              </Link>
            )}
            <span className="badge" data-category={item.category}>
              {categoryLabel(item.category)}
            </span>
            {item.official === false && (
              <span className="badge">Community</span>
            )}
            {newSince > 0 && item.publishedAt.getTime() > newSince && (
              <span className="new-badge">New</span>
            )}
            <time dateTime={item.publishedAt.toISOString()}>
              {item.publishedAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
            </time>
          </div>
          <h3>{item.title}</h3>
          {item.cleanSummary && <p>{item.cleanSummary}</p>}
          {item.category === "patch_note" && /^\d+$/.test(item.id) && (
            <Link
              className="text-link news-read"
              href={`/patch/${item.steamAppId}/${item.id}`}
            >
              Read patch notes<span className="sr-only">: {item.title}</span>
            </Link>
          )}
          {/^https?:\/\//i.test(item.url) && (
            <a
              className="text-link"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Read on Steam<span className="sr-only">: {item.title}</span>{" "}
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </article>
      ))}
    </div>
  );
}

const day = 24 * 60 * 60 * 1000;
const olderThan = 183 * day;
function dateGroup(date: Date, now: number) {
  const age = now - date.getTime();
  return age < 7 * day
    ? "Last 7 days"
    : age < 30 * day
      ? "Last 30 days"
      : age < olderThan
        ? "Last 6 months"
        : "Older";
}

/** Posts grouped by recency; anything older than six months is folded away. */
function GroupedNews({
  items,
  titles,
  newSince,
}: {
  items: NewsItem[];
  titles?: Map<number, string>;
  newSince?: number;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const [now] = useState(() => Date.now());
  const recent = items.filter(
    (item) => now - item.publishedAt.getTime() < olderThan,
  );
  const older = items.length - recent.length;
  const shown = showOlder || !recent.length ? items : recent;
  const groups = new Map<string, NewsItem[]>();
  for (const item of shown) {
    const group = dateGroup(item.publishedAt, now);
    groups.set(group, [...(groups.get(group) ?? []), item]);
  }
  return (
    <div className="space-y-6">
      {[...groups].map(([group, posts]) => (
        <section key={group} aria-label={group}>
          <h3 className="date-group">{group}</h3>
          <NewsCards items={posts} titles={titles} newSince={newSince} />
        </section>
      ))}
      {older > 0 && recent.length > 0 && (
        <button
          type="button"
          className="text-link"
          aria-expanded={showOlder}
          onClick={() => setShowOlder((value) => !value)}
        >
          {showOlder
            ? "Hide older posts"
            : `Show ${older} older ${older === 1 ? "post" : "posts"}`}
        </button>
      )}
    </div>
  );
}

/** Patch notes / events tabs over an already-loaded list of posts. */
export function NewsTabs({
  items,
  titles,
  emptyHint,
  newSince,
  children,
}: {
  items: NewsItem[] | undefined;
  titles?: Map<number, string>;
  emptyHint: string;
  newSince?: number;
  children?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"patches" | "events">("patches");
  const patches = items?.filter((item) => item.category === "patch_note");
  const events = items?.filter((item) => item.category !== "patch_note");
  const visible = tab === "patches" ? patches : events;
  return (
    <section aria-label="Game news" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="tablist" aria-label="News categories" className="tab-bar">
          {(["patches", "events"] as const).map((value) => (
            <button
              key={value}
              className="tab"
              id={`tab-${value}`}
              data-testid={`tab-${value}`}
              role="tab"
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              tabIndex={tab === value ? 0 : -1}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? "patches"
                      : event.key === "End"
                        ? "events"
                        : value === "patches"
                          ? "events"
                          : "patches";
                  setTab(next);
                  document.getElementById(`tab-${next}`)?.focus();
                }
              }}
            >
              <span className="sm:hidden">
                {value === "patches" ? "Patches" : "Events"}
              </span>
              <span className="hidden sm:inline">
                {value === "patches" ? "Patch notes" : "Events & announcements"}
              </span>
              <span className="tab-count">
                {(value === "patches" ? patches : events)?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
        {children}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {visible?.length ? (
          <GroupedNews
            key={tab}
            items={visible}
            titles={titles}
            newSince={newSince}
          />
        ) : (
          <p className="empty-state">
            No {tab === "patches" ? "patch notes" : "events or announcements"}{" "}
            {emptyHint}
          </p>
        )}
      </div>
    </section>
  );
}

function FeedStatus({
  pending,
  error,
  retry,
  paused = false,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
  /** Query is waiting for the network to come back. */
  paused?: boolean;
}) {
  if (paused)
    return (
      <p role="status" className="filter-help">
        You’re offline. News will load when you reconnect.
      </p>
    );
  if (pending) return <p role="status">Loading Steam news…</p>;
  if (error)
    return (
      <p role="alert">
        Steam news is unavailable right now.{" "}
        <button className="text-link" onClick={retry}>
          Try again
        </button>
      </p>
    );
  return null;
}

/** One game's news, with an option to include community and press posts. */
export function BacklogFeed({
  steamAppId,
  initialFeed,
}: {
  steamAppId: number;
  initialFeed?: Feed;
}) {
  const trpc = useTRPC();
  const [includeCommunity, setIncludeCommunity] = useState(false);
  // A failed server-side feed is retried here; fresh data replaces it.
  const query = useQuery(
    trpc.backlog.getSteamFeed.queryOptions(
      { steamAppId },
      { enabled: !initialFeed?.available },
    ),
  );
  const feed = query.data?.available ? query.data : (initialFeed ?? query.data);
  if (!feed?.available)
    return (
      <FeedStatus
        paused={query.fetchStatus === "paused"}
        pending={!feed && query.isPending}
        error={query.isError || feed?.available === false}
        retry={() => void query.refetch()}
      />
    );
  const items = [...feed.patchNotes, ...feed.events]
    .filter((item) => includeCommunity || item.official !== false)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
  return (
    <NewsTabs items={items} emptyHint="for this game yet.">
      <label className="check-label">
        <input
          type="checkbox"
          checked={includeCommunity}
          onChange={(event) => setIncludeCommunity(event.target.checked)}
        />
        Include community and press posts
      </label>
    </NewsTabs>
  );
}

/** Official posts across several games, newest first. */
export function useCollectionFeed(steamAppIds: number[], limit = 60) {
  const trpc = useTRPC();
  return useQuery(
    trpc.backlog.getCollectionFeed.queryOptions(
      { steamAppIds: steamAppIds.slice(0, 24), limit },
      { enabled: steamAppIds.length > 0, staleTime: 5 * 60 * 1000 },
    ),
  );
}

/** Drops posts about a sequel that Steam cross-posted to the original game. */
export function ownPosts(
  items: NewsItem[],
  titles: Map<number, string>,
) {
  return items.filter((item) => {
    const title = titles.get(item.steamAppId);
    return !title || !isAboutSequel(item.title, title);
  });
}

/** Says which games' news couldn't be loaded, so gaps never read as "quiet". */
export function FeedGaps({
  unavailable,
  titles,
  retry,
}: {
  unavailable: number[];
  titles: Map<number, string>;
  retry: () => void;
}) {
  if (!unavailable.length) return null;
  const names = unavailable.map((id) => titles.get(id) ?? `app ${id}`);
  return (
    <p className="source-notice" role="note">
      Steam news for {names.length > 2 ? `${names.length} games` : names.join(" and ")}{" "}
      couldn’t be loaded.{" "}
      <button className="text-link" onClick={retry}>
        Try again
      </button>
    </p>
  );
}

export function CollectionFeed({
  games,
  newSince,
  children,
}: {
  games: { steamAppId: number; title: string }[];
  newSince?: number;
  children?: React.ReactNode;
}) {
  const feed = useCollectionFeed(games.map((game) => game.steamAppId));
  const titles = new Map(games.map((game) => [game.steamAppId, game.title]));
  if (!feed.data)
    return (
      <FeedStatus
        paused={feed.fetchStatus === "paused"}
        pending={feed.isPending}
        error={feed.isError}
        retry={() => void feed.refetch()}
      />
    );
  if (feed.data.unavailable.length === games.length)
    return (
      <FeedStatus pending={false} error retry={() => void feed.refetch()} />
    );
  return (
    <div className="space-y-4">
      <FeedGaps
        unavailable={feed.data.unavailable}
        titles={titles}
        retry={() => void feed.refetch()}
      />
      <NewsTabs
        items={ownPosts(feed.data.items, titles)}
        titles={titles}
        newSince={newSince}
        emptyHint="from your games recently."
      >
        {children}
      </NewsTabs>
    </div>
  );
}
