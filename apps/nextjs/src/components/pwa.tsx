"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { env } from "~/env";

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Registers the service worker (production only) and shows offline state. */
export function PwaSupport() {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  useEffect(() => {
    if (env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker
        .register(`/sw.js?v=${env.NEXT_PUBLIC_BUILD_ID ?? "dev"}`)
        .catch(() => undefined);
  }, []);
  if (online) return null;
  return (
    <p className="offline-banner" role="status">
      You’re offline. Your saved games are still here; prices and news will
      refresh when you reconnect.
    </p>
  );
}

const subscribeNothing = () => () => undefined;
/** iOS Safari never offers an install prompt; it uses Share → Add to Home Screen. */
const iosBrowser = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia("(display-mode: standalone)").matches;

/** "Install app" button, or manual instructions where there's no prompt. */
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const ios = useSyncExternalStore(subscribeNothing, iosBrowser, () => false);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  if (!prompt)
    return ios ? (
      <span>Install: tap Share, then “Add to Home Screen”.</span>
    ) : null;
  return (
    <button
      className="text-link"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      Install Backlog on this device
    </button>
  );
}
