import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FadeIn } from "@/components/reactbits/fade-in";
import { useTheme } from "@/hooks/use-theme";
import { exportAllData, importAllData, exportTransactionsCsv, getSetting, loadSampleData, setSetting } from "@/lib/db";
import { AvailableUpdate, checkForUpdates, installUpdateAndRelaunch, isTauriRuntime } from "@/lib/updater";
import { Download, Upload, Database, FolderOpen, Loader2, Sun, Moon } from "lucide-react";

interface SettingsPageProps {
  portfolioEnabled: boolean;
  portfolioLoading: boolean;
  onPortfolioEnabledChange: (next: boolean) => Promise<void>;
  autoUpdateEnabled: boolean;
  autoUpdateLoading: boolean;
  onAutoUpdateEnabledChange: (next: boolean) => Promise<void>;
}

const AUTO_UPDATE_LAST_CHECKED_KEY = "auto_update_last_checked_at";

export function SettingsPage({
  portfolioEnabled,
  portfolioLoading,
  onPortfolioEnabledChange,
  autoUpdateEnabled,
  autoUpdateLoading,
  onAutoUpdateEnabledChange,
}: SettingsPageProps) {
  const isDevMode = import.meta.env.DEV;
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>("Idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [updateInstallBusy, setUpdateInstallBusy] = useState(false);
  const [updateInstallProgress, setUpdateInstallProgress] = useState(0);

  useEffect(() => {
    getSetting(AUTO_UPDATE_LAST_CHECKED_KEY)
      .then((value) => setLastCheckedAt(value || null))
      .catch(() => setLastCheckedAt(null));
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const formatDateTime = (value: string | null): string => {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Invalid date";
    return parsed.toLocaleString();
  };

  const handleExportCsv = useCallback(async () => {
    setLoading("csv");
    try {
      const csv = await exportTransactionsCsv();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage("CSV exported successfully!");
    } catch (err) {
      showMessage("Export failed: " + String(err));
    } finally {
      setLoading(null);
    }
  }, []);

  const handleExportJson = useCallback(async () => {
    setLoading("json-export");
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `expense-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage("Backup exported successfully!");
    } catch (err) {
      showMessage("Export failed: " + String(err));
    } finally {
      setLoading(null);
    }
  }, []);

  const handleImportJson = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setLoading("json-import");
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== "object") {
          showMessage("Invalid backup file format.");
          return;
        }
        await importAllData(data);
        showMessage("Backup imported. Reloading...");
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        showMessage("Import failed: " + String(err));
      } finally {
        setLoading(null);
      }
    };
    input.click();
  }, []);

  const handleLoadSample = useCallback(async () => {
    setLoading("sample");
    try {
      const inserted = await loadSampleData();
      showMessage(
        inserted
          ? "Sample data loaded! Navigate to Dashboard to see it."
          : "Sample data was skipped because transactions already exist."
      );
    } catch (err) {
      showMessage("Failed to load sample data: " + String(err));
    } finally {
      setLoading(null);
    }
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (!isTauriRuntime()) {
      setUpdateStatus("Updater is only available in the Tauri desktop app.");
      return;
    }
    setLoading("updates-check");
    setUpdateStatus("Checking for updates...");
    try {
      const nowIso = new Date().toISOString();
      await setSetting(AUTO_UPDATE_LAST_CHECKED_KEY, nowIso);
      setLastCheckedAt(nowIso);

      const update = await checkForUpdates();
      if (!update) {
        setAvailableUpdate(null);
        setUpdateStatus("Up to date.");
        return;
      }
      setAvailableUpdate(update);
      setUpdateDialogOpen(true);
      setUpdateStatus(`Update available: v${update.version}`);
    } catch (err) {
      setUpdateStatus(`Update check failed: ${String(err)}`);
    } finally {
      setLoading(null);
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!availableUpdate || updateInstallBusy) return;
    setUpdateInstallBusy(true);
    setUpdateInstallProgress(0);
    let downloadedTotal = 0;
    try {
      await installUpdateAndRelaunch(availableUpdate, (progress) => {
        if (progress.phase === "started") {
          downloadedTotal = 0;
          setUpdateInstallProgress(0);
          return;
        }
        if (progress.phase === "progress") {
          downloadedTotal += progress.downloaded ?? 0;
          const total = progress.contentLength ?? 0;
          if (total > 0) {
            setUpdateInstallProgress(Math.min(100, Math.round((downloadedTotal / total) * 100)));
          }
          return;
        }
        if (progress.phase === "finished") {
          setUpdateInstallProgress(100);
        }
      });
    } catch (err) {
      setUpdateStatus(`Install failed: ${String(err)}`);
      setUpdateInstallBusy(false);
    }
  }, [availableUpdate, updateInstallBusy]);

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Settings</h2>

      {message && (
        <div className="animate-in rounded-md bg-muted px-4 py-2 text-sm">
          {message}
        </div>
      )}

      {/* Appearance */}
      <FadeIn delay={0}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Customize the look of the app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <Label>Dark Mode</Label>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-sm">Follow system theme</Label>
              <Switch
                checked={theme === "system"}
                onCheckedChange={(checked) => setTheme(checked ? "system" : "light")}
              />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Currency */}
      <FadeIn delay={50}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Currency</CardTitle>
            <CardDescription>Default currency for all transactions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">RON</Badge>
              <span className="text-sm text-muted-foreground">Romanian Leu (multi-currency coming soon)</span>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Features */}
      <FadeIn delay={75}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Features</CardTitle>
            <CardDescription>Enable optional modules.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Enable Portfolio (Beta)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Track BTC/ETH/SOL holdings with periodically updated prices.
                </p>
              </div>
              <Switch
                checked={portfolioEnabled}
                disabled={portfolioLoading}
                onCheckedChange={(checked) => {
                  onPortfolioEnabledChange(checked).catch((err) => {
                    showMessage("Failed to update setting: " + String(err));
                  });
                }}
              />
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Updates */}
      <FadeIn delay={85}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Updates</CardTitle>
            <CardDescription>Control automatic update checks and install new versions safely.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Auto-check for updates on startup</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Checks at most once every 24 hours. Updates are never auto-installed.
                </p>
              </div>
              <Switch
                checked={autoUpdateEnabled}
                disabled={autoUpdateLoading}
                onCheckedChange={(checked) => {
                  onAutoUpdateEnabledChange(checked).catch((err) => {
                    showMessage("Failed to update setting: " + String(err));
                  });
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleCheckForUpdates()}
                disabled={loading === "updates-check" || updateInstallBusy}
                className="gap-1.5"
              >
                {loading === "updates-check" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Check for updates
              </Button>
              <span className="text-xs text-muted-foreground">Last checked: {formatDateTime(lastCheckedAt)}</span>
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <div className="font-medium">Status</div>
              <div className="text-muted-foreground">{updateStatus}</div>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Backup */}
      <FadeIn delay={100}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backup & Export</CardTitle>
            <CardDescription>Export your data or restore from a backup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={!!loading}
                className="gap-1.5"
              >
                {loading === "csv" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={!!loading}
                className="gap-1.5"
              >
                {loading === "json-export" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Export JSON Backup
              </Button>
              <span className="text-xs text-muted-foreground self-center">
                Note: Receipt images are not included in backups.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportJson}
                disabled={!!loading}
                className="gap-1.5"
              >
                {loading === "json-import" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Import JSON Backup
              </Button>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Data stored in the Tauri app data directory (managed by the OS).
              </span>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {/* Sample Data */}
      {isDevMode ? (
        <FadeIn delay={150}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Developer</CardTitle>
              <CardDescription>Tools for testing and development.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadSample}
                disabled={!!loading}
                className="gap-1.5"
              >
                {loading === "sample" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                Load Sample Data
              </Button>
            </CardContent>
          </Card>
        </FadeIn>
      ) : null}

      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {availableUpdate ? `Update Available: v${availableUpdate.version}` : "No update"}
            </DialogTitle>
            <DialogDescription>
              {availableUpdate?.body?.trim()
                ? "Release notes are shown below."
                : "No release notes were provided for this version."}
            </DialogDescription>
          </DialogHeader>
          {availableUpdate?.body?.trim() ? (
            <div className="max-h-56 overflow-auto rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
              {availableUpdate.body}
            </div>
          ) : null}
          {updateInstallBusy ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Installing update...
              </div>
              <Progress value={updateInstallProgress} />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateDialogOpen(false)}
              disabled={updateInstallBusy}
            >
              Later
            </Button>
            <Button
              onClick={() => void handleInstallUpdate()}
              disabled={!availableUpdate || updateInstallBusy}
            >
              Install update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
