import { calculateTripAmounts } from "@ledger/accounting";
import type {
  DemoContractor, DemoVehicle, DemoVehicleCashOpening, DemoTripRecord, DemoPayment,
} from "../../demo/demo-types";
import { normalizeArabicNumbers } from "../trips/arabic-number-normalizer";
import { validOpeningDate } from "../master-data/master-data-validation";

/** The primary Ahmed account is not a counterparty entry in DemoStore. */
export const DEMO_PRIMARY_RESPONSIBLE_ID = "PRIMARY_AHMED";
const MAX_PIASTRES = 9223372036854775807n;

export function cairoBusinessDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

export function parsePaymentEgp(input: string): string | null {
  const value = normalizeArabicNumbers(input.trim());
  if (value.length > 25 || !/^[0-9]+(\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return result > 0n && result <= MAX_PIASTRES ? result.toString() : null;
}

export function cashResponsibleForTrip(trip: DemoTripRecord): string {
  return trip.direction === "AHMED_SUPPLIES" ? DEMO_PRIMARY_RESPONSIBLE_ID : trip.counterpartyId;
}

export interface CashLedgerRow {
  readonly date: string;
  readonly id: string;
  readonly type: "WORK" | "PAYMENT";
  readonly amountPiastres: string;
  readonly balancePiastres: string;
  readonly label: string;
}

export interface CashLedger {
  readonly openingPiastres: string;
  readonly balancePiastres: string;
  readonly rows: readonly CashLedgerRow[];
}

export type CashCheck<T> = { readonly ok: true; readonly value: T } | {
  readonly ok: false; readonly error: string;
};
type CashSource = {
  trips: readonly DemoTripRecord[];
  payments: readonly DemoPayment[];
  cashOpenings: readonly DemoVehicleCashOpening[];
};

export function buildCashLedger(
  source: CashSource,
  vehicleId: string,
  responsibleId: string,
  asOf: string,
  excludePaymentId?: string
): CashCheck<CashLedger> {
  if (!validOpeningDate(asOf)) return { ok: false, error: "تاريخ التقييم غير صحيح." };
  const opening = source.cashOpenings.find(o => o.vehicleId === vehicleId && o.contractorId === responsibleId);
  if (opening && (!validOpeningDate(opening.startDate) || opening.startDate > asOf)) {
    return { ok: false, error: "تاريخ الافتتاحي لا يصلح لعرض هذا الحساب." };
  }
  let balance = 0n;
  try {
    balance = BigInt(opening?.signedPiastres ?? "0");
    if (balance > MAX_PIASTRES || balance < -MAX_PIASTRES) throw new Error("opening overflow");
  } catch {
    return { ok: false, error: "رصيد افتتاحي نقدي غير صالح." };
  }
  const movements: { date: string; id: string; type: "WORK" | "PAYMENT"; amount: bigint; label: string; createdAt: string }[] = [];
  for (const trip of source.trips) {
    if (trip.vehicleId !== vehicleId || cashResponsibleForTrip(trip) !== responsibleId) continue;
    if (!validOpeningDate(trip.workDate) || (opening && trip.workDate < opening.startDate)) {
      return { ok: false, error: "توجد نقلة بتاريخ يسبق بداية افتتاحي النقد؛ راجع الحساب." };
    }
    const result = calculateTripAmounts({
      weightTonnes: trip.weightTonnes, contractorRateEgp: trip.contractorRateEgp,
      vehicleRateEgp: trip.vehicleRateEgp, expenseEgp: trip.expenseEgp,
    });
    if (!result.ok || result.vehicleTotalPiastres !== trip.vehicleTotalPiastres) {
      return { ok: false, error: "مستحق نقلة لا يطابق محرك الحساب؛ تم إيقاف دفعات هذا الحساب." };
    }
    if (trip.workDate <= asOf) {
      movements.push({ date: trip.workDate, id: trip.id, type: "WORK",
        amount: BigInt(trip.vehicleTotalPiastres), label: "مستحق نقلة " + (trip.receiptNumber || trip.id),
        createdAt: trip.createdAt });
    }
  }
  for (const payment of source.payments) {
    if (payment.vehicleId !== vehicleId || payment.responsibleContractorId !== responsibleId
        || payment.isCancelled || payment.id === excludePaymentId) continue;
    if (!validOpeningDate(payment.paymentDate) || payment.paymentDate > asOf ||
        (opening && payment.paymentDate < opening.startDate)) {
      return { ok: false, error: "توجد دفعة بتاريخ غير صالح في الحساب؛ تم إيقاف الحفظ." };
    }
    let amount: bigint;
    try {
      amount = BigInt(payment.amountPiastres);
      if (amount <= 0n || amount > MAX_PIASTRES) throw new Error("payment bounds");
    } catch {
      return { ok: false, error: "مبلغ دفعة محفوظة غير صالح." };
    }
    movements.push({ date: payment.paymentDate, id: payment.id, type: "PAYMENT",
      amount: -amount, label: "دفعة " + (payment.receiptNumber || payment.id),
      createdAt: payment.createdAt });
  }
  movements.sort((a, b) => a.date.localeCompare(b.date) ||
    (a.type === b.type ? 0 : a.type === "WORK" ? -1 : 1) ||
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const rows: CashLedgerRow[] = [];
  for (const movement of movements) {
    balance += movement.amount;
    rows.push({ date: movement.date, id: movement.id, type: movement.type,
      amountPiastres: movement.amount.toString(), balancePiastres: balance.toString(),
      label: movement.label });
  }
  return { ok: true, value: {
    openingPiastres: opening?.signedPiastres ?? "0", balancePiastres: balance.toString(), rows,
  } };
}

export type PaymentDraft = {
  readonly vehicleId: string;
  readonly responsibleContractorId: string;
  readonly paymentDate: string;
  readonly amountEgp: string;
  readonly linkedTripId: string;
  readonly receiptNumber: string;
  readonly notes: string;
};

export function validateDemoPayment(
  source: CashSource & { readonly vehicles: readonly DemoVehicle[]; readonly contractors: readonly DemoContractor[] },
  draft: PaymentDraft, asOf: string, excludingPaymentId?: string
): CashCheck<string> {
  const vehicle = source.vehicles.find(v => v.id === draft.vehicleId);
  const contractor = source.contractors.find(c => c.id === draft.responsibleContractorId);
  if (!vehicle || vehicle.isArchived ||
      (draft.responsibleContractorId !== DEMO_PRIMARY_RESPONSIBLE_ID && (!contractor || contractor.isArchived))) {
    return { ok: false, error: "اختر عربية نشطة ومقاولًا مسؤولًا نشطًا." };
  }
  if (!validOpeningDate(draft.paymentDate) || draft.paymentDate > asOf) {
    return { ok: false, error: "تاريخ الدفعة يجب أن يكون صحيحًا ولا يتجاوز تاريخ اليوم بالقاهرة." };
  }
  const amountText = parsePaymentEgp(draft.amountEgp);
  if (!amountText) return { ok: false, error: "مبلغ الدفعة يجب أن يكون موجبًا، وبحد أقصى رقمين للقروش." };
  if (draft.linkedTripId) {
    const trip = source.trips.find(t => t.id === draft.linkedTripId);
    if (!trip || trip.vehicleId !== draft.vehicleId ||
        cashResponsibleForTrip(trip) !== draft.responsibleContractorId) {
      return { ok: false, error: "رابط النقلة لا ينتمي إلى حساب نقد العربية لدى هذا المقاول." };
    }
  }
  const base = buildCashLedger(source,draft.vehicleId,draft.responsibleContractorId,asOf,excludingPaymentId);
  if (!base.ok) return base;
  const before = base.value.rows.filter(r => r.date < draft.paymentDate);
  const candidates = [
    { date: draft.paymentDate, balance: (
      BigInt(before.length ? before[before.length-1]!.balancePiastres : base.value.openingPiastres)
      + base.value.rows.filter(r => r.date === draft.paymentDate && r.type === "WORK")
        .reduce((sum,r) => sum+BigInt(r.amountPiastres),0n)
    ) },
    ...base.value.rows.filter(r => r.date >= draft.paymentDate)
      .map(r => ({ date:r.date, balance:BigInt(r.balancePiastres) })),
    { date:asOf, balance:BigInt(base.value.balancePiastres) },
  ];
  const min = candidates.reduce((current, row) =>
    row.balance < current ? row.balance : current, candidates[0]!.balance);
  if (min < BigInt(amountText)) {
    return { ok: false, error: "D16: الدفعة هتسبب عجزًا في يوم داخل الفترة، أو تتجاوز المتبقي النقدي للعربية عند المقاول المسؤول." };
  }
  return { ok: true, value: amountText };
}
