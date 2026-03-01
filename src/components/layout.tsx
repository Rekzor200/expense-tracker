import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  BarChart3,
  Coins,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getMonthTypeTotalsForYear } from "@/lib/db";
import appLogo from "@/assets/logo-cropped.png";
import { getVersion } from "@tauri-apps/api/app";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/categories", icon: Tags, label: "Categories" },
  { to: "/portfolio", icon: Coins, label: "Portfolio" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface LayoutProps {
  monthLabel: string;
  currentYear: number;
  currentMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToMonth: (year: number, month: number) => void;
  onAddClick: () => void;
  showPortfolio: boolean;
}

type MonthHealth = "good" | "warn" | "bad" | "none";

export function Layout({ monthLabel, currentYear, currentMonth, onPrevMonth, onNextMonth, onGoToMonth, onAddClick, showPortfolio }: LayoutProps) {
  const location = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [monthHealth, setMonthHealth] = useState<Record<number, MonthHealth>>({});
  const [appVersion, setAppVersion] = useState("...");
  const showMonthControls =
    location.pathname === "/" || location.pathname.startsWith("/transactions");
  const showAddButton = location.pathname === "/";
  const showCommandHint = location.pathname === "/";

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version);
      })
      .catch(() => {
        if (!cancelled) setAppVersion("dev");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;

    let cancelled = false;

    (async () => {
      const monthlyTotals = await getMonthTypeTotalsForYear(pickerYear);
      const byMonth = new Map<number, { income: number; expenses: number }>();
      for (let monthIdx = 0; monthIdx < 12; monthIdx += 1) {
        byMonth.set(monthIdx, { income: 0, expenses: 0 });
      }
      for (const row of monthlyTotals) {
        const bucket = byMonth.get(row.month);
        if (!bucket) continue;
        if (row.type === "INCOME") bucket.income += row.total;
        else bucket.expenses += row.total;
      }

      const results = Array.from({ length: 12 }, (_, monthIdx) => {
        const month = byMonth.get(monthIdx) ?? { income: 0, expenses: 0 };
        const net = month.income - month.expenses;
        const hasData = month.income > 0 || month.expenses > 0;
        let health: MonthHealth = "none";
        if (hasData) {
          if (net < 0) health = "bad";
          else if (month.income > 0 && net / month.income >= 0.2) health = "good";
          else health = "warn";
        }
        return [monthIdx, health] as const;
      });

      if (cancelled) return;
      const next: Record<number, MonthHealth> = {};
      for (const [monthIdx, health] of results) next[monthIdx] = health;
      setMonthHealth(next);
    })().catch(() => {
      if (cancelled) return;
      setMonthHealth({});
    });

    return () => {
      cancelled = true;
    };
  }, [pickerOpen, pickerYear]);

  const healthDotClass = (health: MonthHealth | undefined) => {
    if (health === "good") return "bg-income";
    if (health === "warn") return "bg-warning";
    if (health === "bad") return "bg-expense";
    return "bg-muted-foreground/40";
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside className="glass-sidebar relative z-30 w-20 flex flex-col items-center py-4 shrink-0">
          <div className="mb-6 select-none">
            <img src={appLogo} alt="Expense Tracker" className="h-16 w-16 object-contain" />
          </div>
          <nav className="flex flex-col items-center gap-1 flex-1">
            {NAV_ITEMS.filter((item) => (item.to === "/portfolio" ? showPortfolio : true)).map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "mx-auto flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                        isActive
                          ? "bg-foreground/10 text-foreground"
                          : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                      )
                    }
                  >
                    <item.icon className="w-5 h-5" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  cn(
                    "mx-auto flex items-center justify-center w-10 h-10 rounded-lg transition-colors mb-2",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
                  )
                }
              >
                <Settings className="w-5 h-5" />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
          <div className="text-[10px] text-muted-foreground select-none">v{appVersion}</div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <header className="glass-header h-14 sticky top-0 z-20 flex items-center justify-between px-6 shrink-0">
            {showMonthControls ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onPrevMonth}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Popover open={pickerOpen} onOpenChange={(open) => { setPickerOpen(open); if (open) setPickerYear(currentYear); }}>
                  <PopoverTrigger asChild>
                    <button className="text-sm font-medium min-w-35 text-center select-none rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                      {monthLabel}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="flex items-center justify-between mb-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerYear((y) => y - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-semibold">{pickerYear}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPickerYear((y) => y + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTHS.map((name, i) => (
                        <button
                          key={name}
                          onClick={() => { onGoToMonth(pickerYear, i); setPickerOpen(false); }}
                          className={cn(
                            "rounded-md px-2 py-1.5 text-sm transition-colors cursor-pointer flex items-center justify-between",
                            currentYear === pickerYear && currentMonth === i
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <span>{name}</span>
                          <span className={cn("h-2 w-2 rounded-full shrink-0", healthDotClass(monthHealth[i]))} />
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" onClick={onNextMonth}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {showCommandHint ? (
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  Ctrl+K
                </kbd>
              ) : null}
              {showAddButton ? (
                <>
                  <Separator orientation="vertical" className="h-6" />
                  <Button size="sm" onClick={onAddClick} className="gap-1.5">
                    <Plus className="w-4 h-4" />
                    Add
                  </Button>
                </>
              ) : null}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}


