import { createWorker, Worker } from "tesseract.js";
import { parseReceiptText } from "./parser";
import { ParsedReceipt } from "../domain/types";

let worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  worker = await createWorker("ron+eng");
  return worker;
}

export async function extractFromReceipt(imageSource: string | File): Promise<ParsedReceipt> {
  try {
    const w = await getWorker();
    const result = await w.recognize(imageSource);
    const text = result.data.text;
    return parseReceiptText(text);
  } catch (err) {
    console.error("OCR extraction failed:", err);
    return {
      total: null,
      totalConfidence: 0,
      merchant: null,
      date: null,
      rawText: "",
    };
  }
}

export async function terminateOcr(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
