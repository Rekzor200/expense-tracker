const AUTO_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const dynamicImport = new Function("moduleName", "return import(moduleName)") as (moduleName: string) => Promise<unknown>;

export interface AvailableUpdate {
  version: string;
  body?: string | null;
  downloadAndInstall: (
    onEvent?: (event: unknown) => void,
  ) => Promise<void>;
}

export interface InstallProgress {
  phase: "started" | "progress" | "finished";
  downloaded?: number;
  contentLength?: number;
}

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function shouldAutoCheck(lastCheckedAt: string | null, now = Date.now()): boolean {
  if (!lastCheckedAt) return true;
  const parsed = Date.parse(lastCheckedAt);
  if (Number.isNaN(parsed)) return true;
  return now - parsed >= AUTO_CHECK_INTERVAL_MS;
}

export async function checkForUpdates(): Promise<AvailableUpdate | null> {
  if (!isTauriRuntime()) return null;
  const updater = await dynamicImport("@tauri-apps/plugin-updater") as {
    check: () => Promise<AvailableUpdate | null>;
  };
  return updater.check();
}

export async function installUpdateAndRelaunch(
  update: AvailableUpdate,
  onProgress?: (progress: InstallProgress) => void,
): Promise<void> {
  await update.downloadAndInstall((event: unknown) => {
    if (!onProgress || typeof event !== "object" || event === null || !("event" in event)) {
      return;
    }
    const payload = event as { event: string; data?: { chunkLength?: number; contentLength?: number } };
    if (payload.event === "Started") {
      onProgress({
        phase: "started",
        contentLength: payload.data?.contentLength,
      });
      return;
    }
    if (payload.event === "Progress") {
      onProgress({
        phase: "progress",
        downloaded: payload.data?.chunkLength,
        contentLength: payload.data?.contentLength,
      });
      return;
    }
    if (payload.event === "Finished") {
      onProgress({ phase: "finished" });
    }
  });
  const processModule = await dynamicImport("@tauri-apps/plugin-process") as {
    relaunch: () => Promise<void>;
  };
  await processModule.relaunch();
}
