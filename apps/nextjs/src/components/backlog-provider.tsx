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
const changeEvent = "backlog:guest-change";
interface GuestSnapshot {
  items: BacklogItem[];
  error: string | null;
}
const demoSnapshot: GuestSnapshot = { items: demoItems, error: null };
let guestSnapshot = demoSnapshot;
let cachedRaw: string | null | undefined;

function getGuestSnapshot(): GuestSnapshot {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      const result = raw
        ? BacklogExportSchema.safeParse(JSON.parse(raw))
        : null;
      guestSnapshot = result?.success
        ? { items: result.data.items, error: null }
        : {
            items: demoItems,
            error: raw
              ? "Guest backup could not be loaded. The starter demo is available."
              : null,
          };
    }
  } catch {
    if (!guestSnapshot.error)
      guestSnapshot = {
        ...guestSnapshot,
        error:
          "Browser storage is unavailable. Export JSON to keep your changes.",
      };
  }
  return guestSnapshot;
}

function subscribeGuest(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) onChange();
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

function updateGuest(items: BacklogItem[]) {
  guestSnapshot = { items, error: null };
  try {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      items,
    });
    localStorage.setItem(storageKey, raw);
    cachedRaw = raw;
  } catch {
    guestSnapshot = {
      items,
      error:
        "Browser storage is unavailable. Export JSON to keep these changes.",
    };
  }
  window.dispatchEvent(new Event(changeEvent));
}

const BacklogContext = createContext<{
  items: BacklogItem[];
  isGuest: boolean;
  isDemo: boolean;
  isLoading: boolean;
  error: string | null;
  save: (item: BacklogItem) => Promise<void>;
  remove: (steamAppId: number) => Promise<void>;
  importItems: (payload: unknown) => Promise<void>;
  exportItems: () => Promise<Backup>;
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

  const items: BacklogItem[] = isGuest
    ? guestItems
    : (backlog.data ?? []).map((item) => ({
        ...item,
        amountPaid: item.amountPaid ?? undefined,
        targetPrice: item.targetPrice ?? undefined,
      }));

  return (
    <BacklogContext.Provider
      value={{
        items,
        isGuest,
        isDemo: isGuest && guestItems === demoItems,
        isLoading: session.isPending || (!isGuest && backlog.isPending),
        error:
          !isGuest && backlog.isError
            ? "Unable to load your library. Please refresh to retry."
            : guest.error,
        save(item) {
          return enqueue(async () => {
            if (session.isPending)
              throw new Error("Please wait for your session to load.");
            item = BacklogExportSchema.shape.items.element.parse(item);
            if (isGuest) {
              const currentItems = getGuestSnapshot().items;
              const previous = currentItems.find(
                (value) => value.steamAppId === item.steamAppId,
              );
              updateGuest([
                ...currentItems.filter(
                  (value) => value.steamAppId !== item.steamAppId,
                ),
                { ...previous, ...item },
              ]);
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
                }));
            const item = current.find(
              (value) => value.steamAppId === steamAppId,
            );
            if (!item) return;
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
            setRemoved({ item, accountId });
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
              updateGuest([...merged.values()]);
            } else {
              await importer.mutateAsync(backup);
              await client.invalidateQueries({
                queryKey: [...backlogOptions.queryKey, accountId],
              });
            }
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
      {removed?.accountId === accountId && (
        <UndoRemoval item={removed.item} onDismiss={() => setRemoved(null)} />
      )}
    </BacklogContext.Provider>
  );
}

function UndoRemoval({
  item,
  onDismiss,
}: {
  item: BacklogItem;
  onDismiss: () => void;
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
            await save(item);
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
