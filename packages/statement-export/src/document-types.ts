export interface ContractorStatementPeriod {
  readonly from: string;
  readonly to: string;
}

export interface ContractorStatementSummary {
  readonly openingBalanceText: string;
  readonly ahmedWorkText: string;
  readonly counterpartyWorkText: string;
  readonly closingBalanceText: string;
  readonly closingBeneficiaryText: string;
  readonly movementCountText: string;
}

export interface ContractorStatementRow {
  /** Stable internal trip identifier, not a commercial receipt. */
  readonly reference: string;
  /** Separate receipt reference when recorded; absent on older/imported rows. */
  readonly receiptNumber?: string;
  readonly workDate: string;
  readonly directionText: string;
  readonly amountText: string;
  readonly runningBalanceText: string;
}

export interface ContractorStatementDocument {
  readonly businessName: string;
  readonly counterpartyName: string;
  readonly period: ContractorStatementPeriod;
  readonly generatedAtLabel: string;
  readonly summary: ContractorStatementSummary;
  readonly rows: readonly ContractorStatementRow[];
}
