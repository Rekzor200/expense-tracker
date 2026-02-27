import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/reactbits/fade-in";
import { useTheme } from "@/hooks/use-theme";
import { exportAllData, importAllData, exportTransactionsCsv, loadSampleData } from "@/lib/db";
import { Download, Upload, Database, FolderOpen, Loader2, Sun, Moon } from "lucide-react";

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
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
        if (!data.categories || !data.transactions) {
          showMessage("Invalid backup file format.");
          return;
        }
        await importAllData(data);
        showMessage("Backup imported successfully! Reload to see changes.");
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
      await loadSampleData();
      showMessage("Sample data loaded! Navigate to Dashboard to see it.");
    } catch (err) {
      showMessage("Failed to load sample data: " + String(err));
    } finally {
      setLoading(null);
    }
  }, []);

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
    </div>
  );
}
