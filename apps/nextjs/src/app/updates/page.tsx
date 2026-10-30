"use client";

import { useState } from "react";

import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { PageHeading } from "~/components/game-ui";
import { BacklogFeed } from "../_components/backlog-feed";

export default function UpdatesPage() {
  const [appId, setAppId] = useState(1091500);
  const [customId, setCustomId] = useState("");
  const { items } = useBacklog();
  const title =
    items.find((game) => game.steamAppId === appId)?.title ??
    featuredGames.find((game) => game.steamAppId === appId)?.title ??
    `Steam App ${appId}`;
  return (
    <main className="page-shell">
      <PageHeading eyebrow="PATCH NOTES & LIVE EVENTS" title="Stay in the loop">
        The latest fixes, fresh content, and things worth logging in for.
      </PageHeading>
      <section aria-label="Game selector" className="panel space-y-5">
        {items.length > 0 && (
          <label className="field-label max-w-lg">
            Updates for your games
            <select
              className="form-control mt-2 w-full"
              value={
                items.some((item) => item.steamAppId === appId) ? appId : ""
              }
              onChange={(event) => {
                if (event.target.value) setAppId(Number(event.target.value));
              }}
            >
              <option value="">Choose from your collection</option>
              {items.map((item) => (
                <option key={item.steamAppId} value={item.steamAppId}>
                  {item.title}
                  {item.isOwned ? " — Library" : " — Wishlist"}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="filter-bar">
          {featuredGames.map((game) => (
            <button
              className="filter-pill"
              key={game.steamAppId}
              aria-pressed={appId === game.steamAppId}
              onClick={() => setAppId(game.steamAppId)}
            >
              {game.title} [{game.steamAppId}]
            </button>
          ))}
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setAppId(Number(customId));
          }}
        >
          <div>
            <label className="field-label" htmlFor="custom-app-id">
              Custom Steam AppID
            </label>
            <input
              className="form-control"
              id="custom-app-id"
              type="number"
              min="1"
              max="2147483647"
              step="1"
              required
              value={customId}
              onChange={(event) => setCustomId(event.target.value)}
              placeholder="e.g. 570"
            />
          </div>
          <button className="action secondary" type="submit">
            Load game
          </button>
        </form>
      </section>
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">
          {title}{" "}
          <span className="text-muted-foreground text-base">· Steam news</span>
        </h2>
        <BacklogFeed key={appId} steamAppId={appId} />
      </section>
    </main>
  );
}
