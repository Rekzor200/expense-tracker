import { ParsedReceipt } from "../domain/types";

const TOTAL_KEYWORDS = [
  /TOTAL\s*(?:RON|LEI)?\s*[:\s]?\s*([\d.,]+)/i,
  /DE\s*PLATA\s*[:\s]?\s*([\d.,]+)/i,
  /SUMA\s*[:\s]?\s*([\d.,]+)/i,
  /TOTAL\s*GENERAL\s*[:\s]?\s*([\d.,]+)/i,
  /AMOUNT\s*(?:DUE)?\s*[:\s]?\s*([\d.,]+)/i,
  /GRAND\s*TOTAL\s*[:\s]?\s*([\d.,]+)/i,
];

const DATE_PATTERNS = [
  /(\d{2})[.\-/](\d{2})[.\-/](\d{4})/,
  /(\d{4})[.\-/](\d{2})[.\-/](\d{2})/,
];

const NOISE_PATTERNS = [
  /^\s*tel[:\s]/i,
  /^\s*phone/i,
  /^\s*fax/i,
  /^\s*c\.?u\.?i/i,
  /^\s*cod\s*fiscal/i,
  /^\s*reg\s*com/i,
  /^\s*j\d+/i,
  /^\s*ro\d{6,}/i,
  /^\s*str\./i,
  /^\s*adresa/i,
  /^\s*nr\./i,
  /^\s*\d{10,}/,
  /^\s*---/,
  /^\s*====/,
  /^\s*$/,
];

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText.split("\n").map((l) => l.trim());

  const total = extractTotal(lines);
  const date = extractDate(lines);
  const merchant = extractMerchant(lines);

  return {
    total: total.value,
    totalConfidence: total.confidence,
    merchant,
    date,
    rawText,
  };
}

function extractTotal(lines: string[]): { value: number | null; confidence: number } {
  for (const pattern of TOTAL_KEYWORDS) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const val = parseAmount(match[1]);
        if (val !== null && val > 0) {
          return { value: val, confidence: 0.9 };
        }
      }
    }
  }

  const moneyPattern = /(\d+[.,]\d{2})/g;
  const amounts: number[] = [];
  const linesFromEnd = lines.slice(-Math.ceil(lines.length * 0.4));
  for (const line of linesFromEnd) {
    let match;
    while ((match = moneyPattern.exec(line)) !== null) {
      const val = parseAmount(match[1]);
      if (val !== null && val > 0) amounts.push(val);
    }
  }

  if (amounts.length > 0) {
    const maxAmount = Math.max(...amounts);
    return { value: maxAmount, confidence: 0.5 };
  }

  return { value: null, confidence: 0 };
}

function parseAmount(str: string): number | null {
  const cleaned = str.replace(/\s/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function extractDate(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of DATE_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        if (match[1].length === 4) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
        const day = match[1];
        const month = match[2];
        const year = match[3];
        const d = parseInt(day, 10);
        const m = parseInt(month, 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
      }
    }
  }
  return null;
}

function extractMerchant(lines: string[]): string | null {
  const headerLines = lines.slice(0, Math.min(5, lines.length));
  for (const line of headerLines) {
    if (!line || line.length < 3) continue;
    const isNoise = NOISE_PATTERNS.some((p) => p.test(line));
    if (isNoise) continue;
    if (/^\d+[.,]\d{2}$/.test(line)) continue;
    return line;
  }
  return null;
}
