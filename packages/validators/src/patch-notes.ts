import { z } from "zod/v4";

import { cleanSteamText } from "./backlog-parser";

/** What a single change does to the game. */
export const ChangeKindSchema = z.enum([
  "new",
  "buff",
  "nerf",
  "adjusted",
  "fix",
  "removed",
  "note",
]);
export type ChangeKind = z.infer<typeof ChangeKindSchema>;

/** Summary groups shown in the "patch at a glance" visual. */
export const SubjectGroupSchema = z.enum([
  "nerf",
  "buff",
  "adjusted",
  "new",
  "system",
  "fix",
]);
export type SubjectGroup = z.infer<typeof SubjectGroupSchema>;

export interface PatchChange {
  text: string;
  kind: ChangeKind;
}

/** A thing that changed (weapon, character, item, mode, system). */
export interface PatchSubject {
  name: string;
  group: SubjectGroup;
  changes: PatchChange[];
  /** Developer context such as "Problem we want to solve" notes. */
  context: string[];
}

export interface PatchSection {
  title: string;
  subjects: PatchSubject[];
}

export interface ParsedPatch {
  version: string | null;
  heroImage: string | null;
  intro: string[];
  sections: PatchSection[];
}

const STEAM_CLAN_IMAGE = "https://clan.akamai.steamstatic.com/images";

const fixPattern =
  /^(fix(ed|es)?|resolved|addressed)\b|\b(fixed|no longer|crash(es|ing)?|bug(s)?|exploit)\b/i;
const removedPattern = /\b(removed|disabled|deprecated|no longer available)\b/i;
const newPattern =
  /^(added|new|introduc\w*)\b|\b(added|new (mode|map|weapon|item|character|feature|skin|event))\b/i;
// Explicit verbs decide buff/nerf; comparatives alone ("more", "less") are
// too ambiguous ("stacks diminish more aggressively"), so they only count as
// a change in some direction, i.e. "adjusted".
const upPattern =
  /\b(increas\w*|rais(e|ed|es|ing)|buff\w*|improv\w*|boost\w*|extend\w*)\b/i;
const downPattern =
  /\b(decreas\w*|reduc\w*|lowered|nerf\w*|weaken\w*|shortened)\b/i;
const comparativePattern =
  /\b(more|less|higher|lower|shorter|longer|faster|slower|diminish\w*)\b/i;
// Stats where "more" is worse for the player, so an increase is a nerf.
const costlyStat =
  /\b(cool\s?downs?|costs?|recoil|spread|sway|delay|reload(ing)?( time)?|cast time|charge time|drop\s?off|price|heat|wind[- ]?up|spool[- ]?up|build[- ]?up( time)?|respawn time|ammo usage|cycle time|interval|time between|channel(ing)? time|cast delay|startup|recovery( time)?|lockout|wait time|downtime)\b/i;
// A line that describes new behaviour ("Pommel Hit now also disarms") is a
// change even without an increase/decrease verb.
const behaviourPattern = /\b(now|instead|anymore)\b/i;
// "slow from -24% … to -28%": a value moved, even with no direction word.
const fromToPattern = /\bfrom\b[^.!?]*?\bto\s*[-+]?\d/i;
const adjustedPattern =
  /\b(chang\w*|adjust\w*|rework\w*|updat\w*|tweak\w*|rebalanc\w*)\b/i;
const contextLabel =
  /^(problem|issue|why|context|intent|expectation|goal|reason|background|known issues?|developer('s)? notes?)\b/i;
const knownIssuesHeading = /^\W*known issues?\b/i;
const systemSection =
  /\b(system|general|gameplay|ui|ux|interface|performance|audio|server|network|quality of life|qol|balance|economy|progression|matchmaking|stability)\b/i;
const versionPattern =
  /\b(?:v|version\s*|patch\s*)?(\d+(?:\.\d+){1,3}[a-z]?)\b/i;

/**
 * Classifies one change line. "Increased" is a buff unless the stat is one
 * where more is worse (cooldown, cost, recoil, ...), where it's a nerf.
 */
// A line that leads with what was done is a change even when it mentions an
// earlier patch ("Reverted the changes from the previous patch").
const leadingChange =
  /^\W*(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced|changed|reworked|updated|tweaked|reverted|lowered|raised)\b/i;
const previousPatch = /\b(?:previous|last|prior) (?:patch|update|hotfix)\b/i;

export function classifyChange(text: string): ChangeKind {
  // "The correct values are:" introduces values; it isn't a change itself.
  if (text.trim().endsWith(":")) return "note";
  // Context about an earlier patch ("…changes in the previous patch were
  // calculated incorrectly") explains this one rather than changing anything.
  if (previousPatch.test(text) && !leadingChange.test(text)) return "note";
  if (fixPattern.test(text)) return "fix";
  if (removedPattern.test(text)) return "removed";
  if (newPattern.test(text)) return "new";
  const up = upPattern.test(text);
  const down = downPattern.test(text);
  if (up !== down) {
    const costly = costlyStat.test(text);
    return up !== costly ? "buff" : "nerf";
  }
  if (up && down) return "adjusted";
  return adjustedPattern.test(text) ||
    comparativePattern.test(text) ||
    behaviourPattern.test(text) ||
    fromToPattern.test(text)
    ? "adjusted"
    : "note";
}

/** Group a subject by what its changes add up to. */
export function subjectGroup(
  changes: PatchChange[],
  fallback: SubjectGroup = "adjusted",
): SubjectGroup {
  const count = (kind: ChangeKind) =>
    changes.filter((change) => change.kind === kind).length;
  const buffs = count("buff");
  const nerfs = count("nerf");
  if (count("new") > 0 && count("new") >= buffs + nerfs) return "new";
  if (buffs && nerfs) return "adjusted";
  if (buffs) return "buff";
  if (nerfs) return "nerf";
  if (count("adjusted") || count("removed")) return "adjusted";
  if (count("fix")) return "fix";
  return fallback;
}

/** Version-like token from a post title, e.g. "Devoid of Liberty: 7.2.2". */
export function patchVersion(title: string) {
  return versionPattern.exec(title)?.[1] ?? null;
}

/** "🔧 Fixes" → "Fixes": emoji don't belong in summaries or chip names. */
const stripEmoji = (text: string) =>
  text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const isShortLabel = (text: string) =>
  text.length > 0 && text.length <= 60 && text.split(/\s+/).length <= 8;

/** Plain-text bullets ("- ", "• ", "* ") used instead of BBCode lists. */
const dashBullet = /^(?:[-•*–]|\d+[.)])\s+/;
/** "Apollo: Riposte - T2 increased…" → subject "Apollo". */
const subjectPrefix = /^([A-Za-z0-9][^:.!?]{0,38}?):\s+(\S[\s\S]*)$/;

function prefixOf(text: string) {
  const match = subjectPrefix.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const name = match[1].trim();
  if (name.split(/\s+/).length > 4 || contextLabel.test(name)) return null;
  return { name, rest: match[2].trim() };
}

/**
 * Some studios write one flat list where each line names what it changes
 * ("Apollo: …", "Baba: …"). When most of a block's lines do, split it into
 * one subject per name, in order of first appearance.
 */
function splitByPrefix(subjects: PatchSubject[]): PatchSubject[] {
  return subjects.flatMap((subject) => {
    if (subject.changes.length < 4) return [subject];
    const prefixes = subject.changes.map((change) => prefixOf(change.text));
    const matched = prefixes.filter(Boolean).length;
    const names = new Set(
      prefixes.flatMap((value) => (value ? [value.name.toLowerCase()] : [])),
    );
    // Mostly prefixed, and at least one name repeats (so it's a list of
    // subjects, not a list of "Label: sentence" lines).
    if (matched / subject.changes.length < 0.6 || names.size > matched - 1)
      return [subject];
    const rest: PatchChange[] = [];
    const byName = new Map<string, PatchSubject>();
    subject.changes.forEach((change, index) => {
      const prefix = prefixes[index];
      if (!prefix) {
        rest.push(change);
        return;
      }
      const key = prefix.name.toLowerCase();
      let target = byName.get(key);
      if (!target) {
        target = {
          name: prefix.name,
          group: "adjusted",
          changes: [],
          context: [],
        };
        byName.set(key, target);
      }
      target.changes.push({
        text: prefix.rest,
        kind: classifyChange(prefix.rest),
      });
    });
    const remaining =
      rest.length || subject.context.length
        ? [{ ...subject, changes: rest }]
        : [];
    return [...remaining, ...byName.values()];
  });
}

/**
 * Turns a Steam (BBCode) patch post into sections, subjects and classified
 * changes. Headings start sections; a short line wrapped entirely in bold or
 * italics starts a subject; "Label:" lines decide whether the list that
 * follows is developer context or actual changes.
 */
export function parsePatchNotes(contents: string, title = ""): ParsedPatch {
  const raw = contents.replace(/\{STEAM_CLAN_IMAGE\}/g, STEAM_CLAN_IMAGE);
  const heroImage =
    /\[img(?:=[^\]]*)?\]\s*(https?:\/\/[^\s[]+)\s*\[\/img\]/i.exec(raw)?.[1] ??
    null;
  const marked = raw
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, "")
    .replace(/\[previewyoutube[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, "")
    .replace(/\[h[1-6]\]([\s\S]*?)\[\/h[1-6]\]/gi, "\n\u0001H $1\n")
    .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\u0001H $1\n")
    .replace(/\[\*\]|<li[^>]*>/gi, "\n\u0001L ")
    .replace(
      /\[\/?(?:p|list|olist|\*|hr|table|tr|td|th|quote|code)\b[^\]]*\]|<\/?(?:p|div|ul|ol|li|br|hr|table|tr|td|blockquote)\b[^>]*>/gi,
      "\n",
    );

  const intro: string[] = [];
  const sections: PatchSection[] = [];
  let section: PatchSection | null = null;
  let subject: PatchSubject | null = null;
  let contextMode = false;

  const ensureSubject = () => {
    if (!section) {
      section = { title: "Patch notes", subjects: [] };
      sections.push(section);
    }
    if (!subject) {
      subject = {
        name: section.title,
        group: "adjusted",
        changes: [],
        context: [],
      };
      section.subjects.push(subject);
    }
    return subject;
  };

  // "[*][p]text[/p]" leaves the item marker on its own line; carry it over.
  let pendingItem = false;
  for (const line of marked.split("\n")) {
    let trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === "\u0001L") {
      pendingItem = true;
      continue;
    }
    if (pendingItem) {
      if (!trimmed.startsWith("\u0001")) trimmed = `\u0001L ${trimmed}`;
      pendingItem = false;
    }
    if (trimmed.startsWith("\u0001H ")) {
      const heading = stripEmoji(cleanSteamText(trimmed.slice(3)));
      if (!heading) continue;
      section = { title: heading, subjects: [] };
      sections.push(section);
      subject = null;
      contextMode = knownIssuesHeading.test(heading);
      continue;
    }
    if (!trimmed.startsWith("\u0001") && dashBullet.test(trimmed))
      trimmed = `\u0001L ${trimmed.replace(dashBullet, "")}`;
    const isItem = trimmed.startsWith("\u0001L ");
    const body = isItem ? trimmed.slice(3) : trimmed;
    // A line that is entirely bold/italic/underlined is a subject name.
    const emphasised =
      /^(?:\[(b|i|u)\]\s*)+([\s\S]+?)(?:\s*\[\/(?:b|i|u)\])+$/i.exec(body);
    const text = cleanSteamText(body);
    if (!text) continue;
    // Publishers also use plain or emoji-prefixed labels instead of h-tags.
    if (knownIssuesHeading.test(text)) {
      section = { title: stripEmoji(text).replace(/:$/, ""), subjects: [] };
      sections.push(section);
      subject = null;
      contextMode = true;
      continue;
    }
    if (!isItem && emphasised && isShortLabel(text) && !/[.!?]$/.test(text)) {
      // A bold "Label:" is either developer context or a category of changes
      // ("General:", "Heroes:"), which reads best as its own section.
      if (text.endsWith(":")) {
        if (contextLabel.test(text)) {
          contextMode = true;
          continue;
        }
        section = { title: stripEmoji(text.slice(0, -1)), subjects: [] };
        sections.push(section);
        subject = null;
        contextMode = false;
        continue;
      }
      if (!section) {
        intro.push(text);
        continue;
      }
      subject = {
        name: stripEmoji(text),
        group: "adjusted",
        changes: [],
        context: [],
      };
      section.subjects.push(subject);
      contextMode = knownIssuesHeading.test(section.title);
      continue;
    }
    if (!isItem && text.endsWith(":") && isShortLabel(text)) {
      contextMode =
        knownIssuesHeading.test(section?.title ?? "") ||
        contextLabel.test(text);
      continue;
    }
    if (!section && !isItem) {
      intro.push(text);
      continue;
    }
    const target = ensureSubject();
    if (contextMode) target.context.push(text);
    else target.changes.push({ text, kind: classifyChange(text) });
  }

  for (const current of sections) {
    current.subjects = splitByPrefix(
      current.subjects.filter(
        (value) => value.changes.length || value.context.length,
      ),
    );
    const systemFallback = systemSection.test(current.title);
    for (const value of current.subjects) {
      const isSectionLevel = value.name === current.title;
      value.group =
        isSectionLevel && systemFallback
          ? value.changes.every((change) => change.kind === "fix")
            ? "fix"
            : "system"
          : subjectGroup(value.changes);
    }
  }

  return {
    version: patchVersion(title),
    heroImage,
    intro,
    sections: sections.filter((value) => value.subjects.length),
  };
}

export type ChangeCounts = Record<ChangeKind, number>;

export interface PatchSummary {
  counts: ChangeCounts;
  /** Subjects by group, in display order. */
  groups: { group: SubjectGroup; subjects: string[] }[];
  /** One plain sentence describing the patch's shape. */
  headline: string;
  /** The most notable individual changes. */
  highlights: string[];
}

const groupOrder: SubjectGroup[] = [
  "nerf",
  "buff",
  "adjusted",
  "new",
  "system",
  "fix",
];

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * A free, deterministic summary: counts by kind, subjects grouped like a
 * patch overview, a one-line headline and a few highlights.
 */
export function summarizePatch(patch: ParsedPatch): PatchSummary {
  const counts: ChangeCounts = {
    new: 0,
    buff: 0,
    nerf: 0,
    adjusted: 0,
    fix: 0,
    removed: 0,
    note: 0,
  };
  const sections = patch.sections.filter(
    (section) => !knownIssuesHeading.test(section.title),
  );
  const subjects = sections.flatMap((section) => section.subjects);
  for (const subject of subjects)
    for (const change of subject.changes) counts[change.kind] += 1;
  const groups = groupOrder
    .map((group) => ({
      group,
      subjects: [
        ...new Set(
          subjects
            .filter((subject) => subject.group === group)
            .map((subject) => subject.name),
        ),
      ],
    }))
    .filter((value) => value.subjects.length);
  const parts = [
    counts.new && plural(counts.new, "addition"),
    counts.buff && plural(counts.buff, "buff"),
    counts.nerf && plural(counts.nerf, "nerf"),
    counts.adjusted + counts.removed &&
      plural(counts.adjusted + counts.removed, "adjustment"),
    counts.fix && plural(counts.fix, "fix", "fixes"),
  ].filter(Boolean) as string[];
  // Name real sections; a post without headings only has the default one,
  // so say how many things changed instead of "across Patch notes".
  const named = sections
    .map((section) => section.title)
    .filter((title) => title && title !== "Patch notes");
  const areas = named.length
    ? new Intl.ListFormat("en", { type: "conjunction" }).format(
        named.length > 3 ? [...named.slice(0, 3), "more"] : named,
      )
    : plural(subjects.length, "item");
  const headline = parts.length
    ? `${new Intl.ListFormat("en", { type: "conjunction" }).format(parts)} across ${areas}.`
    : "A short update without itemised changes.";
  // Prefer balance and new content over fixes for highlights.
  const rank: Record<ChangeKind, number> = {
    new: 0,
    nerf: 1,
    buff: 1,
    removed: 2,
    adjusted: 3,
    fix: 4,
    note: 5,
  };
  const highlights = subjects
    .flatMap((subject) =>
      subject.changes.map((change) => ({
        change,
        label:
          subject.name === change.text
            ? change.text
            : `${subject.name}: ${change.text}`,
      })),
    )
    .sort((a, b) => rank[a.change.kind] - rank[b.change.kind])
    .slice(0, 5)
    .map((value) => value.label);
  return { counts, groups, headline, highlights };
}

/** Structured output the optional AI summary returns. */
export const AiPatchSummarySchema = z.object({
  overview: z.string(),
  highlights: z.array(z.string()),
  subjects: z.array(
    z.object({
      name: z.string(),
      group: SubjectGroupSchema,
    }),
  ),
});
export type AiPatchSummary = z.infer<typeof AiPatchSummarySchema>;

export const PatchNotesInputSchema = z.object({
  steamAppId: z.number().int().positive().max(2147483647),
  gid: z.string().regex(/^\d{1,24}$/),
});
