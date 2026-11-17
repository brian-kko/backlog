"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/*
 * In-app back navigation. The installed app (PWA, display: standalone) has no
 * browser back button, and a guessed parent ("← Library") is wrong when you
 * arrived from Updates or Deals. `NavHistory` remembers the previous in-app
 * page for this tab; `BackLink` offers "Back to <that page>" and returns there
 * with its filters and scroll intact, or falls back to a logical parent when
 * the page was opened directly.
 */

const historyKey = "gemuzu-nav";

interface NavEntry {
  path: string;
  previous: string | null;
}

function readHistory(): NavEntry | null {
  try {
    const raw = sessionStorage.getItem(historyKey);
    return raw ? (JSON.parse(raw) as NavEntry) : null;
  } catch {
    return null;
  }
}

/** Records the previous in-app page on every route change (this tab only). */
export function NavHistory() {
  const pathname = usePathname();
  useEffect(() => {
    const path = pathname + window.location.search;
    const last = readHistory();
    if (last?.path === path) return;
    try {
      sessionStorage.setItem(
        historyKey,
        JSON.stringify({ path, previous: last?.path ?? null }),
      );
    } catch {
      // Storage blocked: back links fall back to their logical parent.
    }
  }, [pathname]);
  return null;
}

/** A readable name for an in-app path, for "Back to …". */
function pageName(path: string) {
  const [route = ""] = path.split("?");
  if (route === "/") return "Home";
  if (route.startsWith("/deals")) return "Deals";
  if (route.startsWith("/library")) return "Library";
  if (route.startsWith("/wishlist")) return "Wishlist";
  if (route.startsWith("/updates")) return "Updates";
  if (route.startsWith("/game/")) return "game";
  if (route.startsWith("/patch/")) return "patch notes";
  return null;
}

const noSubscribe = () => () => undefined;

/** The previous in-app page for `pathname`, if it has a readable name. */
function previousPage(pathname: string) {
  const entry = readHistory();
  const here = pathname + window.location.search;
  const prev = entry?.path === here ? entry.previous : (entry?.path ?? null);
  return prev && prev !== here && pageName(prev) ? prev : null;
}

export function BackLink({
  fallbackHref,
  fallbackLabel,
  className,
}: {
  className?: string;
  /** Where to go when the page was opened directly (no in-app history). */
  fallbackHref: string;
  fallbackLabel: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // The server (and hydration) render the fallback, so markup matches; the
  // browser then reads the real previous page from this tab's history.
  const previous = useSyncExternalStore(
    noSubscribe,
    () => previousPage(pathname),
    () => null,
  );
  const name = previous ? pageName(previous) : null;
  return (
    <Link
      className={className ? `back-link ${className}` : "back-link"}
      href={previous ?? fallbackHref}
      onClick={(event) => {
        // A plain click returns through history (keeps filters and scroll);
        // modified clicks still open the href normally.
        if (
          !previous ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        router.back();
      }}
    >
      <span aria-hidden="true">←</span>
      <span>{name ? `Back to ${name}` : fallbackLabel}</span>
    </Link>
  );
}
