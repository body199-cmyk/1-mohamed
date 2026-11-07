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

/** A presentation-only report snapshot. It never owns or recalculates money. */
export interface OperationalReportMetadata {
  readonly label: string;
  readonly value: string;
  readonly direction?: "rtl" | "ltr";
}

export interface OperationalReportSummaryMetric {
  readonly label: string;
  readonly value: string;
  readonly direction?: "rtl" | "ltr";
  readonly emphasis?: boolean;
}

export interface OperationalReportSummarySection {
  readonly title: string;
  readonly metrics: readonly OperationalReportSummaryMetric[];
}

export interface OperationalReportColumn {
  readonly label: string;
  readonly direction?: "rtl" | "ltr";
  /** Relative share of the fixed 1440px report width. Must be positive. */
  readonly widthWeight: number;
}

export interface OperationalReportDocument {
  readonly businessName: string;
  readonly title: string;
  readonly subtitle: string;
  readonly generatedAtLabel: string;
  readonly metadata: readonly OperationalReportMetadata[];
  readonly summarySections: readonly OperationalReportSummarySection[];
  readonly columns: readonly OperationalReportColumn[];
  readonly rows: readonly (readonly string[])[];
  readonly emptyMessage: string;
  readonly footerNotes: readonly string[];
}
