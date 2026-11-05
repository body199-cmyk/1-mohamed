import type { DemoTripRecord, DemoPayment, DemoVehicleCashOpening } from "../../demo/demo-types";
import { validOpeningDate } from "../master-data/master-data-validation";
import { buildCashLedger, type CashCheck, type CashLedgerRow } from "../payments/cash-ledger";

export interface VehicleCashReport {
  readonly vehicleId: string;
  readonly responsibleContractorId: string;
  readonly from: string;
  readonly to: string;
  readonly openingPiastres: string;
  readonly workPiastres: string;
  readonly paidPiastres: string;
  readonly closingPiastres: string;
  readonly tripCount: number;
  readonly paymentCount: number;
  readonly rows: readonly CashLedgerRow[];
}

/**
 * T08.4/T08.5 — one period-shaped projection of the existing payment cash
 * ledger, NOT another financial engine. Work and cash remain strictly separate
 * from contractor work-difference statements.
 */
export function buildVehicleCashReport(
  source: {
    readonly trips: readonly DemoTripRecord[];
    readonly payments: readonly DemoPayment[];
    readonly cashOpenings: readonly DemoVehicleCashOpening[];
  },
  filter: { readonly vehicleId: string; readonly responsibleContractorId: string;
    readonly from: string; readonly to: string }
): CashCheck<VehicleCashReport> {
  if (!validOpeningDate(filter.from) || !validOpeningDate(filter.to) || filter.from > filter.to) {
    return { ok: false, error: "تاريخ بداية أو نهاية الفترة غير صحيح، أو النهاية تسبق البداية." };
  }
  if (!filter.vehicleId || !filter.responsibleContractorId) {
    return { ok: false, error: "اختر العربية والمقاول المسؤول عن النقد." };
  }

  const cashOpening = source.cashOpenings.find(o =>
    o.vehicleId === filter.vehicleId && o.contractorId === filter.responsibleContractorId
  );
  if (cashOpening && filter.from < cashOpening.startDate) {
    return { ok: false, error: "بداية الكشف تسبق تاريخ افتتاحي النقد لهذا الحساب." };
  }

  const ledger = buildCashLedger(
    source, filter.vehicleId, filter.responsibleContractorId, filter.to
  );
  if (!ledger.ok) return ledger;

  // The balance AFTER the last movement before "from" is the opening balance
  // for this report. No opening cash is counted a second time.
  const earlier = ledger.value.rows.filter(row => row.date < filter.from);
  const opening = earlier.length
    ? earlier[earlier.length - 1]!.balancePiastres
    : ledger.value.openingPiastres;

  const rows = ledger.value.rows.filter(row => row.date >= filter.from);
  let work = 0n;
  let paid = 0n;
  for (const row of rows) {
    if (row.type === "WORK") work += BigInt(row.amountPiastres);
    else paid -= BigInt(row.amountPiastres);
  }

  const closing = BigInt(ledger.value.balancePiastres);
  if (BigInt(opening) + work - paid !== closing) {
    return { ok: false, error: "بيانات الكشف لا تتطابق مع الرصيد؛ تم إيقاف التقرير." };
  }

  return { ok: true, value: {
    vehicleId: filter.vehicleId, responsibleContractorId: filter.responsibleContractorId,
    from: filter.from, to: filter.to,
    openingPiastres: opening, workPiastres: work.toString(), paidPiastres: paid.toString(),
    closingPiastres: closing.toString(),
    tripCount: rows.filter(row => row.type === "WORK").length,
    paymentCount: rows.filter(row => row.type === "PAYMENT").length,
    rows,
  } };
}
