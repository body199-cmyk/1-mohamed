export type MovementDirection = "AHMED_SUPPLIES" | "OTHER_SUPPLIES";

export type StatementBeneficiary = "AHMED" | "COUNTERPARTY" | "BALANCED";

export type StatementErrorCode =
  | "INVALID_ID"
  | "INVALID_DATE"
  | "INVALID_AMOUNT"
  | "INVALID_PERIOD"
  | "PERIOD_BEFORE_START"
  | "ACCOUNT_MISMATCH"
  | "MOVEMENT_BEFORE_START"
  | "DUPLICATE_MOVEMENT_ID";

export interface StatementOpeningInput {
  readonly startDate: string;
  readonly signedPiastres: string;
}

export interface StatementPeriodInput {
  readonly from: string;
  readonly to: string;
}

export interface ContractorMovementInput {
  readonly id: string;
  readonly counterpartyId: string;
  readonly workDate: string;
  readonly direction: MovementDirection;
  readonly contractorTotalPiastres: string;
}

export interface ContractorStatementInput {
  readonly counterpartyId: string;
  readonly opening: StatementOpeningInput;
  readonly period: StatementPeriodInput;
  readonly movements: readonly ContractorMovementInput[];
}

export interface ContractorStatementRow {
  readonly id: string;
  readonly workDate: string;
  readonly direction: MovementDirection;
  readonly contractorTotalPiastres: string;
  readonly signedDeltaPiastres: string;
  readonly runningBalancePiastres: string;
}

export interface ContractorStatement {
  readonly counterpartyId: string;
  readonly period: {
    readonly from: string;
    readonly to: string;
  };
  readonly openingBalancePiastres: string;
  readonly ahmedWorkPiastres: string;
  readonly counterpartyWorkPiastres: string;
  readonly closingBalancePiastres: string;
  readonly beneficiary: StatementBeneficiary;
  readonly balanceMagnitudePiastres: string;
  readonly movementCount: number;
  readonly rows: readonly ContractorStatementRow[];
}

export interface StatementValidationError {
  readonly code: StatementErrorCode;
  readonly field: string;
  readonly index?: number;
}

export interface ContractorStatementSuccess {
  readonly ok: true;
  readonly statement: ContractorStatement;
}

export interface ContractorStatementFailure {
  readonly ok: false;
  readonly error: StatementValidationError;
}

export type ContractorStatementResult =
  | ContractorStatementSuccess
  | ContractorStatementFailure;
