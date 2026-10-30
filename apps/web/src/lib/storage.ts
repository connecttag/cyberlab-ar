import { openDB } from "idb";
import { reportSchema, type Report } from "@cyberlab/core/report";
type Stored = { id: string; report: Report; bytes: number; expiresAt: number };
const open = () =>
  openDB("cyberlab-local", 1, {
    upgrade(db) {
      db.createObjectStore("reports", { keyPath: "id" });
    }
  });
export async function savedReports(): Promise<Report[]> {
  const db = await open();
  try {
    const tx = db.transaction("reports", "readwrite");
    const all: Stored[] = await tx.store.getAll();
    const valid: Report[] = [];
    for (const record of all) {
      const parsed = reportSchema.safeParse(record.report);
      if (record.expiresAt <= Date.now() || !parsed.success)
        await tx.store.delete(record.id);
      else valid.push(parsed.data);
    }
    await tx.done;
    return valid.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    db.close();
  }
}
export async function saveReport(report: Report): Promise<void> {
  const parsed = reportSchema.parse(report);
  const db = await open();
  try {
    const tx = db.transaction("reports", "readwrite"),
      all: Stored[] = await tx.store.getAll();
    const retained = all.filter(
      (x) => x.expiresAt > Date.now() && x.id !== report.reportId
    );
    const bytes = new TextEncoder().encode(JSON.stringify(parsed)).length;
    if (
      retained.length >= 100 ||
      retained.reduce((sum, x) => sum + x.bytes, 0) + bytes > 25 * 1024 * 1024
    ) {
      tx.abort();
      throw new Error("STORAGE_FULL");
    }
    for (const expired of all.filter((x) => x.expiresAt <= Date.now()))
      await tx.store.delete(expired.id);
    await tx.store.put({
      id: report.reportId,
      report: parsed,
      bytes,
      expiresAt: Date.now() + 30 * 86400000
    });
    await tx.done;
  } finally {
    db.close();
  }
}
export async function deleteSaved(id?: string): Promise<void> {
  const db = await open();
  try {
    if (id) await db.delete("reports", id);
    else await db.clear("reports");
  } finally {
    db.close();
  }
}
