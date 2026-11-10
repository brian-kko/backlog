"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";

import { SearchDealsInputSchema, storeNames } from "@acme/validators";

import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import { DealCards, groupDeals } from "~/components/deal-cards";
import { GameArt, money, PageHeading, plural } from "~/components/game-ui";
import {
  bestOffer,
  PricesChecked,
  steamDelta,
  targetGap,
  useWishlistPrices,
} from "~/components/price-ui";
import { useTRPC } from "~/trpc/react";

interface Filters {
  query: string;
  storeIds: string[];
  maxPrice?: number;
  steamOnly: boolean;
  minDiscount: number;
  hideOwned: boolean;
  sort: "deals" | "price" | "savings" | "title" | "recent";
  pageSize: number;
}
const defaults: Filters = {
  query: "",
  storeIds: [],
  maxPrice: undefined,
  steamOnly: false,
  minDiscount: 0,
  hideOwned: true,
  sort: "deals",
  pageSize: 24,
};
function readFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const input = SearchDealsInputSchema.safeParse({
    query: params.get("q") ?? "",
    storeIds: (params.get("stores") ?? "")
      .split(",")
      .filter((id) => id in storeNames),
    maxPrice: params.has("price") ? Number(params.get("price")) : undefined,
    steamOnly: params.get("steam") === "1",
    sort: params.get("sort") ?? "deals",
    pageSize: Number(params.get("size") ?? 24),
  });
  return input.success
    ? ({
        ...defaults,
        ...input.data,
        minDiscount: [0, 25, 50, 75].includes(Number(params.get("discount")))
          ? Number(params.get("discount"))
          : 0,
        hideOwned: params.get("owned") !== "show",
      } as Filters)
    : defaults;
}
function writeFilters(value: Filters) {
  const params = new URLSearchParams();
  if (value.query) params.set("q", value.query);
  if (value.storeIds.length)
    params.set("stores", [...value.storeIds].sort().join(","));
  if (value.maxPrice !== undefined) params.set("price", String(value.maxPrice));
  if (value.steamOnly) params.set("steam", "1");
  if (!value.hideOwned) params.set("owned", "show");
  if (value.minDiscount) params.set("discount", String(value.minDiscount));
  if (value.sort !== "deals") params.set("sort", value.sort);
  if (value.pageSize !== 24) params.set("size", String(value.pageSize));
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${params.size ? `?${params}` : ""}`,
  );
}

/** Wishlist games with a fresh price, best buys first. */
function WishlistOnSale() {
  const { items } = useBacklog();
  const { rows, alerts } = useWishlistPrices(items);
  // Only games worth buying now; the full list lives on the wishlist.
  const live = alerts.slice(0, 3);
  if (!rows.length)
    return (
      <aside className="wishlist-strip empty">
        <p>Wishlist games to see their best price across stores here.</p>
        <AddGameButton secondary label="Add a game" />
      </aside>
    );
  if (!live.length) return null;
  return (
    <section
      data-reveal
      className="wishlist-strip"
      aria-labelledby="wishlist-strip-title"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="wishlist-strip-title">Worth buying from your wishlist</h2>
        <Link className="text-link" href="/wishlist">
          Wishlist
        </Link>
      </div>
      <ul>
        {live.map(({ item, prices }) => {
          const offer = bestOffer(prices);
          return (
            <li key={item.steamAppId}>
              <GameArt appId={item.steamAppId} title={item.title} />
              <div className="min-w-0">
                <Link className="strip-title" href={`/game/${item.steamAppId}`}>
                  {item.title}
                </Link>
                <p className="strip-meta">
                  {[targetGap(item, prices), steamDelta(prices)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {offer && (
                <a
                  className="strip-price"
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {money(offer.price)}
                  <span>at {offer.store} ↗</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function DealsPage() {
  const trpc = useTRPC();
  const { items, isLoading } = useBacklog();
  const [filters, setFilters] = useState(defaults);
  // Owned games hidden by "Hide games I already own", snapshotted so a game
  // marked owned during this visit stays put until the filters change.
  const [hiddenOwned, setHiddenOwned] = useState<Set<number> | null>(null);
  const ownedNow = () =>
    new Set(
      items.filter((item) => item.isOwned).map((item) => item.steamAppId),
    );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!isLoading && hiddenOwned === null) setHiddenOwned(ownedNow());
  });
  const [search, setSearch] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const restore = () => {
      const value = readFilters();
      setFilters(value);
      setSearch(value.query);
      setReady(true);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  // Batches of offers loaded so far; filters apply across all of them.
  const [batches, setBatches] = useState(1);
  function change(patch: Partial<Filters>) {
    const value = { ...filters, ...patch };
    setFilters(value);
    setBatches(1);
    setHiddenOwned(ownedNow());
    writeFilters(value);
  }
  const pages = useQueries({
    queries: Array.from({ length: batches }, (_, page) =>
      trpc.backlog.searchDeals.queryOptions(
        SearchDealsInputSchema.parse({
          query: filters.query,
          storeIds: filters.storeIds,
          maxPrice: filters.maxPrice,
          steamOnly: filters.steamOnly,
          sort: filters.sort,
          page,
          pageSize: filters.pageSize,
        }),
        { enabled: ready },
      ),
    ),
  });
  const first = pages[0];
  const last = pages[pages.length - 1];
  const fetching = pages.some((page) => page.isFetching);
  const loaded = pages.flatMap((page) => page.data?.offers ?? []);
  const offline = first?.fetchStatus === "paused";
  const deals = {
    data: first?.data ? loaded : undefined,
    live: first?.data?.live ?? true,
    snapshotAt: first?.data?.snapshotAt ?? null,
    isPending: (first?.isPending ?? true) && !offline,
    isError: first?.isError ?? false,
    refetch: () => void first?.refetch(),
  };
  // A later batch fails visibly (error or unreachable stores), with a retry.
  const failedBatch = pages.findIndex(
    (page, index) => index > 0 && (page.isError || page.data?.live === false),
  );
  const more =
    failedBatch < 0 &&
    deals.live &&
    !fetching &&
    (last?.data?.offers.length ?? 0) >= filters.pageSize &&
    batches < 10;
  const owned = hiddenOwned ?? new Set<number>();
  const filtered = loaded
    .filter(
      (deal) =>
        (!filters.storeIds.length ||
          filters.storeIds.includes(deal.storeId ?? "")) &&
        (filters.maxPrice === undefined ||
          deal.cheapestPrice <= filters.maxPrice) &&
        (!filters.steamOnly ||
          deal.steamRedeemable === true ||
          deal.storeId === "1") &&
        deal.savingsPercent >= filters.minDiscount &&
        (!filters.hideOwned || !deal.steamAppId || !owned.has(deal.steamAppId)),
    )
    .sort((a, b) =>
      filters.sort === "price"
        ? a.cheapestPrice - b.cheapestPrice
        : filters.sort === "savings"
          ? b.savingsPercent - a.savingsPercent
          : filters.sort === "title"
            ? a.title.localeCompare(b.title)
            : 0,
    );
  const active =
    filters.storeIds.length > 0 ||
    filters.maxPrice !== undefined ||
    filters.steamOnly ||
    filters.minDiscount > 0;
  const groups = groupDeals(filtered);
  // Steam's own price for each visible game, in one batched request.
  const steamIds = groups
    .map((group) => group.deal.steamAppId)
    .filter((id): id is number => id != null)
    .slice(0, 60);
  const steamPrices = useQuery(
    trpc.backlog.getSteamPrices.queryOptions(
      { steamAppIds: [...steamIds].sort((a, b) => a - b) },
      { enabled: steamIds.length > 0, staleTime: 5 * 60 * 1000 },
    ),
  );
  const hidden = loaded.length - filtered.length;
  const moreActive =
    (filters.maxPrice !== undefined && filters.maxPrice !== 14.99) ||
    (filters.minDiscount > 0 && filters.minDiscount !== 50) ||
    !filters.hideOwned;
  const reset = () => change({ ...defaults, query: filters.query });
  const cached = Boolean(deals.data) && !deals.live;
  return (
    <main className="page-shell">
      <PageHeading title="Deals">
        Compare prices across {Object.keys(storeNames).length} PC stores, not
        just Steam. Prices in USD.
      </PageHeading>
      <section
        data-reveal
        aria-label="Search and filter deals"
        className="deal-toolbar"
      >
        <form
          className="deal-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            change({ query: search.trim() });
          }}
        >
          <label className="sr-only" htmlFor="deal-search">
            Search game deals
          </label>
          <input
            className="form-control min-w-0 flex-1"
            id="deal-search"
            type="search"
            data-testid="deal-search-input"
            placeholder="Search deals by title…"
            maxLength={200}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (!event.target.value && filters.query) change({ query: "" });
            }}
          />
          <button className="action" type="submit">
            Search
          </button>
        </form>
        <div className="filter-row">
          <div
            role="group"
            aria-label="Quick filters"
            className="chip-scroller"
          >
            <button
              className="filter-pill"
              aria-pressed={!active}
              onClick={reset}
            >
              All deals
            </button>
            <button
              className="filter-pill"
              aria-pressed={filters.maxPrice === 14.99}
              onClick={() =>
                change({
                  maxPrice: filters.maxPrice === 14.99 ? undefined : 14.99,
                })
              }
            >
              Under $15
            </button>
            <button
              className="filter-pill"
              aria-pressed={filters.minDiscount === 50}
              onClick={() =>
                change({ minDiscount: filters.minDiscount === 50 ? 0 : 50 })
              }
            >
              50%+ off
            </button>
            <button
              className="filter-pill"
              aria-pressed={filters.steamOnly}
              onClick={() => change({ steamOnly: !filters.steamOnly })}
            >
              Activates on Steam
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <details
              className="popover-picker store-picker"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.open = false;
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary>
                Stores
                <span className="picker-value">
                  {filters.storeIds.length
                    ? `${filters.storeIds.length} selected`
                    : "All"}
                </span>
              </summary>
              <fieldset>
                <legend className="sr-only">Buy from</legend>
                <div className="flex justify-between gap-4">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => change({ storeIds: [] })}
                  >
                    All stores
                  </button>
                  <button
                    type="button"
                    className="text-link"
                    onClick={(event) => {
                      const picker = event.currentTarget.closest("details");
                      if (picker) {
                        picker.open = false;
                        picker.querySelector("summary")?.focus();
                      }
                    }}
                  >
                    Done
                  </button>
                </div>
                {Object.entries(storeNames).map(([id, name]) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      aria-label={`${name} store`}
                      checked={filters.storeIds.includes(id)}
                      onChange={(event) =>
                        change({
                          storeIds: event.target.checked
                            ? [...filters.storeIds, id]
                            : filters.storeIds.filter((value) => value !== id),
                        })
                      }
                    />
                    {name}
                  </label>
                ))}
              </fieldset>
            </details>
            <details className="popover-picker more-filters">
              <summary>
                More filters
                {moreActive && <span className="picker-value">On</span>}
              </summary>
              <fieldset>
                <legend className="sr-only">More filters</legend>
                <label className="field-label">
                  Maximum price
                  <select
                    className="form-control mt-2 w-full"
                    value={filters.maxPrice ?? ""}
                    onChange={(event) =>
                      change({
                        maxPrice:
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                      })
                    }
                  >
                    {[
                      ["", "Any price"],
                      ["0", "Free"],
                      ["5", "$5"],
                      ["10", "$10"],
                      ["14.99", "$15"],
                      ["20", "$20"],
                      ["30", "$30"],
                      ["50", "$50"],
                      ["100", "$100"],
                    ].map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field-label">
                  Minimum discount
                  <select
                    className="form-control mt-2 w-full"
                    value={filters.minDiscount}
                    onChange={(event) =>
                      change({ minDiscount: Number(event.target.value) })
                    }
                  >
                    {[0, 25, 50, 75].map((value) => (
                      <option key={value} value={value}>
                        {value ? `${value}% off` : "Any discount"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={filters.hideOwned}
                    onChange={(event) =>
                      change({ hideOwned: event.target.checked })
                    }
                  />
                  Hide games I already own
                </label>
              </fieldset>
            </details>
            {active && (
              <button className="quiet-button" onClick={reset}>
                Reset filters
              </button>
            )}
          </div>
        </div>
      </section>
      <WishlistOnSale />
      <section data-reveal className="space-y-5" aria-busy={fetching}>
        <div className="section-heading">
          <div>
            <h2>
              {filters.query ? `Results for “${filters.query}”` : "Top deals"}
            </h2>
            <p className="result-count" aria-live="polite">
              {deals.isPending
                ? "Finding offers…"
                : `${plural(groups.length, "game")} from ${plural(loaded.length, "offer")}${
                    hidden ? ` · ${hidden} hidden by your filters` : ""
                  }`}
            </p>
            {/* Saved snapshots carry their own date in the notice below. */}
            {!deals.isPending && deals.live && first?.dataUpdatedAt ? (
              <PricesChecked at={first.dataUpdatedAt} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-select">
              Sort
              <select
                className="form-control"
                aria-label="Sort deals"
                value={filters.sort}
                onChange={(event) =>
                  change({ sort: event.target.value as Filters["sort"] })
                }
              >
                {[
                  ["deals", "Best deals"],
                  ["price", "Lowest price"],
                  ["savings", "Biggest discount"],
                  ["title", "Title A–Z"],
                  ["recent", "Newest offers"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-select">
              Show
              <select
                className="form-control"
                aria-label="Offers per page"
                value={filters.pageSize}
                onChange={(event) =>
                  change({ pageSize: Number(event.target.value) })
                }
              >
                {[12, 24, 60].map((size) => (
                  <option key={size} value={size}>
                    {size} at a time
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        {offline ? (
          <p className="source-notice" role="note">
            You’re offline. Deals will load when you reconnect.
          </p>
        ) : cached ? (
          <p className="source-notice" role="note">
            Live store prices couldn’t be reached
            {loaded.length
              ? `, so these are offers saved on ${deals.snapshotAt}. Check the store for the current price.`
              : "."}{" "}
            <button className="text-link" onClick={deals.refetch}>
              Try again
            </button>
          </p>
        ) : null}
        {offline ? null : deals.isPending ? (
          <p role="status">Loading deals…</p>
        ) : deals.isError ? (
          <p role="alert">
            Couldn’t load deals.{" "}
            <button className="text-link" onClick={deals.refetch}>
              Try again
            </button>
          </p>
        ) : filtered.length ? (
          <DealCards deals={filtered} steamPrices={steamPrices.data} />
        ) : cached && !loaded.length ? null : (
          <div className="empty-state space-y-3">
            <p>
              {loaded.length
                ? "None of the offers loaded so far match your filters."
                : "No offers found."}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {more && (
                <button
                  className="text-link"
                  onClick={() => setBatches((value) => value + 1)}
                >
                  Search more offers
                </button>
              )}
              {active && (
                <button className="text-link" onClick={reset}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
        {failedBatch > 0 && (
          <p role="alert" className="text-center">
            Couldn’t load more deals.{" "}
            <button
              className="text-link"
              onClick={() => void pages[failedBatch]?.refetch()}
            >
              Try again
            </button>
          </p>
        )}
        {(more || (fetching && batches > 1)) && filtered.length > 0 && (
          <div className="load-more">
            <button
              className="action secondary"
              disabled={fetching}
              onClick={() => setBatches((value) => value + 1)}
            >
              {fetching ? "Loading…" : "Load more deals"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
