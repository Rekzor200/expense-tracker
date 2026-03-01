import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LucideIcon } from "@/components/lucide-icon";
import { EmptyState } from "@/components/reactbits/empty-state";
import { FadeIn } from "@/components/reactbits/fade-in";
import { TransactionModal, TransactionSaveData } from "@/components/transaction-modal";
import {
  getTransactions, getCategories, createTransaction, createReceipt, updateTransaction, deleteTransaction,
} from "@/lib/db";
import { saveReceiptImage } from "@/lib/receipt/storage";
import { formatCurrency } from "@/lib/domain/calculations";
import { Category, Transaction, TransactionWithCategory } from "@/lib/domain/types";
import { Search, Pencil, Trash2, ArrowLeftRight } from "lucide-react";

interface TransactionsPageProps {
  startDate: string;
  endDate: string;
  refreshKey?: number;
}

export function TransactionsPage({ startDate, endDate, refreshKey }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [txns, cats] = await Promise.all([
      getTransactions({
        startDate,
        endDate,
        type: filterType !== "all" ? filterType : undefined,
        categoryId: filterCategory !== "all" ? filterCategory : undefined,
        search: search || undefined,
        limit: 200,
      }),
      getCategories(),
    ]);
    setTransactions(txns);
    setCategories(cats);
    setLoading(false);
  }, [startDate, endDate, filterType, filterCategory, search, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const handleSave = useCallback(
    async ({ transaction, receipt }: TransactionSaveData) => {
      if (editTxn) {
        await updateTransaction(editTxn.id, transaction);
      } else {
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
      }
      setEditTxn(null);
      await load();
    },
    [editTxn, load]
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    await deleteTransaction(deleteId);
    setDeleteId(null);
    await load();
  }, [deleteId, load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="EXPENSE">Expenses</SelectItem>
            <SelectItem value="INCOME">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight />}
          title="No transactions"
          description="No transactions match your filters. Try adjusting the search or add a new transaction."
        />
      ) : (
        <div className="table-solid rounded-xl">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-4 py-2 border-b bg-muted/70 text-xs font-medium text-muted-foreground uppercase">
            <span>Transaction</span>
            <span className="text-right">Amount</span>
            <span className="text-center">Date</span>
            <span className="text-right">Actions</span>
          </div>
          {transactions.map((txn, i) => (
            <FadeIn key={txn.id} delay={Math.min(i, 19) * 30} duration={200}>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <LucideIcon
                      name={txn.categoryIcon || (txn.type === "INCOME" ? "trending-up" : "circle")}
                      className="w-4 h-4"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {txn.note || txn.categoryName || txn.type}
                    </div>
                    <div className="flex items-center gap-2">
                      {txn.categoryName && (
                        <Badge variant="secondary" className="text-[10px]">
                          {txn.categoryName}
                        </Badge>
                      )}
                      <Badge variant={txn.type === "INCOME" ? "default" : "outline"} className="text-[10px]">
                        {txn.type}
                      </Badge>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium text-right whitespace-nowrap ${
                    txn.type === "INCOME" ? "text-income" : "text-expense"
                  }`}
                >
                  {txn.type === "INCOME" ? "+" : "-"}{formatCurrency(txn.amount)}
                </span>
                <span className="text-xs text-muted-foreground text-center whitespace-nowrap">
                  {new Date(txn.occurredAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex gap-1 justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => { setEditTxn(txn); setModalOpen(true); }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => setDeleteId(txn.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      )}

      <TransactionModal
        open={modalOpen}
        onOpenChange={(open) => { setModalOpen(open); if (!open) setEditTxn(null); }}
        categories={categories}
        onSave={handleSave}
        editTransaction={editTxn}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this transaction.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

