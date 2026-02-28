import Database from "@tauri-apps/plugin-sql";
import { CREATE_TABLES, SCHEMA_VERSION } from "./schema";
import { v4 as uuid } from "uuid";
import { Category, Transaction, TransactionWithCategory, Receipt, DEFAULT_CATEGORIES } from "../domain/types";

let db: Database | null = null;

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
  const statements = CREATE_TABLES.split(";").map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await database.execute(stmt + ";");
  }

  const meta = await database.select<{ value: string }[]>(
    "SELECT value FROM schema_meta WHERE key = 'version'"
  );

  if (meta.length === 0) {
    await database.execute("INSERT INTO schema_meta (key, value) VALUES ('version', $1)", [
      String(SCHEMA_VERSION),
    ]);
    await seedDefaultCategories(database);
  }
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

// --- Categories ---
export async function getCategories(): Promise<Category[]> {
  const database = await getDb();
  return database.select<Category[]>("SELECT * FROM categories ORDER BY name");
}

export async function createCategory(
  data: Omit<Category, "id" | "createdAt">
): Promise<Category> {
  const database = await getDb();
  const cat: Category = { id: uuid(), ...data, createdAt: new Date().toISOString() };
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
  if (data.monthlyBudget !== undefined) { fields.push(`monthlyBudget = $${idx++}`); values.push(data.monthlyBudget); }

  if (fields.length === 0) return;
  values.push(id);
  await database.execute(`UPDATE categories SET ${fields.join(", ")} WHERE id = $${idx}`, values);
}

export async function deleteCategory(id: string): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE transactions SET categoryId = NULL WHERE categoryId = $1", [id]);
  await database.execute("DELETE FROM categories WHERE id = $1", [id]);
}

// --- Transactions ---
export async function getTransactions(params?: {
  startDate?: string;
  endDate?: string;
  type?: string;
  categoryId?: string;
  search?: string;
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

  query += " ORDER BY t.occurredAt DESC, t.createdAt DESC";
  return database.select<TransactionWithCategory[]>(query, values);
}

export async function createTransaction(
  data: Omit<Transaction, "id" | "createdAt">
): Promise<Transaction> {
  const database = await getDb();
  const txn: Transaction = { id: uuid(), ...data, createdAt: new Date().toISOString() };
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
  if (data.amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(data.amount); }
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
  await database.execute("DELETE FROM receipts WHERE transactionId = $1", [id]);
  await database.execute("DELETE FROM transactions WHERE id = $1", [id]);
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

// --- Backup ---
export async function exportAllData(): Promise<{
  categories: Category[];
  transactions: Transaction[];
  receipts: Receipt[];
}> {
  const database = await getDb();
  const categories = await database.select<Category[]>("SELECT * FROM categories");
  const transactions = await database.select<Transaction[]>("SELECT * FROM transactions");
  const receipts = await database.select<Receipt[]>("SELECT * FROM receipts");
  return { categories, transactions, receipts };
}

export async function importAllData(data: {
  categories?: Category[];
  transactions?: Transaction[];
  receipts?: Receipt[];
}): Promise<void> {
  const cats = data.categories ?? [];
  const txns = data.transactions ?? [];
  const recs = data.receipts ?? [];

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

    for (const cat of cats) {
      await database.execute(
        "INSERT INTO categories (id, name, icon, monthlyBudget, createdAt) VALUES ($1, $2, $3, $4, $5)",
        [cat.id, cat.name, cat.icon, cat.monthlyBudget, cat.createdAt]
      );
    }
    for (const txn of txns) {
      await database.execute(
        "INSERT INTO transactions (id, type, amount, currency, categoryId, note, occurredAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [txn.id, txn.type, txn.amount, txn.currency, txn.categoryId, txn.note, txn.occurredAt, txn.createdAt]
      );
    }
    for (const r of recs) {
      await database.execute(
        "INSERT INTO receipts (id, transactionId, imagePath, ocrText, parsedJson, createdAt) VALUES ($1, $2, $3, $4, $5, $6)",
        [r.id, r.transactionId, r.imagePath, r.ocrText, r.parsedJson, r.createdAt]
      );
    }
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

  const header = "Date,Type,Amount,Currency,Category,Note";
  const rows = transactions.map((t) =>
    `"${t.occurredAt}","${t.type}","${t.amount}","${t.currency}","${t.categoryName || ""}","${(t.note || "").replace(/"/g, '""')}"`
  );
  return [header, ...rows].join("\n");
}

// --- Sample Data ---
function makeDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}T12:00:00.000Z`;
}

export async function loadSampleData(): Promise<void> {
  const database = await getDb();
  const categories = await database.select<Category[]>("SELECT * FROM categories");
  if (categories.length === 0) return;

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
}
