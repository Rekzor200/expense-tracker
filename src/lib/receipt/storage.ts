import { mkdir, writeFile, exists } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { v4 as uuid } from "uuid";

const RECEIPTS_DIR = "receipts";

async function ensureReceiptsDir(): Promise<string> {
  const base = await appDataDir();
  const dir = await join(base, RECEIPTS_DIR);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function saveReceiptImage(file: File): Promise<string> {
  const dir = await ensureReceiptsDir();
  const ext = file.name.split(".").pop() || "png";
  const filename = `${uuid()}.${ext}`;
  const filePath = await join(dir, filename);
  const buffer = await file.arrayBuffer();
  await writeFile(filePath, new Uint8Array(buffer));
  return filePath;
}
