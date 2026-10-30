"use client";

import { useState } from "react";

import type { BacklogItem } from "~/components/backlog-provider";
import { useBacklog } from "~/components/backlog-provider";
import {
  GameArt,
  GameLink,
  LaunchLink,
  money,
  PageHeading,
  PriceField,
  RemoveGameButton,
} from "~/components/game-ui";
import { BacklogSummary } from "../_components/backlog-summary";

const statuses = [
  ["all", "All Games"],
  ["backlog", "Backlog (Unplayed)"],
  ["playing", "Playing"],
  ["completed", "Completed"],
] as const;

function LibraryCard({ item }: { item: BacklogItem }) {
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
      setMessage("Library updated.");
    } catch {
      setMessage("Unable to save changes. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <article
      className="game-card"
      data-testid="library-card"
      aria-busy={pending}
    >
      <GameArt appId={item.steamAppId} title={item.title} />
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <span className="badge capitalize">
            {item.completionStatus ?? "backlog"}
          </span>
        </div>
        <p className="text-muted-foreground text-sm">
          {item.amountPaid === undefined
            ? "Amount paid not recorded"
            : `Paid ${money(item.amountPaid)}`}
        </p>
        <label className="field-label">
          Completion Status
          <select
            aria-label={`Completion status for ${item.title}`}
            className="form-control mt-2 w-full"
            value={item.completionStatus ?? "backlog"}
            onChange={(event) =>
              void update({
                completionStatus: event.target
                  .value as BacklogItem["completionStatus"],
              })
            }
          >
            <option className="bg-zinc-900 text-zinc-100" value="backlog">
              Backlog
            </option>
            <option className="bg-zinc-900 text-zinc-100" value="playing">
              Playing
            </option>
            <option className="bg-zinc-900 text-zinc-100" value="completed">
              Completed
            </option>
          </select>
        </label>
        <PriceField
          label="Amount Paid ($)"
          ariaLabel={`Amount paid for ${item.title}`}
          value={item.amountPaid}
          onSave={(amountPaid) => update({ amountPaid })}
        />
        <div className="flex flex-wrap items-center gap-4">
          <LaunchLink steamAppId={item.steamAppId}>Launch Game</LaunchLink>
          <GameLink steamAppId={item.steamAppId} />
          <RemoveGameButton steamAppId={item.steamAppId} title={item.title} />
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </article>
  );
}

export default function LibraryPage() {
  const { items, isGuest, isDemo, isLoading, error, exportItems, importItems } =
    useBacklog();
  const [filter, setFilter] = useState<(typeof statuses)[number][0]>("all");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("playing");
  const owned = items.filter(
    (item) =>
      item.isOwned &&
      (filter === "all" || (item.completionStatus ?? "backlog") === filter) &&
      `${item.title} ${item.steamAppId}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  owned.sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title)
      : sort === "paid"
        ? (b.amountPaid ?? -1) - (a.amountPaid ?? -1)
        : Number(b.completionStatus === "playing") -
            Number(a.completionStatus === "playing") ||
          a.title.localeCompare(b.title),
  );
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
      setMessage("Backlog exported.");
    } catch {
      setMessage("Unable to export your backlog. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page-shell">
      <PageHeading eyebrow="LIBRARY" title="Your library">
        Find a game, update your progress, or launch your next session.
      </PageHeading>
      <div className="collection-search">
        <label className="field-label">
          Find in your library
          <input
            type="search"
            disabled={isLoading}
            className="form-control mt-2 w-full"
            placeholder="Game title or Steam AppID"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field-label">
          Sort library
          <select
            className="form-control mt-2 w-full"
            value={sort}
            disabled={isLoading}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="playing">Playing first</option>
            <option value="title">Title A–Z</option>
            <option value="paid">Amount paid: high to low</option>
          </select>
        </label>
      </div>
      <section
        aria-label="Library toolbar"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="filter-bar" aria-label="Library status filters">
          {statuses.map(([value, label]) => (
            <button
              key={value}
              className="filter-pill"
              aria-pressed={filter === value}
              disabled={isLoading}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="action"
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
                  setMessage("Backlog imported successfully.");
                } catch {
                  setMessage(
                    "Unable to import. Choose a valid Backlog JSON backup and try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
      </section>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <BacklogSummary ledger />
      {isGuest && (
        <aside className="guest-banner">
          <div>
            <strong>
              {isDemo
                ? "Starter Demo Library (Sign in to sync your Steam account)"
                : "Guest library · saved in this browser"}
            </strong>
            <p>
              Demo purchases and progress are editable. Your guest collection is
              saved in this browser; account saving is available after sign in.
              Steam account sync is coming soon.
            </p>
          </div>
        </aside>
      )}
      {isLoading ? (
        <p role="status">Loading your library…</p>
      ) : owned.length ? (
        <section
          aria-label="Owned games"
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
        >
          {owned.map((item) => (
            <LibraryCard key={item.steamAppId} item={item} />
          ))}
        </section>
      ) : (
        <p className="empty-state">
          No games match this view. Try another search or All Games.
        </p>
      )}
    </main>
  );
}
