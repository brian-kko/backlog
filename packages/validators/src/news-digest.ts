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

/** Extracts source-backed topics and a change sentence; never writes a summary. */
export function digestNews(
  text: string,
  title: string,
): { topics: string[]; line: string | null } {
  // Titles can name topics, but only the body can supply a change sentence.
  const source = `${title}\n${text}`;
  const topics = topicKeywords
    .filter(({ pattern }) => pattern.test(source))
    .slice(0, 2)
    .map(({ label }) => label);
  const sentence = text
    .split(/(?<=[.!?…])\s+|\r?\n+/)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .find(
      (part) =>
        changeVerb.test(part) &&
        !greeting.test(part) &&
        !plannedChange.test(part),
    );

  if (!sentence) return { topics, line: null };
  if (sentence.length <= 140) return { topics, line: sentence };

  // Leave long words intact and keep the lead an exact source excerpt.
  const boundary = sentence.slice(0, 141).lastIndexOf(" ");
  return {
    topics,
    line: boundary > 0 ? sentence.slice(0, boundary) : null,
  };
}
