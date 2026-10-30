"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";

import { storeNames } from "@acme/validators";

import { BacklogEditor } from "~/components/backlog-editor";
import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { headerArt, LaunchLink, money } from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";
import { BacklogFeed } from "../../_components/backlog-feed";

export function GameHub({ steamAppId }: { steamAppId: number }) {
  const trpc = useTRPC();
  const game = useQuery(
    trpc.backlog.getGameDetails.queryOptions({ steamAppId }),
  );
  const { items } = useBacklog();
  const item = items.find((value) => value.steamAppId === steamAppId);
  const title =
    game.data?.metadata?.name ??
    game.data?.prices?.title ??
    item?.title ??
    featuredGames.find((value) => value.steamAppId === steamAppId)?.title ??
    `Steam App ${steamAppId}`;
  const prices = game.data?.prices;
  return (
    <main className="page-shell">
      <section className="game-hero">
        <Image
          className="hub-art"
          src={game.data?.metadata?.header_image ?? headerArt(steamAppId)}
          width={460}
          height={215}
          unoptimized
          priority
          alt={`${title} Steam header artwork`}
        />
        <div className="space-y-5">
          <p className="eyebrow">GAME DETAILS</p>
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <span className="badge">Steam AppID {steamAppId}</span>
          <p className="text-muted-foreground">
            {game.data?.metadata?.short_description?.replace(/<[^>]*>/g, "")}
          </p>
          <LaunchLink steamAppId={steamAppId} testId="launch-game-btn" />
        </div>
      </section>
      {game.isError && (
        <p role="alert">
          Game details are unavailable.{" "}
          <button className="text-link" onClick={() => void game.refetch()}>
            Try again
          </button>
        </p>
      )}
      <section className="grid items-start gap-5 md:grid-cols-2">
        <div className="panel space-y-4">
          <h2 className="text-xl font-semibold">Best live price</h2>
          <p className="text-3xl font-semibold">
            {game.isPending ? "Loading…" : money(prices?.currentPrice)}
          </p>
          <p className="text-muted-foreground text-sm">
            Historical low:{" "}
            {game.isPending
              ? "Loading…"
              : prices?.historicalLow == null
                ? "Not recorded"
                : money(prices.historicalLow)}{" "}
            · USD
          </p>
          {prices?.source === "catalog" && (
            <p className="text-sm text-amber-500">
              Cached USD prices · checked {prices.verifiedAt?.slice(0, 10)}.
              Confirm the current offer at the store.
            </p>
          )}
          <a
            className="action secondary"
            href={`https://store.steampowered.com/app/${steamAppId}/`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Steam ↗
          </a>
          {prices?.deals.length ? (
            <ul className="space-y-3">
              {prices.deals.slice(0, 4).map((deal) => (
                <li
                  key={deal.dealID}
                  className="flex items-center justify-between gap-3"
                >
                  <a
                    className="text-link"
                    href={deal.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {storeNames[deal.storeID] ?? "Partner store"} ↗
                  </a>
                  <span>
                    {money(deal.price)}{" "}
                    <s className="text-muted-foreground text-xs">
                      {money(deal.retailPrice)}
                    </s>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            !game.isPending && (
              <p className="text-muted-foreground text-sm">
                No live price is available for this AppID.{" "}
                <a
                  className="text-link"
                  href={`https://store.steampowered.com/app/${steamAppId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Visit Steam ↗
                </a>
              </p>
            )
          )}
        </div>
        <BacklogEditor
          steamAppId={steamAppId}
          title={title}
          loading={game.isPending && !item}
        />
      </section>
      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">Patch Notes & Live Events</h2>
        {game.isPending ? (
          <p role="status">Loading game news…</p>
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
