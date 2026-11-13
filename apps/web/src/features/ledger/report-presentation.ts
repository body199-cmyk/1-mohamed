import { piastresToPounds, scaledIntegerToDecimal } from "../../lib/ledger/amounts";

export type LedgerReportType = "trips.list" | "payments.list";
export type LedgerReportField = { key: string; title: string };
export type LedgerLookups = {
  vehicles: ReadonlyMap<string, string>;
  contractors: ReadonlyMap<string, string>;
};

const tripFields: readonly LedgerReportField[] = [
  { key: "id", title: "رقم النقلة" },
  { key: "trip_date", title: "التاريخ" },
  { key: "vehicle_id", title: "العربية" },
  { key: "counterparty_contractor_id", title: "المقاول الطرف" },
  { key: "responsible_contractor_id", title: "المقاول المسؤول" },
  { key: "direction", title: "الاتجاه" },
  { key: "origin", title: "من" },
  { key: "destination", title: "إلى" },
  { key: "weight_milli_tonnes", title: "الوزن (طن)" },
  { key: "contractor_rate_piastres", title: "سعر المقاول (جنيه)" },
  { key: "vehicle_rate_piastres", title: "سعر العربية (جنيه)" },
  { key: "expense_piastres", title: "المصاريف (جنيه)" },
  { key: "contractor_total_piastres", title: "إجمالي المقاول (جنيه)" },
  { key: "vehicle_total_piastres", title: "إجمالي العربية (جنيه)" },
  { key: "notes", title: "ملاحظات" },
  { key: "is_cancelled", title: "الحالة" },
  { key: "cancel_reason", title: "سبب الإلغاء" },
  { key: "version", title: "الإصدار" }
];
const paymentFields: readonly LedgerReportField[] = [
  { key: "id", title: "رقم الدفعة" },
  { key: "payment_date", title: "التاريخ" },
  { key: "vehicle_id", title: "العربية" },
  { key: "responsible_contractor_id", title: "المقاول المسؤول" },
  { key: "amount_piastres", title: "المبلغ (جنيه)" },
  { key: "notes", title: "ملاحظات" },
  { key: "is_cancelled", title: "الحالة" },
  { key: "cancel_reason", title: "سبب الإلغاء" },
  { key: "version", title: "الإصدار" }
];

export function reportFields(type: LedgerReportType): readonly LedgerReportField[] {
  return type === "trips.list" ? tripFields : paymentFields;
}

export function displayLedgerField(key: string, value: unknown, lookups: LedgerLookups): string {
  if (value === null || value === undefined) return "";
  if (key === "is_cancelled") return value === true ? "ملغى" : value === false ? "نشط" : "غير معروف";
  if (key === "direction") return value === "AHMED_SUPPLIES" ? "أحمد المورّد" :
    value === "OTHER_SUPPLIES" ? "المقاول الآخر المورّد" : String(value);
  if (key === "vehicle_id" && typeof value === "string") return lookups.vehicles.get(value) ?? value;
  if ((key === "counterparty_contractor_id" || key === "responsible_contractor_id")
      && typeof value === "string") return lookups.contractors.get(value) ?? value;
  if (key === "weight_milli_tonnes" && typeof value === "string") {
    return scaledIntegerToDecimal(value, 3);
  }
  if (key.endsWith("_piastres") && typeof value === "string") return piastresToPounds(value);
  return String(value);
}

export function projectLedgerReport(type: LedgerReportType,
  records: readonly Record<string, unknown>[], lookups: LedgerLookups) {
  const fields = reportFields(type);
  return {
    headers: fields.map(f => f.title),
    rows: records.map(record => fields.map(f => displayLedgerField(f.key, record[f.key], lookups)))
  };
}
