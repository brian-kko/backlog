"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@acme/ui/theme";
import { toast } from "@acme/ui/toast";

import { useCollectionFeed } from "~/app/_components/backlog-feed";
import { authClient } from "~/auth/client";
import { AddGameButton } from "./add-game";
import { useBacklog } from "./backlog-provider";
import { followedGames } from "./collection";
import { useNewsSeen } from "./news-seen";
import { useWishlistPrices } from "./price-ui";

const links = [
  {
    label: "Dashboard",
    href: "/",
    id: "home",
    path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  },
  {
    label: "Deals",
    href: "/deals",
    id: "deals",
    path: "M20 13 13 20a2 2 0 0 1-3 0L3 13V3h10l7 7a2 2 0 0 1 0 3ZM7 7h.01",
  },
  {
    label: "Library",
    href: "/library",
    id: "library",
    path: "M4 4v16M9 4v16M14 4v16M18 4l4 16",
  },
  {
    label: "Wishlist",
    href: "/wishlist",
    id: "wishlist",
    path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  },
  {
    label: "Updates",
    href: "/updates",
    id: "updates",
    path: "M12 3a6 6 0 0 0-6 6c0 7-3 7-3 9h18c0-2-3-2-3-9a6 6 0 0 0-6-6ZM10 21h4",
  },
] as const;

const subscribeDesktop = () => () => undefined;
const desktopSnapshot = () => Boolean(window.__TAURI__);
const serverDesktopSnapshot = () => false;

export function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
      <rect x="3" y="5" width="26" height="6" rx="1.5" fill="currentColor" />
      <rect
        x="3"
        y="13"
        width="20"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".7"
      />
      <rect
        x="3"
        y="21"
        width="13"
        height="6"
        rx="1.5"
        fill="currentColor"
        opacity=".45"
      />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const session = authClient.useSession();
  const { items, isGuest } = useBacklog();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const { alerts } = useWishlistPrices(items);
  const seen = useNewsSeen();
  const feed = useCollectionFeed(
    followedGames(items)
      .slice(0, 24)
      .map((item) => item.steamAppId),
  );
  const unread =
    seen > 0 &&
    !active("/updates") &&
    Boolean(feed.data?.items.some((item) => item.publishedAt.getTime() > seen));

  // One indicator slides between sections instead of each link drawing its own.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const place = () => {
      const element = nav.current;
      if (!element) return;
      const current = element.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      element.dataset.indicator = current ? "on" : "off";
      if (!current) return;
      element.style.setProperty("--ind-x", `${current.offsetLeft}px`);
      element.style.setProperty("--ind-w", `${current.offsetWidth}px`);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [pathname, items.length, alerts.length, unread]);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="site-nav" data-scrolled={scrolled || undefined}>
      <div className="nav-shell">
        <Link href="/" aria-label="Backlog home" className="brand">
          <span className="brand-emblem">
            <BrandMark />
          </span>
          <span className="brand-name">Backlog</span>
        </Link>
        <nav ref={nav} aria-label="Main navigation" className="nav-links">
          {links.map(({ label, href, id, path }) => {
            const count =
              id === "library" || id === "wishlist"
                ? items.filter((item) =>
                    id === "library" ? item.isOwned : !item.isOwned,
                  ).length
                : null;
            return (
              <Link
                key={id}
                href={href}
                data-testid={`nav-${id}`}
                aria-current={active(href) ? "page" : undefined}
                className="nav-link"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={path} />
                </svg>
                <span>{label}</span>
                {id === "wishlist" && alerts.length > 0 ? (
                  <span className="nav-count nav-alert">
                    {alerts.length}
                    <span className="sr-only">
                      {alerts.length === 1 ? " price alert" : " price alerts"}
                    </span>
                  </span>
                ) : count !== null ? (
                  <span className="nav-count">
                    {count}
                    <span className="sr-only">
                      {id === "library" ? " owned games" : " wishlisted games"}
                    </span>
                  </span>
                ) : null}
                {id === "updates" && unread && (
                  <span className="nav-dot">
                    <span className="sr-only">New posts</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="nav-controls">
          {desktop && (
            <span
              className="companion-badge"
              title="Launching through the Backlog desktop app"
            >
              Desktop Connected
            </span>
          )}
          <div className="nav-add">
            <AddGameButton shortcut />
          </div>
          <ThemeToggle />
          {!isGuest && session.data ? (
            <div className="flex items-center gap-3">
              <span className="nav-user">{session.data.user.name}</span>
              <button
                className="action secondary"
                onClick={() => void authClient.signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              className="action secondary"
              onClick={async () => {
                const fail = () =>
                  toast.error("Sign in is unavailable right now. Try again.");
                try {
                  const result = await authClient.signIn.social({
                    provider: "discord",
                    callbackURL: "/",
                  });
                  if (result.error) fail();
                } catch {
                  fail();
                }
              }}
            >
              <span className="sm:hidden">Sign in</span>
              <span className="hidden sm:inline">Sign in with Discord</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
