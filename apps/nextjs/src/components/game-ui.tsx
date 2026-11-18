"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { Platform, PurchaseStore } from "@acme/validators";
import { cn } from "@acme/ui";
import {
  defaultPlatform,
  isRiotGame,
  platformNames,
  purchaseStoreNames,
  storeNames,
} from "@acme/validators";

import { useTRPC } from "~/trpc/react";
import { getSteamLaunchUrl, launchGame } from "~/utils/launcher";
import { useAmbientPalette } from "./ambient";
import { useBacklog } from "./backlog-provider";

export const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("en-US", { style: "currency", currency: "USD" });
/** Shelf price: "Free" instead of $0.00. */
export const price = (value: number | null | undefined) =>
  value === 0 ? "Free" : money(value);
export const headerArt = (appId: number) => `/api/art/${appId}/header`;
/** Wide card art (616×353 where Steam has it, else the header). */
export const wideArt = (appId: number) => `/api/art/${appId}/wide`;
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
      className={cn("action launch-link", secondary && "secondary")}
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

interface TrackingOffer {
  store?: string;
  url?: string;
  source?: "cheapshark" | "steam" | "catalog";
}

/** Free offers replace target entry without changing the saved target. */
export function FreePriceNotice({
  steamAppId,
  saved,
  checking = false,
  url,
  store,
}: {
  steamAppId: number;
  saved: boolean;
  checking?: boolean;
  url?: string;
  store?: string;
}) {
  const destination =
    store && store !== "partner store" && (url || store === "Steam")
      ? store
      : undefined;
  const live = !saved && !checking && destination != null;
  return (
    <div className="col-span-full min-h-28 space-y-2">
      <p className="text-muted-foreground text-sm" role="status">
        {checking
          ? "Checking today’s price…"
          : saved
            ? "Previously free; check the store for today’s price"
            : live
              ? "Free right now; nothing to wait for"
              : "Check the store for today’s availability"}
      </p>
      <a
        className="action secondary compact"
        href={url ?? `https://store.steampowered.com/app/${steamAppId}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {live ? `Get it free at ${destination}` : "Check availability"}
        <span aria-hidden="true"> ↗</span>
      </a>
    </div>
  );
}

/** After wishlisting, asks for a target only when there is a price to watch. */
/**
 * One clear confirmation for follow-up details: "Saving…", then a check and
 * what was saved, re-announced (and re-animated) on every save.
 */
function SaveStatus({
  state,
  count,
  children,
}: {
  state: "idle" | "saving" | "saved";
  count: number;
  children?: React.ReactNode;
}) {
  // The live region stays mounted (so it's announced); only its content is
  // keyed, which replays the pop-in on each save.
  return (
    <p role="status" className="save-status col-span-full">
      {state === "saving" ? (
        <span className="save-status-text">Saving…</span>
      ) : state === "saved" ? (
        <span key={count} className="save-status-text is-saved">
          <span aria-hidden="true">✓</span> {children ?? "Saved"}
        </span>
      ) : null}
    </p>
  );
}

export function TargetPrompt({
  steamAppId,
  title,
  bestPrice,
  priceLabel = "Best now",
  saved,
  offer,
}: {
  steamAppId: number;
  title: string;
  bestPrice?: number | null;
  priceLabel?: string;
  /** Omit when the caller cannot verify the price's source. */
  saved?: boolean;
  /** Destination and source of the offer being tracked. */
  offer?: TrackingOffer;
}) {
  const trpc = useTRPC();
  const { items, save } = useBacklog();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [saves, setSaves] = useState(0);
  const item = items.find((value) => value.steamAppId === steamAppId);
  // Search results do not pass their source; verify a zero before claiming free.
  const verify = bestPrice === 0 && saved === undefined && !offer?.source;
  const check = useQuery(
    trpc.backlog.getGamePrices.queryOptions(
      { steamAppId },
      { enabled: verify && !!item && !item.isOwned, retry: false },
    ),
  );
  if (!item || item.isOwned) return null;
  const checkedPrices = verify ? check.data?.prices : undefined;
  const currentPrice = checkedPrices?.currentPrice ?? bestPrice;
  const currentLabel = checkedPrices
    ? checkedPrices.source === "catalog"
      ? "Saved price"
      : "Best now"
    : priceLabel;
  if (currentPrice === 0) {
    const checkedOffer = checkedPrices?.deals.find((deal) => deal.price === 0);
    const currentOffer = checkedPrices
      ? {
          source: checkedPrices.source,
          url: checkedOffer?.url,
          store: checkedOffer
            ? storeName(checkedOffer.storeID)
            : checkedPrices.source === "steam"
              ? "Steam"
              : undefined,
        }
      : offer;
    return (
      <FreePriceNotice
        steamAppId={steamAppId}
        saved={
          currentOffer?.source === "catalog" ||
          (saved ??
            (currentOffer?.source !== "cheapshark" &&
              currentOffer?.source !== "steam"))
        }
        checking={verify && check.isPending && check.fetchStatus !== "paused"}
        url={currentOffer?.url}
        store={currentOffer?.store}
      />
    );
  }
  return (
    <div className="target-prompt">
      <p className="prompt-added">
        <span aria-hidden="true">✓</span> Added to your wishlist
      </p>
      <PriceField
        label="Your target price (optional)"
        ariaLabel={`Target price for ${title}`}
        value={item.targetPrice}
        hint={
          currentPrice != null
            ? `${currentLabel} ${price(currentPrice)}. Leave blank to be flagged at its lowest ever price.`
            : "Leave blank to be flagged at its lowest ever price."
        }
        onSave={async (targetPrice) => {
          setStatus("saving");
          try {
            await save({ steamAppId, title, isOwned: false, targetPrice });
            setStatus("saved");
            setSaves((value) => value + 1);
          } catch (failure) {
            setStatus("idle");
            throw failure;
          }
        }}
      />
      <SaveStatus state={status} count={saves}>
        {item.targetPrice == null
          ? "Target cleared: you’ll be flagged at its lowest ever price"
          : `Target saved: we’ll flag ${title} at ${price(item.targetPrice)} or less`}
      </SaveStatus>
    </div>
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
  const [saves, setSaves] = useState(0);
  // Counts overlapping writes; "Saved." and the parent's pending flag only
  // settle once every outstanding write has finished.
  const outstanding = useRef(0);
  const failures = useRef(new Set<string>());
  const item = items.find((value) => value.steamAppId === steamAppId);
  if (!item?.isOwned) return null;
  const riot = isRiotGame(steamAppId);
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
        if (!failures.current.size) setSaves((value) => value + 1);
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
  // Name what is now stored, so "Saved" is never ambiguous.
  const summary = [
    item.amountPaid != null &&
      (item.amountPaid === 0
        ? "Got it free"
        : `Paid ${price(item.amountPaid)}`),
    item.purchaseStore && `from ${purchaseStoreNames[item.purchaseStore]}`,
    !riot && item.platform && `plays on ${platformNames[item.platform]}`,
  ].filter(Boolean);
  return (
    <div className="own-prompt">
      <p className="prompt-added">
        <span aria-hidden="true">✓</span> Added to your library
      </p>
      <p className="own-prompt-title">
        Purchase details are optional and save as you change them.
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
          {paid === 0 ? "I got it free" : `I paid ${price(paid)}`}
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
      {riot ? (
        <p className="field-label col-span-full">
          <span>Plays on</span> <span>{platformNames.riot}</span>
        </p>
      ) : (
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
              {`${platformNames[defaultPlatform(item.purchaseStore, steamAppId)]} (unconfirmed)`}
            </option>
            {(Object.keys(platformNames) as Platform[]).map((key) => (
              <option key={key} value={key}>
                {platformNames[key]}
              </option>
            ))}
          </select>
        </label>
      )}
      <SaveStatus state={status} count={saves}>
        {summary.length ? `Saved: ${summary.join(" · ")}` : "Saved"}
      </SaveStatus>
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
  saved,
  offer,
}: {
  steamAppId: number;
  title: string;
  price?: number | null;
  /** Seller of the offer being viewed, used to pre-fill "Bought from". */
  store?: PurchaseStore;
  /** The price is a saved catalog offer, not a live one. */
  saved?: boolean;
  /** Verified offer context, retained in the wishlist follow-up. */
  offer?: TrackingOffer;
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
          saved={saved}
          offer={offer}
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

/**
 * The art resolver answers 200 with a 96×64 plate when Steam has no image,
 * so `onError` never fires; callers check the loaded size instead.
 */
export const isFallbackArt = (image: HTMLImageElement) =>
  image.naturalWidth === 96 && image.naturalHeight === 64;

export function GameArt({
  appId,
  title,
  src,
  priority = false,
  onMissing,
  onArtLoad,
}: {
  appId?: number | null;
  title: string;
  src?: string;
  priority?: boolean;
  /** Called when no real artwork exists (only the placeholder can show). */
  onMissing?: () => void;
  /** Called with the image once real artwork (not the plate) has loaded. */
  onArtLoad?: (image: HTMLImageElement) => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  // A blank thumbnail string falls back to the Steam header art.
  const trimmed = src?.trim() === "" ? undefined : src?.trim();
  const primary = trimmed ?? (appId ? wideArt(appId) : undefined);
  const resolved = [primary, appId ? headerArt(appId) : undefined].find(
    (value) => value && !failed.includes(value),
  );
  const reject = useCallback(
    (value: string) =>
      setFailed((values) =>
        values.includes(value) ? values : [...values, value],
      ),
    [],
  );
  useEffect(() => {
    if (!resolved) onMissing?.();
  }, [resolved, onMissing]);
  return resolved ? (
    <Image
      ref={(image) => {
        // Images that finish before hydration never fire onLoad.
        if (!image?.complete || !image.naturalWidth) return;
        if (isFallbackArt(image)) reject(resolved);
        else onArtLoad?.(image);
      }}
      className="game-art"
      src={resolved}
      alt={title}
      width={460}
      height={215}
      unoptimized
      priority={priority}
      loading={priority ? "eager" : "lazy"}
      onLoad={(event) => {
        if (isFallbackArt(event.currentTarget)) reject(resolved);
        else onArtLoad?.(event.currentTarget);
      }}
      onError={() => reject(resolved)}
    />
  ) : (
    <div className="game-art artwork-placeholder" role="img" aria-label={title}>
      <span>{title}</span>
    </div>
  );
}

/** Wide library hero art (1920×620) and the transparent title logo. */
export const libraryHero = (appId: number) => `/api/art/${appId}/hero`;
export const gameLogo = (appId: number) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`;

export const coverArt = (appId: number) => `/api/art/${appId}/capsule`;

/** Vertical library cover (2:3), falling back to the wide header art. */
export function CoverArt({ appId, title }: { appId: number; title: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const resolved = [coverArt(appId), headerArt(appId)].find(
    (value) => !failed.includes(value),
  );
  const reject = (value: string) =>
    setFailed((values) =>
      values.includes(value) ? values : [...values, value],
    );
  return (
    <div className="cover-frame">
      {resolved ? (
        <Image
          key={resolved}
          ref={(image) => {
            if (
              image?.complete &&
              (image.naturalWidth === 0 || isFallbackArt(image))
            )
              reject(resolved);
          }}
          className={cn(
            "cover-art",
            resolved === headerArt(appId) && "is-header",
          )}
          src={resolved}
          alt={title}
          width={300}
          height={450}
          unoptimized
          loading="lazy"
          onLoad={(event) => {
            if (isFallbackArt(event.currentTarget)) reject(resolved);
          }}
          onError={() => reject(resolved)}
        />
      ) : (
        <div
          className="cover-art artwork-placeholder"
          role="img"
          aria-label={title}
        >
          <span>{title}</span>
        </div>
      )}
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

function MastheadHero({ appId }: { appId: number }) {
  const [source, setSource] = useState<"hero" | "header" | "hidden">("hero");
  const reject = () => setSource(source === "hero" ? "header" : "hidden");
  if (source === "hidden") return null;
  return (
    <Image
      key={source}
      ref={(image) => {
        if (
          image?.complete &&
          (image.naturalWidth === 0 || isFallbackArt(image))
        )
          reject();
      }}
      className="cover-mosaic-hero"
      src={source === "hero" ? libraryHero(appId) : headerArt(appId)}
      alt=""
      width={360}
      height={240}
      sizes="(min-width: 1200px) 360px, 280px"
      onLoad={(event) => {
        if (isFallbackArt(event.currentTarget)) reject();
      }}
      onError={reject}
    />
  );
}

/** One card in a masthead deck: a Steam (or Riot) game, or a store offer. */
export interface DeckCard {
  steamAppId?: number | null;
  title: string;
  /** Offer art for editions without a Steam game (Deals). */
  image?: string;
}

const deckKey = (card: DeckCard) =>
  card.steamAppId != null
    ? String(card.steamAppId)
    : (card.image ?? card.title);

/**
 * Portrait cover first, then the wide hero cropped to the card (Riot's games
 * and newer Steam apps have no portrait cover; the hero is logo-free and the
 * resolver falls back to the header), then nothing. Offer art has one try.
 */
function useCoverFallbacks() {
  const [stages, setStages] = useState<Record<string, number>>({});
  const stage = (card: DeckCard) => stages[deckKey(card)] ?? 0;
  const reject = (card: DeckCard) => {
    const key = deckKey(card);
    const from = stage(card);
    setStages((values) =>
      (values[key] ?? 0) === from ? { ...values, [key]: from + 1 } : values,
    );
  };
  const source = (card: DeckCard) =>
    card.steamAppId == null
      ? card.image
      : stage(card) === 0
        ? coverArt(card.steamAppId)
        : libraryHero(card.steamAppId);
  const gone = (card: DeckCard) =>
    card.steamAppId == null ? !card.image || stage(card) > 0 : stage(card) > 1;
  return { stage, reject, source, gone };
}

/**
 * Masthead art on every main page: the page's own games as a hand of cards.
 * The deck fans out on hover and the card under the pointer lifts, like a
 * card game. Hovering uses fixed, invisible hit areas (one per card, in deck
 * order) that never move or restack, so a lifted card can't cover its
 * neighbours' slivers and the pointer never skips a card.
 */
function CoverDeck({
  cards: all,
  label,
  tucked = false,
}: {
  cards: DeckCard[];
  label: string;
  /** Run the hand under a solid toolbar that follows (Library). */
  tucked?: boolean;
}) {
  const covers = useCoverFallbacks();
  const [active, setActive] = useState<string | null>(null);
  const cards = all
    .filter(
      (card, index) =>
        all.findIndex((other) => deckKey(other) === deckKey(card)) === index,
    )
    .slice(0, 7);
  const lead = cards.find((card) => card.steamAppId != null)?.steamAppId;
  const shown = cards.filter((card) => !covers.gone(card));
  if (!shown.length) return null;
  return (
    <div className={cn("cover-mosaic is-deck", tucked && "is-tucked")}>
      {lead != null && <MastheadHero key={lead} appId={lead} />}
      {/* Fades the hand out as it slides under what follows. */}
      <div className="deck-fade">
        <div
          className="cover-deck"
          role="group"
          aria-label={label}
          style={
            {
              "--deck-count": shown.length,
              "--compact-count": Math.min(shown.length, 4),
            } as React.CSSProperties
          }
          onPointerLeave={() => setActive(null)}
        >
          {shown.map((card, index) => {
            const key = deckKey(card);
            const hit: React.HTMLAttributes<HTMLElement> = {
              className: "deck-hit",
              title: card.title,
              onPointerEnter: (event) => {
                if (event.pointerType === "mouse") setActive(key);
              },
            };
            return (
              <div
                key={key}
                className="deck-slot"
                style={{ "--i": index } as React.CSSProperties}
              >
                <div
                  className={cn("deck-card", active === key && "is-active")}
                  aria-hidden="true"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={covers.stage(card)}
                    ref={(image) => {
                      // Cached images may finish before hydration attaches onLoad.
                      if (
                        image?.complete &&
                        (image.naturalWidth === 0 ||
                          isFallbackArt(image) ||
                          (card.steamAppId == null &&
                            image.naturalHeight < 200))
                      )
                        covers.reject(card);
                    }}
                    src={covers.source(card)}
                    alt=""
                    width={216}
                    height={324}
                    decoding="async"
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      // Store thumbnails can be tiny strips; too blurry for a card.
                      const tooSmall =
                        card.steamAppId == null && image.naturalHeight < 200;
                      if (isFallbackArt(image) || tooSmall) covers.reject(card);
                    }}
                    onError={() => covers.reject(card)}
                  />
                </div>
                {card.steamAppId != null ? (
                  <Link
                    {...hit}
                    href={`/game/${card.steamAppId}`}
                    aria-label={card.title}
                    // Its focus ring is drawn on the sibling card (see CSS).
                    data-focus-proxy=".deck-card"
                  />
                ) : (
                  <span {...hit} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Page masthead: a display title, one live stat about this page's data,
 * and (optionally) artwork from the page's own games beside it.
 */
export function PageHeading({
  title,
  children,
  actions,
  stat,
  deck,
  deckTucked,
}: {
  title: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  /** One live number for this page, e.g. "5 of 18 beat Steam"; pass null
   * while it loads to keep its line reserved. */
  stat?: React.ReactNode;
  /** The page's own games, most relevant first, shown as a hand of cards. */
  deck?: DeckCard[];
  /** The page has a solid toolbar right below, so the hand can slide under. */
  deckTucked?: boolean;
}) {
  // The page's own games colour its background glow.
  useAmbientPalette(
    deck?.flatMap((card) => (card.steamAppId != null ? [card.steamAppId] : [])),
  );
  return (
    <header className="page-heading">
      <div className="page-heading-content space-y-2">
        {/* null reserves the line while data loads, so nothing shifts. */}
        {stat !== undefined && <p className="page-stat">{stat ?? "\u00a0"}</p>}
        <h1>{title}</h1>
        {children && <p className="page-description">{children}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
      {!!deck?.length && (
        <CoverDeck cards={deck} label={`${title} games`} tucked={deckTucked} />
      )}
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
