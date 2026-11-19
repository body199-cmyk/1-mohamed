/**
 * Read-only, browser-side inspection of the application's own portable JSON
 * exports. NO NETWORK, NO MUTATIONS, NO RESTORE.
 *
 * The SHA-256 detects accidental corruption, not who created the file. Schema,
 * foreign keys, Auth and database restore compatibility are NOT proved here.
 * Keep this list in sync with PORTABLE_BACKUP_TABLES in ./export.ts.
 */
export const LOCAL_BACKUP_TABLES = [
  "app_members", "app_owner", "audit_log", "business_settings",
  "contractors", "idempotency_keys", "opening_balances", "payments",
  "trips", "vehicle_accounts", "vehicles", "backup_history",
] as const;

export const MAX_LOCAL_PREVIEW_BYTES = 32 * 1024 * 1024;
const MAX_ROWS = 50_000;
type TableName = typeof LOCAL_BACKUP_TABLES[number];

export type LocalBackupInspection = {
  createdAt: string;
  sourceProject: string;
  format: string;
  totalRows: number;
  counts: Record<TableName, number>;
  sha256: string;
  includesAuth: false;
  restorableDirectly: false;
};

function assertValid(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactNames(value: unknown, expected: readonly string[]): boolean {
  return Array.isArray(value) && value.length === expected.length
    && value.every((item) => typeof item === "string")
    && new Set(value).size === expected.length
    && expected.every(name => value.includes(name));
}
function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return isRecord(value) && exactNames(Object.keys(value), expected);
}

/** Traverse a parsed document without coercing bigint-bearing fields to floats. */
function verifySafeNumbers(value: unknown, depth = 0, limit = { remaining: 2_000_000 }): void {
  assertValid(depth < 64, "ملف النسخة يحتوي بيانات متداخلة أكثر من الحد الآمن.");
  assertValid(--limit.remaining >= 0, "ملف النسخة يحتوي عناصر أكثر من حد الفحص الآمن.");
  if (typeof value === "number") {
    assertValid(Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER,
      "ملف النسخة يحتوي رقمًا غير دقيق؛ تم رفضه لحماية الحسابات.");
  } else if (Array.isArray(value)) {
    for (const item of value) verifySafeNumbers(item, depth + 1, limit);
  } else if (isRecord(value)) {
    for (const item of Object.values(value)) verifySafeNumbers(item, depth + 1, limit);
  }
}

export async function inspectLocalPortableBackup(raw: string): Promise<LocalBackupInspection> {
  assertValid(new TextEncoder().encode(raw).byteLength <= MAX_LOCAL_PREVIEW_BYTES,
    "ملف JSON يتجاوز 32 ميجابايت؛ استخدم مسار الاسترجاع الفني للملفات الكبيرة.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error("ملف JSON غير صالح أو تالف."); }
  assertValid(isRecord(parsed), "هذا ليس ملف نسخة JSON مدعومًا.");
  const data = parsed;
  assertValid(data.format === "1-mohamed-portable-data-backup" && data.format_version === 1,
    "نوع النسخة غير مدعوم. هذه المعاينة تقبل JSON الصادر من زر نسخة بيانات التطبيق فقط.");
  assertValid(typeof data.created_at === "string" && !Number.isNaN(Date.parse(data.created_at)),
    "تاريخ النسخة غير صالح.");
  assertValid(typeof data.project_ref === "string" && /^[a-z]{20}$/.test(data.project_ref),
    "معرّف مصدر النسخة غير صالح.");
  assertValid(data.auth_users_included === false && data.auth_passwords_included === false
    && data.storage_objects_included === false, "ملف النسخة يعلن محتوى غير مسموح به.");
  assertValid(exactNames(data.tables_included, LOCAL_BACKUP_TABLES)
    && exactKeys(data.tables, LOCAL_BACKUP_TABLES)
    && exactKeys(data.row_counts, LOCAL_BACKUP_TABLES),
    "النسخة ناقصة أو تحتوي جداول غير متوقعة.");
  const counts = {} as Record<TableName, number>;
  let totalRows = 0;
  for (const table of LOCAL_BACKUP_TABLES) {
    const rows = (data.tables as Record<string, unknown>)[table];
    const count = (data.row_counts as Record<string, unknown>)[table];
    assertValid(Array.isArray(rows) && rows.every(isRecord), "صفوف جدول " + table + " غير صالحة.");
    assertValid(typeof count === "number" && Number.isSafeInteger(count) && count >= 0 && count === rows.length,
      "عدد سجلات جدول " + table + " لا يطابق محتواه.");
    counts[table] = count as number;
    totalRows += counts[table];
    assertValid(totalRows <= MAX_ROWS, "النسخة تتجاوز حد الفحص البالغ 50,000 سجل.");
  }
  verifySafeNumbers(data.tables);
  assertValid(typeof data.sha256 === "string" && /^[a-f0-9]{64}$/.test(data.sha256),
    "بصمة SHA-256 غير صالحة أو غير موجودة.");
  const { sha256, ...body } = data;
  assertValid(typeof globalThis.crypto?.subtle?.digest === "function",
    "التحقق من البصمة يحتاج متصفحًا يدعم Web Crypto في اتصال آمن.");
  const hash = await globalThis.crypto.subtle.digest("SHA-256",
    new TextEncoder().encode(JSON.stringify(body)));
  const actual = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  assertValid(actual === sha256,
    "بصمة الملف مختلفة: قد تكون البيانات تغيّرت بعد إنشاء النسخة. لم يتم استيراد شيء.");
  return {
    createdAt: data.created_at as string, sourceProject: data.project_ref as string,
    format: data.format as string, totalRows, counts, sha256: actual,
    includesAuth: false, restorableDirectly: false,
  };
}
