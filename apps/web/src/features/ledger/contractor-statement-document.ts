import type { ContractorStatementDocument } from "@ledger/statement-export";
import { piastresToPounds } from "../../lib/ledger/amounts";
import { assertSqlMoney } from "../../lib/ledger/report-contract";

export type LiveStatementRow = {
  id: string; trip_date: string; vehicle_id: string;
  origin: string | null; destination: string | null; notes: string | null;
  direction: "AHMED_SUPPLIES" | "OTHER_SUPPLIES";
  weight_milli_tonnes: string; contractor_total_piastres: string;
  signed_delta_piastres: string; running_balance_piastres: string;
};

export type LiveStatementReport = {
  status: string;
  counterparty_contractor_id: string;
  date_from: string; date_to: string;
  opening_balance_piastres: string;
  ahmed_work_piastres: string;
  counterparty_work_piastres: string;
  closing_balance_piastres: string;
  beneficiary: "AHMED" | "COUNTERPARTY" | "BALANCED";
  balance_magnitude_piastres: string;
  total_count: string;
  next_cursor: { date: string; id: string } | null;
  rows: LiveStatementRow[];
};

const signed = (value: string): string => {
  assertSqlMoney(value);
  return (BigInt(value) > 0n ? "+" : "") + piastresToPounds(value) + " ج.م";
};

export function verifyLiveStatement(report: LiveStatementReport): void {
  if (report.status !== "OK" || !Array.isArray(report.rows) ||
      !/^[0-9]+$/.test(report.total_count)) {
    throw new Error("كشف حساب غير صالح من قاعدة البيانات.");
  }
  const count = BigInt(report.total_count);
  if (count < BigInt(report.rows.length)) throw new Error("عدد قيود الكشف غير متسق.");
  for (const key of ["opening_balance_piastres", "ahmed_work_piastres",
    "counterparty_work_piastres", "closing_balance_piastres",
    "balance_magnitude_piastres"] as const) {
    assertSqlMoney(report[key]);
  }
  const opening = BigInt(report.opening_balance_piastres);
  const ahmed = BigInt(report.ahmed_work_piastres);
  const other = BigInt(report.counterparty_work_piastres);
  const closing = BigInt(report.closing_balance_piastres);
  if (opening + ahmed - other !== closing ||
      (closing > 0n ? "AHMED" : closing < 0n ? "COUNTERPARTY" : "BALANCED") !== report.beneficiary ||
      (closing < 0n ? -closing : closing).toString() !== report.balance_magnitude_piastres) {
    throw new Error("كشف الحساب غير متطابق ماليًا؛ تم إيقاف العرض والتصدير.");
  }
  // A complete loaded history must reconcile every running balance.
  if (BigInt(report.rows.length) === count) {
    let running = opening;
    for (const row of report.rows) {
      assertSqlMoney(row.signed_delta_piastres);
      assertSqlMoney(row.running_balance_piastres);
      assertSqlMoney(row.contractor_total_piastres);
      if (row.direction !== "AHMED_SUPPLIES" && row.direction !== "OTHER_SUPPLIES") {
        throw new Error("اتجاه نقلة غير صالح في كشف الحساب.");
      }
      const delta = BigInt(row.signed_delta_piastres);
      if (delta !== (row.direction === "AHMED_SUPPLIES" ?
          BigInt(row.contractor_total_piastres) : -BigInt(row.contractor_total_piastres))) {
        throw new Error("قيمة حركة غير متطابقة في كشف الحساب.");
      }
      running += delta;
      if (running !== BigInt(row.running_balance_piastres)) {
        throw new Error("الرصيد التراكمي غير متطابق؛ تم إيقاف التصدير.");
      }
    }
    if (running !== closing) throw new Error("رصيد الإقفال لا يساوي آخر رصيد تراكمي.");
  }
}

export function assertSameStatementSnapshot(previous: LiveStatementReport,
  next: LiveStatementReport): void {
  for (const key of ["counterparty_contractor_id", "date_from", "date_to",
    "opening_balance_piastres", "ahmed_work_piastres", "counterparty_work_piastres",
    "closing_balance_piastres", "total_count", "beneficiary"] as const) {
    if (previous[key] !== next[key]) {
      throw new Error("تغير كشف الحساب أثناء تحميل الصفحات. أعد تحميل الكشف من البداية.");
    }
  }
}

export function liveStatementDocument(report: LiveStatementReport, name: string,
  generatedAtLabel: string): ContractorStatementDocument {
  verifyLiveStatement(report);
  if (report.next_cursor || BigInt(report.total_count) !== BigInt(report.rows.length)) {
    throw new Error("حمّل كل صفحات الكشف قبل التصدير؛ لا نصدّر كشفًا ناقصًا.");
  }
  return {
    businessName: "أحمد أبو علي — كشف حساب المقاول",
    counterpartyName: name,
    period: { from: report.date_from, to: report.date_to },
    generatedAtLabel,
    summary: {
      openingBalanceText: signed(report.opening_balance_piastres),
      ahmedWorkText: signed(report.ahmed_work_piastres),
      counterpartyWorkText: "-" + piastresToPounds(report.counterparty_work_piastres) + " ج.م",
      closingBalanceText: signed(report.closing_balance_piastres),
      closingBeneficiaryText: report.beneficiary === "AHMED" ? "لصالح أحمد أبو علي" :
        report.beneficiary === "COUNTERPARTY" ? "لصالح " + name : "الحساب متعادل",
      movementCountText: report.total_count
    },
    rows: report.rows.map(row => ({
      reference: row.id,
      workDate: row.trip_date,
      directionText: row.direction === "AHMED_SUPPLIES" ?
        "أحمد جاب العربيات لشغل المقاول" : "المقاول جاب العربيات لشغل أحمد",
      amountText: signed(row.signed_delta_piastres),
      runningBalanceText: signed(row.running_balance_piastres)
    }))
  };
}
