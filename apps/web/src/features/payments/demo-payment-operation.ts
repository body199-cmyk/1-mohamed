import type {
  DemoContractor, DemoVehicle, DemoTripRecord, DemoVehicleCashOpening,
  DemoPayment, DemoPaymentAudit, DemoPaymentResult,
} from "../../demo/demo-types";
import { validateDemoPayment, type PaymentDraft } from "./cash-ledger";

export type PaymentOperationState = {
  readonly trips: readonly DemoTripRecord[];
  readonly payments: readonly DemoPayment[];
  readonly paymentAudit: readonly DemoPaymentAudit[];
  readonly cashOpenings: readonly DemoVehicleCashOpening[];
  readonly vehicles: readonly DemoVehicle[];
  readonly contractors: readonly DemoContractor[];
};
export type PaymentEditTransition =
  | { readonly ok: true; readonly payment: DemoPayment;
      readonly payments: readonly DemoPayment[];
      readonly audit: readonly DemoPaymentAudit[] }
  | { readonly ok: false; readonly error: string };

/** Deterministic transition used by DemoStore.editPayment, with no mutation on rejection. */
export function applyDemoPaymentEdit(
  state: PaymentOperationState, id: string, expectedVersion: number,
  reason: string, draft: PaymentDraft, today: string,
  nowIso: string
): PaymentEditTransition {
  const previous = state.payments.find(p => p.id === id);
  if (!previous || previous.isCancelled || previous.version !== expectedVersion || !reason.trim()) {
    return { ok:false, error:"الدفعة غير موجودة أو اتغير إصدارها، أو سبب التعديل غير مكتوب." };
  }
  const check = validateDemoPayment(state,draft,today,id);
  if (!check.ok) return check;
  const updated: DemoPayment = {
    ...previous,
    vehicleId:draft.vehicleId,
    responsibleContractorId:draft.responsibleContractorId,
    paymentDate:draft.paymentDate,amountPiastres:check.value,
    linkedTripId:draft.linkedTripId,receiptNumber:draft.receiptNumber.trim(),
    notes:draft.notes.trim(),version:previous.version+1,
  };
  const auditEntry: DemoPaymentAudit = {
    id,action:"update",reason:reason.trim(),
    before:JSON.stringify(previous),after:JSON.stringify(updated),at:nowIso,
  };
  return {
    ok:true,
    payment:updated,
    payments:state.payments.map(p => p.id === id ? updated : p),
    audit:[auditEntry,...state.paymentAudit],
  };
}
