"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { getSteamLaunchUrl, launchGame } from "~/utils/launcher";
import { useBacklog } from "./backlog-provider";

export const money = (value: number | null | undefined) =>
  value == null
    ? "Check Steam"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const headerArt = (appId: number) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;

export function LaunchLink({
  steamAppId,
  children = "Launch in Steam",
  testId,
}: {
  steamAppId: number;
  children?: React.ReactNode;
  testId?: string;
}) {
  return (
    <a
      className="action"
      href={getSteamLaunchUrl(steamAppId)}
      data-testid={testId}
      onClick={(event) => {
        event.preventDefault();
        void launchGame(steamAppId);
      }}
    >
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}

export function TrackActions({
  steamAppId,
  title,
  price,
}: {
  steamAppId: number;
  title: string;
  price?: number | null;
}) {
  const { save, items, isLoading } = useBacklog();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const existing = items.find((item) => item.steamAppId === steamAppId);
  async function track(isOwned: boolean) {
    setPending(true);
    try {
      await save({
        steamAppId,
        title,
        isOwned,
        ...(!isOwned && existing?.targetPrice === undefined && price != null
          ? { targetPrice: Math.floor(price * 0.8 * 100) / 100 }
          : {}),
      });
      setMessage(`${title} ${isOwned ? "marked owned" : "added to wishlist"}.`);
    } catch {
      setMessage("Unable to save. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="track-actions space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          className="action secondary"
          disabled={pending || isLoading || Boolean(existing)}
          onClick={() => void track(false)}
        >
          {existing?.isOwned
            ? "Owned"
            : existing
              ? "On Wishlist"
              : "+ Wishlist"}
        </button>
        <button
          className="action secondary"
          disabled={pending || isLoading || Boolean(existing?.isOwned)}
          onClick={() => void track(true)}
        >
          {existing?.isOwned ? "In Library" : "Mark Owned"}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </div>
  );
}

export function GameArt({
  appId,
  title,
  src,
  priority = false,
}: {
  appId?: number | null;
  title: string;
  src?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const primary = src?.trim() || (appId ? headerArt(appId) : undefined);
  const resolved = [primary, appId ? headerArt(appId) : undefined].find(
    (value) => value && !failed.includes(value),
  );
  return resolved ? (
    <Image
      className="game-art"
      src={resolved}
      alt={title}
      width={460}
      height={215}
      unoptimized
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      onError={() => setFailed((values) => [...values, resolved])}
    />
  ) : (
    <div className="game-art artwork-placeholder" role="img" aria-label={title}>
      <span>{title}</span>
    </div>
  );
}

export function PriceField({
  label,
  ariaLabel,
  value,
  onSave,
  disabled = false,
}: {
  label: string;
  ariaLabel?: string;
  value: number | undefined;
  onSave: (value: number | undefined) => Promise<void>;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  return (
    <label className="field-label">
      {label}
      <input
        key={value ?? "unset"}
        className="form-control mt-2 w-full"
        aria-label={ariaLabel ?? label}
        type="number"
        min="0"
        max="99999999.99"
        step="0.01"
        defaultValue={value ?? ""}
        placeholder="Not set"
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.checkValidity()) {
            setError(
              "Enter a positive amount with at most two decimal places, or leave blank.",
            );
            return;
          }
          setError("");
          const next =
            event.currentTarget.value === ""
              ? undefined
              : Number(event.currentTarget.value);
          if (next !== value)
            void onSave(next).catch(() =>
              setError("Couldn’t save this amount. Please try again."),
            );
        }}
      />
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function RemoveGameButton({
  steamAppId,
  title,
}: {
  steamAppId: number;
  title: string;
}) {
  const { remove, isLoading } = useBacklog();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        className="text-link remove-link"
        aria-label={`Remove ${title} from collection`}
        disabled={pending || isLoading}
        onClick={async () => {
          setPending(true);
          try {
            await remove(steamAppId);
          } catch {
            setError("Couldn’t remove the game. Try again.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function GameLink({
  steamAppId,
  children = "Game Hub",
}: {
  steamAppId: number;
  children?: React.ReactNode;
}) {
  return (
    <Link className="text-link" href={`/game/${steamAppId}`}>
      {children} →
    </Link>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="page-description">{children}</p>}
    </header>
  );
}
