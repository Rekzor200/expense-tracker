import Database from "@tauri-apps/plugin-sql";
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from "./schema";
import { v4 as uuid } from "uuid";
import {
  Category,
  Transaction,
  TransactionWithCategory,
  Receipt,
  DEFAULT_CATEGORIES,
  Holding,
  PortfolioSymbol,
  PORTFOLIO_SYMBOLS,
  PriceCache,
  FxCache,
} from "../domain/types";
import { getMissingDefaultSettings, parseBooleanSetting } from "./settings-utils";
import { deleteReceiptImage } from "../receipt/storage";
import { roundToCents, roundToDecimals } from "../domain/calculations";

let db: Database | null = null;

export function __setDbForTests(database: Database | null): void {
  db = database;
}

export function __resetDbForTests(): void {
  db = null;
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  try {
    db = await Database.load("sqlite:expense-tracker.db");
    await runMigrations(db);
    return db;
  } catch (err) {
    db = null;
    throw new Error(`Failed to open database: ${err instanceof Error ? err.message : err}`);
  }
}

async function runMigrations(database: Database): Promise<void> {
  await database.execute(
    "CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
  );

  const meta = await database.select<{ value: string }[]>(
    "SELECT value FROM schema_meta WHERE key = 'version'"
  );

  if (meta.length === 0) {
    await database.execute("INSERT INTO schema_meta (key, value) VALUES ('version', '0')");
  }

  let currentVersion = Number(meta[0]?.value ?? "0");
  if (!Number.isFinite(currentVersion) || currentVersion < 0) {
    currentVersion = 0;
  }

  const migrationsToRun = MIGRATIONS.filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version);

  for (const migration of migrationsToRun) {
    for (const statement of migration.statements) {
      await database.execute(statement);
    }
    await database.execute("UPDATE schema_meta SET value = $1 WHERE key = 'version'", [
      String(migration.version),
    ]);
    currentVersion = migration.version;
  }

  if (meta.length === 0) {
    await seedDefaultCategories(database);
  }
  if (currentVersion < LATEST_SCHEMA_VERSION) {
    await database.execute("UPDATE schema_meta SET value = $1 WHERE key = 'version'", [
      String(LATEST_SCHEMA_VERSION),
    ]);
  }

  await seedPortfolioHoldings(database);
  await seedDefaultAppSettings(database);
}

async function seedDefaultCategories(database: Database): Promise<void> {
  const existing = await database.select<{ id: string }[]>("SELECT id FROM categories LIMIT 1");
  if (existing.length > 0) return;

  for (const cat of DEFAULT_CATEGORIES) {
    await database.execute(
      "INSERT INTO categories (id, name, icon, monthlyBudget, createdAt) VALUES ($1, $2, $3, $4, $5)",
      [uuid(), cat.name, cat.icon, cat.monthlyBudget, new Date().toISOString()]
    );
  }
}

async function seedPortfolioHoldings(database: Database): Promise<void> {
  for (const symbol of PORTFOLIO_SYMBOLS) {
    await database.execute(
      "INSERT OR IGNORE INTO holdings (symbol, amount, updatedAt) VALUES ($1, $2, $3)",
      [symbol, 0, new Date().toISOString()]
    );
  }
}

async function seedDefaultAppSettings(database: Database): Promise<void> {
  const rows = await database.select<{ key: string }[]>("SELECT key FROM app_settings");
  const inserts = getMissingDefaultSettings(rows.map((r) => r.key));
  for (const row of inserts) {
    await database.execute(
      "INSERT INTO app_settings (key, value, updatedAt) VALUES ($1, $2, $3)",
      [row.key, row.value, new Date().toISOString()]
    );
  }
}

// --- Categories ---
export async function getCategories(): Promise<Category[]> {
  const database = await getDb();
  return database.select<Category[]>("SELECT * FROM categories ORDER BY name");
}

export async function createCategory(
  data: Omit<Category, "id" | "createdAt">
): Promise<Category> {
  const database = await getDb();
  const cat: Category = {
    id: uuid(),
    ...data,
    monthlyBudget: data.monthlyBudget !== null ? roundToCents(data.monthlyBudget) : null,
    createdAt: new Date().toISOString(),
  };
  await database.execute(
    "INSERT INTO categories (id, name, icon, monthlyBudget, createdAt) VALUES ($1, $2, $3, $4, $5)",
    [cat.id, cat.name, cat.icon, cat.monthlyBudget, cat.createdAt]
  );
  return cat;
}

export async function updateCategory(id: string, data: Partial<Omit<Category, "id" | "createdAt">>): Promise<void> {
  const database = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.icon !== undefined) { fields.push(`icon = $${idx++}`); values.push(data.icon); }
  if (data.monthlyBudget !== undefined) {
    fields.push(`monthlyBudget = $${idx++}`);
    values.push(data.monthlyBudget !== null ? roundToCents(data.monthlyBudget) : null);
  }

  if (fields.length === 0) return;
  values.push(id);
  await database.execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = $${idx}`, values);
}

export async function deleteCategory(id: string): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE transactions SET categoryId = NULL WHERE categoryId = $1", [id]);
  await database.execute("DELETE FROM categories WHERE id = $1", [id]);
}

export async function getTransactionCountByCategory(categoryId: string): Promise<number> {
  const database = await getDb();
  const rows = await database.select<Array<{ count: number }>>(
    "SELECT COUNT(*) as count FROM transactions WHERE categoryId = $1",
    [categoryId]
  );
  return Number(rows[0]?.count || 0);
}

// --- Transactions ---
export async function getTransactions(params?: {
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
  search?: string;
  limit?: number;
}): Promise<TransactionWithCategory[]> {
  const database = await getDb();
  let query = `
    SELECT t.*, c.name as categoryName, c.icon as categoryIcon
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    WHERE 1=1
  `;
  const values: unknown[] = [];
  let idx = 1;

  if (params?.startDate) {
    query += ` AND t.occurredAt >= $${idx++}`;
    values.push(params.startDate);
  }
  if (params?.endDate) {
    query += ` AND t.occurredAt <= $${idx++}`;
    values.push(params.endDate + "T23:59:59");
  }
  if (params?.type) {
    query += ` AND t.type = $${idx++}`;
    values.push(params.type);
  }
  if (params?.categoryId) {
    query += ` AND t.categoryId = $${idx++}`;
    values.push(params.categoryId);
  }
  if (params?.search) {
    query += ` AND t.note LIKE $${idx++}`;
    values.push(`%${params.search}%`);
  }

  query += ` ORDER BY t.occurredAt DESC, t.createdAt DESC LIMIT $${idx++}`;
  const limit = Math.max(1, Math.min(params?.limit ?? 200, 2000));
  values.push(limit);
  return database.select<TransactionWithCategory[]>(query, values);
}

export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt">
): Promise<Transaction> {
  const database = await getDb();
  const txn: Transaction = {
    id: uuid(),
    ...data,
    amount: roundToCents(data.amount),
    createdAt: new Date().toISOString(),
  };
  await database.execute(
    "INSERT INTO transactions (id, type, amount, currency, categoryId, note, occurredAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [txn.id, txn.type, txn.amount, txn.currency, txn.categoryId, txn.note, txn.occurredAt, txn.createdAt]
  );
  return txn;
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, "id" | "createdAt">>
): Promise<void> {
  const database = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.type !== undefined) { fields.push(`type = $${idx++}`); values.push(data.type); }
  if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(roundToCents(data.amount)); }
  if (data.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(data.currency); }
  if (data.categoryId !== undefined) { fields.push(`categoryId = $${idx++}`); values.push(data.categoryId); }
  if (data.note !== undefined) { fields.push(`note = $${idx++}`); values.push(data.note); }
  if (data.occurredAt !== undefined) { fields.push(`occurredAt = $${idx++}`); values.push(data.occurredAt); }

  if (fields.length === 0) return;
  values.push(id);
  await database.execute(`UPDATE transactions SET ${fields.join(", ")} WHERE id = $${idx}`, values);
}

export async function deleteTransaction(id: string): Promise<void> {
  const database = await getDb();
  const receipts = await database.select<Array<{ imagePath: string }>>(
    "SELECT imagePath FROM receipts WHERE transactionId = $1",
    [id]
  );
  await database.execute("DELETE FROM receipts WHERE transactionId = $1", [id]);
  await database.execute("DELETE FROM transactions WHERE id = $1", [id]);
  for (const receipt of receipts) {
    await deleteReceiptImage(receipt.imagePath);
  }
}

// --- Receipts ---
export async function createReceipt(data: Omit<Receipt, "id" | "createdAt">): Promise<Receipt> {
  const database = await getDb();
  const receipt: Receipt = { id: uuid(), ...data, createdAt: new Date().toISOString() };
  await database.execute(
    "INSERT INTO receipts (id, transactionId, imagePath, ocrText, parsedJson, createdAt) VALUES ($1, $2, $3, $4, $5, $6)",
    [receipt.id, receipt.transactionId, receipt.imagePath, receipt.ocrText, receipt.parsedJson, receipt.createdAt]
  );
  return receipt;
}

export async function getReceiptByTransaction(transactionId: string): Promise<Receipt | null> {
  const database = await getDb();
  const results = await database.select<Receipt[]>(
    "SELECT * FROM receipts WHERE transactionId = $1 LIMIT 1",
    [transactionId]
  );
  return results[0] || null;
}

// --- Portfolio ---
export async function getHoldings(): Promise<Holding[]> {
  const database = await getDb();
  const rows = await database.select<Holding[]>("SELECT * FROM holdings ORDER BY symbol");
  return rows;
}

export async function upsertHolding(symbol: PortfolioSymbol, amount: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO holdings (symbol, amount, updatedAt)
     VALUES ($1, $2, $3)
     ON CONFLICT(symbol) DO UPDATE SET amount = excluded.amount, updatedAt = excluded.updatedAt`,
    [symbol, amount, new Date().toISOString()]
  );
}

export async function getPriceCache(): Promise<PriceCache[]> {
  const database = await getDb();
  return database.select<PriceCache[]>("SELECT * FROM price_cache ORDER BY symbol, currency");
}

export async function upsertPriceCache(rows: Omit<PriceCache, "updatedAt">[]): Promise<void> {
  if (rows.length === 0) return;
  const database = await getDb();
  const updatedAt = new Date().toISOString();
  for (const row of rows) {
    await database.execute(
      `INSERT INTO price_cache (symbol, currency, price, change24h, updatedAt, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT(symbol, currency) DO UPDATE SET
         price = excluded.price,
         change24h = excluded.change24h,
         updatedAt = excluded.updatedAt,
         source = excluded.source`,
      [
        row.symbol,
        row.currency,
        roundToDecimals(row.price, 8),
        row.change24h !== null ? roundToDecimals(row.change24h, 4) : null,
        updatedAt,
        row.source,
      ]
    );
  }
}

export async function getFxCache(base = "EUR", quote = "RON"): Promise<FxCache | null> {
  const database = await getDb();
  const rows = await database.select<FxCache[]>(
    "SELECT * FROM fx_cache WHERE base = $1 AND quote = $2 LIMIT 1",
    [base, quote]
  );
  return rows[0] || null;
}

export async function upsertFxCache(data: Omit<FxCache, "updatedAt">): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO fx_cache (base, quote, rate, rateDate, updatedAt, source)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(base, quote) DO UPDATE SET
       rate = excluded.rate,
       rateDate = excluded.rateDate,
       updatedAt = excluded.updatedAt,
       source = excluded.source`,
    [
      data.base,
      data.quote,
      roundToDecimals(data.rate, 6),
      data.rateDate,
      new Date().toISOString(),
      data.source,
    ]
  );
}

// --- App Settings ---
export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO app_settings (key, value, updatedAt)
     VALUES ($1, $2, $3)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, value, new Date().toISOString()]
  );
}

export async function getBooleanSetting(key: string, defaultValue: boolean): Promise<boolean> {
  const value = await getSetting(key);
  return parseBooleanSetting(value, defaultValue);
}

// --- Backup ---
export async function exportAllData(): Promise<{
  schemaVersion: number;
  categories: Category[];
  transactions: Transaction[];
  receipts: Receipt[];
  holdings: Holding[];
  priceCache: PriceCache[];
  fxCache: FxCache[];
  appSettings: { key: string; value: string; updatedAt: string }[];
}> {
  const database = await getDb();
  const categories = await database.select<Category[]>("SELECT * FROM categories");
  const transactions = await database.select<Transaction[]>("SELECT * FROM transactions");
  const receipts = await database.select<Receipt[]>("SELECT * FROM receipts");
  const holdings = await database.select<Holding[]>("SELECT * FROM holdings");
  const priceCache = await database.select<PriceCache[]>("SELECT * FROM price_cache");
  const fxCache = await database.select<FxCache[]>("SELECT * FROM fx_cache");
  const appSettings = await database.select<{ key: string; value: string; updatedAt: string }[]>(
    "SELECT * FROM app_settings"
  );
  return {
    schemaVersion: LATEST_SCHEMA_VERSION,
    categories,
    transactions,
    receipts,
    holdings,
    priceCache,
    fxCache,
    appSettings,
  };
}

export async function importAllData(data: {
  schemaVersion?: number;
  categories?: Category[];
  transactions?: Transaction[];
  receipts?: Receipt[];
  holdings?: Holding[];
  priceCache?: PriceCache[];
  fxCache?: FxCache[];
  appSettings?: Array<{ key: string; value: string; updatedAt: string }>;
}): Promise<void> {
  if (typeof data.schemaVersion !== "number" || !Number.isInteger(data.schemaVersion)) {
    throw new Error("Invalid backup format: schemaVersion is missing or invalid.");
  }
  if (data.schemaVersion < 1 || data.schemaVersion > LATEST_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup schemaVersion: ${data.schemaVersion}.`);
  }

  const cats = data.categories ?? [];
  const txns = data.transactions ?? [];
  const recs = data.receipts ?? [];
  const holdings = data.holdings ?? [];
  const priceCache = data.priceCache ?? [];
  const fxCache = data.fxCache ?? [];
  const appSettings = data.appSettings ?? [];

  for (const txn of txns) {
    if (!txn.id || !txn.type || typeof txn.amount !== "number") {
      throw new Error(`Invalid transaction in backup: ${JSON.stringify(txn).slice(0, 100)}`);
    }
  }

  const database = await getDb();

  await database.execute("BEGIN TRANSACTION");
  try {
    await database.execute("DELETE FROM receipts");
    await database.execute("DELETE FROM transactions");
    await database.execute("DELETE FROM categories");
    await database.execute("DELETE FROM holdings");
    await database.execute("DELETE FROM price_cache");
    await database.execute("DELETE FROM fx_cache");
    await database.execute("DELETE FROM app_settings");

    for (const cat of cats) {
      await database.execute(
        "INSERT INTO categories (id, name, icon, monthlyBudget, createdAt) VALUES ($1, $2, $3, $4, $5)",
        [
          cat.id,
          cat.name,
          cat.icon,
          cat.monthlyBudget !== null ? roundToCents(cat.monthlyBudget) : null,
          cat.createdAt,
        ]
      );
    }
    for (const txn of txns) {
      await database.execute(
        "INSERT INTO transactions (id, type, amount, currency, categoryId, note, occurredAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          txn.id,
          txn.type,
          roundToCents(txn.amount),
          txn.currency,
          txn.categoryId,
          txn.note,
          txn.occurredAt,
          txn.createdAt,
        ]
      );
    }
    for (const r of recs) {
      await database.execute(
        "INSERT INTO receipts (id, transactionId, imagePath, ocrText, parsedJson, createdAt) VALUES ($1, $2, $3, $4, $5, $6)",
        [r.id, r.transactionId, r.imagePath, r.ocrText, r.parsedJson, r.createdAt]
      );
    }
    for (const h of holdings) {
      if (!PORTFOLIO_SYMBOLS.includes(h.symbol)) continue;
      await database.execute(
        "INSERT INTO holdings (symbol, amount, updatedAt) VALUES ($1, $2, $3)",
        [h.symbol, h.amount, h.updatedAt]
      );
    }
    await seedPortfolioHoldings(database);
    for (const p of priceCache) {
      if (!PORTFOLIO_SYMBOLS.includes(p.symbol)) continue;
      if (p.currency !== "USD" && p.currency !== "EUR") continue;
      await database.execute(
        "INSERT INTO price_cache (symbol, currency, price, change24h, updatedAt, source) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          p.symbol,
          p.currency,
          roundToDecimals(p.price, 8),
          p.change24h !== null ? roundToDecimals(p.change24h, 4) : null,
          p.updatedAt,
          p.source,
        ]
      );
    }
    for (const fx of fxCache) {
      await database.execute(
        "INSERT INTO fx_cache (base, quote, rate, rateDate, updatedAt, source) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          fx.base,
          fx.quote,
          roundToDecimals(fx.rate, 6),
          fx.rateDate,
          fx.updatedAt,
          fx.source,
        ]
      );
    }
    for (const s of appSettings) {
      await database.execute(
        "INSERT INTO app_settings (key, value, updatedAt) VALUES ($1, $2, $3)",
        [s.key, s.value, s.updatedAt]
      );
    }
    await seedDefaultAppSettings(database);
    await database.execute("COMMIT");
  } catch (err) {
    await database.execute("ROLLBACK");
    throw err;
  }
}

export async function exportTransactionsCsv(): Promise<string> {
  const database = await getDb();
  const transactions = await database.select<TransactionWithCategory[]>(`
    SELECT t.*, c.name as categoryName
    FROM transactions t
    LEFT JOIN categories c ON t.categoryId = c.id
    ORDER BY t.occurredAt DESC
  `);

  const sanitizeCsvCell = (value: unknown): string => {
    const raw = value === null || value === undefined ? "" : String(value);
    const trimmed = raw.trimStart();
    const firstChar = trimmed.charAt(0);
    const formulaChars = new Set(["=", "+", "-", "@", "\t", "\r"]);
    const prefixed = formulaChars.has(firstChar) ? `'${raw}` : raw;
    return prefixed.replace(/"/g, '""');
  };

  const header = "Date,Type,Amount,Currency,Category,Note";
  const rows = transactions.map((t) => {
    const cells = [
      sanitizeCsvCell(t.occurredAt),
      sanitizeCsvCell(t.type),
      sanitizeCsvCell(t.amount),
      sanitizeCsvCell(t.currency),
      sanitizeCsvCell(t.categoryName || ""),
      sanitizeCsvCell(t.note || ""),
    ];
    return cells.map((cell) => `"${cell}"`).join(",");
  });
  return [header, ...rows].join("\n");
}

// --- Sample Data ---
function makeDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}T12:00:00.000Z`;
}

export async function loadSampleData(): Promise<boolean> {
  const database = await getDb();
  const existingTxCount = await database.select<Array<{ count: number }>>(
    "SELECT COUNT(*) as count FROM transactions"
  );
  if (Number(existingTxCount[0]?.count || 0) > 0) return false;

  const categories = await database.select<Category[]>("SELECT * FROM categories");
  if (categories.length === 0) return false;

  const catMap = new Map(categories.map((c) => [c.name, c.id]));
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const sampleTransactions: Omit<Transaction, "id" | "createdAt">[] = [
    { type: "INCOME", amount: 8500, currency: "RON", categoryId: null, note: "Salary", occurredAt: makeDate(year, month, 1) },
    { type: "EXPENSE", amount: 45.5, currency: "RON", categoryId: catMap.get("Food") || null, note: "Mega Image groceries", occurredAt: makeDate(year, month, 2) },
    { type: "EXPENSE", amount: 32, currency: "RON", categoryId: catMap.get("Take-outs") || null, note: "Bolt Food - pizza", occurredAt: makeDate(year, month, 3) },
    { type: "EXPENSE", amount: 150, currency: "RON", categoryId: catMap.get("Transport") || null, note: "Fuel", occurredAt: makeDate(year, month, 4) },
    { type: "EXPENSE", amount: 55, currency: "RON", categoryId: catMap.get("Subscriptions") || null, note: "Netflix + Spotify", occurredAt: makeDate(year, month, 5) },
    { type: "EXPENSE", amount: 1200, currency: "RON", categoryId: catMap.get("Bills") || null, note: "Rent", occurredAt: makeDate(year, month, 1) },
    { type: "EXPENSE", amount: 250, currency: "RON", categoryId: catMap.get("Shopping") || null, note: "New shoes", occurredAt: makeDate(year, month, 7) },
    { type: "EXPENSE", amount: 89, currency: "RON", categoryId: catMap.get("Health") || null, note: "Pharmacy", occurredAt: makeDate(year, month, 8) },
    { type: "EXPENSE", amount: 120, currency: "RON", categoryId: catMap.get("Fun") || null, note: "Cinema + dinner", occurredAt: makeDate(year, month, 10) },
    { type: "EXPENSE", amount: 67.8, currency: "RON", categoryId: catMap.get("Food") || null, note: "Lidl weekly shop", occurredAt: makeDate(year, month, 12) },
    { type: "INCOME", amount: 500, currency: "RON", categoryId: null, note: "Freelance project", occurredAt: makeDate(year, month, 15) },
    { type: "EXPENSE", amount: 35, currency: "RON", categoryId: catMap.get("Take-outs") || null, note: "Tazz - sushi", occurredAt: makeDate(year, month, 14) },
    { type: "EXPENSE", amount: 180, currency: "RON", categoryId: catMap.get("Shopping") || null, note: "H&M clothes", occurredAt: makeDate(year, month, 16) },
    { type: "EXPENSE", amount: 42, currency: "RON", categoryId: catMap.get("Transport") || null, note: "Uber rides", occurredAt: makeDate(year, month, 18) },
    { type: "EXPENSE", amount: 95, currency: "RON", categoryId: catMap.get("Other") || null, note: "Gift for friend", occurredAt: makeDate(year, month, 20) },
  ];

  for (const txn of sampleTransactions) {
    await createTransaction(txn);
  }
  return true;
}
