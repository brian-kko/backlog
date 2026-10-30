declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: (
          command: string,
          args: Record<string, unknown>,
        ) => Promise<unknown>;
      };
    };
  }
}

export function getSteamLaunchUrl(steamAppId: number) {
  return "steam://rungameid/" + steamAppId;
}

export async function launchGame(steamAppId: number) {
  if (typeof window === "undefined") return;
  const url = getSteamLaunchUrl(steamAppId);
  if (window.__TAURI__?.core) {
    try {
      await window.__TAURI__.core.invoke("plugin:opener|open_url", { url });
      return;
    } catch {
      // Older companions may not have the opener plugin installed yet.
    }
  }
  window.location.href = url;
}
