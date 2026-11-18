"use client";

import { useEffect } from "react";

/*
 * The page's living background: a bounded region under the header with one
 * slowly drifting olive field, a still tint field (recoloured from game art on
 * game pages) and a dot grid that fades out. Only transforms animate, so it
 * stays cheap without a GPU; reduced motion keeps it still.
 */
export function AmbientBackground() {
  // Run the drift only while the visitor is active, then let it rest.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let idle = 0;
    const wake = () => {
      if (document.hidden) return;
      root.dataset.ambientLive = "";
      window.clearTimeout(idle);
      idle = window.setTimeout(() => {
        delete root.dataset.ambientLive;
      }, 6000);
    };
    const events = ["pointermove", "scroll", "keydown"] as const;
    for (const name of events)
      window.addEventListener(name, wake, { passive: true });
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      window.clearTimeout(idle);
      for (const name of events) window.removeEventListener(name, wake);
      document.removeEventListener("visibilitychange", wake);
      delete root.dataset.ambientLive;
    };
  }, []);
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient-grid" />
      <div className="ambient-field ambient-main" />
      <div className="ambient-field ambient-tint" />
      <div className="ambient-field ambient-aurora" />
      {/* Still glows further down, so the page isn't flat below the fold. */}
      <div className="ambient-field ambient-deep ambient-deep-1" />
      <div className="ambient-field ambient-deep ambient-deep-2" />
    </div>
  );
}

/** Average colour of a game's key art, nudged toward a usable glow. */
function sampleTint(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 15;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    // Favour colourful mid-tones over near-black and near-white pixels.
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const value = (max + min) / 2;
    const chroma = max - min;
    const w = chroma * (value > 24 && value < 232 ? 1 : 0.1) + 1;
    red += r * w;
    green += g * w;
    blue += b * w;
    weight += w;
  }
  if (!weight) return null;
  const r = red / weight;
  const g = green / weight;
  const b = blue / weight;
  // Cap saturation so a loud cover can't fight the price and status colours.
  const gray = 0.3 * r + 0.59 * g + 0.11 * b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  const keep = spread > 0 ? Math.min(1, (0.4 * 255) / spread) : 1;
  const tone = (channel: number) => Math.round(gray + (channel - gray) * keep);
  return `${tone(r)} ${tone(g)} ${tone(b)}`;
}

// Same-origin art route, so the canvas is never tainted.
const sampleSource = (appId: number) => `/api/art/${appId}/header`;

function loadTint(appId: number, onTint: (tint: string) => void) {
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    // The 96×64 resolver plate means "no art": keep the default palette.
    if (image.naturalWidth === 96 && image.naturalHeight === 64) return;
    try {
      const tint = sampleTint(image);
      if (tint) onTint(tint);
    } catch {
      // A tainted canvas just keeps the default palette.
    }
  };
  image.src = sampleSource(appId);
}

/**
 * Colours the ambient background from the page's own games: the first game
 * tints the right-hand glow, the second the aurora on the left. Pages without
 * games (or art) keep the olive palette.
 */
export function useAmbientPalette(appIds: readonly number[] | undefined) {
  const first = appIds?.[0];
  const second = appIds?.[1];
  useEffect(() => {
    if (!first) return;
    const root = document.documentElement;
    let cancelled = false;
    const set = (name: string) => (tint: string) => {
      if (!cancelled) root.style.setProperty(name, tint);
    };
    loadTint(first, set("--ambient-tint"));
    if (second) loadTint(second, set("--ambient-aurora"));
    return () => {
      cancelled = true;
      root.style.removeProperty("--ambient-tint");
      root.style.removeProperty("--ambient-aurora");
    };
  }, [first, second]);
}

/** Tints the ambient background with one game's artwork (game pages). */
export function useAmbientTint(steamAppId: number | undefined) {
  useAmbientPalette(steamAppId ? [steamAppId] : undefined);
}
