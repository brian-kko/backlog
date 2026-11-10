"use client";

import type { z } from "zod/v4";
import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BacklogExportSchema } from "@acme/validators";

import { authClient } from "~/auth/client";
import { useTRPC, useTRPCClient } from "~/trpc/react";

type Backup = z.infer<typeof BacklogExportSchema>;
export type BacklogItem = Backup["items"][number];
export const featuredGames = [
  { steamAppId: 1091500, title: "Cyberpunk 2077" },
  { steamAppId: 1245620, title: "Elden Ring" },
  { steamAppId: 553850, title: "Helldivers 2" },
  { steamAppId: 1086940, title: "Baldur's Gate 3" },
  { steamAppId: 730, title: "Counter-Strike 2" },
];
const demoItems: BacklogItem[] = [
  {
    steamAppId: 1091500,
    title: "Cyberpunk 2077",
    isOwned: true,
    amountPaid: 29.99,
    completionStatus: "playing",
  },
  {
    steamAppId: 1245620,
    title: "Elden Ring",
    isOwned: true,
    amountPaid: 39.99,
    completionStatus: "backlog",
  },
  {
    steamAppId: 1086940,
    title: "Baldur's Gate 3",
    isOwned: true,
    amountPaid: 59.99,
    completionStatus: "completed",
  },
  {
    steamAppId: 553850,
    title: "Helldivers 2",
    isOwned: false,
    targetPrice: 25,
    notifyPatches: true,
    notifyEvents: true,
  },
  {
    steamAppId: 1145360,
    title: "Hades",
    isOwned: false,
    targetPrice: 10,
    notifyPatches: true,
    notifyEvents: false,
  },
];
const storageKey = "backlog-guest-v1";
// Set while the starter sample games are present, including after edits, so
// sample purchases are never presented as the user's own data.
const sampleKey = "backlog-guest-sample";
const changeEvent = "backlog:guest-change";
const demoIds = new Set(demoItems.map((item) => item.steamAppId));
interface GuestSnapshot {
  items: BacklogItem[];
  /** Sample games still present; edits keep them marked as samples. */
  samples: Set<number>;
  isSample: boolean;
  /** True once the guest has saved anything in this browser. */
  hasSaved: boolean;
  error: string | null;
}
const demoSnapshot: GuestSnapshot = {
  items: demoItems,
  samples: demoIds,
  isSample: true,
  hasSaved: false,
  error: null,
};
let guestSnapshot = demoSnapshot;
let cachedRaw: string | null | undefined;
let cachedSample: string | null | undefined;

/** AppIDs still marked as sample data ("1" is the legacy all-samples flag). */
function sampleIds(raw: string | null): Set<number> {
  if (raw === "1") return new Set(demoIds);
  try {
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(ids) ? ids.filter((id) => typeof id === "number") : [],
    );
  } catch {
    return new Set();
  }
}

function getGuestSnapshot(): GuestSnapshot {
  try {
    const raw = localStorage.getItem(storageKey);
    const sample = localStorage.getItem(sampleKey);
    if (raw !== cachedRaw || sample !== cachedSample) {
      cachedRaw = raw;
      cachedSample = sample;
      const result = raw
        ? BacklogExportSchema.safeParse(JSON.parse(raw))
        : null;
      const ids = sampleIds(sample);
      guestSnapshot = result?.success
        ? {
            items: result.data.items,
            samples: ids,
            isSample: result.data.items.some((item) =>
              ids.has(item.steamAppId),
            ),
            hasSaved: true,
            error: null,
          }
        : {
            ...demoSnapshot,
            error: raw
              ? "Your saved games couldn’t be loaded, so sample games are shown."
              : null,
          };
    }
  } catch {
    if (!guestSnapshot.error)
      guestSnapshot = {
        ...guestSnapshot,
        error:
          "Browser storage is unavailable. Export a backup to keep your changes.",
      };
  }
  return guestSnapshot;
}

function subscribeGuest(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === storageKey ||
      event.key === sampleKey ||
      event.key === null
    )
      onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, onChange);
  };
}
const getServerGuestSnapshot = () => demoSnapshot;
const subscribeHydration = () => () => undefined;
const clientHydrated = () => true;
const serverHydrated = () => false;

function updateGuest(
  items: BacklogItem[],
  samples: Set<number> = getGuestSnapshot().samples,
) {
  const present = new Set(
    [...samples].filter((id) => items.some((item) => item.steamAppId === id)),
  );
  guestSnapshot = {
    items,
    samples: present,
    isSample: present.size > 0,
    hasSaved: true,
    error: null,
  };
  try {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    });
    const sampleRaw = present.size ? JSON.stringify([...present]) : null;
    if (sampleRaw) localStorage.setItem(sampleKey, sampleRaw);
    else localStorage.removeItem(sampleKey);
    localStorage.setItem(storageKey, raw);
    cachedRaw = raw;
    cachedSample = sampleRaw;
  } catch {
    guestSnapshot = {
      ...guestSnapshot,
      error:
        "Browser storage is unavailable. Export a backup to keep these changes.",
    };
  }
  window.dispatchEvent(new Event(changeEvent));
}

/** Guest games that belong to the user (sample games excluded). */
function ownGuestItems() {
  const snapshot = getGuestSnapshot();
  if (!snapshot.hasSaved) return [];
  return snapshot.items.filter(
    (item) => !snapshot.samples.has(item.steamAppId),
  );
}

function clearGuest() {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(sampleKey);
  } catch {
    // Storage unavailable; nothing persisted to clear.
  }
  cachedRaw = undefined;
  window.dispatchEvent(new Event(changeEvent));
}

const BacklogContext = createContext<{
  items: BacklogItem[];
  isGuest: boolean;
  isDemo: boolean;
  isLoading: boolean;
  error: string | null;
  /**
   * Saves an item. Any save turns a sample game into the user's own record,
   * unless `claim: false` is passed.
   */
  save: (item: BacklogItem, options?: { claim?: boolean }) => Promise<void>;
  remove: (steamAppId: number) => Promise<void>;
  importItems: (payload: unknown) => Promise<void>;
  exportItems: () => Promise<Backup>;
  clearSample: () => Promise<void>;
  keepSamples: () => Promise<void>;
  /** Whether a guest item is still one of the starter samples. */
  isSample: (steamAppId: number) => boolean;
} | null>(null);

export function BacklogProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  const trpc = useTRPC();
  const rpc = useTRPCClient();
  const client = useQueryClient();
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const [removed, setRemoved] = useState<{
    item: BacklogItem;
    accountId: string;
    /** A removed sample comes back as a sample on Undo. */
    wasSample: boolean;
  } | null>(null);
  function enqueue(operation: () => Promise<void>) {
    const next = writes.current.catch(() => undefined).then(operation);
    writes.current = next;
    return next;
  }
  const guest = useSyncExternalStore(
    subscribeGuest,
    getGuestSnapshot,
    getServerGuestSnapshot,
  );
  const guestItems = guest.items;
  const isGuest = !session.data;
  const accountId = session.data?.user.id ?? "guest";
  const backlogOptions = trpc.backlog.getBacklog.queryOptions();
  const backlog = useQuery({
    queryKey: [...backlogOptions.queryKey, accountId],
    queryFn: () => rpc.backlog.getBacklog.query(),
    enabled: !isGuest,
    gcTime: 0,
  });
  const upsert = useMutation(trpc.backlog.upsertBacklogItem.mutationOptions());
  const remover = useMutation(trpc.backlog.removeBacklogItem.mutationOptions());
  const importer = useMutation(
    trpc.backlog.importBacklogJson.mutationOptions(),
  );
  const guestImporter = useMutation(
    trpc.backlog.importGuestItems.mutationOptions(),
  );

  const items: BacklogItem[] = isGuest
    ? guestItems
    : (backlog.data ?? []).map((item) => ({
        ...item,
        amountPaid: item.amountPaid ?? undefined,
        targetPrice: item.targetPrice ?? undefined,
        purchaseStore: item.purchaseStore ?? undefined,
        platform: item.platform ?? undefined,
      }));

  return (
    <BacklogContext.Provider
      value={{
        items,
        isGuest,
        isDemo: isGuest && guest.isSample,
        isLoading: session.isPending || (!isGuest && backlog.isPending),
        error:
          !isGuest && backlog.isError
            ? "Unable to load your library. Please refresh to retry."
            : guest.error,
        save(item, options) {
          return enqueue(async () => {
            if (session.isPending)
              throw new Error("Please wait for your session to load.");
            item = BacklogExportSchema.shape.items.element.parse(item);
            if (isGuest) {
              const currentItems = getGuestSnapshot().items;
              const previous = currentItems.find(
                (value) => value.steamAppId === item.steamAppId,
              );
              const samples = new Set(getGuestSnapshot().samples);
              let merged: BacklogItem = { ...previous, ...item };
              // Editing or claiming a sample makes it the user's own record.
              // Its invented purchase price and target are dropped unless this
              // edit sets them, so they never become real spending data.
              if (options?.claim !== false && samples.delete(item.steamAppId)) {
                merged = { ...merged };
                if (!Object.hasOwn(item, "amountPaid"))
                  delete merged.amountPaid;
                if (!Object.hasOwn(item, "targetPrice"))
                  delete merged.targetPrice;
              }
              updateGuest(
                [
                  ...currentItems.filter(
                    (value) => value.steamAppId !== item.steamAppId,
                  ),
                  merged,
                ],
                samples,
              );
            } else {
              const queryKey = [...backlogOptions.queryKey, accountId];
              await client.cancelQueries({ queryKey });
              const previousItems =
                client.getQueryData<typeof backlog.data>(queryKey);
              client.setQueryData<typeof backlog.data>(queryKey, (current) => {
                const previous = current?.find(
                  (value) => value.steamAppId === item.steamAppId,
                );
                return [
                  ...(current ?? []).filter(
                    (value) => value.steamAppId !== item.steamAppId,
                  ),
                  {
                    id: previous?.id ?? `pending-${item.steamAppId}`,
                    userId: accountId,
                    createdAt: previous?.createdAt ?? new Date(),
                    notifyPatches: true,
                    notifyEvents: true,
                    completionStatus: "backlog" as const,
                    ...previous,
                    ...item,
                    amountPaid: Object.hasOwn(item, "amountPaid")
                      ? (item.amountPaid ?? null)
                      : (previous?.amountPaid ?? null),
                    targetPrice: Object.hasOwn(item, "targetPrice")
                      ? (item.targetPrice ?? null)
                      : (previous?.targetPrice ?? null),
                    purchaseStore: Object.hasOwn(item, "purchaseStore")
                      ? (item.purchaseStore ?? null)
                      : (previous?.purchaseStore ?? null),
                    platform: Object.hasOwn(item, "platform")
                      ? (item.platform ?? null)
                      : (previous?.platform ?? null),
                  },
                ];
              });
              try {
                await upsert.mutateAsync({
                  ...item,
                  ...(Object.hasOwn(item, "amountPaid")
                    ? { amountPaid: item.amountPaid ?? null }
                    : {}),
                  ...(Object.hasOwn(item, "targetPrice")
                    ? { targetPrice: item.targetPrice ?? null }
                    : {}),
                  ...(Object.hasOwn(item, "purchaseStore")
                    ? { purchaseStore: item.purchaseStore ?? null }
                    : {}),
                  ...(Object.hasOwn(item, "platform")
                    ? { platform: item.platform ?? null }
                    : {}),
                });
              } catch (error) {
                client.setQueryData(queryKey, previousItems);
                throw error;
              }
              await client.invalidateQueries({ queryKey });
            }
            setRemoved((previous) =>
              previous?.item.steamAppId === item.steamAppId &&
              previous.accountId === accountId
                ? null
                : previous,
            );
          });
        },
        remove(steamAppId) {
          return enqueue(async () => {
            if (session.isPending)
              throw new Error("Please wait for your session to load.");
            const current: BacklogItem[] = isGuest
              ? getGuestSnapshot().items
              : (
                  client.getQueryData<typeof backlog.data>([
                    ...backlogOptions.queryKey,
                    accountId,
                  ]) ?? []
                ).map((value) => ({
                  ...value,
                  amountPaid: value.amountPaid ?? undefined,
                  targetPrice: value.targetPrice ?? undefined,
                  purchaseStore: value.purchaseStore ?? undefined,
                  platform: value.platform ?? undefined,
                }));
            const item = current.find(
              (value) => value.steamAppId === steamAppId,
            );
            if (!item) return;
            const wasSample =
              isGuest && getGuestSnapshot().samples.has(steamAppId);
            if (isGuest)
              updateGuest(
                current.filter((value) => value.steamAppId !== steamAppId),
              );
            else {
              const queryKey = [...backlogOptions.queryKey, accountId];
              await client.cancelQueries({ queryKey });
              const previous =
                client.getQueryData<typeof backlog.data>(queryKey);
              client.setQueryData<typeof backlog.data>(queryKey, (values) =>
                values?.filter((value) => value.steamAppId !== steamAppId),
              );
              try {
                await remover.mutateAsync({ steamAppId });
              } catch (error) {
                client.setQueryData(queryKey, previous);
                throw error;
              }
              await client.invalidateQueries({ queryKey });
            }
            setRemoved({ item, accountId, wasSample });
          });
        },
        importItems(payload) {
          return enqueue(async () => {
            const backup = BacklogExportSchema.parse(payload);
            if (session.isPending)
              throw new Error("Please wait for your session to load.");
            if (isGuest) {
              const merged = new Map(
                getGuestSnapshot().items.map((item) => [item.steamAppId, item]),
              );
              for (const item of backup.items)
                merged.set(item.steamAppId, item);
              // Imported games are the user's own, even if they match a sample.
              const samples = new Set(getGuestSnapshot().samples);
              for (const item of backup.items) samples.delete(item.steamAppId);
              updateGuest([...merged.values()], samples);
            } else {
              await importer.mutateAsync(backup);
              await client.invalidateQueries({
                queryKey: [...backlogOptions.queryKey, accountId],
              });
            }
          });
        },
        isSample: (steamAppId) => isGuest && guest.samples.has(steamAppId),
        keepSamples() {
          return enqueue(() => {
            // Keep the games, not the samples' invented prices and targets.
            const { items: current, samples } = getGuestSnapshot();
            updateGuest(
              current.map((item) => {
                if (!samples.has(item.steamAppId)) return item;
                const {
                  amountPaid: _paid,
                  targetPrice: _target,
                  ...rest
                } = item;
                return rest;
              }),
              new Set(),
            );
            return Promise.resolve();
          });
        },
        clearSample() {
          return enqueue(() => {
            const { items: current, samples } = getGuestSnapshot();
            updateGuest(
              current.filter((item) => !samples.has(item.steamAppId)),
              new Set(),
            );
            return Promise.resolve();
          });
        },
        async exportItems() {
          await writes.current.catch(() => undefined);
          if (isGuest)
            return BacklogExportSchema.parse({
              version: 1,
              exportedAt: new Date().toISOString(),
              items: getGuestSnapshot().items,
            });
          return client.fetchQuery({
            queryKey: [...trpc.backlog.exportBacklogJson.queryKey(), accountId],
            queryFn: () => rpc.backlog.exportBacklogJson.query(),
            staleTime: 0,
            gcTime: 0,
          });
        },
      }}
    >
      {children}
      {!isGuest && backlog.isSuccess && (
        <GuestTransfer
          onTransfer={async (items) => {
            const result = await guestImporter.mutateAsync({
              version: 1,
              exportedAt: new Date().toISOString(),
              items,
            });
            await client.invalidateQueries({
              queryKey: [...backlogOptions.queryKey, accountId],
            });
            clearGuest();
            return result;
          }}
        />
      )}
      {removed?.accountId === accountId && (
        <UndoRemoval
          item={removed.item}
          onDismiss={() => setRemoved(null)}
          onRestore={
            removed.wasSample
              ? () =>
                  enqueue(() => {
                    const snapshot = getGuestSnapshot();
                    updateGuest(
                      [...snapshot.items, removed.item],
                      new Set([...snapshot.samples, removed.item.steamAppId]),
                    );
                    return Promise.resolve();
                  })
              : undefined
          }
        />
      )}
    </BacklogContext.Provider>
  );
}

// After sign-in, offer to move games saved in this browser into the account.
// Games already in the account keep their account data.
function GuestTransfer({
  onTransfer,
}: {
  onTransfer: (
    items: BacklogItem[],
  ) => Promise<{ added: number; skipped: number }>;
}) {
  useSyncExternalStore(
    subscribeGuest,
    getGuestSnapshot,
    getServerGuestSnapshot,
  );
  const items = ownGuestItems();
  const [state, setState] = useState<
    | { kind: "idle" | "busy" | "error" | "dismissed" }
    | { kind: "done"; added: number; skipped: number }
  >({ kind: "idle" });
  const games = (count: number) => `${count} ${count === 1 ? "game" : "games"}`;
  if (state.kind === "dismissed" || (!items.length && state.kind !== "done"))
    return null;
  return (
    <aside className="undo-toast" aria-label="Games saved in this browser">
      <p role="status">
        {state.kind === "done"
          ? `Added ${games(state.added)} to your account.${
              state.skipped
                ? ` ${games(state.skipped)} you already had were left unchanged.`
                : ""
            }`
          : state.kind === "error"
            ? "Couldn’t add those games to your account. Try again."
            : `You have ${games(items.length)} saved in this browser. Add ${
                items.length === 1 ? "it" : "them"
              } to your account? Games already in your account stay as they are.`}
      </p>
      <div className="flex gap-4">
        {state.kind === "done" ? (
          <button
            className="text-link"
            onClick={() => setState({ kind: "dismissed" })}
          >
            Done
          </button>
        ) : (
          <>
            <button
              className="text-link"
              disabled={state.kind === "busy"}
              onClick={async () => {
                setState({ kind: "busy" });
                try {
                  setState({ kind: "done", ...(await onTransfer(items)) });
                } catch {
                  setState({ kind: "error" });
                }
              }}
            >
              {state.kind === "busy" ? "Adding…" : "Add to account"}
            </button>
            <button
              className="text-link"
              onClick={() => setState({ kind: "dismissed" })}
            >
              Not now
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function UndoRemoval({
  item,
  onDismiss,
  onRestore,
}: {
  item: BacklogItem;
  onDismiss: () => void;
  /** Custom restore (e.g. back into the samples); defaults to saving it. */
  onRestore?: () => Promise<void>;
}) {
  const { save } = useBacklog();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <aside className="undo-toast" aria-label="Removed game">
      <p role="status">
        {error
          ? "Couldn’t restore the game. Try again."
          : `Removed ${item.title}.`}
      </p>
      <button
        className="text-link"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await (onRestore ? onRestore() : save(item));
            onDismiss();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        Undo
      </button>
      <button
        className="text-link"
        aria-label="Dismiss removed game notice"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </aside>
  );
}

export function useBacklog() {
  const context = useContext(BacklogContext);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientHydrated,
    serverHydrated,
  );
  if (!context) throw new Error("useBacklog requires BacklogProvider");
  // Auth can resolve before a streamed page hydrates. Keep its first render
  // consistent with the server instead of replacing typed input during hydration.
  return hydrated
    ? context
    : {
        ...context,
        items: demoItems,
        isGuest: true,
        isLoading: true,
        isDemo: true,
        error: null,
      };
}
