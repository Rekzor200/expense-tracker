export type TransactionType = "EXPENSE" | "INCOME";
export type PortfolioSymbol = "BTC" | "ETH" | "SOL";

export interface Category {
  id: string;
  name: string;
  icon: string;
  monthlyBudget: number | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  categoryId: string | null;
  note: string;
  occurredAt: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  transactionId: string;
  imagePath: string;
  ocrText: string;
  parsedJson: string;
  createdAt: string;
}

export interface TransactionWithCategory extends Transaction {
  categoryName?: string;
  categoryIcon?: string;
}

export interface CategorySummary {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
  budget: number | null;
  percentage: number;
}

export interface MonthSummary {
  income: number;
  expenses: number;
  net: number;
}

export interface ParsedReceipt {
  total: number | null;
  totalConfidence: number;
  merchant: string | null;
  date: string | null;
  rawText: string;
}

export interface Holding {
  symbol: PortfolioSymbol;
  amount: number;
  updatedAt: string;
}

export interface PriceCache {
  symbol: PortfolioSymbol;
  currency: "USD" | "EUR";
  price: number;
  change24h: number | null;
  updatedAt: string;
  source: string;
}

export interface FxCache {
  base: "EUR";
  quote: "RON";
  rate: number;
  rateDate: string;
  updatedAt: string;
  source: string;
}

export const PORTFOLIO_SYMBOLS: PortfolioSymbol[] = ["BTC", "ETH", "SOL"];

export const DEFAULT_CATEGORIES: Omit<Category, "id" | "createdAt">[] = [
  { name: "Subscriptions", icon: "repeat", monthlyBudget: null },
  { name: "Fun", icon: "gamepad-2", monthlyBudget: null },
  { name: "Food", icon: "utensils", monthlyBudget: null },
  { name: "Take-outs", icon: "pizza", monthlyBudget: null },
  { name: "Transport", icon: "car", monthlyBudget: null },
  { name: "Shopping", icon: "shopping-bag", monthlyBudget: null },
  { name: "Bills", icon: "file-text", monthlyBudget: null },
  { name: "Health", icon: "heart-pulse", monthlyBudget: null },
  { name: "Other", icon: "ellipsis", monthlyBudget: null },
];
