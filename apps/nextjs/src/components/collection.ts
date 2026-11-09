import { itemPlatform } from "@acme/validators";

import type { BacklogItem } from "./backlog-provider";

const priority = (item: BacklogItem) =>
  item.isOwned
    ? { playing: 0, backlog: 1, completed: 3 }[
        item.completionStatus ?? "backlog"
      ]
    : 2;

/** Games to follow, most relevant first: playing, unplayed, wishlist, done. */
export function followedGames(items: BacklogItem[]) {
  return [...items].sort(
    (a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title),
  );
}

/** Owned games that run in Steam (the default unless set otherwise). */
export function canLaunch(item: BacklogItem | undefined) {
  return Boolean(item?.isOwned && itemPlatform(item) === "steam");
}
