import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "@/components/lucide-icon";
import { FadeIn } from "@/components/reactbits/fade-in";
import { EmptyState } from "@/components/reactbits/empty-state";
import { getTransactions, getCategories } from "@/lib/db";
import {
  calculateMonthSummary,
  calculateCategorySummaries,
  formatCurrency,
} from "@/lib/domain/calculations";
import { Category, TransactionWithCategory } from "@/lib/domain/types";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet, LayoutDashboard } from "lucide-react";

const CHART_COLORS = [
  "hsl(12, 76%, 61%)", "hsl(173, 58%, 39%)", "hsl(197, 37%, 24%)",
  "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)", "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)", "hsl(160, 60%, 45%)", "hsl(220, 70%, 50%)",
];

interface DashboardProps {
  startDate: string;
  endDate: string;
  refreshKey?: number;
}

export function DashboardPage({ startDate, endDate, refreshKey }: DashboardProps) {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [txns, cats] = await Promise.all([
        getTransactions({ startDate, endDate }),
        getCategories(),
      ]);
      setTransactions(txns);
      setCategories(cats);
      setLoading(false);
    })();
  }, [startDate, endDate, refreshKey]);

  const summary = useMemo(() => calculateMonthSummary(transactions), [transactions]);
  const catSummaries = useMemo(
    () => calculateCategorySummaries(transactions, categories),
    [transactions, categories]
  );
  const recentTxns = useMemo(() => transactions.slice(0, 5), [transactions]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<LayoutDashboard />}
        title="No data yet"
        description="Add your first transaction to see your dashboard come alive."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FadeIn delay={0}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
              <TrendingUp className="w-4 h-4 text-income" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-income">{formatCurrency(summary.income)}</div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={50}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
              <TrendingDown className="w-4 h-4 text-expense" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-expense">{formatCurrency(summary.expenses)}</div>
            </CardContent>
          </Card>
        </FadeIn>
        <FadeIn delay={100}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Net</CardTitle>
              <Wallet className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.net >= 0 ? "text-income" : "text-expense"}`}>
                {formatCurrency(summary.net)}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <FadeIn delay={150}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {catSummaries.length > 0 ? (
                <div className="flex items-center gap-4">
                  <div className="w-48 h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={catSummaries}
                          dataKey="total"
                          nameKey="categoryName"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {catSummaries.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => formatCurrency(value as number)}
                          allowEscapeViewBox={{ x: true, y: true }}
                          wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
                          contentStyle={{
                            borderRadius: "8px",
                            border: "1px solid var(--color-border)",
                            backgroundColor: "var(--color-popover)",
                            color: "var(--color-popover-foreground)",
                            fontSize: "13px",
                            padding: "8px 12px",
                          }}
                          itemStyle={{ color: "var(--color-popover-foreground)" }}
                          labelStyle={{ color: "var(--color-muted-foreground)" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {catSummaries.slice(0, 5).map((cs, i) => (
                      <div key={cs.categoryId} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <span className="truncate flex-1">{cs.categoryName}</span>
                        <span className="text-muted-foreground">{formatCurrency(cs.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No expenses this month.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        {/* Budget Bars */}
        <FadeIn delay={200}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Budget Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const budgetCats = catSummaries.filter((cs) => cs.budget !== null && cs.budget > 0);
                if (budgetCats.length === 0) {
                  return <p className="text-sm text-muted-foreground">No budgets set. Edit categories to set monthly budgets.</p>;
                }
                return budgetCats.map((cs) => {
                  const pct = cs.budget! > 0 ? Math.min((cs.total / cs.budget!) * 100, 100) : 0;
                  const isWarning = pct >= 90;
                  return (
                    <div key={cs.categoryId} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <LucideIcon name={cs.categoryIcon} className="w-4 h-4" />
                          <span>{cs.categoryName}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {formatCurrency(cs.total)} / {formatCurrency(cs.budget!)}
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        indicatorClassName={isWarning ? "bg-warning" : "bg-primary"}
                      />
                      {isWarning && (
                        <Badge variant="destructive" className="text-[10px]">
                          {pct >= 100 ? "Over budget!" : "Near limit"}
                        </Badge>
                      )}
                    </div>
                  );
                });
              })()}
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Recent Transactions */}
      <FadeIn delay={250}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <LucideIcon name={txn.categoryIcon || (txn.type === "INCOME" ? "trending-up" : "circle")} className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{txn.note || txn.categoryName || txn.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(txn.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${txn.type === "INCOME" ? "text-income" : "text-expense"}`}>
                    {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
