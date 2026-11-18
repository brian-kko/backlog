"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { skipToken, useQuery } from "@tanstack/react-query";

import { toCents } from "@acme/validators";

import type { useWishlistPrices } from "./price-ui";
import { useTRPC } from "~/trpc/react";
import { plural, price, storeName } from "./game-ui";

type WatchRows = ReturnType<typeof useWishlistPrices>["rows"];

const periods = [30, 90, 365] as const;
type Period = (typeof periods)[number];
const periodKey = "gemuzu-wishlist-price-period";
const defaultPeriod = () => 90 as const;

function readPeriod() {
  try {
    const saved = Number(localStorage.getItem(periodKey));
    return periods.find((period) => period === saved) ?? defaultPeriod();
  } catch {
    return defaultPeriod();
  }
}

function subscribePeriod(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const dayMs = 24 * 60 * 60 * 1000;
const dayNumber = (date: string | number) =>
  Math.floor((typeof date === "string" ? Date.parse(date) : date) / dayMs);
const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function checkedPrice(row?: WatchRows[number]) {
  const current = row?.prices?.currentPrice;
  if (
    current == null ||
    (row?.state !== "live" && row?.state !== "steam-only") ||
    typeof row.checkedAt !== "number"
  )
    return undefined;

  return {
    cents: toCents(current),
    day: dayNumber(row.checkedAt),
    storeId:
      row.prices?.deals[0]?.storeID ??
      (row.state === "steam-only" ? "1" : null),
  };
}

export function useWishlistPriceChart(rows: WatchRows, pending: boolean) {
  const savedPeriod = useSyncExternalStore(
    subscribePeriod,
    readPeriod,
    defaultPeriod,
  );
  const [selectedPeriod, setPeriod] = useState<Period>();
  const days = selectedPeriod ?? savedPeriod;
  const trpc = useTRPC();
  const hasTargets = rows.some(({ item }) => item.targetPrice !== undefined);
  const closest = rows.reduce<
    { row: WatchRows[number]; gap: number } | undefined
  >((best, row) => {
    const checked = checkedPrice(row);
    if (!checked || row.item.targetPrice === undefined) return best;
    const gap = checked.cents - toCents(row.item.targetPrice);
    // The smallest signed gap is either closest above or furthest below.
    return !best || gap < best.gap ? { row, gap } : best;
  }, undefined);
  const chosen = hasTargets ? (pending ? undefined : closest?.row) : rows[0];
  const history = useQuery(
    trpc.backlog.getPriceHistory.queryOptions(
      chosen ? { steamAppId: chosen.item.steamAppId, days } : skipToken,
      { retry: false, staleTime: 5 * 60 * 1000 },
    ),
  );
  const current = checkedPrice(chosen);
  const gap = closest?.gap;
  const target = chosen?.item.targetPrice;

  return {
    game: chosen?.item,
    heading:
      gap === undefined
        ? undefined
        : gap <= 0
          ? "at your price"
          : `${price(gap / 100)} above your target`,
    current,
    target,
    days,
    changePeriod: (period: Period) => {
      setPeriod(period);
      try {
        localStorage.setItem(periodKey, String(period));
      } catch {
        // The control still works when storage is disabled.
      }
    },
    history,
    pending,
  };
}

interface ChartPoint {
  day: number;
  cents: number;
  storeId: string | null;
}

const gapLimit = 7;
const arrowShape = {
  up: "0,0 -5,8 5,8",
  down: "0,0 -5,-8 5,-8",
  right: "0,0 -8,-5 -8,5",
};
const arrowDescription = {
  up: "Price rose",
  down: "Price fell",
  right: "Price held steady",
};

const pointLabel = ({ day, cents, storeId }: ChartPoint) =>
  `${dayLabel.format(day * dayMs)} · ${price(cents / 100)}${storeId ? ` at ${storeName(storeId)}` : ""}`;
const checkedLabel = (point: ChartPoint | undefined, today: number) =>
  point
    ? `Checked ${point.day === today ? "today" : dayLabel.format(point.day * dayMs)} · ${price(point.cents / 100)}${point.storeId ? ` at ${storeName(point.storeId)}` : ""}`
    : "Current price unavailable";

function ChartPlot({
  observations,
  current,
  target,
  start,
  today,
  low,
}: {
  observations: ChartPoint[];
  current: ChartPoint | undefined;
  target: number | undefined;
  start: number;
  today: number;
  low: { day: number; cents: number } | undefined;
}) {
  const clipId = useId();
  const svg = useRef<SVGSVGElement>(null);
  const [{ width, height }, setSize] = useState({ width: 320, height: 107 });
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    // Match the viewBox to the reserved space so compact charts keep legible type.
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const plot = { left: 57, right: width - 17, top: 14, bottom: height - 27 };
  const [hovered, setHovered] = useState<string | number>();
  const [focused, setFocused] = useState<string | number>();
  const targetCents = target === undefined ? undefined : toCents(target);
  const checkedToday = current?.day === today ? current : undefined;
  const latest = observations.at(-1);
  const sameAsToday =
    latest?.day === today && latest.cents === checkedToday?.cents;
  const points =
    checkedToday && !sameAsToday
      ? [...observations, checkedToday]
      : observations;
  const previous = observations.reduce<number | undefined>(
    (lastChange, { cents }) =>
      cents === checkedToday?.cents ? lastChange : cents,
    undefined,
  );
  const direction =
    !checkedToday || previous === undefined
      ? "right"
      : checkedToday.cents > previous
        ? "up"
        : "down";
  const amounts = points.map((point) => point.cents);
  if (targetCents !== undefined) amounts.push(targetCents);
  if (low) amounts.push(low.cents);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const x = (day: number) =>
    plot.left + (plot.right - plot.left) * ((day - start) / (today - start));
  const y = (cents: number) =>
    min === max
      ? (plot.top + plot.bottom) / 2
      : plot.bottom - (plot.bottom - plot.top) * ((cents - min) / (max - min));
  const path = points
    .map((point, index) => {
      const before = points[index - 1];
      // Only bridge nearby observations. An unobserved stretch has no price.
      if (!before || point.day - before.day > gapLimit)
        return `M ${x(point.day)} ${y(point.cents)}`;
      const horizontal = `H ${x(point.day)}`;
      return point.cents === before.cents
        ? horizontal
        : `${horizontal} V ${y(point.cents)}`;
    })
    .join(" ");
  const observedSteps = observations.filter((point, index) => {
    const before = observations[index - 1];
    const after = points[index + 1];
    return (
      !before ||
      before.cents !== point.cents ||
      point.day - before.day > gapLimit ||
      !after ||
      after.day - point.day > gapLimit
    );
  });
  const steps = checkedToday ? [...observedSteps, checkedToday] : observedSteps;
  const stepKey = (point: ChartPoint) =>
    point === checkedToday ? "current" : point.day;
  const active = steps.find((point) => stepKey(point) === (hovered ?? focused));

  return (
    <>
      <svg
        ref={svg}
        className="price-chart-plot"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="Observed price history"
        aria-description="The line breaks where more than seven days separate observations."
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              className="price-chart-reveal"
              width={width}
              height={height}
            />
          </clipPath>
        </defs>
        <g className="price-chart-axis">
          <path
            d={`M ${plot.left} ${plot.top} V ${height - 19} H ${plot.right}`}
            aria-hidden="true"
          />
          <text x="51" y={y(max)} dy=".35em" textAnchor="end">
            {price(max / 100)}
          </text>
          {min !== max && (
            <text x="51" y={y(min)} dy=".35em" textAnchor="end">
              {price(min / 100)}
            </text>
          )}
          <text x={plot.left} y={height - 4}>
            {dayLabel.format(start * dayMs)}
          </text>
          <text x={plot.right} y={height - 4} textAnchor="end">
            {dayLabel.format(today * dayMs)}
          </text>
        </g>
        {targetCents !== undefined && (
          <g className="price-chart-target">
            <path
              d={`M ${plot.left} ${y(targetCents)} H ${plot.right}`}
              aria-hidden="true"
            />
            <text x={plot.right} y={y(targetCents) - 5} textAnchor="end">
              Your target {price(targetCents / 100)}
            </text>
          </g>
        )}
        <g clipPath={`url(#${clipId})`}>
          <path className="price-chart-line" d={path} aria-hidden="true" />
        </g>
        {steps.map((point) => {
          const key = stepKey(point);
          const cx = x(point.day);
          const cy = y(point.cents);
          const isCurrent = point === checkedToday;
          return (
            <g
              key={key}
              className="price-chart-step"
              role="img"
              aria-label={
                isCurrent
                  ? `${pointLabel(point)} · ${arrowDescription[direction]}`
                  : pointLabel(point)
              }
              tabIndex={0}
              onFocus={() => setFocused(key)}
              onBlur={() => setFocused(undefined)}
              onPointerEnter={() => setHovered(key)}
              onPointerLeave={() => setHovered(undefined)}
              onPointerDown={(event) => event.currentTarget.focus()}
            >
              <circle className="price-visual-hit" cx={cx} cy={cy} r="7" />
              {isCurrent ? (
                <g clipPath={`url(#${clipId})`} aria-hidden="true">
                  <polygon
                    className="price-chart-arrow"
                    points={arrowShape[direction]}
                    transform={`translate(${cx} ${cy})`}
                    data-direction={direction}
                  />
                </g>
              ) : (
                <circle
                  className="price-chart-mark"
                  cx={cx}
                  cy={cy}
                  r={point.day === today && sameAsToday ? 0 : 2.5}
                />
              )}
              <circle
                className="price-chart-focus"
                cx={cx}
                cy={cy}
                r={isCurrent ? 10 : 6}
              />
            </g>
          );
        })}
        {low && (
          <g className="price-chart-low">
            <circle
              cx={x(low.day)}
              cy={y(low.cents)}
              r="3"
              role="img"
              aria-label={`Lowest recorded ${price(low.cents / 100)} · ${dayLabel.format(low.day * dayMs)} (CheapShark)`}
            />
            <text
              x={x(low.day) + (low.day - start < (today - start) / 2 ? 6 : -6)}
              y={y(low.cents) + 5}
              textAnchor={
                low.day - start < (today - start) / 2 ? "start" : "end"
              }
              aria-hidden="true"
            >
              Low {price(low.cents / 100)}
            </text>
          </g>
        )}
      </svg>
      <p className="price-chart-caption" aria-live="polite">
        {active ? pointLabel(active) : checkedLabel(current, today)}
      </p>
    </>
  );
}

export function PriceChart({
  game,
  heading,
  current,
  target,
  days,
  changePeriod,
  history,
  pending,
}: ReturnType<typeof useWishlistPriceChart>) {
  const [mountedDay] = useState(() => dayNumber(Date.now()));
  const today = Math.max(
    mountedDay,
    current?.day ?? mountedDay,
    dayNumber(history.dataUpdatedAt),
  );
  const start = today - days + 1;
  const points = (history.data?.points ?? [])
    .map((point) => ({
      day: dayNumber(point.date),
      cents: toCents(point.price),
      storeId: point.storeId,
    }))
    .filter((point) => point.day >= start && point.day <= today)
    .sort((a, b) => a.day - b.day);
  const datedLow = history.data?.allTimeLow;
  const lowDay = datedLow ? dayNumber(datedLow.date) : null;
  const drawChart = points.length >= 2;
  const lowInChart =
    drawChart &&
    datedLow &&
    lowDay !== null &&
    lowDay >= start &&
    lowDay <= today
      ? { day: lowDay, cents: toCents(datedLow.price) }
      : undefined;
  const observedSince = history.data?.observedSince;

  return (
    <figure
      className="price-chart"
      role="group"
      aria-label="Wishlist price history"
    >
      <div className="price-chart-header">
        <p className="price-visual-heading">
          {game?.title ?? "Price history"}
          {heading ? ` · ${heading}` : ""}
        </p>
        <div
          className="price-chart-periods"
          role="group"
          aria-label="Price history period"
        >
          {periods.map((period) => (
            <button
              key={period}
              type="button"
              aria-label={`${period} days`}
              aria-pressed={period === days}
              disabled={!game}
              onClick={() => changePeriod(period)}
            >
              {period}d
            </button>
          ))}
        </div>
      </div>
      {drawChart ? (
        <ChartPlot
          key={`${game?.steamAppId}-${days}`}
          observations={points}
          current={current}
          target={target}
          start={start}
          today={today}
          low={lowInChart}
        />
      ) : (
        <div className="price-chart-empty">
          {game && (
            <p>
              {checkedLabel(current, today)}
              {target !== undefined && ` · Your target ${price(target)}`}
            </p>
          )}
          <p role="status">
            {!game
              ? pending
                ? "Checking prices…"
                : "Current prices unavailable"
              : history.isError
                ? "Price history unavailable"
                : history.isPaused
                  ? "Price history needs a connection"
                  : !history.data
                    ? "Loading price history…"
                    : `${observedSince ? `Tracking since ${dayLabel.format(dayNumber(observedSince) * dayMs)} · ` : ""}${plural(points.length, "price")} observed. The chart fills in as Gemuzu checks prices.`}
          </p>
        </div>
      )}
      {datedLow && !lowInChart && (
        <p className="price-chart-low-note">
          Lowest recorded {price(datedLow.price)} ·{" "}
          {monthLabel.format(Date.parse(datedLow.date))} (CheapShark)
        </p>
      )}
    </figure>
  );
}
