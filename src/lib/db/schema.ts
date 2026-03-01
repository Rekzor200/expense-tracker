export type Migration = {
  version: number;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        monthlyBudget REAL,
        createdAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
        amount REAL NOT NULL,
        currency TEXT NOT NULL,
        categoryId TEXT NULL,
        note TEXT NOT NULL DEFAULT '',
        occurredAt TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        transactionId TEXT NOT NULL UNIQUE,
        imagePath TEXT NOT NULL,
        ocrText TEXT NOT NULL DEFAULT '',
        parsedJson TEXT NOT NULL DEFAULT '{}',
        createdAt TEXT NOT NULL,
        FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
      )`,
      "CREATE INDEX IF NOT EXISTS idx_transactions_occurredAt ON transactions(occurredAt DESC)",
      "CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId)",
    ],
  },
  {
    version: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS holdings (
        symbol TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS price_cache (
        symbol TEXT NOT NULL,
        currency TEXT NOT NULL,
        price REAL NOT NULL,
        change24h REAL NULL,
        updatedAt TEXT NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY(symbol, currency)
      )`,
      `CREATE TABLE IF NOT EXISTS fx_cache (
        base TEXT NOT NULL,
        quote TEXT NOT NULL,
        rate REAL NOT NULL,
        rateDate TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        source TEXT NOT NULL,
        PRIMARY KEY(base, quote)
      )`,
      "CREATE INDEX IF NOT EXISTS idx_price_cache_updatedAt ON price_cache(updatedAt DESC)",
      "CREATE INDEX IF NOT EXISTS idx_fx_cache_updatedAt ON fx_cache(updatedAt DESC)",
    ],
  },
  {
    version: 3,
    statements: [
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 1;
