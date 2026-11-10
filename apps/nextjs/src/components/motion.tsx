"use client";

import { useEffect, useRef, useState } from "react";

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveals `[data-reveal]` sections once as they scroll into view.
 * Content is only ever hidden after this has started successfully, so it
 * stays visible without JavaScript, with reduced motion, or if setup fails.
 * State lives in a data attribute so React re-renders can't undo it.
 */
export function MotionRoot() {
  useEffect(() => {
    if (reducedMotion() || !("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal-in", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );
    const tracked = new WeakSet<Element>();
    const scan = (initial: boolean) => {
      for (const element of document.querySelectorAll(
        "[data-reveal]:not([data-reveal-in])",
      )) {
        if (tracked.has(element)) continue;
        tracked.add(element);
        // Anything already on screen at startup stays put: no flash.
        if (initial && element.getBoundingClientRect().top < window.innerHeight)
          element.setAttribute("data-reveal-in", "");
        else observer.observe(element);
      }
    };
    scan(true);
    root.classList.add("motion-ok");
    let queued = false;
    const mutations = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan(false);
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.classList.remove("motion-ok");
    };
  }, []);
  return null;
}

const numberPattern = /\d[\d,]*(?:\.\d+)?/;

/** Counts a number up to its value once, e.g. "$129.97" or "1 of 3". */
export function CountUp({ value }: { value: string | number }) {
  const text = String(value);
  const [shown, setShown] = useState(text);
  const previous = useRef(0);
  useEffect(() => {
    const match = numberPattern.exec(text);
    let frame = 0;
    if (!match || reducedMotion()) {
      frame = requestAnimationFrame(() => setShown(text));
      return () => cancelAnimationFrame(frame);
    }
    const target = Number(match[0].replace(/,/g, ""));
    const decimals = match[0].includes(".")
      ? match[0].length - match[0].indexOf(".") - 1
      : 0;
    const start = previous.current;
    previous.current = target;
    const began = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 450);
      const eased = 1 - (1 - progress) ** 3;
      const current = start + (target - start) * eased;
      setShown(
        progress === 1
          ? text
          : text.slice(0, match.index) +
              current.toLocaleString("en-US", {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              }) +
              text.slice(match.index + match[0].length),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text]);
  return <>{shown}</>;
}
