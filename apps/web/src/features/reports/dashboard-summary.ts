import type { DemoTripRecord, DemoPayment } from "../../demo/demo-types";
import { buildDailyWorkReport, type DailyWorkReport } from "./daily-work-report";

/**
 * T08.6/H051 — day-scoped operational KPIs only. Not a contractor net
 * balance and not a total of unrelated vehicle cash accounts.
 * All work figures come from the original daily report/accounting engine.
 */
export type DashboardSummary =
  | { readonly ok: true;
      readonly work: Extract<DailyWorkReport, { readonly ok: true }>;
      readonly paymentCount: number;
      readonly paidPiastres: string;
      readonly date: string; }
  | { readonly ok: false; readonly error: string };

const MAX_DB_BIGINT = 9223372036854775807n;

export function buildDashboardSummary(
  trips: readonly DemoTripRecord[],
  payments: readonly DemoPayment[],
  date: string
): DashboardSummary {
  const work = buildDailyWorkReport(trips, {
    workDate: date, contractorId: "", vehicleId: ""
  });
  if (!work.ok) {
    return { ok: false, error: work.error === "INVALID_DATE"
      ? "تاريخ الملخص اليومي غير صحيح."
      : "تم إيقاف الملخص لأن إحدى النقلات لا تطابق محرك الحساب." };
  }

  const paidToday = payments.filter(p => !p.isCancelled && p.paymentDate === date);
  let paid = 0n;
  for (const p of paidToday) {
    // Stored money stays integer piastres, never floating-point.
    if (!/^[1-9][0-9]*$/.test(p.amountPiastres)) {
      return { ok: false, error: "مبلغ دفعة محفوظة غير صالح؛ لا يمكن عرض إجمالي اليوم." };
    }
    const amount = BigInt(p.amountPiastres);
    if (amount > MAX_DB_BIGINT) {
      return { ok: false, error: "مبلغ دفعة خارج الحد المالي المدعوم." };
    }
    paid += amount;
  }
  return { ok: true, work, paymentCount: paidToday.length, paidPiastres: paid.toString(), date };
}
