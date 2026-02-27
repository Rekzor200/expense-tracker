import { describe, it, expect } from "vitest";
import { parseReceiptText } from "./parser";

describe("parseReceiptText", () => {
  describe("total extraction", () => {
    it("extracts TOTAL keyword amount", () => {
      const text = `MEGA IMAGE
Str. Exemplu Nr. 1
Paine          3.50
Lapte          7.20
TOTAL         10.70
Multumim!`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(10.70);
      expect(result.totalConfidence).toBeGreaterThanOrEqual(0.9);
    });

    it("extracts DE PLATA variant", () => {
      const text = `LIDL
Produs 1      12.00
Produs 2       8.50
DE PLATA      20.50`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(20.50);
    });

    it("extracts SUMA variant", () => {
      const text = `SHOP
Item          15.00
SUMA: 15.00`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(15.00);
    });

    it("extracts TOTAL RON variant", () => {
      const text = `KAUFLAND
Items...
TOTAL RON 45.90`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(45.90);
    });

    it("falls back to max amount near end when no keyword match", () => {
      const text = `Some shop
3.50
7.20
19.99
Thank you`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(19.99);
      expect(result.totalConfidence).toBeLessThan(0.9);
    });

    it("returns null when no amounts found", () => {
      const text = `Hello world
No numbers here
Thank you`;
      const result = parseReceiptText(text);
      expect(result.total).toBeNull();
      expect(result.totalConfidence).toBe(0);
    });

    it("handles comma as decimal separator", () => {
      const text = `CARREFOUR
TOTAL: 123,45`;
      const result = parseReceiptText(text);
      expect(result.total).toBe(123.45);
    });
  });

  describe("date extraction", () => {
    it("extracts dd.mm.yyyy format", () => {
      const result = parseReceiptText("Date: 15.03.2026\nTOTAL 10.00");
      expect(result.date).toBe("2026-03-15");
    });

    it("extracts dd-mm-yyyy format", () => {
      const result = parseReceiptText("15-03-2026\nTOTAL 10.00");
      expect(result.date).toBe("2026-03-15");
    });

    it("extracts dd/mm/yyyy format", () => {
      const result = parseReceiptText("15/03/2026\nTOTAL 10.00");
      expect(result.date).toBe("2026-03-15");
    });

    it("extracts yyyy-mm-dd format", () => {
      const result = parseReceiptText("2026-03-15\nTOTAL 10.00");
      expect(result.date).toBe("2026-03-15");
    });

    it("returns null when no date found", () => {
      const result = parseReceiptText("No date here\nTOTAL 10.00");
      expect(result.date).toBeNull();
    });
  });

  describe("merchant extraction", () => {
    it("extracts first meaningful header line", () => {
      const result = parseReceiptText("MEGA IMAGE SRL\nStr. Exemplu 1\nTOTAL 10.00");
      expect(result.merchant).toBe("MEGA IMAGE SRL");
    });

    it("skips noise lines (phone, tax, address)", () => {
      const text = `Tel: 021-123-4567
CUI: RO12345678
LIDL DISCOUNT
Products...`;
      const result = parseReceiptText(text);
      expect(result.merchant).toBe("LIDL DISCOUNT");
    });

    it("returns null for empty text", () => {
      const result = parseReceiptText("");
      expect(result.merchant).toBeNull();
    });
  });

  describe("raw text preservation", () => {
    it("preserves the original text", () => {
      const text = "Hello\nWorld";
      const result = parseReceiptText(text);
      expect(result.rawText).toBe(text);
    });
  });
});
