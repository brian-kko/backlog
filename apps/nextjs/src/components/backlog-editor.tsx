"use client";

import { useState } from "react";
import Link from "next/link";

import type { BacklogItem } from "./backlog-provider";
import { useBacklog } from "./backlog-provider";
import { PriceField, RemoveGameButton } from "./game-ui";

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
      await save({
        steamAppId,
        title,
        isOwned: item?.isOwned ?? false,
        ...change,
      });
      setMessage("Backlog status updated.");
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
        <h2>Your backlog status</h2>
        <span className="save-state">
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
            ? "You own this game. Keep your progress and purchase details here."
            : "You’re watching this game. Set a price you’d like to pay."
          : "Add this game to your library or watch it on your wishlist."}
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
          <span>I own this game</span>
        </button>
        <button
          className="membership-option"
          aria-label="On Wishlist"
          aria-pressed={item?.isOwned === false}
          disabled={disabled}
          onClick={() => void update({ isOwned: false })}
        >
          <strong>On Wishlist</strong>
          <span>I’m waiting to buy</span>
        </button>
      </div>
      {item && (
        <div className="editor-fields">
          {item.isOwned ? (
            <>
              <label className="field-label">
                Completion Status
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
                    ["backlog", "Backlog — haven’t started"],
                    ["playing", "Playing"],
                    ["completed", "Completed"],
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
              <PriceField
                label="Amount Paid ($)"
                value={item.amountPaid}
                disabled={disabled}
                onSave={(amountPaid) => update({ amountPaid })}
              />
            </>
          ) : (
            <>
              <PriceField
                label="Target Price ($)"
                value={item.targetPrice}
                disabled={disabled}
                onSave={(targetPrice) => update({ targetPrice })}
              />
              <p className="filter-help">
                Leave the target blank to watch for an all-time low. Automatic
                notifications arrive in a later milestone.
              </p>
              {(["notifyPatches", "notifyEvents"] as const).map((field) => (
                <label className="check-label" key={field}>
                  <input
                    type="checkbox"
                    checked={item[field] ?? true}
                    disabled={disabled}
                    onChange={(event) =>
                      void update({ [field]: event.target.checked })
                    }
                  />
                  {field === "notifyPatches"
                    ? "Track patch notes"
                    : "Track live events"}
                </label>
              ))}
            </>
          )}
          <p className="filter-help">
            Changes save automatically. Press Enter or leave a price field to
            save it.
          </p>
          <div className="editor-footer">
            <Link
              className="text-link"
              href={item.isOwned ? "/library" : "/wishlist"}
            >
              {item.isOwned ? "Open your library" : "Open your wishlist"} →
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
