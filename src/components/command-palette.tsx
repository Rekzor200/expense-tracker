import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard, ArrowLeftRight, Tags, BarChart3, Settings,
  Plus, Search, Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
  showPortfolio: boolean;
}

export function CommandPalette({ onAddExpense, onAddIncome, showPortfolio }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (location.pathname !== "/") return;
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/" && open) {
      setOpen(false);
    }
  }, [location.pathname, open]);

  const runAction = useCallback(
    (action: () => void) => {
      setOpen(false);
      action();
    },
    []
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-lg animate-in">
        <Command
          className="rounded-xl border shadow-2xl bg-popover text-popover-foreground overflow-hidden"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            <Command.Group heading="Actions" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              <CommandItem onSelect={() => runAction(onAddExpense)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </CommandItem>
              <CommandItem onSelect={() => runAction(onAddIncome)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Income
              </CommandItem>
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border" />

            <Command.Group heading="Navigate" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              <CommandItem onSelect={() => runAction(() => navigate("/"))}>
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </CommandItem>
              <CommandItem onSelect={() => runAction(() => navigate("/transactions"))}>
                <ArrowLeftRight className="w-4 h-4 mr-2" />
                Transactions
              </CommandItem>
              <CommandItem onSelect={() => runAction(() => navigate("/categories"))}>
                <Tags className="w-4 h-4 mr-2" />
                Categories
              </CommandItem>
              {showPortfolio ? (
                <CommandItem onSelect={() => runAction(() => navigate("/portfolio"))}>
                  <Coins className="w-4 h-4 mr-2" />
                  Portfolio
                </CommandItem>
              ) : null}
              <CommandItem onSelect={() => runAction(() => navigate("/analytics"))}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </CommandItem>
              <CommandItem onSelect={() => runAction(() => navigate("/settings"))}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </CommandItem>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
      )}
    >
      {children}
    </Command.Item>
  );
}
