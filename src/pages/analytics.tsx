import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "@/components/lucide-icon";
import { FadeIn } from "@/components/reactbits/fade-in";
import { EmptyState } from "@/components/reactbits/empty-state";
import { getTransactions, getCategories } from "@/lib/db";
import {
  calculateMonthSummary, calculateCategorySummaries, calculateDailyTrend,
  calculatePercentChange, formatCurrency, getMonthRange, localDateStr,
} from "@/lib/domain/calculations";
import { Category, TransactionWithCategory } from "@/lib/domain/types";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { BarChart3, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";

const CHART_COLORS = [
  "hsl(12, 76%, 61%)", "hsl(173, 58%, 39%)", "hsl(197, 37%, 24%)",
  "hsl(43, 74%, 66%)", "hsl(27, 87%, 67%)", "hsl(280, 65%, 60%)",
  "hsl(340, 75%, 55%)", "hsl(160, 60%, 45%)", "hsl(220, 70%, 50%)",
];

type RangeOption = "this_month" | "last_month" | "custom";

export function AnalyticsPage() {
  const now = new Date();
  const [range, setRange] = useState<RangeOption>("this_month");
  const [customStart, setCustomStart] = useState(localDateStr(now));
  const [customEnd, setCustomEnd] = useState(localDateStr(now));
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const { startDate, endDate } = useMemo((): { startDate: string; endDate: string } => {
    if (range === "custom") return { startDate: customStart, endDate: customEnd };
    const y = now.getFullYear();
    const m = range === "this_month" ? now.getMonth() : now.getMonth() - 1;
    const r = getMonthRange(y, m);
    return { startDate: r.start, endDate: r.end };
  }, [range, customStart, customEnd]);

  const { startDate: prevStart, endDate: prevEnd } = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = e.getTime() - s.getTime();
    const ps = new Date(s.getTime() - diff - 86400000);
    const pe = new Date(s.getTime() - 86400000);
    return { startDate: localDateStr(ps), endDate: localDateStr(pe) };
  }, [startDate, endDate]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [txns, prev, cats] = await Promise.all([
        getTransactions({ startDate, endDate }),
        getTransactions({ startDate: prevStart, endDate: prevEnd }),
        getCategories(),
      ]);
      setTransactions(txns);
      setPrevTransactions(prev);
      setCategories(cats);
      setLoading(false);
    })();
  }, [startDate, endDate, prevStart, prevEnd]);

  const summary = useMemo(() => calculateMonthSummary(transactions), [transactions]);
  const prevSummary = useMemo(() => calculateMonthSummary(prevTransactions), [prevTransactions]);
  const catSummaries = useMemo(
    () => calculateCategorySummaries(transactions, categories),
    [transactions, categories]
  );
  const dailyTrend = useMemo(
    () => calculateDailyTrend(transactions, startDate, endDate),
    [transactions, startDate, endDate]
  );
  const expenseChange = useMemo(
    () => calculatePercentChange(summary.expenses, prevSummary.expenses),
    [summary.expenses, prevSummary.expenses]
  );

  const budgetExceeded = useMemo(
    () => catSummaries.filter((cs) => cs.budget !== null && cs.budget > 0 && cs.total > cs.budget),
    [catSummaries]
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Range Picker */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={range} onValueChange={(v) => setRange(v as RangeOption)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {range === "custom" && (
          <>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              onFocus={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                input.showPicker?.();
              }}
              onClick={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                input.showPicker?.();
              }}
              className="w-37.5"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              onFocus={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                input.showPicker?.();
              }}
              onClick={(e) => {
                const input = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
                input.showPicker?.();
              }}
              className="w-37.5"
            />
          </>
        )}
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No data for this period"
          description="There are no transactions in the selected date range."
        />
      ) : (
        <>
          {/* Insights */}
          <FadeIn delay={0}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {catSummaries.length > 0 && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <LucideIcon name={catSummaries[0].categoryIcon} className="w-4 h-4" />
                      Top Category
                    </div>
                    <div className="text-lg font-semibold">{catSummaries[0].categoryName}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(catSummaries[0].total)} ({catSummaries[0].percentage.toFixed(0)}%)
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    {expenseChange !== null && expenseChange > 0 ? (
                      <TrendingUp className="w-4 h-4 text-expense" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-income" />
                    )}
                    vs Previous Period
                  </div>
                  <div className="text-lg font-semibold">
                    {expenseChange !== null ? `${expenseChange > 0 ? "+" : ""}${expenseChange.toFixed(1)}%` : "N/A"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {expenseChange !== null && expenseChange > 0
                      ? "Spending increased"
                      : "Spending decreased"}
                  </div>
                </CardContent>
              </Card>
              {budgetExceeded.length > 0 && (
                <Card className="border-warning/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-sm text-warning mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Budget Warnings
                    </div>
                    <div className="space-y-1">
                      {budgetExceeded.map((cs) => (
                        <Badge key={cs.categoryId} variant="destructive" className="mr-1">
                          {cs.categoryName}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </FadeIn>

          {/* Daily Trend */}
          <FadeIn delay={100}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Daily Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d: string) => new Date(d).getDate().toString()}
                        className="text-xs"
                      />
                      <YAxis className="text-xs" tickFormatter={(v: number) => `${v}`} />
                      <RechartsTooltip
                        formatter={(value) => formatCurrency(value as number)}
                        labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        contentStyle={{
                          borderRadius: "8px",
                          border: "1px solid var(--color-border)",
                          backgroundColor: "var(--color-popover)",
                          color: "var(--color-popover-foreground)",
                        }}
                        itemStyle={{ color: "var(--color-popover-foreground)" }}
                        labelStyle={{ color: "var(--color-muted-foreground)" }}
                      />
                      <Bar dataKey="amount" fill="hsl(12, 76%, 61%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </FadeIn>

          {/* Category Breakdown */}
          <FadeIn delay={200}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start gap-6">
                  <div className="w-56 h-56">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={catSummaries}
                          dataKey="total"
                          nameKey="categoryName"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          paddingAngle={1}
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
                    {catSummaries.map((cs, i) => (
                      <div key={cs.categoryId} className="flex items-center gap-3 text-sm">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        <LucideIcon name={cs.categoryIcon} className="w-4 h-4 text-muted-foreground" />
                        <span className="flex-1">{cs.categoryName}</span>
                        <span className="font-medium">{formatCurrency(cs.total)}</span>
                        <span className="text-muted-foreground w-12 text-right">
                          {cs.percentage.toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        </>
      )}
    </div>
  );
}

