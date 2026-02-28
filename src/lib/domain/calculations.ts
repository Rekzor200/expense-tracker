import { Transaction, TransactionWithCategory, CategorySummary, MonthSummary, Category } from "./types";

export function calculateMonthSummary(transactions: Transaction[]): MonthSummary {
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (t.type === "INCOME") {
      income += t.amount;
    } else {
      expenses += t.amount;
    }
  }
  return { income, expenses, net: income - expenses };
}

export function calculateCategorySummaries(
  transactions: TransactionWithCategory[],
  categories: Category[]
): CategorySummary[] {
  const expenseTransactions = transactions.filter((t) => t.type === "EXPENSE");
  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

  const byCategory = new Map<string, number>();
  for (const t of expenseTransactions) {
    const key = t.categoryId || "uncategorized";
    byCategory.set(key, (byCategory.get(key) || 0) + t.amount);
  }

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const summaries: CategorySummary[] = [];

  for (const [catId, total] of byCategory) {
    const cat = categoryMap.get(catId);
    summaries.push({
      categoryId: catId,
      categoryName: cat?.name || "Uncategorized",
      categoryIcon: cat?.icon || "help-circle",
      total,
      budget: cat?.monthlyBudget ?? null,
      percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
    });
  }

  return summaries.sort((a, b) => b.total - a.total);
}

export function getTopSpenders(summaries: CategorySummary[], limit = 5): CategorySummary[] {
  return summaries.slice(0, limit);
}

export function calculateDailyTrend(
  transactions: Transaction[],
  startDate: string,
  endDate: string
): { date: string; amount: number }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dailyMap = new Map<string, number>();

  const current = new Date(start);
  while (current <= end) {
    dailyMap.set(localDateStr(current), 0);
    current.setDate(current.getDate() + 1);
  }

  for (const t of transactions.filter((t) => t.type === "EXPENSE")) {
    const day = t.occurredAt.slice(0, 10);
    if (dailyMap.has(day)) {
      dailyMap.set(day, (dailyMap.get(day) || 0) + t.amount);
    }
  }

  return Array.from(dailyMap.entries())
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return ((current - previous) / previous) * 100;
}

export function formatCurrency(amount: number, currency = "RON"): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format a Date as YYYY-MM-DD using local time (avoids UTC shift). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const mm = String(month + 1).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}
