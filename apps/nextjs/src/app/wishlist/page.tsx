"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { purchaseStoreFromDeal } from "@acme/validators";

import type { BacklogItem } from "~/components/backlog-provider";
import type { AlertState, Prices, PriceState } from "~/components/price-ui";
import { AddGameButton } from "~/components/add-game";
import { useBacklog } from "~/components/backlog-provider";
import {
  GameArt,
  GameLink,
  money,
  OwnPrompt,
  PageHeading,
  plural,
  PriceField,
  RemoveGameButton,
  SampleTag,
} from "~/components/game-ui";
import { GuestBanner } from "~/components/guest-banner";
import {
  AlertBadge,
  bestOffer,
  lowLabel,
  offerSource,
  priceLabel,
  PriceTrack,
  steamDelta,
  targetGap,
  useRelativeTime,
  useWishlistPrices,
} from "~/components/price-ui";

function WatchCard({
  item,
  prices,
  state,
  alert,
  onOwned,
  moveBusy,
}: {
  item: BacklogItem;
  prices: Prices | undefined;
  state: PriceState;
  alert: AlertState;
  onOwned: (item: BacklogItem, prices: Prices | undefined) => void;
  /** Another move is in flight; one at a time keeps the panel coherent. */
  moveBusy: boolean;
}) {
  const pending = state === "checking";
  const delta = steamDelta(prices);
  const [editing, setEditing] = useState(false);
  const { save } = useBacklog();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const offer = bestOffer(prices);
  async function update(change: Partial<BacklogItem>, done: string) {
    setSaving(true);
    try {
      await save({
        steamAppId: item.steamAppId,
        title: item.title,
        isOwned: false,
        ...change,
      });
      setMessage(done);
      return true;
    } catch {
      setMessage("Couldn’t save. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }
  return (
    <article className="game-card watch-card" aria-busy={saving}>
      <GameArt appId={item.steamAppId} title={item.title} />
      <div className="card-body">
        <div className="space-y-2">
          <div className="card-heading">
            <h2 className="card-title">
              <Link href={`/game/${item.steamAppId}`}>{item.title}</Link>
            </h2>
            <SampleTag item={item} />
          </div>
          <AlertBadge state={state} alert={alert} />
        </div>
        {/* One row: what it costs now, what you'll pay, and the floor. */}
        <dl className="price-pair price-trio">
          <div>
            <dt>{priceLabel(prices)}</dt>
            <dd className="deal-price">
              {pending ? "…" : offer ? money(offer.price) : "Unavailable"}
            </dd>
          </div>
          <div data-field="target">
            <dt>Your target</dt>
            <dd
              className="deal-price muted"
              title={
                item.targetPrice === undefined
                  ? "No target: flagged at its lowest ever price"
                  : undefined
              }
            >
              {item.targetPrice === undefined
                ? "None"
                : money(item.targetPrice)}
            </dd>
            <dd>
              <button
                type="button"
                className="quiet-button target-edit"
                aria-expanded={editing}
                aria-label={`${editing ? "Close" : "Edit"} target price for ${item.title}`}
                onClick={() => setEditing((value) => !value)}
              >
                {editing
                  ? "Done"
                  : item.targetPrice === undefined
                    ? "Set target"
                    : "Edit target"}
              </button>
            </dd>
          </div>
          <div>
            <dt>{lowLabel(prices)}</dt>
            <dd className="deal-price muted">
              {pending
                ? "…"
                : prices?.historicalLow == null
                  ? "Not recorded"
                  : money(prices.historicalLow)}
            </dd>
          </div>
        </dl>
        <p className="price-pair-note">{offer ? offerSource(offer) : ""}</p>
        {!pending && (
          <PriceTrack
            current={offer?.price}
            target={item.targetPrice}
            low={
              prices?.historicalLowSource === "cheapshark"
                ? prices.historicalLow
                : null
            }
          />
        )}
        {!pending && (
          <p className="gap-line">
            {targetGap(item, prices) ??
              "Prices couldn’t be checked right now. Your target is saved."}
            {delta && <span className="gap-line-note"> · {delta}</span>}
          </p>
        )}
        {editing && (
          <PriceField
            label="Target price"
            ariaLabel={`Target price for ${item.title}`}
            value={item.targetPrice}
            hint="Leave blank to be flagged only at its lowest ever price."
            onSave={async (targetPrice) => {
              await update({ targetPrice }, "Target saved.");
            }}
          />
        )}
        <div className="card-actions">
          {offer && (
            <a
              className="action"
              href={offer.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy at {offer.store}
              <span aria-hidden="true">↗</span>
            </a>
          )}
          <button
            className="action secondary"
            disabled={saving || moveBusy}
            data-own-button={item.steamAppId}
            onClick={() => onOwned(item, prices)}
          >
            I own this
          </button>
        </div>
        <div className="card-links">
          <GameLink steamAppId={item.steamAppId} />
          <RemoveGameButton steamAppId={item.steamAppId} title={item.title} />
        </div>
        <p role="status" className="save-feedback">
          {message}
        </p>
      </div>
    </article>
  );
}

export default function WishlistPage() {
  const { items, isLoading, error } = useBacklog();
  const {
    rows,
    alerts,
    pending,
    offline,
    unchecked,
    checkedAt,
    refresh,
    refreshing,
  } = useWishlistPrices(items);
  const checked = useRelativeTime(checkedAt);
  const { save, isSample } = useBacklog();
  // Moving a game to the library is owned by the page, not the card (which
  // disappears once owned): the panel stays mounted through saving, failure,
  // retry, purchase details and Undo, and takes keyboard focus.
  const [moved, setMoved] = useState<{
    item: BacklogItem;
    prices: Prices | undefined;
    wasSample: boolean;
    status: "saving" | "done" | "error" | "undoing" | "undo-error";
  } | null>(null);
  const panel = useRef<HTMLElement>(null);
  // Always mounted (cards or empty state), so focus has a stable home.
  const results = useRef<HTMLDivElement>(null);
  // Each move/undo gets an id; stale completions are ignored.
  const transaction = useRef(0);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const moveBusy =
    moved?.status === "saving" || moved?.status === "undoing" || detailsSaving;
  // Where focus should go once the next render has happened: a returned
  // card's button (which may render a moment later) or the results region.
  const focusTarget = useRef<{ appId?: number; until: number } | null>(null);
  useEffect(() => {
    const target = focusTarget.current;
    if (!target) return;
    const button =
      target.appId == null
        ? null
        : document.querySelector<HTMLElement>(
            `[data-own-button="${target.appId}"]`,
          );
    if (button) {
      button.focus();
      focusTarget.current = null;
    } else if (target.appId == null || Date.now() > target.until) {
      // No card to return to (e.g. hidden by search): use the region.
      results.current?.focus();
      focusTarget.current = null;
    }
  });
  function dismiss() {
    transaction.current += 1;
    focusTarget.current = { until: 0 };
    setMoved(null);
  }
  useEffect(() => {
    if (moved) panel.current?.focus();
  }, [moved?.item.steamAppId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function moveToLibrary(item: BacklogItem, prices: Prices | undefined) {
    const next = {
      item,
      prices,
      wasSample: isSample(item.steamAppId),
    };
    const id = ++transaction.current;
    setMoved({ ...next, status: "saving" });
    try {
      await save({
        steamAppId: item.steamAppId,
        title: item.title,
        isOwned: true,
      });
      if (transaction.current === id) setMoved({ ...next, status: "done" });
    } catch {
      if (transaction.current === id) setMoved({ ...next, status: "error" });
    }
  }
  async function undoMove() {
    if (!moved) return;
    const id = ++transaction.current;
    const steamAppId = moved.item.steamAppId;
    setMoved({ ...moved, status: "undoing" });
    try {
      // Restore the wishlist entry; a sample's invented target stays dropped.
      await save({
        steamAppId: moved.item.steamAppId,
        title: moved.item.title,
        isOwned: false,
        ...(moved.wasSample ? {} : { targetPrice: moved.item.targetPrice }),
      });
      if (transaction.current !== id) return;
      // Focus the returned card's "I own this" button once it renders, or the
      // results region if a search keeps that card hidden.
      focusTarget.current = { appId: steamAppId, until: Date.now() + 1000 };
      setMoved(null);
      // If the card never renders (and nothing re-renders), still land focus.
      window.setTimeout(() => {
        if (focusTarget.current?.appId !== steamAppId) return;
        focusTarget.current = null;
        results.current?.focus();
      }, 1000);
    } catch {
      if (transaction.current === id)
        setMoved({ ...moved, status: "undo-error" });
    }
  }
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("alerts");
  const distance = (row: (typeof rows)[number]) =>
    row.prices?.currentPrice == null
      ? Infinity
      : row.prices.currentPrice -
        (row.item.targetPrice ?? row.prices.historicalLow ?? 0);
  const rank = (row: (typeof rows)[number]) =>
    alerts.includes(row) ? 0 : row.state === "unavailable" ? 2 : 1;
  const visible = rows
    .filter(({ item }) =>
      item.title.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "price"
        ? (a.prices?.currentPrice ?? Infinity) -
          (b.prices?.currentPrice ?? Infinity)
        : sort === "title"
          ? a.item.title.localeCompare(b.item.title)
          : rank(a) - rank(b) || distance(a) - distance(b),
    );
  return (
    <main className="page-shell">
      <PageHeading title="Wishlist">
        Set the price you’re willing to pay. Each time you open Backlog it
        compares stores and flags games at your target or their lowest price
        ever.
      </PageHeading>
      <GuestBanner compact />
      {rows.length > 0 && (
        <div className="summary-row">
          <p className="summary-line" aria-live="polite">
            {offline
              ? "You’re offline. Prices will update when you reconnect."
              : pending
                ? "Checking prices across stores…"
                : `${
                    alerts.length
                      ? `${plural(alerts.length, "game")} worth buying now.`
                      : "Nothing has hit your targets yet."
                  }${
                    unchecked.length
                      ? ` ${plural(unchecked.length, "game")} couldn’t be checked live.`
                      : ""
                  }`}
          </p>
          <p className="checked-at">
            {checkedAt > 0 && `Prices checked ${checked} · `}
            <button
              className="text-link"
              disabled={refreshing}
              onClick={() => void refresh()}
            >
              {refreshing ? "Checking…" : "Check prices now"}
            </button>
          </p>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {moved && (
        <aside
          ref={panel}
          tabIndex={-1}
          className="moved-panel"
          aria-label="Moved to library"
          aria-busy={moved.status === "saving" || moved.status === "undoing"}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status">
              {moved.status === "saving" ? (
                <>
                  Moving <strong>{moved.item.title}</strong> to your library…
                </>
              ) : moved.status === "error" ? (
                <>
                  Couldn’t move <strong>{moved.item.title}</strong> to your
                  library.
                </>
              ) : moved.status === "undoing" ? (
                <>
                  Moving <strong>{moved.item.title}</strong> back to your
                  wishlist…
                </>
              ) : (
                <>
                  <strong>{moved.item.title}</strong> moved to your library.
                </>
              )}
            </p>
            <div className="flex gap-4">
              {moved.status === "error" ? (
                <button
                  className="text-link"
                  onClick={() => void moveToLibrary(moved.item, moved.prices)}
                >
                  Try again
                </button>
              ) : (
                <button
                  className="text-link"
                  disabled={
                    detailsSaving ||
                    (moved.status !== "done" && moved.status !== "undo-error")
                  }
                  onClick={() => void undoMove()}
                >
                  Undo
                </button>
              )}
              <button
                className="text-link"
                disabled={moveBusy}
                onClick={dismiss}
              >
                {moved.status === "error" ? "Dismiss" : "Done"}
              </button>
            </div>
          </div>
          {moved.status === "undo-error" && (
            <p role="alert" className="field-error">
              Couldn’t undo. Please try again.
            </p>
          )}
          {(moved.status === "done" || moved.status === "undo-error") && (
            <OwnPrompt
              steamAppId={moved.item.steamAppId}
              title={moved.item.title}
              onPendingChange={setDetailsSaving}
              paid={moved.prices?.currentPrice}
              store={
                moved.prices?.deals[0]
                  ? purchaseStoreFromDeal(moved.prices.deals[0].storeID)
                  : undefined
              }
            />
          )}
        </aside>
      )}
      {rows.length > 0 && (
        <div className="collection-search">
          <input
            type="search"
            aria-label="Find in your wishlist"
            disabled={isLoading}
            className="form-control w-full"
            placeholder="Find in your wishlist…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="form-control"
            aria-label="Sort wishlist"
            value={sort}
            disabled={isLoading}
            onChange={(event) => setSort(event.target.value)}
          >
            <option value="alerts">Best to buy first</option>
            <option value="price">Lowest price</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      )}
      <div
        ref={results}
        tabIndex={-1}
        role="region"
        aria-label="Wishlist results"
        className="outline-none"
      >
        {isLoading ? (
          <p role="status">Loading your wishlist…</p>
        ) : visible.length ? (
          <section data-reveal aria-label="Price watches" className="card-grid">
            {visible.map(({ item, prices, state, alert }) => (
              <WatchCard
                key={item.steamAppId}
                item={item}
                prices={prices}
                state={state}
                alert={alert}
                moveBusy={moveBusy}
                onOwned={(owned, ownedPrices) =>
                  void moveToLibrary(owned, ownedPrices)
                }
              />
            ))}
          </section>
        ) : rows.length ? (
          <p className="empty-state">No games match your search.</p>
        ) : (
          <div className="empty-state space-y-4">
            <p>
              Your wishlist is empty. Add a game to compare its price across
              stores and get flagged when it drops.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <AddGameButton />
              <Link className="action secondary" href="/deals">
                Browse deals
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
