export const SCHEMA_VERSION = 2;

export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  monthlyBudget REAL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('EXPENSE', 'INCOME')),
  amount REAL NOT NULL CHECK(amount >= 0),
  currency TEXT NOT NULL DEFAULT 'RON',
  categoryId TEXT,
  note TEXT NOT NULL DEFAULT '',
  occurredAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  transactionId TEXT NOT NULL,
  imagePath TEXT NOT NULL,
  ocrText TEXT NOT NULL DEFAULT '',
  parsedJson TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (transactionId) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS holdings (
  symbol TEXT PRIMARY KEY CHECK(symbol IN ('BTC', 'ETH', 'SOL')),
  amount REAL NOT NULL CHECK(amount >= 0),
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_cache (
  symbol TEXT NOT NULL CHECK(symbol IN ('BTC', 'ETH', 'SOL')),
  currency TEXT NOT NULL CHECK(currency IN ('USD', 'EUR')),
  price REAL NOT NULL CHECK(price >= 0),
  change24h REAL,
  updatedAt TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, currency)
);

CREATE TABLE IF NOT EXISTS fx_cache (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL CHECK(rate > 0),
  rateDate TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (base, quote)
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurredAt ON transactions(occurredAt);
CREATE INDEX IF NOT EXISTS idx_transactions_categoryId ON transactions(categoryId);
CREATE INDEX IF NOT EXISTS idx_receipts_transactionId ON receipts(transactionId);
CREATE INDEX IF NOT EXISTS idx_price_cache_updatedAt ON price_cache(updatedAt);
`;
