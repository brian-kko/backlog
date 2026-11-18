"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { Platform, PurchaseStore } from "@acme/validators";
import {
  defaultPlatform,
  isRiotGame,
  platformNames,
  purchaseStoreNames,
} from "@acme/validators";

import type { BacklogItem } from "./backlog-provider";
import { useTRPC } from "~/trpc/react";
import { useBacklog } from "./backlog-provider";
import {
  FreePriceNotice,
  PriceField,
  RemoveGameButton,
  SampleTag,
  storeName,
} from "./game-ui";

export function BacklogEditor({
  steamAppId,
  title,
  loading,
}: {
  steamAppId: number;
  title: string;
  loading: boolean;
}) {
  const trpc = useTRPC();
  // Observe the game page's existing request, including refreshes, without
  // starting a second price/news request just for the editor.
  const game = useQuery(
    trpc.backlog.getGameDetails.queryOptions(
      { steamAppId },
      { enabled: false },
    ),
  );
  const prices = game.data?.prices;
  const free = prices?.currentPrice === 0;
  const freeOffer = prices?.deals.find((deal) => deal.price === 0);
  const { items, save, isGuest, isLoading } = useBacklog();
  const item = items.find((value) => value.steamAppId === steamAppId);
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function update(change: Partial<BacklogItem>) {
    setPending((value) => value + 1);
    setError("");
    try {
      // Send only the edited fields. The provider serializes writes and merges
      // against the latest item, including when a price blur precedes a click.
      await save({
        steamAppId,
        title,
        isOwned: item?.isOwned ?? false,
        ...change,
      });
      setMessage("Saved.");
    } catch {
      setError("Couldn’t save this change. Please try again.");
    } finally {
      setPending((value) => value - 1);
    }
  }
  const disabled = loading || isLoading;
  return (
    <section className="panel backlog-editor" aria-label="Your backlog status">
      <div className="section-heading">
        <h2>In your collection</h2>
        <span className="save-state">
          {item && <SampleTag item={item} />}{" "}
          {pending
            ? "Saving…"
            : item
              ? isGuest
                ? "Saved in this browser"
                : "Saved to your account"
              : "Not in your collection"}
        </span>
      </div>
      {free && !item?.isOwned ? (
        <FreePriceNotice
          steamAppId={steamAppId}
          saved={prices.source !== "cheapshark" && prices.source !== "steam"}
          url={freeOffer?.url}
          store={storeName(freeOffer?.storeID)}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {item
            ? item.isOwned
              ? "Track your progress and what you paid."
              : "Set the price you’re willing to pay and we’ll flag it when a store hits it."
            : "Add it to your library if you own it, or wishlist it to watch prices across stores."}
        </p>
      )}
      <div className="membership-picker" aria-label="Collection membership">
        {/* Labels say what a press does; the selected state reads as status. */}
        <button
          className="membership-option"
          aria-pressed={item?.isOwned === true}
          disabled={disabled}
          onClick={() => void update({ isOwned: true })}
        >
          <strong>
            {!item
              ? "Add to library"
              : item.isOwned
                ? "In library"
                : "Move to library"}
          </strong>
          <span>I own it</span>
        </button>
        <button
          className="membership-option"
          aria-pressed={item?.isOwned === false}
          disabled={disabled}
          onClick={() => void update({ isOwned: false })}
        >
          <strong>
            {!item
              ? "Add to wishlist"
              : item.isOwned
                ? "Move to wishlist"
                : "On wishlist"}
          </strong>
          <span>{free ? "Keep it on your list" : "Watch the price"}</span>
        </button>
      </div>
      {item && (
        <div className="editor-fields">
          {item.isOwned ? (
            <>
              <label className="field-label">
                Status
                <select
                  className="form-control mt-2 w-full"
                  aria-label="Completion status"
                  value={item.completionStatus ?? "backlog"}
                  disabled={disabled}
                  onChange={(event) =>
                    void update({
                      completionStatus: event.target
                        .value as BacklogItem["completionStatus"],
                    })
                  }
                >
                  {[
                    ["backlog", "Unplayed"],
                    ["playing", "Playing"],
                    ["completed", "Completed"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="card-fields">
                <PriceField
                  label="Amount paid"
                  value={item.amountPaid}
                  disabled={disabled}
                  onSave={(amountPaid) => update({ amountPaid })}
                />
                <label className="field-label">
                  <span>Bought from</span>
                  <select
                    className="form-control w-full"
                    value={item.purchaseStore ?? ""}
                    disabled={disabled}
                    onChange={(event) =>
                      void update({
                        purchaseStore: (event.target.value || undefined) as
                          | PurchaseStore
                          | undefined,
                      })
                    }
                  >
                    <option value="">Not set</option>
                    {(Object.keys(purchaseStoreNames) as PurchaseStore[]).map(
                      (store) => (
                        <option key={store} value={store}>
                          {purchaseStoreNames[store]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="field-label col-span-full">
                  <span>Plays on</span>
                  <select
                    className="form-control w-full"
                    value={item.platform ?? ""}
                    disabled={disabled}
                    onChange={(event) =>
                      void update({
                        platform: (event.target.value || undefined) as
                          | Platform
                          | undefined,
                      })
                    }
                  >
                    <option value="">
                      {`${platformNames[defaultPlatform(item.purchaseStore, item.steamAppId)]}${isRiotGame(item.steamAppId) ? "" : " (unconfirmed)"}`}
                    </option>
                    {(Object.keys(platformNames) as Platform[]).map((key) => (
                      <option key={key} value={key}>
                        {platformNames[key]}
                      </option>
                    ))}
                  </select>
                  {!item.platform && !isRiotGame(item.steamAppId) && (
                    <span className="field-hint">
                      Not confirmed. Change it if this plays elsewhere.
                    </span>
                  )}
                </label>
              </div>
            </>
          ) : free ? null : (
            <>
              <PriceField
                label="Target price"
                value={item.targetPrice}
                disabled={disabled}
                hint="Leave blank to be flagged only at an all-time low."
                onSave={(targetPrice) => update({ targetPrice })}
              />
            </>
          )}
          {(item.isOwned || !free) && (
            <p className="filter-help">Changes save automatically.</p>
          )}
          <div className="editor-footer">
            <Link
              className="text-link"
              href={item.isOwned ? "/library" : "/wishlist"}
            >
              {item.isOwned ? "Open your library" : "Open your wishlist"}
            </Link>
            <RemoveGameButton steamAppId={steamAppId} title={title} />
          </div>
        </div>
      )}
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : message ? (
        <p role="status" className="save-feedback">
          {message}
        </p>
      ) : null}
    </section>
  );
}
