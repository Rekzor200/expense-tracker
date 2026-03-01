import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/layout";
import { TransactionModal } from "@/components/transaction-modal";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { DashboardPage } from "@/pages/dashboard";
import { TransactionsPage } from "@/pages/transactions";
import { CategoriesPage } from "@/pages/categories";
import { PortfolioPage } from "@/pages/portfolio";
import { AnalyticsPage } from "@/pages/analytics";
import { SettingsPage } from "@/pages/settings";
import { useMonth } from "@/hooks/use-month";
import { useTheme } from "@/hooks/use-theme";
import { useAppSettingBoolean } from "@/hooks/use-app-setting-boolean";
import { getDb, getCategories, createTransaction, createReceipt } from "@/lib/db";
import { saveReceiptImage } from "@/lib/receipt/storage";
import { TransactionSaveData } from "@/components/transaction-modal";
import { Category, TransactionType } from "@/lib/domain/types";

export default function App() {
  const month = useMonth();
  useTheme();
  const [portfolioEnabled, setPortfolioEnabled, portfolioSettingLoading] = useAppSettingBoolean("portfolio_enabled", false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
