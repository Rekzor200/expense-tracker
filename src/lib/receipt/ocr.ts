import { createWorker, Worker } from "tesseract.js";
import { parseReceiptText } from "./parser";
import { ParsedReceipt } from "../domain/types";

let worker: Worker | null = null;
let activeOcrJobs = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
const OCR_IDLE_TIMEOUT_MS = 2 * 60 * 1000;

function clearIdleTimer(): void {
  if (!idleTimer) return;
  clearTimeout(idleTimer);
  idleTimer = null;
}

function scheduleIdleTermination(): void {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    if (activeOcrJobs === 0) {
      terminateOcr().catch((err) => {
        console.error("Failed to terminate OCR worker after idle timeout:", err);
      });
    }
  }, OCR_IDLE_TIMEOUT_MS);
}

async function getWorker(): Promise<Worker> {
  clearIdleTimer();
  if (worker) return worker;
  try {
    worker = await createWorker("ron+eng");
    return worker;
  } catch (err) {
    const details =
      err instanceof Error ? err.message : typeof err === "string" ? err : "unknown error";
    throw new Error(
      `Failed to initialize OCR. Check your internet connection for the first-time setup. (${details})`
    );
  }
}

export async function extractFromReceipt(imageSource: string | File): Promise<ParsedReceipt> {
  activeOcrJobs += 1;
  try {
    const w = await getWorker();
    const result = await w.recognize(imageSource);
    const text = result.data.text;
    return parseReceiptText(text);
  } catch (err) {
    console.error("OCR extraction failed:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Failed to initialize OCR. Check your internet connection for the first-time setup.";
    return {
      total: null,
      totalConfidence: 0,
      merchant: null,
      date: null,
      rawText: message,
    };
  } finally {
    activeOcrJobs = Math.max(0, activeOcrJobs - 1);
    if (activeOcrJobs === 0) {
      scheduleIdleTermination();
    }
  }
}

export async function terminateOcr(): Promise<void> {
  clearIdleTimer();
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
