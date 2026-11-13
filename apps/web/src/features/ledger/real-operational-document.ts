import {
  assertOperationalReportDocument, type OperationalReportDocument
} from "@ledger/statement-export";
import { piastresToPounds } from "../../lib/ledger/amounts";
import { assertSqlMoney } from "../../lib/ledger/report-contract";
import {
  displayLedgerField, reportFields, type LedgerReportType, type LedgerLookups
} from "./report-presentation";

type SourceReport = {
  rows: Record<string, unknown>[];
  total_count?: string | number;
  next_cursor?: unknown;
  period_opening_piastres?: string;
  period_closing_piastres?: string;
  current_cash_balance_piastres?: string;
};

const tripColumns = [
  "id", "trip_date", "vehicle_id", "counterparty_contractor_id", "direction",
  "origin", "destination", "weight_milli_tonnes",
  "contractor_rate_piastres", "vehicle_rate_piastres", "expense_piastres",
  "contractor_total_piastres", "vehicle_total_piastres", "notes", "cancel_reason"
] as const;
const paymentColumns = [
  "id", "payment_date", "vehicle_id", "responsible_contractor_id",
  "amount_piastres", "notes", "cancel_reason"
] as const;

/** Full report exports are never produced from a truncated history page. */
export function isFullOperationalReport(report: SourceReport): boolean {
  const total = typeof report.total_count === "number" ?
    (Number.isSafeInteger(report.total_count) && report.total_count >= 0 ?
      BigInt(report.total_count) : null) :
    (typeof report.total_count === "string" && /^(0|[1-9][0-9]*)$/.test(report.total_count) ?
      BigInt(report.total_count) : null);
  return total !== null && Array.isArray(report.rows) &&
    total === BigInt(report.rows.length) && !report.next_cursor;
}

export function buildRealOperationalDocument(
  type: LedgerReportType, report: SourceReport,
  lookups: LedgerLookups, from: string, to: string, generatedAtLabel: string
): OperationalReportDocument {
  if (!isFullOperationalReport(report)) {
    throw new Error("حمّل كل صفحات التقرير قبل التصدير الكامل؛ لن نحذف حركات بصمت.");
  }
  const fields = reportFields(type);
  const keys: readonly string[] = type === "trips.list" ? tripColumns : paymentColumns;
  const columns = keys.map(key => {
    const field = fields.find(f => f.key === key);
    if (!field) throw new Error("تعريف عمود التقرير غير صالح.");
    return { label: field.title, widthWeight: ["notes", "origin", "destination"].includes(key) ? 1.4 : 1 };
  });
  const rows = report.rows.map(row =>
    keys.map(key => displayLedgerField(key, row[key], lookups)));
  const metrics: { label: string; value: string }[] = [
    { label: "عدد السجلات", value: String(report.total_count) }
  ];
  if (type === "payments.list") {
    for (const [key, title] of [
      ["period_opening_piastres", "رصيد أول الفترة"],
      ["period_closing_piastres", "رصيد آخر الفترة"],
      ["current_cash_balance_piastres", "الرصيد الحالي"]
    ] as const) {
      const value = report[key];
      if (value !== undefined) {
        assertSqlMoney(value);
        metrics.push({ label: title, value: piastresToPounds(value) + " ج.م" });
      }
    }
  }
  const document: OperationalReportDocument = {
    businessName: "أحمد أبو علي — حسابات النقل",
    title: type === "trips.list" ? "تقرير النقلات" : "تقرير مدفوعات العربية",
    subtitle: "بيانات من دفتر الحسابات المحفوظ، وليست من النسخة التجريبية",
    generatedAtLabel,
    metadata: [
      { label: "من تاريخ", value: from },
      { label: "إلى تاريخ", value: to },
      { label: "حالة البيانات", value: "كل سجلات الفترة المحددة محمّلة" }
    ],
    summarySections: [{ title: "ملخص الفترة", metrics }],
    columns, rows,
    emptyMessage: "لا توجد حركات في الفترة المحددة.",
    footerNotes: [
      "الأرصدة مأخوذة من SQL كما هي؛ لا يُعاد حسابها داخل ملف التصدير.",
      "التصدير التفصيلي CSV يشمل أيضًا الحقول التقنية مثل حالة الإلغاء ورقم الإصدار."
    ]
  };
  assertOperationalReportDocument(document);
  return document;
}
