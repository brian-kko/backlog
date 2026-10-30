"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { SearchDealsInputSchema, storeNames } from "@acme/validators";

import { useBacklog } from "~/components/backlog-provider";
import { DealCards } from "~/components/deal-cards";
import { PageHeading } from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";

interface Filters {
  query: string;
  storeIds: string[];
  maxPrice?: number;
  steamOnly: boolean;
  onSale: boolean;
  minDiscount: number;
  hideOwned: boolean;
  sort: "deals" | "price" | "savings" | "title" | "recent";
  page: number;
  pageSize: number;
  view: "grid" | "list";
}
const defaults: Filters = {
  query: "",
  storeIds: [],
  maxPrice: undefined,
  steamOnly: false,
  onSale: false,
  minDiscount: 0,
  hideOwned: false,
  sort: "deals",
  page: 0,
  pageSize: 24,
  view: "grid",
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
    onSale: params.get("sale") === "1",
    sort: params.get("sort") ?? "deals",
    page: Number(params.get("page") ?? 0),
    pageSize: Number(params.get("size") ?? 24),
  });
  return input.success
    ? ({
        ...defaults,
        ...input.data,
        minDiscount: [0, 25, 50, 75].includes(Number(params.get("discount")))
          ? Number(params.get("discount"))
          : 0,
        hideOwned: params.get("owned") === "1",
        view: params.get("view") === "list" ? "list" : "grid",
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
  if (value.onSale) params.set("sale", "1");
  if (value.hideOwned) params.set("owned", "1");
  if (value.minDiscount) params.set("discount", String(value.minDiscount));
  if (value.sort !== "deals") params.set("sort", value.sort);
  if (value.page) params.set("page", String(value.page));
  if (value.pageSize !== 24) params.set("size", String(value.pageSize));
  if (value.view === "list") params.set("view", "list");
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${params.size ? `?${params}` : ""}`,
  );
}

export default function DealsPage() {
  const trpc = useTRPC();
  const { items } = useBacklog();
  const [filters, setFilters] = useState(defaults);
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
  function change(patch: Partial<Filters>) {
    const value = { ...filters, page: 0, ...patch };
    setFilters(value);
    writeFilters(value);
  }
  const input = SearchDealsInputSchema.parse({
    query: filters.query,
    storeIds: filters.storeIds,
    maxPrice: filters.maxPrice,
    steamOnly: filters.steamOnly,
    onSale: filters.onSale,
    sort: filters.sort,
    page: filters.page,
    pageSize: filters.pageSize,
  });
  const deals = useQuery(
    trpc.backlog.searchDeals.queryOptions(input, { enabled: ready }),
  );
  const owned = new Set(
    items.filter((item) => item.isOwned).map((item) => item.steamAppId),
  );
  const filtered = (deals.data ?? [])
    .filter(
      (deal) =>
        (!filters.storeIds.length ||
          filters.storeIds.includes(deal.storeId ?? "")) &&
        (filters.maxPrice === undefined ||
          deal.cheapestPrice <= filters.maxPrice) &&
        (!filters.steamOnly || deal.steamRedeemable || deal.storeId === "1") &&
        (!filters.onSale || deal.savingsPercent > 0) &&
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
    filters.onSale ||
    filters.minDiscount > 0 ||
    filters.hideOwned;
  return (
    <main className="page-shell">
      <PageHeading eyebrow="DEALS" title="PC game deals">
        Compare PC game offers across stores. All prices are in USD.
      </PageHeading>
      <section
        aria-label="Search and filter deals"
        className="panel deal-toolbar"
      >
        <form
          className="deal-search"
          onSubmit={(event) => {
            event.preventDefault();
            change({ query: search.trim() });
          }}
        >
          <label className="field-label" htmlFor="deal-search">
            Search game deals
          </label>
          <div className="flex gap-3">
            <input
              className="form-control min-w-0 flex-1"
              id="deal-search"
              data-testid="deal-search-input"
              placeholder="Game title…"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button className="action" type="submit">
              Search
            </button>
          </div>
          {filters.query && (
            <button
              type="button"
              className="text-link mt-2"
              onClick={() => {
                setSearch("");
                change({ query: "" });
              }}
            >
              Clear search
            </button>
          )}
        </form>
        <div className="deal-filter-grid">
          <details
            className="store-picker"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary>
              Stores{" "}
              <span>
                {filters.storeIds.length
                  ? `${filters.storeIds.length} selected`
                  : "All stores"}
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
          <label className="field-label">
            Maximum price
            <select
              className="form-control mt-2 w-full"
              aria-label="Maximum price"
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
                ["14.99", "Under $15"],
                ["20", "$20"],
                ["30", "$30"],
                ["50", "$50"],
                ["100", "$100"],
              ].map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  className="bg-zinc-900 text-zinc-100"
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Minimum discount
            <select
              className="form-control mt-2 w-full"
              aria-label="Minimum discount"
              value={filters.minDiscount}
              onChange={(event) =>
                change({ minDiscount: Number(event.target.value) })
              }
            >
              {[0, 25, 50, 75].map((value) => (
                <option
                  key={value}
                  value={value}
                  className="bg-zinc-900 text-zinc-100"
                >
                  {value ? `${value}% off` : "Any discount"}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Sort by
            <select
              className="form-control mt-2 w-full"
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
                <option
                  key={value}
                  value={value}
                  className="bg-zinc-900 text-zinc-100"
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-bar" aria-label="Deal filters">
          <button
            className="filter-pill"
            aria-pressed={!active}
            onClick={() => change({ ...defaults, query: filters.query })}
          >
            All Deals
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
            50%+ Off
          </button>
          <button
            className="filter-pill"
            aria-pressed={filters.steamOnly}
            onClick={() => change({ steamOnly: !filters.steamOnly })}
          >
            Steam Redeemable
          </button>
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.onSale}
              onChange={(event) => change({ onSale: event.target.checked })}
            />
            On sale only
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.hideOwned}
              onChange={(event) => change({ hideOwned: event.target.checked })}
            />
            Hide owned games
          </label>
          {active && (
            <button
              className="text-link"
              onClick={() => change({ ...defaults, query: filters.query })}
            >
              Reset filters
            </button>
          )}
        </div>
        <p className="filter-help">
          Filters combine. Store and Steam activation data come from CheapShark;
          check the seller’s activation details before buying. Discount and
          ownership filters apply to this page of offers.
        </p>
      </section>
      <section className="space-y-5" aria-busy={deals.isFetching}>
        <div className="section-heading">
          <h2>
            {filters.query
              ? `Results for “${filters.query}”`
              : "Featured Deals"}
          </h2>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {deals.isFetching
              ? "Finding offers…"
              : `${filtered.length} of ${deals.data?.length ?? 0} offers · page ${filters.page + 1}`}
          </p>
          <div className="result-controls">
            <label>
              Per page{" "}
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
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="filter-pill"
              aria-pressed={filters.view === "grid"}
              onClick={() => change({ view: "grid", page: filters.page })}
            >
              Grid
            </button>
            <button
              className="filter-pill"
              aria-pressed={filters.view === "list"}
              onClick={() => change({ view: "list", page: filters.page })}
            >
              List
            </button>
          </div>
        </div>
        {deals.isPending ? (
          <p role="status">Loading deals…</p>
        ) : deals.isError ? (
          <p role="alert">
            Couldn’t load deals.{" "}
            <button className="text-link" onClick={() => void deals.refetch()}>
              Try again
            </button>
          </p>
        ) : filtered.length ? (
          <DealCards deals={filtered} list={filters.view === "list"} />
        ) : (
          <div className="empty-state">
            <p>No offers match this combination.</p>
            <button
              className="text-link mt-3"
              onClick={() => change({ ...defaults, query: filters.query })}
            >
              Clear active filters
            </button>
          </div>
        )}
        <div className="pagination">
          <button
            className="action secondary"
            disabled={!filters.page || deals.isFetching}
            onClick={() => change({ page: filters.page - 1 })}
          >
            Previous page
          </button>
          <span>Page {filters.page + 1}</span>
          <button
            className="action secondary"
            disabled={
              deals.isFetching ||
              (deals.data?.length ?? 0) < filters.pageSize ||
              filters.page >= 100
            }
            onClick={() => change({ page: filters.page + 1 })}
          >
            Next page
          </button>
        </div>
        {deals.data?.some((deal) => deal.source === "catalog") && (
          <p className="filter-help">
            Live stores could not be reached. These are saved catalog offers;
            some store and activation filters may have fewer matches.
          </p>
        )}
      </section>
    </main>
  );
}
