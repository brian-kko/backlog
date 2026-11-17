"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import type { RouterOutputs } from "@acme/api";
import type { ChangeKind, SubjectGroup } from "@acme/validators";

import { useAmbientTint } from "~/components/ambient";
import { featuredGames, useBacklog } from "~/components/backlog-provider";
import { headerArt } from "~/components/game-ui";
import { useTRPC } from "~/trpc/react";

type PatchData = RouterOutputs["backlog"]["getPatchNotes"];
type Subject = PatchData["patch"]["sections"][number]["subjects"][number];

const groups: Record<
  SubjectGroup,
  { label: string; one: string; icon: string; description: string }
> = {
  nerf: {
    label: "Mostly nerfed",
    one: "Nerf",
    icon: "▼",
    description: "made weaker",
  },
  buff: {
    label: "Mostly buffed",
    one: "Buff",
    icon: "▲",
    description: "made stronger",
  },
  adjusted: {
    label: "Mixed or other",
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
// The legend counts individual lines; the groups below count items, so say
// "changes" here to distinguish them from the entity counts below.
const legendWords: Record<(typeof barKinds)[number], [string, string]> = {
  new: ["addition", "additions"],
  nerf: ["nerf change", "nerf changes"],
  buff: ["buff change", "buff changes"],
  adjusted: ["other change", "other changes"],
  fix: ["fix", "fixes"],
};
// Balance groups first, followed by additions, systems, and fixes.
const columns: SubjectGroup[][] = [
  ["nerf", "buff", "adjusted"],
  ["new", "system", "fix"],
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

function ProportionBar({ counts }: { counts: PatchData["summary"]["counts"] }) {
  const values = barKinds.map((kind) => ({
    kind,
    count:
      kind === "adjusted" ? counts.adjusted + counts.removed : counts[kind],
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
          {values
            .filter((value) => value.count)
            .map((value) => (
              <li key={value.kind}>
                <span
                  className="patch-swatch"
                  data-kind={value.kind}
                  aria-hidden="true"
                >
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

/**
 * Counts like the overview caption: notes are context, not changes, so a
 * subject's chip only says "notes" when that's all it has.
 */
function changeLabel(subject: Subject) {
  const changes = subject.changes.filter(
    (change) => change.kind !== "note",
  ).length;
  if (changes) return `${changes} ${changes === 1 ? "change" : "changes"}`;
  const notes = subject.changes.length;
  return `${notes} ${notes === 1 ? "note" : "notes"}`;
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
    // Only populated groups, flowing into as many columns as fit, so a
    // short patch never leaves an empty column.
    <div className="glance-columns">
      {[columns.flat()].map((column, index) => (
        <div key={index} className="contents">
          {column.map((group) => {
            const members = tiles.filter((tile) => tile.group === group);
            if (!members.length) return null;
            const shown = members.slice(0, 12);
            return (
              <section
                data-reveal
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
                  <span className="glance-count">
                    {members.length} {members.length === 1 ? "item" : "items"}
                  </span>
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
                        <span className="glance-name">{tile.subject.name}</span>
                        <span className="glance-changes" aria-hidden="true">
                          {changeLabel(tile.subject)}
                        </span>
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
    <section
      data-reveal
      className="ai-summary patch-ai-summary"
      aria-labelledby="ai-summary-title"
    >
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
            It also sorts the hero and item groups below.
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
            Full patch notes view is the source.
          </p>
        </div>
      )}
    </section>
  );
}

function ChangeText({ text }: { text: string }) {
  // Keep the source intact: the comparison is a scanning aid, not a rewrite.
  const comparison = /\bfrom\s+(.+?)\s+to\s+(.+?)(?=[,;.!?](?:\s|$)|$)/i.exec(
    text,
  );
  const before = comparison?.[1]?.trim();
  const after = comparison?.[2]?.trim();
  return (
    <>
      <span className="patch-change-text">{text}</span>
      {before && after && (
        <span className="patch-change-values" aria-hidden="true">
          <span>{before}</span>
          <span> → </span>
          <span>{after}</span>
        </span>
      )}
    </>
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
                        <span
                          className="change-kind-blank"
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="change-kind" data-kind={change.kind}>
                          <span aria-hidden="true">
                            {kinds[change.kind].icon}
                          </span>
                          <span>{kinds[change.kind].label}</span>
                        </span>
                      )}
                      <ChangeText text={change.text} />
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </section>
      ))}
      {data.patch.intro.length > 0 && (
        <details
          className="patch-context patch-publisher-intro"
          open={data.patch.sections.length === 0}
        >
          <summary>Publisher introduction</summary>
          <blockquote className="patch-intro">
            {data.patch.intro.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </blockquote>
        </details>
      )}
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
  useAmbientTint(steamAppId);
  const { items } = useBacklog();
  const patch = useQuery(
    trpc.backlog.getPatchNotes.queryOptions({ steamAppId, gid }),
  );
  const [view, setView] = useState<"summary" | "notes">("notes");
  const [aiGroups, setAiGroups] = useState<Map<string, SubjectGroup> | null>(
    null,
  );
  const knownTitle =
    items.find((item) => item.steamAppId === steamAppId)?.title ??
    featuredGames.find((value) => value.steamAppId === steamAppId)?.title;
  // Games outside your collection (e.g. opened from a shared link) still
  // get their real name, from the same lookup the game page uses.
  const details = useQuery(
    trpc.backlog.getGameDetails.queryOptions(
      { steamAppId },
      { enabled: !knownTitle, staleTime: 60 * 60 * 1000 },
    ),
  );
  const game =
    knownTitle ??
    details.data?.metadata?.name ??
    details.data?.prices?.title ??
    `Steam app ${steamAppId}`;
  const groupOf = (subject: Subject) =>
    aiGroups?.get(subject.name.toLowerCase()) ?? subject.group;
  function open(id: string) {
    setView("notes");
    requestAnimationFrame(() => {
      const target = document.getElementById(id);
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
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
      <Link
        className="back-link patch-back-link"
        href={`/updates?game=${steamAppId}`}
      >
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
          {data.patch.version ? (
            <>
              <h1>
                <span className="patch-version">{data.patch.version}</span>
                <span className="patch-label">Patch notes</span>
              </h1>
              <p className="patch-title">{data.title}</p>
            </>
          ) : (
            <h1 className="patch-headline">{data.title}</h1>
          )}
          <p className="patch-meta">
            <time dateTime={data.publishedAt.toISOString()}>{date}</time>
            {" · "}
            <a href={data.url} target="_blank" rel="noopener noreferrer">
              Read on Steam<span aria-hidden="true"> ↗</span>
            </a>
          </p>
        </div>
      </header>

      <section
        data-reveal
        className="patch-glance"
        aria-labelledby="glance-title"
      >
        <div className="section-heading patch-count-heading">
          <h2 id="glance-title">Patch at a glance</h2>
          {aiGroups && (
            <span className="premium-badge">Sorted by AI summary</span>
          )}
        </div>
        {(() => {
          const changes =
            summary.counts.new +
            summary.counts.buff +
            summary.counts.nerf +
            summary.counts.adjusted +
            summary.counts.removed +
            summary.counts.fix;
          const items = data.patch.sections.reduce(
            (sum, section) => sum + section.subjects.length,
            0,
          );
          return changes ? (
            <p className="glance-caption">
              {changes} {changes === 1 ? "change" : "changes"} across {items}{" "}
              {items === 1 ? "item" : "items"}
            </p>
          ) : null;
        })()}
        <ProportionBar counts={summary.counts} />
        {!summary.groups.length && (
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
            <section
              data-reveal
              className="panel space-y-3"
              aria-labelledby="quick-read"
            >
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
      {summary.groups.length > 0 && (
        <details className="patch-browse">
          <summary>Browse by hero / item</summary>
          <p className="glance-note">
            Each hero or item is grouped by the overall direction of its
            changes. These counts describe items, not individual changes.
          </p>
          <Glance data={data} groupOf={groupOf} onOpen={open} />
        </details>
      )}
    </main>
  );
}
