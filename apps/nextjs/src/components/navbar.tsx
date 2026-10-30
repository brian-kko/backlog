"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { authClient } from "~/auth/client";
import { useBacklog } from "./backlog-provider";

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

export function Navbar() {
  const pathname = usePathname();
  const session = authClient.useSession();
  const { items, isGuest } = useBacklog();
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    serverDesktopSnapshot,
  );
  const [authError, setAuthError] = useState("");

  return (
    <header className="site-nav">
      <div className="nav-shell">
        <Link href="/" aria-label="Backlog home" className="brand">
          <span className="brand-emblem" aria-hidden="true">
            ♦
          </span>{" "}
          <span>
            <span className="brand-name">Backlog</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="nav-links">
          {links.map(({ label, href, id, path }) => (
            <Link
              key={id}
              href={href}
              data-testid={`nav-${id}`}
              aria-current={pathname === href ? "page" : undefined}
              className="nav-link"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={path} />
              </svg>
              {label}
              {(id === "library" || id === "wishlist") && (
                <span
                  className="nav-count"
                  aria-label={`${id === "library" ? "Owned" : "Wishlisted"} games`}
                >
                  {
                    items.filter((item) =>
                      id === "library" ? item.isOwned : !item.isOwned,
                    ).length
                  }
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="nav-controls">
          <span
            className="companion-badge"
            title="The desktop companion unlocks local .vdf auto-detection, standalone .exe launching, and live playtime tracking."
          >
            <span aria-hidden="true">●</span>{" "}
            {desktop ? "Desktop Connected" : "PC Companion: Web URI Mode"}
          </span>
          {!isGuest && session.data ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">{session.data.user.name}</span>
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
                try {
                  const result = await authClient.signIn.social({
                    provider: "discord",
                    callbackURL: "/",
                  });
                  if (result.error)
                    setAuthError("Sign in is unavailable. Please try again.");
                } catch {
                  setAuthError("Sign in is unavailable. Please try again.");
                }
              }}
            >
              Sign in
            </button>
          )}
        </div>
        {authError && <p role="alert">{authError}</p>}
      </div>
    </header>
  );
}
