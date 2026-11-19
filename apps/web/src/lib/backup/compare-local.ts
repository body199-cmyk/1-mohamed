/**
 * Read-only comparison of TWO individually verified portable JSON exports:
 * selected old file vs a fresh owner-only export of the current database.
 *
 * This is not a migration plan, financial replay, or authorization to write.
 * Both exported files exclude Supabase Auth/Storage and do not prove FK safety.
 */
import { inspectLocalPortableBackup, LOCAL_BACKUP_TABLES, type LocalBackupInspection } from "./inspect-local";

type TableName = typeof LOCAL_BACKUP_TABLES[number];
type JsonRow = Record<string, unknown>;

const PRIMARY_KEYS: Record<TableName, readonly string[]> = {
  app_members: ["user_id"],
  app_owner: ["id"],
  audit_log: ["id"],
  business_settings: ["id"],
  contractors: ["id"],
  idempotency_keys: ["key"],
  opening_balances: ["id"],
  payments: ["id"],
  trips: ["id"],
  vehicle_accounts: ["vehicle_id", "contractor_id"],
  vehicles: ["id"],
  backup_history: ["id"],
};

export type TableDifference = {
  table: TableName;
  backupRows: number;
  currentRows: number;
  backupOnly: number;
  currentOnly: number;
  modified: number;
  unchanged: number;
  examples: ReadonlyArray<{
    key: string;
    status: "backup-only" | "current-only" | "modified";
    description: string;
  }>;
};

export type PortableBackupComparison = {
  backup: LocalBackupInspection;
  current: LocalBackupInspection;
  sourceProjectMismatch: boolean;
  identityMismatch: boolean;
  totalBackupOnly: number;
  totalCurrentOnly: number;
  totalModified: number;
  totalUnchanged: number;
  affectedCashAccountCount: number;
  affectedContractorCount: number;
  financialEntriesDiffer: number;
  financialReconciliationPerformed: false;
  selectableRestore: false;
  tables: TableDifference[];
};

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
function record(x: unknown): x is JsonRow {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function stringId(value: unknown): string {
  assert((typeof value === "string" && value.length > 0) ||
    (typeof value === "number" && Number.isSafeInteger(value)),
    "تعذر مقارنة النسخة: يوجد سجل بلا معرّف أساسي صالح.");
  return String(value);
}
function stableKey(table: TableName, row: JsonRow): string {
  return JSON.stringify(PRIMARY_KEYS[table].map(column => stringId(row[column])));
}
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (record(value)) {
    const result: JsonRow = {};
    for (const key of Object.keys(value).sort()) {
      // canonical object keys; avoid prototype mutation if an old row is malformed
      Object.defineProperty(result, key, { value: normalized(value[key]), enumerable: true, configurable: true, writable: true });
    }
    return result;
  }
  return value;
}
function identical(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
}
function byKey(table: TableName, rows: JsonRow[]): Map<string, JsonRow> {
  const result = new Map<string, JsonRow>();
  for (const row of rows) {
    assert(record(row), "النسخة تحتوي صفًا غير صالح.");
    const key = stableKey(table, row);
    assert(!result.has(key), "النسخة تحتوي معرفًا مكررًا في جدول " + table);
    result.set(key, row);
  }
  return result;
}
function shortDescription(table: TableName, row: JsonRow, key: string): string {
  const date = row.trip_date ?? row.payment_date ?? row.start_date ?? row.backup_date;
  const readable = (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : "";
  const title = table === "vehicles" ? row.plate_number
    : table === "contractors" ? row.name : undefined;
  const safeTitle = typeof title === "string" ? title.slice(0, 80) : undefined;
  return [safeTitle, readable, key].filter(Boolean).join(" — ").slice(0, 160);
}
const FINANCIAL_TABLES = new Set<TableName>(["trips", "payments", "opening_balances"]);
function captureAccounts(table: TableName, row: JsonRow, affectedCash: Set<string>, affectedContractors: Set<string>) {
  if (table === "trips") {
    for (const name of ["counterparty_contractor_id", "responsible_contractor_id"]) {
      if (typeof row[name] === "string") affectedContractors.add(row[name] as string);
    }
  }
  if (table === "opening_balances" && typeof row.contractor_id === "string") {
    affectedContractors.add(row.contractor_id);
  }
  if (table === "payments" && typeof row.responsible_contractor_id === "string") {
    affectedContractors.add(row.responsible_contractor_id);
  }
  if (typeof row.vehicle_id === "string" && typeof row.responsible_contractor_id === "string") {
    affectedCash.add(JSON.stringify([row.vehicle_id, row.responsible_contractor_id]));
  }
}

/** No network, no SQL, no values or mutations returned. */
export async function compareVerifiedPortableBackups(
  backupRaw: string, currentRaw: string,
): Promise<PortableBackupComparison> {
  const [backup, current] = await Promise.all([
    inspectLocalPortableBackup(backupRaw),
    inspectLocalPortableBackup(currentRaw),
  ]);
  // Both inputs have passed format, counts, safe numbers and SHA-256.
  const oldData = JSON.parse(backupRaw) as { tables: Record<TableName, JsonRow[]> };
  const nowData = JSON.parse(currentRaw) as { tables: Record<TableName, JsonRow[]> };
  const tables: TableDifference[] = [];
  const affectedCash = new Set<string>();
  const affectedContractors = new Set<string>();
  let financialEntriesDiffer = 0;
  let totalBackupOnly = 0, totalCurrentOnly = 0, totalModified = 0, totalUnchanged = 0;
  let identityMismatch = false;
  for (const table of LOCAL_BACKUP_TABLES) {
    const left = byKey(table, oldData.tables[table]);
    const right = byKey(table, nowData.tables[table]);
    const samples: TableDifference["examples"][number][] = [];
    let backupOnly = 0, currentOnly = 0, modified = 0, unchanged = 0;
    const note = (kind: "backup-only" | "current-only" | "modified", key: string, row: JsonRow) => {
      if (samples.length < 8) samples.push({ key, status: kind, description: shortDescription(table, row, key) });
      if (FINANCIAL_TABLES.has(table)) {
        financialEntriesDiffer++;
        captureAccounts(table, row, affectedCash, affectedContractors);
        const other = kind === "modified" ? right.get(key) : undefined;
        if (other) captureAccounts(table, other, affectedCash, affectedContractors);
      }
      if (table === "app_owner" || table === "app_members") identityMismatch = true;
    };
    for (const [key, row] of left) {
      const rightRow = right.get(key);
      if (!rightRow) { backupOnly++; note("backup-only", key, row); }
      else if (!identical(row, rightRow)) { modified++; note("modified", key, row); }
      else unchanged++;
    }
    for (const [key, row] of right) {
      if (!left.has(key)) { currentOnly++; note("current-only", key, row); }
    }
    totalBackupOnly += backupOnly;
    totalCurrentOnly += currentOnly;
    totalModified += modified;
    totalUnchanged += unchanged;
    tables.push({
      table, backupRows: left.size, currentRows: right.size,
      backupOnly, currentOnly, modified, unchanged, examples: samples,
    });
  }
  return {
    backup, current, sourceProjectMismatch: backup.sourceProject !== current.sourceProject,
    identityMismatch, totalBackupOnly, totalCurrentOnly, totalModified, totalUnchanged,
    affectedCashAccountCount: affectedCash.size,
    affectedContractorCount: affectedContractors.size,
    financialEntriesDiffer, financialReconciliationPerformed: false,
    selectableRestore: false, tables,
  };
}
