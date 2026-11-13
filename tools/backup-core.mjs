/**
 * H054 / T10.1 and isolated T10.4: versioned, fully checked BUSINESS snapshot.
 *
 * Server-only core. No storage provider, schedule, Supabase connection or
 * authorization bypass. The app_owner row, auth.users, secrets and backups
 * themselves are intentionally NOT part of the business archive.
 *
 * SHA256 detects unintended file damage, not malicious replacement by a party
 * who can rewrite both the data and checksum. External authenticated storage,
 * signature/encryption, physical durability and retention remain D07/T10.2+.
 */
import { createHash, randomUUID } from "node:crypto";

export const BACKUP_FORMAT = "transport-ledger-business-snapshot";
export const BACKUP_VERSION = 1;
export const BACKUP_TABLES = Object.freeze([
  "contractors", "vehicles", "vehicle_accounts", "opening_balances",
  "trips", "payments", "audit_log", "idempotency_keys",
]);
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_ROWS = 50000;
const MAX_DEPTH = 32;
const I64_MAX = 9223372036854775807n;
const I64_MIN = -9223372036854775808n;

const COLUMNS = {
  contractors: ["id","name","is_primary","is_archived","version","created_at","updated_at"],
  vehicles: ["id","plate_number","driver_name","notes","is_archived","version","created_at","updated_at"],
  vehicle_accounts: ["vehicle_id","contractor_id","created_at","last_activity_at"],
  opening_balances: ["id","balance_type","contractor_id","vehicle_id","start_date",
    "signed_piastres","notes","is_cancelled","cancel_reason","cancelled_at",
    "version","created_at","updated_at"],
  trips: ["id","vehicle_id","counterparty_contractor_id","responsible_contractor_id",
    "direction","trip_date","weight_milli_tonnes","contractor_rate_piastres",
    "vehicle_rate_piastres","same_rate","expense_piastres",
    "contractor_total_piastres","vehicle_total_piastres",
    "origin","destination","receipt_number","notes","is_cancelled","cancel_reason",
    "cancelled_at","version","created_at","updated_at"],
  payments: ["id","vehicle_id","responsible_contractor_id","payment_date",
    "amount_piastres","linked_trip_id","receipt_number","notes","is_cancelled",
    "cancel_reason","cancelled_at","version","created_at","updated_at"],
  audit_log: ["id","entity_type","entity_id","action","reason","old_data",
    "new_data","diff","financial_impact","performed_by","created_at"],
  idempotency_keys: ["key","user_id","operation","payload_hash","status",
    "response_status","response_body","created_at","updated_at"],
};
const REQUIRED = {
  contractors: ["id","name","is_primary","is_archived"],
  vehicles: ["id","plate_number","is_archived"],
  vehicle_accounts: ["vehicle_id","contractor_id"],
  opening_balances: ["id","balance_type","contractor_id","vehicle_id",
    "start_date","signed_piastres","is_cancelled","version"],
  trips: ["id","vehicle_id","counterparty_contractor_id",
    "responsible_contractor_id","direction","trip_date","weight_milli_tonnes",
    "contractor_rate_piastres","vehicle_rate_piastres","same_rate",
    "expense_piastres","contractor_total_piastres","vehicle_total_piastres",
    "is_cancelled","version"],
  payments: ["id","vehicle_id","responsible_contractor_id","payment_date",
    "amount_piastres","is_cancelled","version"],
  audit_log: ["id","entity_type","entity_id","action","performed_by"],
  idempotency_keys: ["key","user_id","operation","payload_hash","status"],
};
const KEY = {
  contractors: row => row.id,
  vehicles: row => row.id,
  vehicle_accounts: row => row.vehicle_id + "|" + row.contractor_id,
  opening_balances: row => row.id,
  trips: row => row.id,
  payments: row => row.id,
  audit_log: row => String(row.id),
  idempotency_keys: row => row.key,
};

function fail(message) { throw new Error("BACKUP_INVALID: " + message); }
function plain(obj) {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj) &&
    (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
}
function jsonCheck(value, depth = 0) {
  if (depth > MAX_DEPTH) fail("البيانات متداخلة بعمق غير مقبول.");
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "string") {
    if (value.length > 120000 || /[\u0000-\u0008]/.test(value)) fail("قيمة نصية غير صالحة.");
    return;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("الأرقام يجب أن تكون أعدادًا صحيحة آمنة؛ أموال القروش نصوص.");
    return;
  }
  if (Array.isArray(value)) {
    for (const row of value) jsonCheck(row, depth + 1);
    return;
  }
  if (!plain(value)) fail("بنية JSON غير معتمدة.");
  for (const [key, item] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") fail("مفتاح JSON غير آمن.");
    jsonCheck(item, depth + 1);
  }
}
function canonical(value) {
  jsonCheck(value);
  function visit(v) {
    if (Array.isArray(v)) return "[" + v.map(visit).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map(k =>
        JSON.stringify(k) + ":" + visit(v[k])
      ).join(",") + "}";
    }
    return JSON.stringify(v);
  }
  return visit(value);
}
function clone(value) { return JSON.parse(canonical(value)); }
function string(row, field) {
  return typeof row[field] === "string" && row[field].trim().length > 0 &&
    row[field].length <= 2048;
}
function int64(row, field, positive = false, unsigned = false) {
  const v = row[field];
  if (typeof v !== "string" || !/^-?(0|[1-9]\d*)$/.test(v)) return false;
  const b = BigInt(v);
  return b >= (unsigned ? 0n : I64_MIN) && b <= I64_MAX && (!positive || b > 0n);
}
function date(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(value + "T00:00:00Z").toISOString().startsWith(value);
}
function flag(row,field) { return typeof row[field] === "boolean"; }
function cancelValid(row) {
  if (!flag(row,"is_cancelled")) return false;
  if (!row.is_cancelled) return row.cancel_reason == null && row.cancelled_at == null;
  return string(row,"cancel_reason") &&
    typeof row.cancelled_at === "string" && !Number.isNaN(Date.parse(row.cancelled_at));
}
function requireValid(ok, description) { if (!ok) fail(description); }

export function verifyBusinessDataset(data) {
  requireValid(plain(data), "جداول النسخة ليست كائنًا.");
  const names = Object.keys(data).sort();
  requireValid(names.length === BACKUP_TABLES.length &&
    names.every((n,i) => n === [...BACKUP_TABLES].sort()[i]),
    "النسخة يجب أن تحتوي كل جداول الأعمال الثمانية بلا زيادة أو نقص.");
  let totalRows = 0;
  const index = {};
  for (const table of BACKUP_TABLES) {
    const rows = data[table];
    requireValid(Array.isArray(rows), "جدول غير موجود: " + table);
    totalRows += rows.length;
    requireValid(totalRows <= MAX_ROWS, "النسخة أكبر من حد محرك الاختبار المعزول.");
    const keys = new Set();
    for (const row of rows) {
      requireValid(plain(row), "صف غير صالح في " + table);
      jsonCheck(row);
      requireValid(Object.keys(row).every(f => COLUMNS[table].includes(f)),
        "حقل مجهول أو غير آمن في " + table);
      requireValid(REQUIRED[table].every(f => Object.hasOwn(row,f) &&
        (row[f] !== null || (table === "opening_balances" && f === "vehicle_id"))),
        "حقل إلزامي ناقص في " + table);
      const key = KEY[table](row);
      requireValid(typeof key === "string" && key.length > 0 && !keys.has(key),
        "معرف مكرر أو فارغ في " + table);
      keys.add(key);
    }
    index[table] = keys;
  }

  const contractors = new Map(data.contractors.map(x => [x.id,x]));
  const vehicles = index.vehicles;
  const accounts = index.vehicle_accounts;
  const tripIds = index.trips;
  const primary = data.contractors.filter(c => c.is_primary === true);
  requireValid(primary.length <= 1, "يوجد أكثر من مقاول أساسي.");
  for (const c of data.contractors) {
    requireValid(string(c,"id") && string(c,"name") &&
      flag(c,"is_primary") && flag(c,"is_archived") &&
      !(c.is_primary && c.is_archived) &&
      (c.version === undefined || (Number.isSafeInteger(c.version) && c.version >= 1)),
      "مقاول غير صالح.");
  }
  for (const v of data.vehicles) {
    requireValid(string(v,"id") && string(v,"plate_number") && flag(v,"is_archived") &&
      (v.version === undefined || (Number.isSafeInteger(v.version) && v.version >= 1)),
      "عربية غير صالحة.");
  }
  for (const a of data.vehicle_accounts) {
    requireValid(vehicles.has(a.vehicle_id) && contractors.has(a.contractor_id),
      "حساب نقد عربية يشير إلى مقاول أو عربية مفقودة.");
  }
  const activeCashOpenings = new Set();
  const activeContractorOpenings = new Set();
  for (const o of data.opening_balances) {
    requireValid(string(o,"id") && contractors.has(o.contractor_id) &&
      date(o.start_date) && int64(o,"signed_piastres") &&
      Number.isSafeInteger(o.version) && o.version >= 1 &&
      cancelValid(o), "رصيد افتتاحي غير صالح.");
    requireValid(o.balance_type === "CONTRACTOR_WORK" ?
      o.vehicle_id == null :
      o.balance_type === "VEHICLE_CASH" && vehicles.has(o.vehicle_id) &&
        accounts.has(o.vehicle_id + "|" + o.contractor_id),
      "نوع الافتتاحي أو علاقة الحساب غير صحيحة.");
    if (!o.is_cancelled) {
      const cash = o.balance_type === "VEHICLE_CASH";
      const key = cash ? o.vehicle_id + "|" + o.contractor_id : o.contractor_id;
      const registry = cash ? activeCashOpenings : activeContractorOpenings;
      requireValid(!registry.has(key),
        "أكثر من رصيد افتتاحي نشط لنفس حساب الشغل أو النقد.");
      registry.add(key);
    }
  }
  for (const t of data.trips) {
    requireValid(string(t,"id") && vehicles.has(t.vehicle_id) &&
      contractors.has(t.counterparty_contractor_id) &&
      contractors.has(t.responsible_contractor_id) &&
      accounts.has(t.vehicle_id + "|" + t.responsible_contractor_id) &&
      date(t.trip_date) && flag(t,"same_rate") &&
      Number.isSafeInteger(t.version) && t.version >= 1 && cancelValid(t),
      "علاقة أو تاريخ نقلة غير صحيح.");
    requireValid(t.direction === "AHMED_SUPPLIES" ?
      primary.length === 1 && t.responsible_contractor_id === primary[0].id :
      t.direction === "OTHER_SUPPLIES" &&
        t.responsible_contractor_id === t.counterparty_contractor_id,
      "المسؤول النقدي في النقلة لا يطابق اتجاهها.");
    for (const field of ["weight_milli_tonnes","contractor_rate_piastres",
      "vehicle_rate_piastres","expense_piastres",
      "contractor_total_piastres","vehicle_total_piastres"]) {
      requireValid(int64(t,field,field === "weight_milli_tonnes",
        field !== "weight_milli_tonnes"), "رقم نقلة غير صالح: " + field);
    }
    const weight = BigInt(t.weight_milli_tonnes),expense=BigInt(t.expense_piastres);
    const due = rate => (weight * BigInt(rate) + 500n) / 1000n + expense;
    requireValid(!t.same_rate || t.contractor_rate_piastres === t.vehicle_rate_piastres,
      "ربط السعرين يخالف البيانات.");
    requireValid(due(t.contractor_rate_piastres) === BigInt(t.contractor_total_piastres) &&
      due(t.vehicle_rate_piastres) === BigInt(t.vehicle_total_piastres),
      "إجمالي نقلة لا يتطابق مع الوزن والسعر والمصاريف.");
  }
  for (const p of data.payments) {
    requireValid(string(p,"id") && vehicles.has(p.vehicle_id) &&
      contractors.has(p.responsible_contractor_id) &&
      accounts.has(p.vehicle_id + "|" + p.responsible_contractor_id) &&
      (p.linked_trip_id == null || tripIds.has(p.linked_trip_id)) &&
      date(p.payment_date) && int64(p,"amount_piastres",true,true) &&
      Number.isSafeInteger(p.version) && p.version >= 1 && cancelValid(p),
      "دفعة أو علاقة حسابها غير صالحة.");
    // The optional linked trip may have changed contractor since the payment
    // was created (D13); preserve it as descriptive history, not allocation.
  }
  for (const a of data.audit_log) {
    requireValid((typeof a.id === "string" && /^\d+$/.test(a.id)) ||
      (Number.isSafeInteger(a.id) && a.id > 0), "معرف سجل تدقيق غير صالح.");
    requireValid(string(a,"entity_type") && string(a,"entity_id") &&
      string(a,"action") && string(a,"performed_by"), "أثر تدقيق ناقص.");
  }
  for (const k of data.idempotency_keys) {
    requireValid(string(k,"key") && string(k,"user_id") && string(k,"operation") &&
      typeof k.payload_hash === "string" &&
      /^[a-fA-F0-9]{64}$/.test(k.payload_hash) &&
      ["PROCESSING","COMPLETED","FAILED"].includes(k.status),
      "معرف طلب أو حالته غير صحيح.");
  }
  return Object.freeze(Object.fromEntries(
    BACKUP_TABLES.map(table => [table, data[table].length])
  ));
}

function hash(value) {
  return createHash("sha256").update(canonical(value),"utf8").digest("hex");
}

export function createBusinessBackup(dataset, {
  backupId = randomUUID(),
  createdAt = new Date().toISOString(),
  sourceEpoch = 0,
} = {}) {
  const counts = verifyBusinessDataset(dataset);
  requireValid(typeof backupId === "string" && /^[0-9a-f-]{36}$/i.test(backupId),
    "معرف النسخة غير صالح.");
  requireValid(typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt)),
    "تاريخ النسخة غير صالح.");
  requireValid(Number.isSafeInteger(sourceEpoch) && sourceEpoch >= 0,
    "جيل البيانات غير صالح.");
  const body = { format: BACKUP_FORMAT, version: BACKUP_VERSION,
    backupId, createdAt, sourceEpoch, counts, data: clone(dataset) };
  const digest = hash(body);
  return Object.freeze({ ...body, sha256: digest });
}

export function serializeBusinessBackup(backup) {
  verifyBusinessBackup(backup);
  const content = canonical(backup);
  requireValid(Buffer.byteLength(content,"utf8") <= MAX_BYTES, "ملف النسخة تجاوز الحد.");
  return content;
}

export function verifyBusinessBackup(raw) {
  if (typeof raw === "string") {
    requireValid(Buffer.byteLength(raw,"utf8") <= MAX_BYTES, "ملف النسخة تجاوز الحد.");
    try { raw = JSON.parse(raw); } catch { fail("ملف النسخة ليس JSON صالحًا."); }
  }
  requireValid(plain(raw), "غلاف النسخة غير صالح.");
  requireValid(Object.keys(raw).sort().join("|") ===
    ["backupId","counts","createdAt","data","format","sha256","sourceEpoch","version"].sort().join("|"),
    "غلاف النسخة ناقص أو يحتوي حقولًا غير معتمدة.");
  requireValid(raw.format === BACKUP_FORMAT && raw.version === BACKUP_VERSION,
    "نوع النسخة أو إصدارها غير مدعوم.");
  requireValid(typeof raw.backupId === "string" && /^[0-9a-f-]{36}$/i.test(raw.backupId) &&
    typeof raw.createdAt === "string" && !Number.isNaN(Date.parse(raw.createdAt)) &&
    Number.isSafeInteger(raw.sourceEpoch) && raw.sourceEpoch >= 0,
    "معلومات النسخة غير صالحة.");
  const counts = verifyBusinessDataset(raw.data);
  requireValid(plain(raw.counts) &&
    canonical(raw.counts) === canonical(counts),
    "أعداد سجلات النسخة لا تطابق البيانات.");
  const {sha256, ...body} = raw;
  requireValid(typeof sha256 === "string" && /^[a-f0-9]{64}$/.test(sha256) &&
    hash(body) === sha256, "بصمة SHA-256 للنسخة لا تطابق محتواها.");
  return { backupId:raw.backupId, createdAt:raw.createdAt,
    sourceEpoch:raw.sourceEpoch, counts, data:clone(raw.data), sha256 };
}

/**
 * TEST ONLY. In-memory atomic pointer swap is NOT PostgreSQL transactional
 * recovery and MUST NOT be wired as a production restore endpoint.
 *
 * saveSafety must acknowledge a verified pre-restore safety snapshot BEFORE
 * any replacement. Caller supplies authenticated authorization out-of-band;
 * this class requires an explicit true flag and a matching epoch. The real
 * implementation must independently verify owner, durable safety copy and
 * exclusive DB transaction, including in-flight financial requests (B07/B08).
 */
export class IsolatedRestoreStore {
  #data;
  #epoch;
  constructor(dataset, epoch=0) {
    verifyBusinessDataset(dataset);
    requireValid(Number.isSafeInteger(epoch) && epoch>=0, "جيل غير صالح.");
    this.#data=clone(dataset);
    this.#epoch=epoch;
  }
  get epoch() { return this.#epoch; }
  read() { return clone(this.#data); }
  write(expectedEpoch, replaceFn) {
    requireValid(this.#epoch===expectedEpoch, "الجيل تغيّر؛ ارفض طلب تعديل قديم.");
    requireValid(typeof replaceFn==="function", "عملية تعديل غير صالحة.");
    const proposed=this.read();
    replaceFn(proposed);
    verifyBusinessDataset(proposed);
    this.#data=clone(proposed);
    // A financial request must capture and return this generation token.
    return this.#epoch;
  }
  async restore(raw, {
    authorized=false, expectedEpoch, saveSafety, beforeCommit,
  }={}) {
    requireValid(authorized===true, "الاسترجاع ممنوع لغير المصرح.");
    requireValid(this.#epoch===expectedEpoch, "جيل الاسترجاع قديم.");
    requireValid(typeof saveSafety==="function", "نسخة الحماية المسبقة إلزامية.");
    const restored=verifyBusinessBackup(raw); // Never mutate before this.
    const replacement=clone(restored.data);
    const safety=createBusinessBackup(this.#data,{sourceEpoch:this.#epoch});
    const verifiedSafety=verifyBusinessBackup(safety);
    const acknowledged=await saveSafety(serializeBusinessBackup(safety),verifiedSafety);
    requireValid(acknowledged===true,"فشل حفظ نسخة الحماية؛ الاسترجاع ممنوع.");
    if (beforeCommit) await beforeCommit();
    requireValid(this.#epoch===expectedEpoch, "تغيّر الجيل أثناء تجهيز الاسترجاع.");
    // One synchronous swap; no partial table-by-table state is ever exposed.
    this.#data=replacement;
    this.#epoch+=1;
    return { restoredBackupId:restored.backupId,
      restoredCounts:restored.counts,
      safetyBackupId:safety.backupId,
      newEpoch:this.#epoch };
  }
}
