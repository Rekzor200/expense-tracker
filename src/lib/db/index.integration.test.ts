import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  __resetDbForTests,
  __setDbForTests,
  createCategory,
  createReceipt,
  createTransaction,
  deleteCategory,
  deleteTransaction,
  exportAllData,
  getBooleanSetting,
  getCategories,
  getFxCache,
  getHoldings,
  getPriceCache,
  getReceiptByTransaction,
  getSetting,
  getTransactionCountByCategory,
  getTransactions,
  importAllData,
  setSetting,
  updateCategory,
  updateTransaction,
  upsertFxCache,
  upsertHolding,
  upsertPriceCache,
} from "./index";
import { Category, FxCache, Holding, PriceCache, Receipt, Transaction } from "../domain/types";
import type Database from "@tauri-apps/plugin-sql";

type AppSettingRow = { key: string; value: string; updatedAt: string };

class InMemoryDb {
  categories: Category[] = [];
  transactions: Transaction[] = [];
  receipts: Receipt[] = [];
  holdings: Holding[] = [];
  priceCache: PriceCache[] = [];
  fxCache: FxCache[] = [];
  appSettings: AppSettingRow[] = [];

  async execute(sql: string, values: unknown[] = []): Promise<void> {
    const normalized = sql.toLowerCase().replace(/\s+/g, " ").trim();

    if (normalized === "begin transaction" || normalized === "commit" || normalized === "rollback") {
      return;
    }

    if (normalized.startsWith("insert into categories")) {
      const [id, name, icon, monthlyBudget, createdAt] = values as [string, string, string, number | null, string];
      this.categories.push({ id, name, icon, monthlyBudget, createdAt });
      return;
    }

    if (normalized.startsWith("update categories set")) {
      const id = String(values[values.length - 1]);
      const category = this.categories.find((entry) => entry.id === id);
      if (!category) return;
      let cursor = 0;
      if (normalized.includes("name =")) category.name = String(values[cursor++]);
      if (normalized.includes("icon =")) category.icon = String(values[cursor++]);
      if (normalized.includes("monthlybudget =")) category.monthlyBudget = values[cursor++] as number | null;
      return;
    }

    if (normalized === "update transactions set categoryid = null where categoryid = $1") {
      const categoryId = String(values[0]);
      this.transactions = this.transactions.map((txn) =>
        txn.categoryId === categoryId ? { ...txn, categoryId: null } : txn
      );
      return;
    }

    if (normalized === "delete from categories where id = $1") {
      const id = String(values[0]);
      this.categories = this.categories.filter((category) => category.id !== id);
      return;
    }

    if (normalized.startsWith("insert into transactions")) {
      const [id, type, amount, currency, categoryId, note, occurredAt, createdAt] = values as [
        string,
        Transaction["type"],
        number,
        string,
        string | null,
        string,
        string,
        string,
      ];
      this.transactions.push({ id, type, amount, currency, categoryId, note, occurredAt, createdAt });
      return;
    }

    if (normalized.startsWith("update transactions set")) {
      const id = String(values[values.length - 1]);
      const transaction = this.transactions.find((entry) => entry.id === id);
      if (!transaction) return;
      let cursor = 0;
      if (normalized.includes("type =")) transaction.type = values[cursor++] as Transaction["type"];
      if (normalized.includes("amount =")) transaction.amount = Number(values[cursor++]);
      if (normalized.includes("currency =")) transaction.currency = String(values[cursor++]);
      if (normalized.includes("categoryid =")) transaction.categoryId = values[cursor++] as string | null;
      if (normalized.includes("note =")) transaction.note = String(values[cursor++]);
      if (normalized.includes("occurredat =")) transaction.occurredAt = String(values[cursor++]);
      return;
    }

    if (normalized === "delete from receipts where transactionid = $1") {
      const transactionId = String(values[0]);
      this.receipts = this.receipts.filter((row) => row.transactionId !== transactionId);
      return;
    }

    if (normalized === "delete from transactions where id = $1") {
      const id = String(values[0]);
      this.transactions = this.transactions.filter((txn) => txn.id !== id);
      return;
    }

    if (normalized.startsWith("insert into receipts")) {
      const [id, transactionId, imagePath, ocrText, parsedJson, createdAt] = values as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      this.receipts.push({ id, transactionId, imagePath, ocrText, parsedJson, createdAt });
      return;
    }

    if (normalized.startsWith("insert into holdings")) {
      const [symbol, amount, updatedAt] = values as [Holding["symbol"], number, string];
      const existing = this.holdings.find((row) => row.symbol === symbol);
      if (existing) {
        existing.amount = amount;
        existing.updatedAt = updatedAt;
      } else {
        this.holdings.push({ symbol, amount, updatedAt });
      }
      return;
    }

    if (normalized.startsWith("insert into price_cache")) {
      const [symbol, currency, price, change24h, updatedAt, source] = values as [
        PriceCache["symbol"],
        PriceCache["currency"],
        number,
        number | null,
        string,
        string,
      ];
      const existing = this.priceCache.find(
        (row) => row.symbol === symbol && row.currency === currency
      );
      if (existing) {
        existing.price = price;
        existing.change24h = change24h;
        existing.updatedAt = updatedAt;
        existing.source = source;
      } else {
        this.priceCache.push({ symbol, currency, price, change24h, updatedAt, source });
      }
      return;
    }

    if (normalized.startsWith("insert into fx_cache")) {
      const [base, quote, rate, rateDate, updatedAt, source] = values as [
        FxCache["base"],
        FxCache["quote"],
        number,
        string,
        string,
        string,
      ];
      const existing = this.fxCache.find((row) => row.base === base && row.quote === quote);
      if (existing) {
        existing.rate = rate;
        existing.rateDate = rateDate;
        existing.updatedAt = updatedAt;
        existing.source = source;
      } else {
        this.fxCache.push({ base, quote, rate, rateDate, updatedAt, source });
      }
      return;
    }

    if (normalized.startsWith("insert into app_settings")) {
      const [key, value, updatedAt] = values as [string, string, string];
      const existing = this.appSettings.find((row) => row.key === key);
      if (existing) {
        existing.value = value;
        existing.updatedAt = updatedAt;
      } else {
        this.appSettings.push({ key, value, updatedAt });
      }
      return;
    }

    if (normalized === "delete from receipts") {
      this.receipts = [];
      return;
    }
    if (normalized === "delete from transactions") {
      this.transactions = [];
      return;
    }
    if (normalized === "delete from categories") {
      this.categories = [];
      return;
    }
    if (normalized === "delete from holdings") {
      this.holdings = [];
      return;
    }
    if (normalized === "delete from price_cache") {
      this.priceCache = [];
      return;
    }
    if (normalized === "delete from fx_cache") {
      this.fxCache = [];
      return;
    }
    if (normalized === "delete from app_settings") {
      this.appSettings = [];
      return;
    }
  }

  async select<T>(sql: string, values: unknown[] = []): Promise<T> {
    const normalized = sql.toLowerCase().replace(/\s+/g, " ").trim();

    if (normalized === "select * from categories order by name") {
      return [...this.categories].sort((a, b) => a.name.localeCompare(b.name)) as T;
    }
    if (normalized === "select id from categories limit 1") {
      return (this.categories[0] ? [{ id: this.categories[0].id }] : []) as T;
    }
    if (normalized === "select count(*) as count from transactions where categoryid = $1") {
      const categoryId = String(values[0]);
      return [{ count: this.transactions.filter((txn) => txn.categoryId === categoryId).length }] as T;
    }

    if (
      normalized.startsWith(
        "select t.*, c.name as categoryname, c.icon as categoryicon from transactions t left join categories c on t.categoryid = c.id"
      )
    ) {
      const limit = Number(values[values.length - 1] ?? 200);
      const rows = [...this.transactions]
        .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
        .slice(0, limit)
        .map((txn) => {
          const category = this.categories.find((cat) => cat.id === txn.categoryId);
          return {
            ...txn,
            categoryName: category?.name,
            categoryIcon: category?.icon,
          };
        });
      return rows as T;
    }

    if (normalized === "select imagepath from receipts where transactionid = $1") {
      const transactionId = String(values[0]);
      return this.receipts
        .filter((row) => row.transactionId === transactionId)
        .map((row) => ({ imagePath: row.imagePath })) as T;
    }

    if (normalized === "select * from receipts where transactionid = $1 limit 1") {
      const transactionId = String(values[0]);
      const receipt = this.receipts.find((row) => row.transactionId === transactionId);
      return (receipt ? [receipt] : []) as T;
    }

    if (normalized === "select * from holdings order by symbol") {
      return [...this.holdings].sort((a, b) => a.symbol.localeCompare(b.symbol)) as T;
    }
    if (normalized === "select * from price_cache order by symbol, currency") {
      return [...this.priceCache].sort((a, b) => {
        const symbolSort = a.symbol.localeCompare(b.symbol);
        if (symbolSort !== 0) return symbolSort;
        return a.currency.localeCompare(b.currency);
      }) as T;
    }
    if (normalized === "select * from fx_cache where base = $1 and quote = $2 limit 1") {
      const base = String(values[0]);
      const quote = String(values[1]);
      const row = this.fxCache.find((entry) => entry.base === base && entry.quote === quote);
      return (row ? [row] : []) as T;
    }

    if (normalized === "select value from app_settings where key = $1 limit 1") {
      const key = String(values[0]);
      const row = this.appSettings.find((entry) => entry.key === key);
      return (row ? [{ value: row.value }] : []) as T;
    }
    if (normalized === "select key from app_settings") {
      return this.appSettings.map((entry) => ({ key: entry.key })) as T;
    }

    if (normalized === "select * from categories") return [...this.categories] as T;
    if (normalized === "select * from transactions") return [...this.transactions] as T;
    if (normalized === "select * from receipts") return [...this.receipts] as T;
    if (normalized === "select * from holdings") return [...this.holdings] as T;
    if (normalized === "select * from price_cache") return [...this.priceCache] as T;
    if (normalized === "select * from fx_cache") return [...this.fxCache] as T;
    if (normalized === "select * from app_settings") return [...this.appSettings] as T;

    return [] as T;
  }
}

describe("db integration", () => {
  let memoryDb: InMemoryDb;

  beforeEach(() => {
    memoryDb = new InMemoryDb();
    __setDbForTests(memoryDb as unknown as Database);
  });

  afterEach(() => {
    __resetDbForTests();
  });

  it("handles category and transaction CRUD flows", async () => {
    const category = await createCategory({ name: "Food", icon: "utensils", monthlyBudget: 101.456 });
    expect(category.monthlyBudget).toBe(101.46);

    await updateCategory(category.id, { monthlyBudget: 99.991, name: "Groceries" });
    const categories = await getCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0]?.name).toBe("Groceries");
    expect(categories[0]?.monthlyBudget).toBe(99.99);

    const txn = await createTransaction({
      type: "EXPENSE",
      amount: 15.239,
      currency: "RON",
      categoryId: category.id,
      note: "Coffee",
      occurredAt: "2026-03-01T10:00:00.000Z",
    });
    expect(txn.amount).toBe(15.24);

    await updateTransaction(txn.id, { amount: 20.499, note: "Lunch" });
    const transactions = await getTransactions({ limit: 200 });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.amount).toBe(20.5);
    expect(transactions[0]?.note).toBe("Lunch");

    expect(await getTransactionCountByCategory(category.id)).toBe(1);
    await deleteCategory(category.id);

    const afterDelete = await getTransactions({ limit: 200 });
    expect(afterDelete[0]?.categoryId).toBeNull();

    await deleteTransaction(txn.id);
    expect((await getTransactions({ limit: 200 })).length).toBe(0);
  });

  it("handles receipt, holdings, caches, and settings CRUD", async () => {
    const txn = await createTransaction({
      type: "EXPENSE",
      amount: 50,
      currency: "RON",
      categoryId: null,
      note: "Pharmacy",
      occurredAt: "2026-03-01T10:00:00.000Z",
    });

    await createReceipt({
      transactionId: txn.id,
      imagePath: "C:/receipts/test.webp",
      ocrText: "TOTAL 50.00",
      parsedJson: '{"total":50}',
    });
    const receipt = await getReceiptByTransaction(txn.id);
    expect(receipt?.transactionId).toBe(txn.id);

    await upsertHolding("BTC", 1.5);
    await upsertHolding("ETH", 2);
    expect((await getHoldings()).map((row) => row.symbol)).toEqual(["BTC", "ETH"]);

    await upsertPriceCache([
      { symbol: "BTC", currency: "USD", price: 65000.129, change24h: -1.234, source: "coingecko" },
      { symbol: "BTC", currency: "EUR", price: 60000.556, change24h: -1.234, source: "coingecko" },
    ]);
    const cachedPrices = await getPriceCache();
    const btcUsd = cachedPrices.find((p) => p.currency === "USD");
    expect(btcUsd?.price).toBe(65000.129);

    await upsertFxCache({
      base: "EUR",
      quote: "RON",
      rate: 4.9731,
      rateDate: "2026-03-01",
      source: "ecb",
    });
    expect((await getFxCache("EUR", "RON"))?.rate).toBe(4.9731);

    await setSetting("portfolio_enabled", "true");
    expect(await getSetting("portfolio_enabled")).toBe("true");
    expect(await getBooleanSetting("portfolio_enabled", false)).toBe(true);
    expect(await getBooleanSetting("missing_flag", false)).toBe(false);
  });

  it("exports and imports full backup payload", async () => {
    const category = await createCategory({ name: "Utilities", icon: "bolt", monthlyBudget: null });
    const txn = await createTransaction({
      type: "EXPENSE",
      amount: 120,
      currency: "RON",
      categoryId: category.id,
      note: "Electricity",
      occurredAt: "2026-03-02T10:00:00.000Z",
    });
    await createReceipt({
      transactionId: txn.id,
      imagePath: "C:/receipts/utility.webp",
      ocrText: "TOTAL 120",
      parsedJson: "{}",
    });
    await upsertHolding("SOL", 10.12345678);
    await upsertPriceCache([
      { symbol: "SOL", currency: "USD", price: 150.1, change24h: 3.21, source: "coingecko" },
    ]);
    await upsertFxCache({
      base: "EUR",
      quote: "RON",
      rate: 4.97,
      rateDate: "2026-03-01",
      source: "ecb",
    });
    await setSetting("portfolio_enabled", "true");

    const backup = await exportAllData();
    expect(backup.schemaVersion).toBeGreaterThan(0);
    expect(backup.categories.length).toBe(1);
    expect(backup.transactions.length).toBe(1);
    expect(backup.receipts.length).toBe(1);
    expect(backup.holdings.length).toBe(1);
    expect(backup.priceCache.length).toBe(1);
    expect(backup.fxCache.length).toBe(1);

    await importAllData(backup);

    expect((await getCategories()).length).toBe(1);
    expect((await getTransactions({ limit: 200 })).length).toBe(1);
    expect((await getHoldings()).length).toBe(1);
    expect(await getSetting("portfolio_enabled")).toBe("true");
  });
});
