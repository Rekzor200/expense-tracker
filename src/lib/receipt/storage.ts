import { mkdir, writeFile, exists, remove } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { v4 as uuid } from "uuid";

const RECEIPTS_DIR = "receipts";
const MAX_RECEIPT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_RECEIPT_DIMENSION = 2000;

type ReceiptExt = "png" | "jpg" | "webp";

function isPng(bytes: Uint8Array): boolean {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return sig.every((v, i) => bytes[i] === v);
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  return riff === "RIFF" && webp === "WEBP";
}

export async function validateReceiptFile(file: File): Promise<ReceiptExt> {
  if (file.size <= 0) {
    throw new Error("Receipt file is empty.");
  }
  if (file.size > MAX_RECEIPT_SIZE_BYTES) {
    throw new Error("Receipt file is too large. Maximum is 10MB.");
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (isPng(header)) return "png";
  if (isJpeg(header)) return "jpg";
  if (isWebp(header)) return "webp";

  throw new Error("Unsupported receipt file type. Please upload PNG, JPEG, or WEBP.");
}

function extToMime(ext: ReceiptExt): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function mimeToExt(mime: string): ReceiptExt {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function optimizeReceiptImage(
  file: File,
  detectedExt: ReceiptExt
): Promise<{ bytes: Uint8Array; ext: ReceiptExt }> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    const raw = new Uint8Array(await file.arrayBuffer());
    return { bytes: raw, ext: detectedExt };
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_RECEIPT_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      const raw = new Uint8Array(await file.arrayBuffer());
      return { bytes: raw, ext: detectedExt };
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const preferredMime = file.type.startsWith("image/") ? file.type : extToMime(detectedExt);
    const quality = preferredMime === "image/png" ? 0.92 : 0.85;
    const optimizedBlob = await canvasToBlob(canvas, preferredMime, quality);
    if (!optimizedBlob) {
      const raw = new Uint8Array(await file.arrayBuffer());
      return { bytes: raw, ext: detectedExt };
    }

    const optimizedBytes = new Uint8Array(await optimizedBlob.arrayBuffer());
    return {
      bytes: optimizedBytes,
      ext: mimeToExt(optimizedBlob.type || preferredMime),
    };
  } catch {
    const raw = new Uint8Array(await file.arrayBuffer());
    return { bytes: raw, ext: detectedExt };
  }
}

async function ensureReceiptsDir(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, RECEIPTS_DIR);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function saveReceiptImage(file: File): Promise<string> {
  const safeExt = await validateReceiptFile(file);
  const optimized = await optimizeReceiptImage(file, safeExt);
  const dir = await ensureReceiptsDir();
  const filename = `${uuid()}.${optimized.ext}`;
  const filePath = await join(dir, filename);
  await writeFile(filePath, optimized.bytes);
  return filePath;
}

export async function deleteReceiptImage(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    if (await exists(filePath)) {
      await remove(filePath);
    }
  } catch {
    // Best effort cleanup to avoid blocking transaction deletion.
  }
}
