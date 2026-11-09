"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { GameSearchResult } from "@acme/validators";

import { useTRPC } from "~/trpc/react";
import { useBacklog } from "./backlog-provider";
import { money, OwnPrompt, TargetPrompt } from "./game-ui";

function useDebounced(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function ResultRow({
  game,
  onDone,
}: {
  game: GameSearchResult;
  onDone: () => void;
}) {
  const { items, save, isLoading, isSample } = useBacklog();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<"owned" | "wishlist" | null>(null);
  const existing = items.find((item) => item.steamAppId === game.steamAppId);
  async function add(isOwned: boolean) {
    setPending(true);
    setError("");
    try {
      await save(
        { steamAppId: game.steamAppId, title: game.title, isOwned },
        { claim: true },
      );
      setAdded(isOwned ? "owned" : "wishlist");
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <li className="search-result">
      {game.image ? (
        <Image
          src={game.image}
          alt=""
          width={120}
          height={45}
          unoptimized
          className="search-result-art"
        />
      ) : (
        <span className="search-result-art" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="search-result-title">{game.title}</p>
        <p className="search-result-meta">
          {game.price == null ? "Steam price not listed" : `${money(game.price)} on Steam`}
          {" · "}
          <Link
            className="text-link"
            href={`/game/${game.steamAppId}`}
            onClick={onDone}
          >
            View game
          </Link>
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
      {added && (
        <div className="col-span-full">
          {added === "wishlist" ? (
            <TargetPrompt
              steamAppId={game.steamAppId}
              title={game.title}
              bestPrice={game.price}
              priceLabel="Steam price"
            />
          ) : (
            <OwnPrompt steamAppId={game.steamAppId} title={game.title} />
          )}
        </div>
      )}
      <div className="search-result-actions">
        {existing && isSample(existing.steamAppId) ? (
          <button
            className="action secondary compact"
            disabled={pending}
            onClick={() =>
              // Keep the game itself, not the sample's invented price/target.
              void save({
                steamAppId: existing.steamAppId,
                title: existing.title,
                isOwned: existing.isOwned,
              })
            }
          >
            Sample: keep it
          </button>
        ) : existing?.isOwned ? (
          <span className="collection-chip">✓ In library</span>
        ) : (
          <>
            {existing ? (
              <span className="collection-chip">♥ Wishlisted</span>
            ) : (
              <button
                className="action secondary compact"
                disabled={pending || isLoading}
                aria-label={`Wishlist: add ${game.title} to wishlist`}
                onClick={() => void add(false)}
              >
                Wishlist
              </button>
            )}
            <button
              className="action compact"
              disabled={pending || isLoading}
              aria-label={`I own it: add ${game.title} to library`}
              onClick={() => void add(true)}
            >
              I own it
            </button>
          </>
        )}
      </div>
    </li>
  );
}

const AddGameContext = createContext<(query?: string) => void>(() => undefined);

/**
 * One shared "Add a game" dialog for the whole app. Buttons anywhere call
 * `useAddGame()(query)` to open it, optionally pre-filled.
 */
export function AddGameProvider({ children }: { children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const term = useDebounced(query.trim());
  const trpc = useTRPC();
  const results = useQuery(
    trpc.backlog.searchGames.queryOptions(
      { query: term },
      { enabled: open && term.length >= 2, staleTime: 5 * 60 * 1000 },
    ),
  );
  function close() {
    dialog.current?.close();
  }
  function show(initial = "") {
    setQuery(initial);
    setOpen(true);
    dialog.current?.showModal();
  }
  return (
    <AddGameContext.Provider value={show}>
      {children}
      <dialog
        ref={dialog}
        className="add-game-dialog"
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {open && (
          <div className="add-game-panel">
            <div className="flex items-center justify-between gap-4">
              <h2 id={titleId} className="text-lg font-semibold">
                Add a game
              </h2>
              <button
                type="button"
                className="quiet-button"
                aria-label="Close"
                onClick={close}
              >
                ✕
              </button>
            </div>
            <p className="filter-help">
              Search any Steam game, on sale or not. Add games you own to track
              progress and spending, or wishlist them to watch prices across
              stores.
            </p>
            <input
              type="search"
              className="form-control w-full"
              aria-label="Search games"
              placeholder="Search by title…"
              autoFocus
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div aria-live="polite" className="add-game-results">
              {term.length < 2 ? (
                <p className="filter-help">Type at least two characters.</p>
              ) : results.fetchStatus === "paused" ? (
                <p role="status" className="filter-help">
                  You’re offline. Search will run when you reconnect.
                </p>
              ) : results.isPending ? (
                <p role="status" className="filter-help">
                  Searching…
                </p>
              ) : results.isError ? (
                <p role="alert" className="filter-help">
                  Search is unavailable right now.{" "}
                  <button
                    className="text-link"
                    onClick={() => void results.refetch()}
                  >
                    Try again
                  </button>
                </p>
              ) : (
                <>
                  {results.data.source === "catalog" && (
                    <p className="source-notice" role="note">
                      Steam search is unavailable right now, so only a few
                      saved games are shown.{" "}
                      <button
                        className="text-link"
                        onClick={() => void results.refetch()}
                      >
                        Try again
                      </button>
                    </p>
                  )}
                  {results.data.results.length ? (
                    <ul className="search-results">
                      {results.data.results.map((game) => (
                        <ResultRow
                          key={game.steamAppId}
                          game={game}
                          onDone={close}
                        />
                      ))}
                    </ul>
                  ) : results.data.source === "steam" ? (
                    <p className="filter-help">
                      No Steam games match “{term}”.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        )}
      </dialog>
    </AddGameContext.Provider>
  );
}

export const useAddGame = () => useContext(AddGameContext);

/** Opens the shared add-game dialog. */
export function AddGameButton({
  label = "Add game",
  secondary = false,
  initialQuery = "",
  className = "",
}: {
  label?: string;
  secondary?: boolean;
  /** Pre-fills the search, e.g. to find a deal's Steam match. */
  initialQuery?: string;
  className?: string;
}) {
  const open = useAddGame();
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className={className || `action${secondary ? " secondary" : ""}`}
      onClick={() => open(initialQuery)}
    >
      {/* Inline text links read as part of a sentence: no "+" icon. */}
      {!className.includes("text-link") && <span aria-hidden="true">+</span>}
      <span className="add-label" aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
