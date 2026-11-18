import type { ParsedPatch } from "./patch-notes";

const topicKeywords: { label: string; pattern: RegExp }[] = [
  {
    label: "Crash fixes",
    pattern:
      /\b(?:fixed|resolved|corrected)\b[^.!?\n]*\bcrash(?:es|ing)?\b|\bcrash(?:es|ing)?\b[^.!?\n]*\bfix(?:es|ed)?\b/i,
  },
  {
    label: "Balance",
    pattern: /\b(?:balanc(?:e|ing)|rebalanced|buffs?|nerfs?)\b/i,
  },
  {
    label: "New content",
    pattern:
      /\bnew (?:content|maps?|modes?|missions?|weapons?|characters?|quests?|levels?)\b/i,
  },
  {
    label: "Performance",
    pattern: /\b(?:performance|fps|frame[ -]?rates?|stutter(?:s|ing)?)\b/i,
  },
  { label: "Cosmetics", pattern: /\b(?:cosmetics?|skins?|outfits?)\b/i },
  { label: "Events", pattern: /\b(?:events?|festivals?|tournaments?)\b/i },
  { label: "Matchmaking", pattern: /\bmatchmaking\b/i },
  {
    label: "Bug fixes",
    pattern: /\b(?:bug[ -]?fix(?:es)?|fixed|resolved|corrected)\b/i,
  },
];

const changeVerb =
  /\b(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced)\b/i;
const greeting =
  /^(?:greetings|hello|hi|hey|dear|welcome|incoming transmission|attention|thanks|thank you)\b/i;
const plannedChange =
  /\b(?:will|would|coming soon|plan(?:ning)? to|hope to|aim to)\b|\b(?:not|never|isn['’]t|aren['’]t|hasn['’]t|haven['’]t|wasn['’]t|weren['’]t)\s+(?:(?:been|yet|fully|actually|still)\s+)*(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced)\b/i;
const completedChange =
  /^(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced)\b/i;
const genericSubject =
  /^(?:(?:crash|bug)\s+)?fix(?:es)?$|^known issues$|^misc(?:ellaneous)?$|^general$/i;
const fallbackHeading =
  /(?:^|\s)(?:[^\p{L}\p{N}\s]+\s*)?(?:known issues\b|(?:(?:(?:crash|bug)\s+)?fix(?:es)?|misc(?:ellaneous)?|general|changes|balance|weapons|performance|new content)\s*:)/iu;

const sentences = (text: string) =>
  text
    .split(/(?<=[.!?…])\s+|\r?\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean);

function isIntro(text: string) {
  const letters = text.match(/[a-z]/gi) ?? [];
  const capitals = letters.filter((letter) => letter === letter.toUpperCase());
  return greeting.test(text) || capitals.length > letters.length * 0.6;
}

/** Keeps fallback excerpts short and stops before subsequent section headings. */
export function stripNewsIntro(text: string): string {
  const heading = fallbackHeading.exec(text);
  const excerpt = heading ? text.slice(0, heading.index).trim() : text;
  const parts = sentences(excerpt);
  while (parts[0] && isIntro(parts[0])) parts.shift();
  // A post that is only a greeting keeps it; an empty excerpt says less.
  return shortExcerpt(parts.length ? parts.join(" ") : excerpt) ?? "";
}

function shortExcerpt(sentence: string): string | null {
  if (sentence.length <= 140) return sentence;
  // Leave long words intact and keep the lead an exact source excerpt.
  const boundary = sentence.slice(0, 141).lastIndexOf(" ");
  return boundary > 0 ? sentence.slice(0, boundary) : null;
}

function isCompletedChange(sentence: string): boolean {
  // "Fixed a crash that would occur" describes the old failure, not a plan.
  // Keep modal language in the main action and all negations subject to checks.
  const action = completedChange.test(sentence)
    ? sentence.replace(
        /(\b(?:that|which|when|where)\b[^.!?]*?)\bwould\b(?=\s+(?:occur|happen|crash|cause|prevent|fail|disconnect|freeze|block|stop|trigger|result)\b)/gi,
        "$1",
      )
    : sentence;
  return (
    changeVerb.test(sentence) &&
    !isIntro(sentence) &&
    !plannedChange.test(action)
  );
}

function withoutGenericSubject(sentence: string): string {
  const colon = sentence.indexOf(":");
  return colon >= 0 && genericSubject.test(sentence.slice(0, colon).trim())
    ? sentence.slice(colon + 1).trim()
    : sentence;
}

/** Extracts source-backed topics and a change sentence; never writes a summary. */
export function digestNews(
  text: string,
  title: string,
  patch?: ParsedPatch,
): { topics: string[]; line: string | null } {
  // Titles can name topics, but only the body can supply a change sentence.
  const source = `${title}\n${text}`;
  const topics = topicKeywords
    .filter(({ pattern }) => pattern.test(source))
    .slice(0, 2)
    .map(({ label }) => label);
  // Parsed changes keep developer problem statements out of the lead and
  // retain the weapon/item heading that gives a bullet its meaning.
  const changes = patch?.sections.flatMap((section) =>
    section.subjects.flatMap((subject) =>
      subject.changes
        .filter((change) => change.kind !== "note")
        .flatMap((change) =>
          sentences(change.text).map((sentence) => ({
            sentence: withoutGenericSubject(sentence),
            subject:
              subject.name === section.title ||
              genericSubject.test(subject.name.replace(/:$/, "").trim()) ||
              sentence.startsWith(`${subject.name}:`)
                ? null
                : subject.name,
          })),
        ),
    ),
  );
  const candidates = patch?.sections.length
    ? (changes ?? [])
    : sentences(text).map((sentence) => ({
        sentence: withoutGenericSubject(sentence),
        subject: null,
      }));
  const change = candidates.find(({ sentence }) => isCompletedChange(sentence));
  const sentence = change
    ? change.subject
      ? `${change.subject}: ${change.sentence}`
      : change.sentence
    : null;
  const line = sentence ? shortExcerpt(sentence) : null;
  return { topics, line: line && changeVerb.test(line) ? line : null };
}
