/**
 * Explicit allowlist of audited, owner-gated PostgreSQL RPC operations.
 * No arbitrary function names, table mutations or client-supplied SQL.
 * The final activation must verify the deployed migration grants and RLS.
 */
export const WRITE_OPERATIONS = {
  "contractor.create": "app_op_contractor_create",
  "contractor.update": "app_op_contractor_update",
  "contractor.archive": "app_op_contractor_set_archived",
  "vehicle.create": "app_op_vehicle_create",
  "vehicle.update": "app_op_vehicle_update",
  "vehicle.archive": "app_op_vehicle_set_archived",
  "vehicle.account.ensure": "app_op_vehicle_account_ensure",
  "opening.create": "app_op_opening_balance_create",
  "trip.create": "app_op_trip_create",
  "trip.update": "app_op_trip_update",
  "trip.cancel": "app_op_trip_cancel",
  "payment.create": "app_op_payment_create",
  "payment.update": "app_op_payment_update",
  "payment.cancel": "app_op_payment_cancel",
} as const;

export const READ_OPERATIONS = {
  "trips.list": "app_op_trips_read",
  "payments.list": "app_op_payments_read",
  "contractor.statement": "app_op_contractor_statement_read",
} as const;

export type WriteOperation = keyof typeof WRITE_OPERATIONS;
export type ReadOperation = keyof typeof READ_OPERATIONS;

export function isWriteOperation(value: unknown): value is WriteOperation {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(WRITE_OPERATIONS, value);
}
export function isReadOperation(value: unknown): value is ReadOperation {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(READ_OPERATIONS, value);
}
export function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validRequestKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 128
    && /^[a-zA-Z0-9:_-]+$/.test(value);
}

/**
 * Generate the key ONCE per user action and reuse on retries. Never generate
 * a new key automatically after a network timeout: that risks double posting.
 */
export function createOperationRequest(operation: WriteOperation, payload: Record<string, unknown>,
  key: string) {
  if (!validRequestKey(key)) throw new Error("Invalid idempotency key");
  return { operation, requestKey: key, payload };
}
