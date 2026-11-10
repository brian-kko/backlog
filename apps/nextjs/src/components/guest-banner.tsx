"use client";

import { useState } from "react";

import { AddGameButton } from "./add-game";
import { useBacklog } from "./backlog-provider";

/**
 * Explains guest storage and sample data. `compact` is a one-line notice for
 * secondary pages; the full banner lives on the dashboard.
 */
export function GuestBanner({ compact = false }: { compact?: boolean }) {
  const { isGuest, isDemo, clearSample, keepSamples, isLoading } = useBacklog();
  const [busy, setBusy] = useState(false);
  if (!isGuest || isLoading || (compact && !isDemo)) return null;
  const clear = (
    <button
      className="text-link"
      aria-label="Clear sample games"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await clearSample();
        } finally {
          setBusy(false);
        }
      }}
    >
      {/* Whole labels: the link is a flex box, which would eat a split space. */}
      <span className="max-sm:hidden">Clear sample games</span>
      <span className="sm:hidden">Clear samples</span>
    </button>
  );
  const keep = (
    <button
      className="text-link"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await keepSamples();
        } finally {
          setBusy(false);
        }
      }}
    >
      Keep them
    </button>
  );
  if (compact)
    return (
      <p className="sample-note">
        <span>Showing sample games.</span>
        <span className="flex gap-4">
          {clear} {keep}
        </span>
      </p>
    );
  return (
    <aside className="guest-banner" aria-label="Guest mode">
      <div className="space-y-1.5">
        {isDemo && (
          <p className="guest-tagline">
            Compare stores. Set your price. Follow your games.
          </p>
        )}
        <strong>
          {isDemo
            ? "You’re exploring with sample games"
            : "Your games are saved in this browser"}
        </strong>
        <p>
          {isDemo
            ? "Try things out, then clear them or keep the ones you own. "
            : ""}
          <span className="hidden sm:inline">
            Sign in with Discord to keep your collection across devices.
          </span>
        </p>
      </div>
      <div className="guest-actions">
        {isDemo && clear}
        {isDemo && keep}
        <AddGameButton secondary label="Add your games" />
      </div>
    </aside>
  );
}
