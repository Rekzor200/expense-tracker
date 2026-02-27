import { describe, it, expect } from "vitest";
import { calculateMonthSummary, calculatePercentChange, formatCurrency } from "./calculations";
import { Transaction } from "./types";

const makeTxn = (type: "EXPENSE" | "INCOME", amount: number): Transaction => ({
  id: "test",
  type,
  amount,
  currency: "RON",
  categoryId: null,
  note: "",
  occurredAt: "2026-01-15T00:00:00.000Z",
  createdAt: "2026-01-15T00:00:00.000Z",
});

describe("calculateMonthSummary", () => {
  it("returns zeros for empty transactions", () => {
    const result = calculateMonthSummary([]);
    expect(result).toEqual({ income: 0, expenses: 0, net: 0 });
  });

  it("calculates income only", () => {
    const result = calculateMonthSummary([makeTxn("INCOME", 5000)]);
    expect(result.income).toBe(5000);
    expect(result.expenses).toBe(0);
    expect(result.net).toBe(5000);
  });

  it("calculates expenses only", () => {
    const result = calculateMonthSummary([makeTxn("EXPENSE", 1200)]);
    expect(result.income).toBe(0);
    expect(result.expenses).toBe(1200);
    expect(result.net).toBe(-1200);
  });

  it("calculates net correctly with mixed transactions", () => {
    const txns = [
      makeTxn("INCOME", 8500),
      makeTxn("EXPENSE", 1200),
      makeTxn("EXPENSE", 45.5),
      makeTxn("EXPENSE", 32),
      makeTxn("INCOME", 500),
    ];
    const result = calculateMonthSummary(txns);
    expect(result.income).toBe(9000);
    expect(result.expenses).toBeCloseTo(1277.5);
    expect(result.net).toBeCloseTo(7722.5);
  });

  it("handles large numbers", () => {
    const txns = [makeTxn("INCOME", 100000), makeTxn("EXPENSE", 99999.99)];
    const result = calculateMonthSummary(txns);
    expect(result.net).toBeCloseTo(0.01);
  });
});

describe("calculatePercentChange", () => {
  it("returns null when both are zero", () => {
    expect(calculatePercentChange(0, 0)).toBeNull();
  });

  it("returns 100 when previous is zero and current is positive", () => {
    expect(calculatePercentChange(500, 0)).toBe(100);
  });

  it("calculates positive change", () => {
    expect(calculatePercentChange(150, 100)).toBe(50);
  });

  it("calculates negative change", () => {
    expect(calculatePercentChange(80, 100)).toBe(-20);
  });

  it("returns 0 when values are equal", () => {
    expect(calculatePercentChange(100, 100)).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats RON currency", () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain("1.234,56");
    expect(result).toContain("RON");
  });
});
