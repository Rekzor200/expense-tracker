import { NavLink, Outlet } from "react-router-dom";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/categories", icon: Tags, label: "Categories" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface LayoutProps {
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onAddClick: () => void;
}

export function Layout({ monthLabel, onPrevMonth, onNextMonth, onAddClick }: LayoutProps) {
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
          <div className="text-[10px] text-muted-foreground select-none">v0.1</div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Top bar */}
          <header className="h-14 flex items-center justify-between px-6 border-b bg-background shrink-0">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={onPrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[140px] text-center select-none">
                {monthLabel}
              </span>
              <Button variant="ghost" size="icon" onClick={onNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

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
