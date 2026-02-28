import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { LucideIcon } from "@/components/lucide-icon";
import { Category, Transaction, TransactionType, ParsedReceipt } from "@/lib/domain/types";
import { extractFromReceipt } from "@/lib/receipt/ocr";
import { formatCurrency, localDateStr } from "@/lib/domain/calculations";

export interface ReceiptData {
  file: File;
  ocrResult: ParsedReceipt;
}

export interface TransactionSaveData {
  transaction: Omit<Transaction, "id" | "createdAt">;
  receipt?: ReceiptData;
}

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSave: (data: TransactionSaveData) => Promise<void>;
  editTransaction?: Transaction | null;
  initialType?: TransactionType;
}

export function TransactionModal({
  open,
  onOpenChange,
  categories,
  onSave,
  editTransaction,
  initialType = "EXPENSE",
}: TransactionModalProps) {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localDateStr());
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<ParsedReceipt | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [showRawOcr, setShowRawOcr] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editTransaction) {
        setType(editTransaction.type);
        setAmount(String(editTransaction.amount));
        setCategoryId(editTransaction.categoryId || "");
        setNote(editTransaction.note || "");
        setDate(editTransaction.occurredAt?.slice(0, 10) || localDateStr());
      } else {
        setType(initialType);
        setAmount("");
        setCategoryId("");
        setNote("");
        setDate(localDateStr());
      }
      setOcrResult(null);
      setReceiptFile(null);
      setShowRawOcr(false);
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [open, editTransaction, initialType]);

  const handleSave = useCallback(async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    setSaving(true);
    try {
      await onSave({
        transaction: {
          type,
          amount: amt,
          currency: "RON",
          categoryId: type === "EXPENSE" ? (categoryId || null) : null,
          note: note.trim(),
          occurredAt: date + "T12:00:00.000Z",
        },
        receipt: receiptFile && ocrResult ? { file: receiptFile, ocrResult } : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save transaction:", err);
    } finally {
      setSaving(false);
    }
  }, [type, amount, categoryId, note, date, receiptFile, ocrResult, onSave, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  const handleReceiptUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrLoading(true);
      try {
        setReceiptFile(file);
        const result = await extractFromReceipt(file);
        setOcrResult(result);
        if (result.total !== null) setAmount(String(result.total));
        if (result.date) setDate(result.date);
        if (result.merchant) setNote(result.merchant);
      } finally {
        setOcrLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{editTransaction ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>
            {editTransaction ? "Update the transaction details." : "Record a new expense or income."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type Tabs */}
          <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
            <TabsList className="w-full">
              <TabsTrigger value="EXPENSE" className="flex-1">Expense</TabsTrigger>
              <TabsTrigger value="INCOME" className="flex-1">Income</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (RON)</Label>
            <Input
              ref={amountRef}
              id="amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {/* Category (expenses only) */}
          {type === "EXPENSE" && (
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <LucideIcon name={cat.icon} className="w-4 h-4" />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="note">Note</Label>
            <Input
              id="note"
              placeholder="What was this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Receipt Upload */}
          {!editTransaction && type === "EXPENSE" && (
            <div className="space-y-2">
              <Label>Receipt (optional)</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={ocrLoading}
                  className="gap-1.5"
                >
                  {ocrLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {ocrLoading ? "Extracting..." : "Upload & Extract"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleReceiptUpload}
                />
              </div>

              {/* OCR Results */}
              {ocrResult && (
                <div className="rounded-md border p-3 space-y-2 text-sm bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Extraction Results</span>
                    <Badge variant={ocrResult.totalConfidence > 0.7 ? "default" : "secondary"}>
                      {Math.round(ocrResult.totalConfidence * 100)}% confidence
                    </Badge>
                  </div>
                  {ocrResult.total !== null && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total:</span>
                      <span className="font-medium">{formatCurrency(ocrResult.total)}</span>
                    </div>
                  )}
                  {ocrResult.merchant && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Merchant:</span>
                      <span>{ocrResult.merchant}</span>
                    </div>
                  )}
                  {ocrResult.date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date:</span>
                      <span>{ocrResult.date}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setShowRawOcr(!showRawOcr)}
                  >
                    {showRawOcr ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Raw OCR text
                  </button>
                  {showRawOcr && (
                    <ScrollArea className="max-h-32">
                      <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                        {ocrResult.rawText || "No text extracted"}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !amount || parseFloat(amount) <= 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {editTransaction ? "Update" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
