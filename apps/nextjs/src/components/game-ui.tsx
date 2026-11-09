"use client";

import { useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import type { Platform, PurchaseStore } from "@acme/validators";
import {
  defaultPlatform,
  platformNames,
  purchaseStoreNames,
  storeNames,
} from "@acme/validators";

import { getSteamLaunchUrl, launchGame } from "~/utils/launcher";
import { useBacklog } from "./backlog-provider";

export const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
/** Shelf price: "Free" instead of $0.00. */
export const price = (value: number | null | undefined) =>
  value === 0 ? "Free" : money(value);
export const headerArt = (appId: number) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`;
export const storeName = (storeId: string | null | undefined) =>
  (storeId ? storeNames[storeId] : undefined) ?? "partner store";
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * Launches through the desktop companion or the Steam client URI. Hidden on
 * phones and tablets via CSS, where a desktop Steam client can't be reached.
 */
export function LaunchLink({
  steamAppId,
  title,
  children = "Launch in Steam",
  testId,
  secondary = false,
}: {
  steamAppId: number;
  /** Game title, so each launch button has a distinct accessible name. */
  title: string;
  /** Visible verb, repeated in the accessible name ("Play", "Launch"). */
  children?: React.ReactNode;
  testId?: string;
  secondary?: boolean;
}) {
  return (
    <a
      className={`action launch-link${secondary ? "secondary" : ""}`}
      href={getSteamLaunchUrl(steamAppId)}
      aria-label={`${typeof children === "string" && children !== "Launch in Steam" ? children : "Launch"} ${title} in Steam`}
      title="Opens the Steam app on this computer"
      data-testid={testId}
      onClick={(event) => {
        event.preventDefault();
        void launchGame(steamAppId);
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d="M7 4v16l13-8z" fill="currentColor" />
      </svg>
      {children}
    </a>
  );
}

/** After wishlisting, asks for an optional target price in place. */
export function TargetPrompt({
  steamAppId,
  title,
  bestPrice,
  priceLabel = "Best now",
}: {
  steamAppId: number;
  title: string;
  bestPrice?: number | null;
  priceLabel?: string;
}) {
  const { items, save } = useBacklog();
  const item = items.find((value) => value.steamAppId === steamAppId);
  if (!item || item.isOwned) return null;
  return (
    <PriceField
      label="Your target price (optional)"
      ariaLabel={`Target price for ${title}`}
      value={item.targetPrice}
      hint={
        bestPrice != null
          ? `${priceLabel} ${money(bestPrice)}. Leave blank to be flagged at its lowest ever price.`
          : "Leave blank to be flagged at its lowest ever price."
      }
      onSave={(targetPrice) =>
        save({ steamAppId, title, isOwned: false, targetPrice })
      }
    />
  );
}

/**
 * After marking a game owned, asks what was paid, where, and which launcher it
 * runs in. A deal's price and seller are offered as a suggestion, never saved
 * without the user's say-so.
 */
export function OwnPrompt({
  steamAppId,
  title,
  paid,
  store,
  onPendingChange,
}: {
  steamAppId: number;
  title: string;
  /** Lets a containing panel block dismissal while details are saving. */
  onPendingChange?: (pending: boolean) => void;
  /** Suggested amount, e.g. the offer the user was looking at. */
  paid?: number | null;
  store?: PurchaseStore;
}) {
  const { items, save } = useBacklog();
  // Fields whose last write failed; only a successful write of that same
  // field clears it, so an unrelated success can't mask a failure.
  const [failedFields, setFailedFields] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  // Counts overlapping writes; "Saved." and the parent's pending flag only
  // settle once every outstanding write has finished.
  const outstanding = useRef(0);
  const failures = useRef(new Set<string>());
  const item = items.find((value) => value.steamAppId === steamAppId);
  if (!item?.isOwned) return null;
  const fieldNames: Record<string, string> = {
    amountPaid: "amount paid",
    purchaseStore: "store",
    platform: "launcher",
  };
  const update = async (change: Partial<typeof item>) => {
    const fields = Object.keys(change).filter((key) => key in fieldNames);
    outstanding.current += 1;
    setStatus("saving");
    onPendingChange?.(true);
    try {
      await save({ steamAppId, title, isOwned: true, ...change });
      for (const field of fields) failures.current.delete(field);
    } catch (failure) {
      for (const field of fields) failures.current.add(field);
      throw failure;
    } finally {
      setFailedFields([...failures.current]);
      outstanding.current -= 1;
      if (outstanding.current === 0) {
        setStatus(failures.current.size ? "idle" : "saved");
        onPendingChange?.(false);
      }
    }
  };
  const error = failedFields.length
    ? `Couldn’t save the ${new Intl.ListFormat("en", {
        type: "conjunction",
      }).format(
        failedFields.map((field) => fieldNames[field] ?? field),
      )}. Try changing ${failedFields.length > 1 ? "them" : "it"} again.`
    : "";
  const suggest =
    paid != null &&
    item.amountPaid === undefined &&
    item.purchaseStore === undefined;
  return (
    <div className="own-prompt">
      <p className="own-prompt-title">
        Added to your library. Add purchase details (optional):{" "}
        <span role="status" className="save-feedback">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved." : ""}
        </span>
      </p>
      {suggest && (
        <button
          type="button"
          className="text-link col-span-full justify-self-start"
          onClick={() =>
            void update({
              amountPaid: paid,
              ...(store ? { purchaseStore: store } : {}),
            }).catch(() => undefined)
          }
        >
          I paid {money(paid)}
          {store ? ` at ${purchaseStoreNames[store]}` : ""}: use this
        </button>
      )}
      <PriceField
        label="Paid"
        ariaLabel={`Amount paid for ${title}`}
        value={item.amountPaid}
        onSave={(amountPaid) =>
          // The prompt's summary reports failures; avoid a second alert.
          update({ amountPaid }).catch(() => undefined)
        }
      />
      <label className="field-label">
        <span>Bought from</span>
        <select
          className="form-control w-full"
          aria-label={`Store ${title} was bought from`}
          value={item.purchaseStore ?? ""}
          onChange={(event) =>
            void update({
              purchaseStore: (event.target.value || undefined) as
                | PurchaseStore
                | undefined,
            }).catch(() => undefined)
          }
        >
          <option value="">Not set</option>
          {(Object.keys(purchaseStoreNames) as PurchaseStore[]).map((key) => (
            <option key={key} value={key}>
              {purchaseStoreNames[key]}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label col-span-full">
        <span>Plays on</span>
        <select
          className="form-control w-full"
          aria-label={`Launcher ${title} plays on`}
          value={item.platform ?? ""}
          onChange={(event) =>
            void update({
              platform: (event.target.value || undefined) as
                | Platform
                | undefined,
            }).catch(() => undefined)
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
      </label>
      {error && (
        <p role="alert" className="field-error col-span-full">
          {error}
        </p>
      )}
    </div>
  );
}

export function TrackActions({
  steamAppId,
  title,
  price,
  store,
  saved = false,
}: {
  steamAppId: number;
  title: string;
  price?: number | null;
  /** Seller of the offer being viewed, used to pre-fill "Bought from". */
  store?: PurchaseStore;
  /** The price is a saved catalog offer, not a live one. */
  saved?: boolean;
}) {
  const { save, items, isLoading } = useBacklog();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [justAdded, setJustAdded] = useState<"owned" | "wishlist" | null>(null);
  const existing = items.find((item) => item.steamAppId === steamAppId);
  async function track(isOwned: boolean) {
    setPending(true);
    setError("");
    try {
      // Ownership alone says nothing about what was paid; the prompt asks.
      await save({ steamAppId, title, isOwned }, { claim: true });
      setJustAdded(isOwned ? "owned" : "wishlist");
    } catch {
      setError("Couldn’t save. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="track-actions">
      {existing?.isOwned && justAdded !== "owned" ? (
        <Link className="collection-chip" href="/library">
          <span aria-hidden="true">✓</span> In your library
        </Link>
      ) : existing?.isOwned ? null : (
        <div className="flex w-full flex-wrap items-center gap-2">
          {existing ? (
            <Link className="collection-chip" href="/wishlist">
              <span aria-hidden="true">♥</span> On your wishlist
            </Link>
          ) : (
            <button
              className="action secondary compact"
              disabled={pending || isLoading}
              onClick={() => void track(false)}
            >
              + Wishlist
            </button>
          )}
          <button
            className="action secondary compact"
            disabled={pending || isLoading}
            onClick={() => void track(true)}
          >
            I own this
          </button>
        </div>
      )}
      {justAdded === "wishlist" && (
        <TargetPrompt
          steamAppId={steamAppId}
          title={title}
          bestPrice={price}
          priceLabel={saved ? "Saved price" : "Best now"}
        />
      )}
      {justAdded === "owned" && (
        <OwnPrompt
          steamAppId={steamAppId}
          title={title}
          paid={price}
          store={store}
        />
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
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
  // A blank thumbnail string falls back to the Steam header art.
  const trimmed = src?.trim() === "" ? undefined : src?.trim();
  const primary = trimmed ?? (appId ? headerArt(appId) : undefined);
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
  hint,
}: {
  label: string;
  ariaLabel?: string;
  value: number | undefined;
  onSave: (value: number | undefined) => Promise<void>;
  disabled?: boolean;
  hint?: string;
}) {
  const [error, setError] = useState("");
  const id = useId();
  const describedBy =
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="field-label">
      <label htmlFor={id}>{label}</label>
      <div className="money-input">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          key={value ?? "unset"}
          className="form-control w-full"
          aria-label={ariaLabel ?? label}
          type="number"
          inputMode="decimal"
          min="0"
          max="99999999.99"
          step="0.01"
          defaultValue={value ?? ""}
          placeholder="Not set"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
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
      </div>
      {hint && (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
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
    <>
      <button
        type="button"
        className="quiet-button remove-link"
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
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </>
  );
}

export function GameLink({
  steamAppId,
  children = "View game",
}: {
  steamAppId: number;
  children?: React.ReactNode;
}) {
  return (
    <Link className="text-link" href={`/game/${steamAppId}`}>
      {children}
    </Link>
  );
}

export function PageHeading({
  title,
  children,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div className="space-y-2">
        <h1>{title}</h1>
        {children && <p className="page-description">{children}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

/** Quiet label on starter samples; editing a sample makes it the user's own. */
export function SampleTag({
  item,
}: {
  item: { steamAppId: number; title: string; isOwned: boolean };
}) {
  const { isSample } = useBacklog();
  if (!isSample(item.steamAppId)) return null;
  return <span className="sample-label">Sample</span>;
}
