"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import type { ChangeKind, SubjectGroup } from "@acme/validators";

import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { headerArt } from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";

type PatchData = RouterOutputs["backlog"]["getPatchNotes"];
type Subject = PatchData["patch"]["sections"][number]["subjects"][number];

const groups: Record<
  SubjectGroup,
  { label: string; one: string; icon: string; description: string }
> = {
  nerf: { label: "Nerfs", one: "Nerf", icon: "▼", description: "made weaker" },
  buff: { label: "Buffs", one: "Buff", icon: "▲", description: "made stronger" },
  adjusted: {
    label: "Adjusted",
    one: "Adjusted",
    icon: "↻",
    description: "reworked or mixed",
  },
  system: {
    label: "Systems",
    one: "System",
    icon: "⚙",
    description: "broad gameplay changes",
  },
  new: { label: "New", one: "New", icon: "+", description: "added content" },
  fix: { label: "Fixes", one: "Fix", icon: "✓", description: "bug fixes" },
};
// Legend wording per bar segment: [singular, plural].
const legendWords: Record<(typeof barKinds)[number], [string, string]> = {
  new: ["addition", "additions"],
  nerf: ["nerf", "nerfs"],
  buff: ["buff", "buffs"],
  adjusted: ["change", "changes"],
  fix: ["fix", "fixes"],
};
// Two columns, as in a classic patch overview: balance left, the rest right.
const columns: SubjectGroup[][] = [
  ["nerf", "buff", "adjusted"],
  ["system", "new", "fix"],
];

const kinds: Record<ChangeKind, { label: string; icon: string }> = {
  new: { label: "New", icon: "+" },
  buff: { label: "Buff", icon: "▲" },
  nerf: { label: "Nerf", icon: "▼" },
  adjusted: { label: "Change", icon: "↻" },
  removed: { label: "Removed", icon: "−" },
  fix: { label: "Fix", icon: "✓" },
  note: { label: "Note", icon: "•" },
};
// Fixed, validated order for the proportion bar (see styles: --kind-*).
const barKinds = ["new", "nerf", "buff", "adjusted", "fix"] as const;

const anchor = (sectionIndex: number, subjectIndex: number) =>
  `change-${sectionIndex}-${subjectIndex}`;

function monogram(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/[\s-]+/)
    .filter(Boolean);
  const letters =
    words.length > 1
      ? (words[0]?.[0] ?? "") + (words.at(-1)?.[0] ?? "")
      : (words[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

function ProportionBar({ counts }: { counts: PatchData["summary"]["counts"] }) {
  const values = barKinds.map((kind) => ({
    kind,
    count: kind === "adjusted" ? counts.adjusted + counts.removed : counts[kind],
  }));
  const total = values.reduce((sum, value) => sum + value.count, 0);
  if (!total) return null;
  return (
    <figure className="patch-bar">
      <div className="patch-bar-track" aria-hidden="true">
        {values
          .filter((value) => value.count)
          .map((value) => (
            <span
              key={value.kind}
              className="patch-bar-segment"
              data-kind={value.kind}
              style={{ flexGrow: value.count }}
              title={`${kinds[value.kind].label}: ${value.count}`}
            />
          ))}
      </div>
      <figcaption>
        <ul className="patch-legend">
          {values.filter((value) => value.count).map((value) => (
            <li key={value.kind}>
              <span className="patch-swatch" data-kind={value.kind} aria-hidden="true">
                {kinds[value.kind].icon}
              </span>
              <span className="patch-legend-count">{value.count}</span>{" "}
              {legendWords[value.kind][value.count === 1 ? 0 : 1]}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function Glance({
  data,
  groupOf,
  onOpen,
}: {
  data: PatchData;
  groupOf: (subject: Subject) => SubjectGroup;
  onOpen: (id: string) => void;
}) {
  const tiles = data.patch.sections.flatMap((section, sectionIndex) =>
    section.subjects.map((subject, subjectIndex) => ({
      subject,
      id: anchor(sectionIndex, subjectIndex),
      group: groupOf(subject),
    })),
  );
  return (
    <div className="glance-columns">
      {columns.map((column, index) => (
        <div key={index} className="glance-column">
          {column.map((group) => {
            const members = tiles.filter((tile) => tile.group === group);
            if (!members.length) return null;
            const shown = members.slice(0, 12);
            return (
              <section
                key={group}
                className="glance-group"
                data-group={group}
                aria-labelledby={`glance-${group}`}
              >
                <h3 id={`glance-${group}`} className="glance-heading">
                  <span className="glance-icon" aria-hidden="true">
                    {groups[group].icon}
                  </span>
                  {groups[group].label}
                  <span className="glance-count">{members.length}</span>
                  <span className="sr-only">: {groups[group].description}</span>
                </h3>
                <ul className="glance-tiles">
                  {shown.map((tile) => (
                    <li key={tile.id}>
                      <button
                        type="button"
                        className="glance-tile"
                        onClick={() => onOpen(tile.id)}
                      >
                        <span className="glance-mark" aria-hidden="true">
                          {monogram(tile.subject.name)}
                        </span>
                        <span className="glance-name">{tile.subject.name}</span>
                      </button>
                    </li>
                  ))}
                  {members.length > shown.length && (
                    <li className="glance-more">
                      +{members.length - shown.length} more
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AiSummary({
  steamAppId,
  gid,
  onLoaded,
}: {
  steamAppId: number;
  gid: string;
  onLoaded: (data: RouterOutputs["backlog"]["getPatchAiSummary"]) => void;
}) {
  const trpc = useTRPC();
  const [requested, setRequested] = useState(false);
  const ai = useQuery(
    trpc.backlog.getPatchAiSummary.queryOptions(
      { steamAppId, gid },
      { enabled: requested, staleTime: Infinity, retry: false },
    ),
  );
  // Hand the AI's grouping to the overview once it arrives.
  useEffect(() => {
    if (ai.data) onLoaded(ai.data);
  }, [ai.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="ai-summary" aria-labelledby="ai-summary-title">
      <div className="ai-summary-head">
        <h3 id="ai-summary-title">
          <span aria-hidden="true">✦ </span>AI summary
        </h3>
        <span className="premium-badge">Premium preview</span>
      </div>
      {!requested ? (
        <div className="space-y-3">
          <p className="filter-help">
            A plain-language summary written by Claude from these patch notes.
            It also sorts each change for the overview above.
          </p>
          <button
            type="button"
            className="action secondary"
            onClick={() => setRequested(true)}
          >
            Summarize this patch
          </button>
        </div>
      ) : ai.isPending ? (
        <p role="status" className="filter-help">
          Reading the patch notes…
        </p>
      ) : ai.isError ? (
        <p role="alert" className="field-error">
          {ai.error.message}{" "}
          <button className="text-link" onClick={() => void ai.refetch()}>
            Try again
          </button>
        </p>
      ) : (
        <div className="space-y-3">
          <p className="ai-overview">{ai.data.overview}</p>
          <ul className="summary-points">
            {ai.data.highlights.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="filter-help">
            Written by Claude from the patch notes. It can make mistakes; the
            full notes below are the source.
          </p>
        </div>
      )}
    </section>
  );
}

function FullNotes({
  data,
  groupOf,
}: {
  data: PatchData;
  groupOf: (subject: Subject) => SubjectGroup;
}) {
  return (
    <div className="patch-notes">
      {data.patch.intro.length > 0 && (
        <blockquote className="patch-intro">
          {data.patch.intro.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </blockquote>
      )}
      {data.patch.sections.map((section, sectionIndex) => (
        <section key={section.title + sectionIndex} className="patch-section">
          <h2>{section.title}</h2>
          {section.subjects.map((subject, subjectIndex) => {
            const group = groupOf(subject);
            return (
              <article
                key={subject.name + subjectIndex}
                id={anchor(sectionIndex, subjectIndex)}
                tabIndex={-1}
                className="patch-subject"
                data-group={group}
              >
                {subject.name !== section.title && (
                  <h3>
                    {subject.name}
                    <span className="patch-group-tag" data-group={group}>
                      <span aria-hidden="true">{groups[group].icon} </span>
                      {groups[group].one}
                    </span>
                  </h3>
                )}
                {subject.context.length > 0 && (
                  <details className="patch-context">
                    <summary>Developer notes</summary>
                    <ul>
                      {subject.context.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  </details>
                )}
                <ul className="patch-changes">
                  {subject.changes.map((change, index) => (
                    <li key={index}>
                      {change.kind === "note" ? (
                        <span className="change-kind-blank" aria-hidden="true" />
                      ) : (
                        <span className="change-kind" data-kind={change.kind}>
                          <span aria-hidden="true">{kinds[change.kind].icon}</span>
                          <span>{kinds[change.kind].label}</span>
                        </span>
                      )}
                      <span>{change.text}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export function PatchReader({
  steamAppId,
  gid,
}: {
  steamAppId: number;
  gid: string;
}) {
  const trpc = useTRPC();
  const { items } = useBacklog();
  const patch = useQuery(
    trpc.backlog.getPatchNotes.queryOptions({ steamAppId, gid }),
  );
  const [view, setView] = useState<"summary" | "notes">("summary");
  const [aiGroups, setAiGroups] = useState<Map<string, SubjectGroup> | null>(
    null,
  );
  const game =
    items.find((item) => item.steamAppId === steamAppId)?.title ??
    featuredGames.find((value) => value.steamAppId === steamAppId)?.title ??
    `Steam app ${steamAppId}`;
  const groupOf = (subject: Subject) =>
    aiGroups?.get(subject.name.toLowerCase()) ?? subject.group;
  function open(id: string) {
    setView("notes");
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    });
  }

  if (patch.isPending)
    return (
      <main className="page-shell">
        <p role="status">Loading patch notes…</p>
      </main>
    );
  if (patch.isError)
    return (
      <main className="page-shell space-y-4">
        <Link className="back-link" href={`/updates?game=${steamAppId}`}>
          ← Updates
        </Link>
        <p role="alert">
          {patch.error.data?.code === "NOT_FOUND"
            ? "This post is no longer in the game's recent Steam news."
            : "Patch notes are unavailable right now."}{" "}
          <button className="text-link" onClick={() => void patch.refetch()}>
            Try again
          </button>
        </p>
      </main>
    );

  const data = patch.data;
  const { summary } = data;
  const date = data.publishedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <main className="page-shell patch-page">
      <Link className="back-link" href={`/updates?game=${steamAppId}`}>
        ← {game} updates
      </Link>
      <header className="patch-hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote Steam art, decorative */}
        <img
          className="patch-hero-art"
          src={data.patch.heroImage ?? headerArt(steamAppId)}
          alt=""
        />
        <div className="patch-hero-copy">
          <p className="patch-game">{game}</p>
          <h1>
            {data.patch.version && (
              <span className="patch-version">{data.patch.version}</span>
            )}
            <span className="patch-label">Patch notes</span>
          </h1>
          <p className="patch-title">{data.title}</p>
          <p className="patch-meta">
            <time dateTime={data.publishedAt.toISOString()}>{date}</time>
            {" · "}
            <a href={data.url} target="_blank" rel="noopener noreferrer">
              Read on Steam<span aria-hidden="true"> ↗</span>
            </a>
          </p>
        </div>
      </header>

      <section className="patch-glance" aria-labelledby="glance-title">
        <div className="section-heading">
          <h2 id="glance-title">Patch at a glance</h2>
          {aiGroups && (
            <span className="premium-badge">Sorted by AI summary</span>
          )}
        </div>
        <ProportionBar counts={summary.counts} />
        {summary.groups.length ? (
          <Glance data={data} groupOf={groupOf} onOpen={open} />
        ) : (
          <p className="filter-help">
            This post has no itemised changes to chart.
          </p>
        )}
      </section>

      <div role="tablist" aria-label="Reading mode" className="tab-bar">
        {(
          [
            ["summary", "Quick read"],
            ["notes", "Full patch notes"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            id={`tab-${value}-view`}
            aria-selected={view === value}
            aria-controls={`panel-${value}-view`}
            className="tab"
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${view}-view`}
        aria-labelledby={`tab-${view}-view`}
      >
        {view === "summary" ? (
          <div className="summary-layout">
            <section className="panel space-y-3" aria-labelledby="quick-read">
              <h3 id="quick-read" className="text-base font-semibold">
                Quick read
              </h3>
              <p className="summary-headline">{summary.headline}</p>
              {summary.highlights.length > 0 && (
                <ul className="summary-points">
                  {summary.highlights.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="text-link"
                onClick={() => setView("notes")}
              >
                Read the full patch notes
              </button>
            </section>
            {data.aiAvailable && (
              <AiSummary
                steamAppId={steamAppId}
                gid={gid}
                onLoaded={(ai) =>
                  setAiGroups(
                    new Map(
                      ai.subjects.map((subject) => [
                        subject.name.toLowerCase(),
                        subject.group,
                      ]),
                    ),
                  )
                }
              />
            )}
          </div>
        ) : (
          <FullNotes data={data} groupOf={groupOf} />
        )}
      </div>
    </main>
  );
}
