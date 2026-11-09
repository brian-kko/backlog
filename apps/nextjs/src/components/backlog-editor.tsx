"use client";

import { useState } from "react";
import Link from "next/link";

import type { Platform, PurchaseStore } from "@acme/validators";
import {
  defaultPlatform,
  platformNames,
  purchaseStoreNames,
} from "@acme/validators";

import type { BacklogItem } from "./backlog-provider";
import { useBacklog } from "./backlog-provider";
import { PriceField, RemoveGameButton, SampleTag } from "./game-ui";

export function BacklogEditor({
  steamAppId,
  title,
  loading,
}: {
  steamAppId: number;
  title: string;
  loading: boolean;
}) {
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
      await save(
        {
          steamAppId,
          title,
          isOwned: item?.isOwned ?? false,
          ...change,
        },
      );
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
      <p className="text-muted-foreground text-sm">
        {item
          ? item.isOwned
            ? "Track your progress and what you paid."
            : "Set the price you’re willing to pay and we’ll flag it when a store hits it."
          : "Add it to your library if you own it, or wishlist it to watch prices across stores."}
      </p>
      <div className="membership-picker" aria-label="Backlog membership">
        <button
          className="membership-option"
          aria-label="In Library"
          aria-pressed={item?.isOwned === true}
          disabled={disabled}
          onClick={() => void update({ isOwned: true })}
        >
          <strong>In Library</strong>
          <span>I own it</span>
        </button>
        <button
          className="membership-option"
          aria-label="On Wishlist"
          aria-pressed={item?.isOwned === false}
          disabled={disabled}
          onClick={() => void update({ isOwned: false })}
        >
          <strong>On Wishlist</strong>
          <span>Watch the price</span>
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
                  aria-label="Backlog completion status"
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
                    <option
                      key={value}
                      value={value}
                     
                    >
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
                      {platformNames[defaultPlatform(item.purchaseStore)]}{" "}
                      (assumed)
                    </option>
                    {(Object.keys(platformNames) as Platform[]).map((key) => (
                      <option key={key} value={key}>
                        {platformNames[key]}
                      </option>
                    ))}
                  </select>
                  {!item.platform && (
                    <span className="field-hint">
                      Not confirmed. Change it if this plays elsewhere.
                    </span>
                  )}
                </label>
              </div>
            </>
          ) : (
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
          <p className="filter-help">
            Changes save automatically.
          </p>
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
