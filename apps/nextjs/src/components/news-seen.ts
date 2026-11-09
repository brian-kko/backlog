"use client";

import { useSyncExternalStore } from "react";

// Remembers when the user last opened Updates, so newer posts can be marked
// "New" and the nav can show an unread dot. Per browser, by design.
const key = "backlog-news-seen";
const event = "backlog:news-seen";

function read(): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (change: StorageEvent) => {
    if (change.key === key) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(event, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(event, onChange);
  };
}

/** Timestamp (ms) of the last Updates visit; 0 when never visited. */
export function useNewsSeen() {
  return useSyncExternalStore(subscribe, read, () => 0);
}

export function markNewsSeen() {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    // Storage unavailable: posts simply won't be marked as read.
  }
  window.dispatchEvent(new Event(event));
}
