import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createPortableBackup, PORTABLE_BACKUP_TABLES } from "../src/lib/backup/export";
import { inspectLocalPortableBackup, LOCAL_BACKUP_TABLES } from "../src/lib/backup/inspect-local";

const emptyTables = () => Object.fromEntries(PORTABLE_BACKUP_TABLES.map(name => [name, []]));
function signedCopy(doc: Record<string, unknown>) {
  const { sha256: _original, ...body } = doc;
  return JSON.stringify({ ...body, sha256: createHash("sha256").update(JSON.stringify(body)).digest("hex") });
}

describe("read-only local JSON backup inspection", () => {
  it("stays aligned with the 12-table portable exporter and accepts an intact file", async () => {
    expect([...LOCAL_BACKUP_TABLES]).toEqual([...PORTABLE_BACKUP_TABLES]);
    const tables = emptyTables();
    tables.trips = [{ id: "trip-1", amount_piastres: "9007199254741000", notes: "نقلة" }];
    tables.payments = [{ id: "p1", amount_piastres: "10000" }];
    const backup = createPortableBackup(tables, "2026-11-19T12:00:00.000Z");
    const preview = await inspectLocalPortableBackup(JSON.stringify(backup, null, 2));
    expect(preview.counts.trips).toBe(1);
    expect(preview.counts.payments).toBe(1);
    expect(preview.totalRows).toBe(2);
    expect(preview.sha256).toBe(backup.sha256);
    expect(preview.restorableDirectly).toBe(false);
    expect(preview.includesAuth).toBe(false);
  });

  it("rejects changes to a record even if the JSON remains well-formed", async () => {
    const tables = emptyTables();
    tables.trips = [{ id: "TR-1", vehicle_total_piastres: "10000" }];
    const backup = createPortableBackup(tables);
    (backup.tables.trips[0] as Record<string, unknown>).vehicle_total_piastres = "20000";
    await expect(inspectLocalPortableBackup(JSON.stringify(backup))).rejects.toThrow(/بصمة/);
  });

  it("rejects missing tables, forged row counts, unsafe numbers and non-app files", async () => {
    const b = createPortableBackup(emptyTables());
    const changed = structuredClone(b) as Record<string, unknown>;
    (changed.tables as Record<string, unknown>).trips = [{ id: "T1" }];
    await expect(inspectLocalPortableBackup(signedCopy(changed))).rejects.toThrow(/عدد سجلات/);
    const missing = structuredClone(b) as Record<string, unknown>;
    delete (missing.tables as Record<string, unknown>).payments;
    await expect(inspectLocalPortableBackup(signedCopy(missing))).rejects.toThrow(/ناقصة/);
    const unsafe = structuredClone(b) as Record<string, unknown>;
    (unsafe.tables as Record<string, unknown>).payments = [{ amount_piastres: Number.MAX_SAFE_INTEGER + 1 }];
    (unsafe.row_counts as Record<string, number>).payments = 1;
    await expect(inspectLocalPortableBackup(signedCopy(unsafe))).rejects.toThrow(/غير دقيق/);
    await expect(inspectLocalPortableBackup('{"format":"other"}')).rejects.toThrow(/غير مدعوم/);
    await expect(inspectLocalPortableBackup("not json")).rejects.toThrow(/JSON غير صالح/);
  });

  it("refuses Auth-bearing flags despite a recomputed file hash", async () => {
    const original = createPortableBackup(emptyTables());
    const forged = { ...original, auth_users_included: true };
    await expect(inspectLocalPortableBackup(signedCopy(forged))).rejects.toThrow(/غير مسموح/);
  });

  it("rejects files containing more than 50000 rows even with a valid hash", async () => {
    const original = createPortableBackup(emptyTables());
    const forged: Record<string, unknown> = structuredClone(original);
    (forged.tables as Record<string, unknown>).trips = Array.from({ length: 50001 }, (_, id) => ({ id: String(id) }));
    (forged.row_counts as Record<string, number>).trips = 50001;
    await expect(inspectLocalPortableBackup(signedCopy(forged))).rejects.toThrow(/50,000/);
  });
});
