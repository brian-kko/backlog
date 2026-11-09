"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";

import type { Platform, PurchaseStore } from "@acme/validators";
import {
  defaultPlatform,
  itemPlatform,
  platformNames,
  purchaseStoreNames,
} from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import { canLaunch } from "~/components/collection";
import {
  GameArt,
  GameLink,
  LaunchLink,
  money,
  PageHeading,
  PriceField,
  RemoveGameButton,
  SampleTag,
} from "~/components/game-ui";
import { GuestBanner } from "~/components/guest-banner";
import { BacklogSummary } from "../_components/backlog-summary";

type Status = NonNullable<BacklogItem["completionStatus"]>;
const statusLabels: Record<Status, string> = {
  backlog: "Unplayed",
  playing: "Playing",
  completed: "Completed",
};
type Filter = "all" | Status;
const filters: [Filter, string][] = [
  ["all", "All"],
  ["playing", "Playing"],
  ["backlog", "Unplayed"],
  ["completed", "Completed"],
];
type Sort = "status" | "title" | "paid" | "store";
const viewKey = "backlog-library-view";

function useUpdate(item: BacklogItem) {
  const { save } = useBacklog();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function update(change: Partial<BacklogItem>) {
    setPending(true);
    try {
      await save({
        steamAppId: item.steamAppId,
        title: item.title,
        isOwned: true,
        ...change,
      });
      setMessage("Saved.");
    } catch {
      setMessage("Couldn’t save. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return { update, message, pending };
}

/** One-tap status control. */
function StatusPicker({
  item,
  onChange,
}: {
  item: BacklogItem;
  onChange: (status: Status) => void;
}) {
  const current = item.completionStatus ?? "backlog";
  return (
    <div
      role="group"
      aria-label={`Status for ${item.title}`}
      className="segmented status-picker"
    >
      {(Object.keys(statusLabels) as Status[]).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={current === value}
          data-status={value}
          onClick={() => current !== value && onChange(value)}
        >
          {statusLabels[value]}
        </button>
      ))}
    </div>
  );
}

function PlatformSelect({
  item,
  onChange,
}: {
  item: BacklogItem;
  onChange: (platform: Platform | undefined) => void;
}) {
  return (
    <select
      className="form-control w-full"
      aria-label={`Launcher ${item.title} plays on`}
      value={item.platform ?? ""}
      onChange={(event) =>
        onChange((event.target.value || undefined) as Platform | undefined)
      }
    >
      <option value="">
        {platformNames[defaultPlatform(item.purchaseStore)]} (assumed)
      </option>
      {(Object.keys(platformNames) as Platform[]).map((key) => (
        <option key={key} value={key}>
          {platformNames[key]}
        </option>
      ))}
    </select>
  );
}

function StoreSelect({
  item,
  onChange,
}: {
  item: BacklogItem;
  onChange: (store: PurchaseStore | undefined) => void;
}) {
  return (
    <select
      className="form-control w-full"
      aria-label={`Store ${item.title} was bought from`}
      value={item.purchaseStore ?? ""}
      onChange={(event) =>
        onChange((event.target.value || undefined) as PurchaseStore | undefined)
      }
    >
      <option value="">Not set</option>
      {(Object.keys(purchaseStoreNames) as PurchaseStore[]).map((store) => (
        <option key={store} value={store}>
          {purchaseStoreNames[store]}
        </option>
      ))}
    </select>
  );
}

function purchaseSummary(item: BacklogItem) {
  const paid =
    item.amountPaid === undefined
      ? "Price not recorded"
      : `Paid ${money(item.amountPaid)}`;
  const from = item.purchaseStore
    ? ` at ${purchaseStoreNames[item.purchaseStore]}`
    : "";
  const platform = itemPlatform(item);
  // Make the launcher assumption visible until the user confirms it.
  const plays = item.platform
    ? platform === "steam"
      ? ""
      : ` · plays on ${platformNames[platform]}`
    : ` · ${platformNames[platform]} (assumed)`;
  return `${paid}${from}${plays}`;
}

function LibraryCard({ item }: { item: BacklogItem }) {
  const { update, message, pending } = useUpdate(item);
  const [editing, setEditing] = useState(false);
  const panelId = useId();
  return (
    <article
      className="game-card library-card"
      data-testid="library-card"
      aria-busy={pending}
    >
      <GameArt appId={item.steamAppId} title={item.title} />
      <div className="card-body">
        <div className="card-heading">
          <h2 className="card-title">
            <Link href={`/game/${item.steamAppId}`}>{item.title}</Link>
          </h2>
          <SampleTag item={item} />
        </div>
        <StatusPicker
          item={item}
          onChange={(completionStatus) => void update({ completionStatus })}
        />
        <div className="purchase-line">
          <span>{purchaseSummary(item)}</span>
          <button
            type="button"
            className="quiet-button"
            aria-expanded={editing}
            aria-controls={panelId}
            aria-label={`Edit purchase details for ${item.title}`}
            onClick={() => setEditing((value) => !value)}
          >
            {editing ? "Done" : "Edit"}
          </button>
        </div>
        {editing && (
          <div id={panelId} className="card-fields">
            <PriceField
              label="Amount paid"
              ariaLabel={`Amount paid for ${item.title}`}
              value={item.amountPaid}
              onSave={(amountPaid) => update({ amountPaid })}
            />
            <div className="field-label">
              <span>Bought from</span>
              <StoreSelect
                item={item}
                onChange={(purchaseStore) => void update({ purchaseStore })}
              />
            </div>
            <div className="field-label col-span-full">
              <span>Plays on</span>
              <PlatformSelect
                item={item}
                onChange={(platform) => void update({ platform })}
              />
            </div>
          </div>
        )}
        <div className="card-actions">
          {canLaunch(item) && (
            <LaunchLink
              steamAppId={item.steamAppId}
              title={item.title}
              secondary
            >
              Launch
            </LaunchLink>
          )}
          <GameLink steamAppId={item.steamAppId} />
          <span className="ml-auto">
            <RemoveGameButton steamAppId={item.steamAppId} title={item.title} />
          </span>
        </div>
        <p role="status" className="save-feedback">
          {message}
        </p>
      </div>
    </article>
  );
}

function LibraryRow({ item }: { item: BacklogItem }) {
  const { update, message, pending } = useUpdate(item);
  const [editingStore, setEditingStore] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState(false);
  return (
    <tr data-testid="library-card" aria-busy={pending}>
      <th scope="row">
        <div className="table-game">
          <GameArt appId={item.steamAppId} title={item.title} />
          <div className="min-w-0">
            <Link href={`/game/${item.steamAppId}`}>{item.title}</Link>{" "}
            <SampleTag item={item} />
            <span role="status" className="save-feedback block">
              {message}
            </span>
          </div>
        </div>
      </th>
      <td>
        <select
          className="form-control"
          aria-label={`Status for ${item.title}`}
          value={item.completionStatus ?? "backlog"}
          onChange={(event) =>
            void update({ completionStatus: event.target.value as Status })
          }
        >
          {(Object.keys(statusLabels) as Status[]).map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
      </td>
      <td className="table-paid">
        <PriceField
          label="Paid"
          ariaLabel={`Amount paid for ${item.title}`}
          value={item.amountPaid}
          onSave={(amountPaid) => update({ amountPaid })}
        />
      </td>
      <td>
        {editingStore ? (
          <StoreSelect
            item={item}
            onChange={(purchaseStore) => {
              setEditingStore(false);
              void update({ purchaseStore });
            }}
          />
        ) : (
          <button
            type="button"
            className="cell-edit"
            aria-label={`${item.purchaseStore ? purchaseStoreNames[item.purchaseStore] : "Not set"}: edit store for ${item.title}`}
            onClick={() => setEditingStore(true)}
          >
            {item.purchaseStore ? purchaseStoreNames[item.purchaseStore] : "Not set"}
          </button>
        )}
      </td>
      <td>
        {editingPlatform ? (
          <PlatformSelect
            item={item}
            onChange={(platform) => {
              setEditingPlatform(false);
              void update({ platform });
            }}
          />
        ) : (
          <button
            type="button"
            className="cell-edit"
            aria-label={`${platformNames[itemPlatform(item)]}${item.platform ? "" : " (assumed)"}: edit launcher for ${item.title}`}
            onClick={() => setEditingPlatform(true)}
          >
            {platformNames[itemPlatform(item)]}
            {!item.platform && (
              <span className="text-muted-foreground text-xs"> (assumed)</span>
            )}
          </button>
        )}
      </td>
      <td>
        <div className="flex items-center justify-end gap-3">
          {canLaunch(item) && (
            <LaunchLink
              steamAppId={item.steamAppId}
              title={item.title}
              secondary
            >
              Launch
            </LaunchLink>
          )}
          <RemoveGameButton steamAppId={item.steamAppId} title={item.title} />
        </div>
      </td>
    </tr>
  );
}

function SortHeader({
  label,
  value,
  sort,
  descending,
  onSort,
}: {
  label: string;
  value: Sort;
  sort: Sort;
  descending: boolean;
  onSort: (value: Sort) => void;
}) {
  const active = sort === value;
  return (
    <th
      scope="col"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        type="button"
        className="sort-header"
        onClick={() => onSort(value)}
      >
        {label}
        <span aria-hidden="true">
          {active ? (descending ? " ▼" : " ▲") : ""}
        </span>
      </button>
    </th>
  );
}

function BackupPanel() {
  const { isGuest, isLoading, error, exportItems, importItems } = useBacklog();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function downloadBackup() {
    setBusy(true);
    setMessage("");
    try {
      const backup = await exportItems();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `backlog-${backup.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Backup downloaded.");
    } catch {
      setMessage("Couldn’t export your backup. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="backup-panel" aria-labelledby="backup-heading">
      <div>
        <h2 id="backup-heading">Backup &amp; restore</h2>
        <p className="filter-help">
          Download your library and wishlist as JSON, or restore a backup.
          Restoring adds games and updates matching ones; nothing is deleted.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="action secondary"
          data-testid="export-json-btn"
          disabled={busy || isLoading || Boolean(error && !isGuest)}
          onClick={() => void downloadBackup()}
        >
          Export Backlog JSON
        </button>
        <label
          className={`action secondary ${busy || isLoading ? "opacity-50" : ""}`}
        >
          Import JSON
          <input
            className="sr-only"
            aria-label="Import JSON"
            type="file"
            accept=".json,application/json"
            disabled={busy || isLoading}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              setBusy(true);
              try {
                await importItems(JSON.parse(await file.text()));
                setMessage("Backup restored.");
              } catch {
                setMessage(
                  "That file isn’t a valid Backlog backup. Choose another and try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      </div>
      {message && (
        <p role="status" className="save-feedback basis-full">
          {message}
        </p>
      )}
    </section>
  );
}

function readStatus(): Filter {
  const value = new URLSearchParams(window.location.search).get("status");
  return value === "playing" || value === "backlog" || value === "completed"
    ? value
    : "all";
}

export default function LibraryPage() {
  const { items, isLoading, error } = useBacklog();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("status");
  const [reversed, setReversed] = useState(false);
  // Clicking the active column flips its direction.
  function sortBy(value: Sort) {
    setReversed((current) => (value === sort ? !current : false));
    setSort(value);
  }
  const descending = (sort === "paid") !== reversed;
  const [view, setView] = useState<"grid" | "table">("grid");
  useEffect(() => {
    const restore = () => setFilter(readStatus());
    // URL and storage can only be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    restore();
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(viewKey) === "table") setView("table");
    } catch {
      // Storage unavailable: default view.
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function chooseFilter(value: Filter) {
    setFilter(value);
    window.history.replaceState(
      null,
      "",
      value === "all" ? "/library" : `/library?status=${value}`,
    );
  }
  function chooseView(value: "grid" | "table") {
    setView(value);
    try {
      localStorage.setItem(viewKey, value);
    } catch {
      // Storage unavailable: the choice lasts for this visit.
    }
  }
  const ownedAll = items.filter((item) => item.isOwned);
  const count = (value: Filter) =>
    value === "all"
      ? ownedAll.length
      : ownedAll.filter((item) => (item.completionStatus ?? "backlog") === value)
          .length;
  const rank = { playing: 0, backlog: 1, completed: 2 };
  const owned = ownedAll
    .filter(
      (item) =>
        (filter === "all" || (item.completionStatus ?? "backlog") === filter) &&
        `${item.title} ${item.steamAppId}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "paid"
          ? (b.amountPaid ?? -1) - (a.amountPaid ?? -1)
          : sort === "store"
            ? (a.purchaseStore ?? "~").localeCompare(b.purchaseStore ?? "~") ||
              a.title.localeCompare(b.title)
            : rank[a.completionStatus ?? "backlog"] -
                rank[b.completionStatus ?? "backlog"] ||
              a.title.localeCompare(b.title),
    );
  if (reversed) owned.reverse();
  return (
    <main className="page-shell">
      <PageHeading title="Library">
        Every game you own, how far you’ve got, and what you paid at each
        store.
      </PageHeading>
      <GuestBanner compact />
      {error && <p role="alert">{error}</p>}
      <section aria-label="Library toolbar" className="collection-toolbar">
        <div
          role="group"
          aria-label="Filter by status"
          className="chip-scroller"
        >
          {filters.map(([value, label]) => (
            <button
              key={value}
              className="filter-pill"
              aria-pressed={filter === value}
              disabled={isLoading}
              onClick={() => chooseFilter(value)}
            >
              {label}
              <span className="tab-count">{count(value)}</span>
            </button>
          ))}
        </div>
        <div className="collection-search">
          <input
            type="search"
            aria-label="Find in your library"
            disabled={isLoading}
            className="form-control w-full"
            placeholder="Find in your library…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="form-control"
            aria-label="Sort library"
            value={sort}
            disabled={isLoading}
            onChange={(event) => {
              setSort(event.target.value as Sort);
              setReversed(false);
            }}
          >
            <option value="status">Playing first</option>
            <option value="title">Title A–Z</option>
            <option value="paid">Price paid</option>
            <option value="store">Store</option>
          </select>
          <div role="group" aria-label="Layout" className="segmented view-toggle">
            {(["grid", "table"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={view === value}
                onClick={() => chooseView(value)}
              >
                {value === "grid" ? "Cards" : "Table"}
              </button>
            ))}
          </div>
        </div>
      </section>
      {isLoading ? (
        <p role="status">Loading your library…</p>
      ) : !ownedAll.length ? (
        <div className="empty-state space-y-4">
          <p>
            Your library is empty. Add the games you own to track progress and
            spending across stores.
          </p>
          <AddGameButton />
        </div>
      ) : !owned.length ? (
        <p className="empty-state">
          No games match this view.{" "}
          <button
            className="text-link"
            onClick={() => {
              chooseFilter("all");
              setSearch("");
            }}
          >
            Show all games
          </button>
        </p>
      ) : (
        <>
          <section
            aria-label="Owned games"
            className={`card-grid${view === "table" ? " sm:hidden" : ""}`}
          >
            {owned.map((item) => (
              <LibraryCard key={item.steamAppId} item={item} />
            ))}
          </section>
          {view === "table" && (
            <div className="table-scroll max-sm:hidden">
              <table className="ledger-table">
                <caption className="sr-only">
                  Owned games, sortable by column
                </caption>
                <thead>
                  <tr>
                    {(
                      [
                        ["Game", "title"],
                        ["Status", "status"],
                        ["Paid", "paid"],
                        ["Bought from", "store"],
                      ] as const
                    ).map(([label, value]) => (
                      <SortHeader
                        key={value}
                        label={label}
                        value={value}
                        sort={sort}
                        descending={descending}
                        onSort={sortBy}
                      />
                    ))}
                    <th scope="col">Plays on</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {owned.map((item) => (
                    <LibraryRow key={item.steamAppId} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <section className="space-y-4" aria-labelledby="spending-heading">
        <div className="section-heading">
          <h2 id="spending-heading">Spending &amp; progress</h2>
        </div>
        <BacklogSummary ledger />
      </section>
      <BackupPanel />
    </main>
  );
}
