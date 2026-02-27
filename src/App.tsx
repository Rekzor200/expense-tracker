import { useState, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout";
import { TransactionModal } from "@/components/transaction-modal";
import { CommandPalette } from "@/components/command-palette";
import { DashboardPage } from "@/pages/dashboard";
import { TransactionsPage } from "@/pages/transactions";
import { CategoriesPage } from "@/pages/categories";
import { AnalyticsPage } from "@/pages/analytics";
import { SettingsPage } from "@/pages/settings";
import { useMonth } from "@/hooks/use-month";
import { useTheme } from "@/hooks/use-theme";
import { getDb, getCategories, createTransaction } from "@/lib/db";
import { Category, Transaction, TransactionType } from "@/lib/domain/types";

export default function App() {
  const month = useMonth();
  useTheme();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [initialType, setInitialType] = useState<TransactionType>("EXPENSE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    (async () => {
      await getDb();
      setDbReady(true);
      setCategories(await getCategories());
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
    async (data: Omit<Transaction, "id" | "createdAt">) => {
      await createTransaction(data);
    },
    []
  );

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
      <CommandPalette onAddExpense={handleAddExpense} onAddIncome={handleAddIncome} />
      <Routes>
        <Route
          element={
            <Layout
              monthLabel={month.label}
              onPrevMonth={month.prev}
              onNextMonth={month.next}
              onAddClick={handleAddClick}
            />
          }
        >
          <Route
            index
            element={<DashboardPage startDate={month.range.start} endDate={month.range.end} />}
          />
          <Route
            path="transactions"
            element={<TransactionsPage startDate={month.range.start} endDate={month.range.end} />}
          />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>

      {/* Global Add Transaction modal from top bar + command palette */}
      <TransactionModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        categories={categories}
        onSave={handleSave}
        editTransaction={initialType === "INCOME" ? { type: "INCOME" } as Transaction : null}
      />
    </BrowserRouter>
  );
}
