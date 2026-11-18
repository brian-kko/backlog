import type { EmptyArtName } from "./empty-art-markup";
import { emptyArt } from "./empty-art-markup";

/** Decorative illustration above an empty state (hidden from screen readers). */
export function EmptyArt({ name }: { name: EmptyArtName }) {
  return (
    <div
      className="empty-art"
      aria-hidden="true"
      // Static, first-party SVG markup (see empty-art-markup.ts).
      dangerouslySetInnerHTML={{ __html: emptyArt[name] }}
    />
  );
}
