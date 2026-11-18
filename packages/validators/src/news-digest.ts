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
  /\b(?:will|would|coming soon|plan(?:ning)? to|hope to|aim to)\b|\b(?:not|never|hasn['’]t|haven['’]t|wasn['’]t|weren['’]t)\s+(?:been\s+)?(?:fixed|added|increased|decreased|reduced|removed|adjusted|improved|resolved|corrected|rebalanced)\b/i;

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

/** Removes publisher greetings before displaying a fallback excerpt. */
export function stripNewsIntro(text: string): string {
  const parts = sentences(text);
  while (parts[0] && isIntro(parts[0])) parts.shift();
  // A post that is only a greeting keeps it; an empty excerpt says less.
  return parts.length ? parts.join(" ") : text;
}

function shortChange(sentence: string): string | null {
  if (sentence.length <= 140) return sentence;
  // Leave long words intact and keep the lead an exact source excerpt.
  const boundary = sentence.slice(0, 141).lastIndexOf(" ");
  const line = boundary > 0 ? sentence.slice(0, boundary) : null;
  return line && changeVerb.test(line) ? line : null;
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
            sentence,
            subject:
              subject.name === section.title ||
              sentence.startsWith(`${subject.name}:`)
                ? null
                : subject.name,
          })),
        ),
    ),
  );
  const candidates = patch?.sections.length
    ? (changes ?? [])
    : sentences(text).map((sentence) => ({ sentence, subject: null }));
  const change = candidates.find(
    ({ sentence }) =>
      changeVerb.test(sentence) &&
      !isIntro(sentence) &&
      !plannedChange.test(sentence),
  );
  const sentence = change
    ? change.subject
      ? `${change.subject}: ${change.sentence}`
      : change.sentence
    : null;
  return { topics, line: sentence ? shortChange(sentence) : null };
}
