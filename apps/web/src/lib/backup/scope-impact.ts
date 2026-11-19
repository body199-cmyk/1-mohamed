/**
 * Read-only cancellation-scope PREVIEW on an already verified current
 * 12-table export. It NEVER authorizes or performs bulk cancellation.
 * Counts reveal possible dependencies; they are NOT financial balances.
 */
import { inspectLocalPortableBackup } from "./inspect-local";

export type ScopeSelection =
  | { kind: "day"; id: string }
  | { kind: "vehicle"; id: string }
  | { kind: "contractor"; id: string }
  | { kind: "all" };

type Row = Record<string, unknown>;
const isRow = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const active = (v: Row) => v.is_cancelled !== true;

export type ScopeImpact = {
  scope: ScopeSelection;
  tripCount: number;
  activeTripCount: number;
  alreadyCancelledTrips: number;
  linkedPayments: number;
  activePaymentsInScope: number;
  paymentsOnOtherDates: number;
  otherBusinessRecords: number;
  totalBusinessRecords: number;
  canDelete: false;
  canRestore: false;
  financialBalancesCalculated: false;
};

export async function inspectCancellationImpact(
  currentRaw: string, scope: ScopeSelection,
): Promise<ScopeImpact> {
  const verified = await inspectLocalPortableBackup(currentRaw);
  const data = JSON.parse(currentRaw) as { tables: Record<string, Row[]> };
  const trips = data.tables.trips.filter(isRow);
  const payments = data.tables.payments.filter(isRow);
  if (scope.kind === "day" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(scope.id) ||
       Number.isNaN(Date.parse(scope.id+"T00:00:00Z")) ||
       new Date(scope.id+"T00:00:00Z").toISOString().slice(0,10)!==scope.id)) {
    throw Error("التاريخ المطلوب غير صالح.");
  }
  if (scope.kind !== "all" && !scope.id.trim()) throw Error("اختر نطاقًا قبل معاينة التأثير.");
  const included = trips.filter(t =>
    scope.kind === "all" ||
    scope.kind === "day" && t.trip_date === scope.id ||
    scope.kind === "vehicle" && t.vehicle_id === scope.id ||
    scope.kind === "contractor" &&
      (t.responsible_contractor_id === scope.id || t.counterparty_contractor_id === scope.id));
  const selectedTripIds = new Set(included.filter(t=>typeof t.id==="string").map(t=>t.id));
  const linked = payments.filter(p=>typeof p.linked_trip_id==="string" &&
    selectedTripIds.has(p.linked_trip_id));
  const withinScope = payments.filter(p=>
    scope.kind === "all" ||
    scope.kind === "day" && (p.payment_date===scope.id || typeof p.linked_trip_id==="string" && selectedTripIds.has(p.linked_trip_id)) ||
    scope.kind === "vehicle" && p.vehicle_id===scope.id ||
    scope.kind === "contractor" && p.responsible_contractor_id===scope.id);
  const otherDates = withinScope.filter(p =>
    scope.kind === "day" && p.payment_date !== scope.id);
  const tracked = new Set(["trips", "payments"]);
  const otherBusinessRecords = Object.entries(verified.counts)
    .filter(([table])=>!tracked.has(table) && !["app_owner","app_members","backup_history","audit_log","idempotency_keys"].includes(table))
    .reduce((sum,[,n])=>sum+n,0);
  return {
    scope, tripCount: included.length,
    activeTripCount: included.filter(active).length,
    alreadyCancelledTrips: included.filter(t=>!active(t)).length,
    linkedPayments: linked.length,
    activePaymentsInScope: withinScope.filter(active).length,
    paymentsOnOtherDates: otherDates.length,
    otherBusinessRecords,
    totalBusinessRecords: verified.counts.trips+verified.counts.payments+otherBusinessRecords,
    canDelete: false, canRestore: false, financialBalancesCalculated: false,
  };
}
