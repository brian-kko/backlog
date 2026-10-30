"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";

import { useTRPC } from "~/trpc/react";

type Feed = RouterOutputs["backlog"]["getSteamFeed"];
export function NewsCards({
  items,
  compact = false,
}: {
  items: Feed["events"];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "news-list news-list-compact" : "news-list"}>
      {items.map((item, index) => (
        <article key={item.id} className="news-entry">
          <span className="news-index" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge">
                {item.category === "patch_note"
                  ? "Patch Notes"
                  : item.category === "general"
                    ? "Announcement"
                    : "Live Event"}
              </span>
              <time
                className="text-muted-foreground text-xs"
                dateTime={item.publishedAt.toISOString()}
              >
                {item.publishedAt.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
            </div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {item.cleanSummary}
            </p>
            {/^https?:\/\//i.test(item.url) && (
              <a
                className="text-link text-sm"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read Full Post on Steam →
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function BacklogFeed({
  steamAppId,
  initialFeed,
}: {
  steamAppId: number;
  initialFeed?: Feed;
}) {
  const trpc = useTRPC();
  const [tab, setTab] = useState<"patches" | "events">("patches");
  const [includeCommunity, setIncludeCommunity] = useState(false);
  const query = useQuery(
    trpc.backlog.getSteamFeed.queryOptions(
      { steamAppId },
      { enabled: !initialFeed },
    ),
  );
  const feed = initialFeed ?? query.data;
  const patches = feed?.patchNotes.filter(
    (item) => includeCommunity || item.official !== false,
  );
  const events = feed?.events.filter(
    (item) => includeCommunity || item.official !== false,
  );
  const items = tab === "patches" ? patches : events;
  return (
    <section aria-label="Game news" className="space-y-5">
      <div role="tablist" aria-label="News categories" className="filter-bar">
        {(["patches", "events"] as const).map((value) => (
          <button
            key={value}
            className="filter-pill"
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
            {value === "patches"
              ? `Patch Notes (${patches?.length ?? 0})`
              : `Live Events & Announcements (${events?.length ?? 0})`}
          </button>
        ))}
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          checked={includeCommunity}
          onChange={(event) => setIncludeCommunity(event.target.checked)}
        />
        Include community and press posts
      </label>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {!feed && query.isPending ? (
          <p role="status">Loading Steam news…</p>
        ) : !feed && query.isError ? (
          <p role="alert">
            Unable to load Steam news.{" "}
            <button className="text-link" onClick={() => void query.refetch()}>
              Try again
            </button>
          </p>
        ) : items?.length ? (
          <NewsCards items={items} />
        ) : (
          <p className="empty-state">
            No {tab === "patches" ? "patch notes" : "events or announcements"}{" "}
            available for this game yet.
          </p>
        )}
      </div>
    </section>
  );
}
