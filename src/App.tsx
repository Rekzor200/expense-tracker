import { useState, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout";
import { TransactionModal } from "@/components/transaction-modal";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DashboardPage } from "@/pages/dashboard";
import { TransactionsPage } from "@/pages/transactions";
import { CategoriesPage } from "@/pages/categories";
import { PortfolioPage } from "@/pages/portfolio";
import { AnalyticsPage } from "@/pages/analytics";
import { SettingsPage } from "@/pages/settings";
import { useMonth } from "@/hooks/use-month";
import { useTheme } from "@/hooks/use-theme";
import { useAppSettingBoolean } from "@/hooks/use-app-setting-boolean";
import { getDb, getCategories, createTransaction, createReceipt, getSetting, setSetting } from "@/lib/db";
import { saveReceiptImage } from "@/lib/receipt/storage";
import { TransactionSaveData } from "@/components/transaction-modal";
import { Category, TransactionType } from "@/lib/domain/types";
import { AvailableUpdate, checkForUpdates, installUpdateAndRelaunch, shouldAutoCheck } from "@/lib/updater";
import { Loader2 } from "lucide-react";

const AUTO_UPDATE_LAST_CHECKED_KEY = "auto_update_last_checked_at";

export default function App() {
  const month = useMonth();
  useTheme();
  const [portfolioEnabled, setPortfolioEnabled, portfolioSettingLoading] = useAppSettingBoolean("portfolio_enabled", false);
  const [autoUpdateEnabled, setAutoUpdateEnabled, autoUpdateLoading] = useAppSettingBoolean("auto_update_enabled", false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [startupUpdate, setStartupUpdate] = useState<AvailableUpdate | null>(null);
  const [startupUpdateDismissed, setStartupUpdateDismissed] = useState(false);
  const [startupInstallBusy, setStartupInstallBusy] = useState(false);
  const [startupInstallProgress, setStartupInstallProgress] = useState(0);
  const autoCheckRanRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        await getDb();
        setDbReady(true);
        setCategories(await getCategories());
      } catch (err) {
        setDbError(err instanceof Error ? err.message : "Unknown database error");
      }
    })();
  }, []);

  useEffect(() => {
    if (!autoUpdateEnabled) autoCheckRanRef.current = false;
  }, [autoUpdateEnabled]);

  useEffect(() => {
    if (!dbReady || autoUpdateLoading || !autoUpdateEnabled || autoCheckRanRef.current) return;

    let cancelled = false;
    autoCheckRanRef.current = true;

    (async () => {
      try {
        const lastChecked = await getSetting(AUTO_UPDATE_LAST_CHECKED_KEY);
        if (!shouldAutoCheck(lastChecked)) return;

        const nowIso = new Date().toISOString();
        await setSetting(AUTO_UPDATE_LAST_CHECKED_KEY, nowIso);
        const update = await checkForUpdates();
        if (!cancelled && update) {
          setStartupUpdate(update);
          setStartupUpdateDismissed(false);
        }
      } catch {
        // Silent fail for startup checks to keep app boot resilient.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dbReady, autoUpdateLoading, autoUpdateEnabled]);

  const handleInstallStartupUpdate = useCallback(async () => {
    if (!startupUpdate || startupInstallBusy) return;
    setStartupInstallBusy(true);
    setStartupInstallProgress(0);
    let downloadedTotal = 0;
    try {
      await installUpdateAndRelaunch(startupUpdate, (progress) => {
        if (progress.phase === "started") {
          downloadedTotal = 0;
          setStartupInstallProgress(0);
          return;
        }
        if (progress.phase === "progress") {
          downloadedTotal += progress.downloaded ?? 0;
          const total = progress.contentLength ?? 0;
          if (total > 0) {
            setStartupInstallProgress(Math.min(100, Math.round((downloadedTotal / total) * 100)));
          }
        }
        if (progress.phase === "finished") {
          setStartupInstallProgress(100);
        }
      });
    } catch {
      setStartupInstallBusy(false);
    }
  }, [startupUpdate, startupInstallBusy]);

  const refreshCategories = useCallback(async () => {
    setCategories(await getCategories());
  }, []);

  const handleAddClick = useCallback(() => {
    setInitialType("EXPENSE");
    setAddModalOpen(true);
    refreshCategories();
  }, [refreshCategories]);

  const handleAddExpense = useCallback(() => {
    setInitialType("EXPENSE");
    setAddModalOpen(true);
    refreshCategories();
  }, [refreshCategories]);

  const handleAddIncome = useCallback(() => {
    setInitialType("INCOME");
    setAddModalOpen(true);
    refreshCategories();
  }, [refreshCategories]);

  const handleSave = useCallback(
    async ({ transaction, receipt }: TransactionSaveData) => {
      const txn = await createTransaction(transaction);
      if (receipt) {
        const imagePath = await saveReceiptImage(receipt.file);
        await createReceipt({
          transactionId: txn.id,
          imagePath,
          ocrText: receipt.ocrResult.rawText,
          parsedJson: JSON.stringify(receipt.ocrResult),
        });
      }
      setRefreshKey((k) => k + 1);
    },
    []
  );

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center space-y-3 max-w-md px-4">
          <div className="text-4xl">&#x26A0;</div>
          <h1 className="text-lg font-semibold">Database Error</h1>
          <p className="text-sm text-muted-foreground">{dbError}</p>
          <p className="text-xs text-muted-foreground">Try restarting the application. If the problem persists, your database file may be corrupted.</p>
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Initializing database...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <CommandPalette
        onAddExpense={handleAddExpense}
        onAddIncome={handleAddIncome}
        showPortfolio={!portfolioSettingLoading && portfolioEnabled}
      />
      {startupUpdate && !startupUpdateDismissed && (
        <div className="fixed right-4 bottom-4 z-[60] w-[360px] rounded-xl border bg-card/95 p-4 shadow-xl backdrop-blur-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Update available: v{startupUpdate.version}</p>
            <p className="text-xs text-muted-foreground">A newer version is ready. Install now or later from Settings.</p>
            {startupInstallBusy ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Installing update...
                </div>
                <Progress value={startupInstallProgress} />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => void handleInstallStartupUpdate()}>
                  Install update
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setStartupUpdateDismissed(true)}>
                  Later
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      <Routes>
        <Route
          element={
            <Layout
              monthLabel={month.label}
              currentYear={month.year}
              currentMonth={month.month}
              onPrevMonth={month.prev}
              onNextMonth={month.next}
              onGoToMonth={month.goTo}
              onAddClick={handleAddClick}
              showPortfolio={!portfolioSettingLoading && portfolioEnabled}
            />
          }
        >
          <Route
            index
            element={<DashboardPage startDate={month.range.start} endDate={month.range.end} refreshKey={refreshKey} />}
          />
          <Route
            path="transactions"
            element={<TransactionsPage startDate={month.range.start} endDate={month.range.end} refreshKey={refreshKey} />}
          />
          <Route path="categories" element={<CategoriesPage />} />
          <Route
            path="portfolio"
            element={
              !portfolioEnabled ? (
                <PortfolioDisabledPage />
              ) : (
                <PortfolioPage />
              )
            }
          />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route
            path="settings"
            element={
              <SettingsPage
                portfolioEnabled={portfolioEnabled}
                onPortfolioEnabledChange={setPortfolioEnabled}
                portfolioLoading={portfolioSettingLoading}
                autoUpdateEnabled={autoUpdateEnabled}
                onAutoUpdateEnabledChange={setAutoUpdateEnabled}
                autoUpdateLoading={autoUpdateLoading}
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Add Transaction modal from top bar + command palette */}
      <TransactionModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        categories={categories}
        onSave={handleSave}
        initialType={initialType}
      />
    </BrowserRouter>
  );
}

function PortfolioDisabledPage() {
  return (
    <div className="max-w-xl mx-auto mt-10 rounded-lg border p-6 space-y-3 bg-card">
      <h2 className="text-lg font-semibold">Portfolio Is Disabled</h2>
      <p className="text-sm text-muted-foreground">
        Enable Portfolio (Beta) in Settings to track BTC, ETH, and SOL holdings.
      </p>
      <Button asChild size="sm" className="gap-1.5">
        <Link to="/settings">Open Settings</Link>
      </Button>
    </div>
  );
}
