import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tags,
  BarChart3,
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
import { getTransactions } from "@/lib/db";
import { getMonthRange } from "@/lib/domain/calculations";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/categories", icon: Tags, label: "Categories" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
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
}

type MonthHealth = "good" | "warn" | "bad" | "none";

export function Layout({ monthLabel, currentYear, currentMonth, onPrevMonth, onNextMonth, onGoToMonth, onAddClick }: LayoutProps) {
  const location = useLocation();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(currentYear);
  const [monthHealth, setMonthHealth] = useState<Record<number, MonthHealth>>({});
  const showMonthControls =
    location.pathname === "/" || location.pathname.startsWith("/transactions");

  useEffect(() => {
    if (!pickerOpen) return;

    let cancelled = false;

    (async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, async (_, monthIdx) => {
          const range = getMonthRange(pickerYear, monthIdx);
          const txns = await getTransactions({ startDate: range.start, endDate: range.end });
          let income = 0;
          let expenses = 0;
          for (const txn of txns) {
            if (txn.type === "INCOME") income += txn.amount;
            else expenses += txn.amount;
          }
          const net = income - expenses;
          const hasData = income > 0 || expenses > 0;
          let health: MonthHealth = "none";
          if (hasData) {
            if (net < 0) health = "bad";
            else if (income > 0 && net / income >= 0.2) health = "good";
            else health = "warn";
          }
          return [monthIdx, health] as const;
        })
      );

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
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <aside className="w-16 flex flex-col items-center py-4 border-r bg-sidebar shrink-0">
          <div className="text-xl font-bold text-foreground mb-6 select-none">ET</div>
          <nav className="flex flex-col gap-1 flex-1">
            {NAV_ITEMS.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
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
          <div className="text-[10px] text-muted-foreground select-none">v0.2.0</div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <header className="h-14 flex items-center justify-between px-6 border-b bg-background shrink-0">
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
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                Ctrl+K
              </kbd>
              <Separator orientation="vertical" className="h-6" />
              <Button size="sm" onClick={onAddClick} className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add
              </Button>
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

