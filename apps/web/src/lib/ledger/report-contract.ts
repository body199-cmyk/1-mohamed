/**
 * SQL-backed reports are never calculated from the old DemoStore.
 * The FIN-05 RPC returns exact decimal strings; do not coerce to Number.
 */
export type SqlMoney = string;
export type VehicleCashPeriod = {
  readonly period_opening_piastres: SqlMoney;
  readonly period_closing_piastres: SqlMoney;
  readonly current_cash_balance_piastres: SqlMoney;
  readonly cash_balance_piastres: SqlMoney;
  readonly total_count: number;
  readonly rows: readonly unknown[];
};

export function assertSqlMoney(value: unknown): asserts value is SqlMoney {
  if (typeof value !== "string" || !/^-?(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("Non-canonical money value from financial RPC");
  }
}

export function readVehicleCashPeriod(value: unknown): VehicleCashPeriod {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid vehicle cash report");
  }
  const report = value as Record<string, unknown>;
  for (const key of ["period_opening_piastres", "period_closing_piastres",
    "current_cash_balance_piastres", "cash_balance_piastres"]) {
    assertSqlMoney(report[key]);
  }
  if (!Number.isSafeInteger(report.total_count) || (report.total_count as number) < 0
      || !Array.isArray(report.rows)) throw new Error("Invalid report pagination");
  return report as VehicleCashPeriod;
}

/** Exact subtraction, including values beyond JS Number.MAX_SAFE_INTEGER. */
export function cashMovementForPeriod(report: VehicleCashPeriod): string {
  return (BigInt(report.period_closing_piastres) -
    BigInt(report.period_opening_piastres)).toString();
}
