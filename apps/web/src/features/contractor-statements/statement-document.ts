import { formatEgpFromPiastres } from "@ledger/accounting";
import type { ContractorStatement } from "@ledger/contractor-statements";
import type { ContractorStatementDocument } from "@ledger/statement-export";

function money(value: string): string {
  const formatted = formatEgpFromPiastres(value);
  if (!formatted.ok) throw new Error("Invalid statement amount");
  return `${formatted.amount} ج.م`;
}

/** Formats the exact displayed statement; never recalculates or queries movements. */
export function toStatementDocument(statement: ContractorStatement, name: string): ContractorStatementDocument {
  return {
    businessName: "أحمد أبو علي — بيانات تجريبية، ليست كشفًا فعليًا",
    counterpartyName: name,
    period: statement.period,
    generatedAtLabel: new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short",
    }).format(new Date()),
    summary: {
      openingBalanceText: money(statement.openingBalancePiastres),
      ahmedWorkText: money(statement.ahmedWorkPiastres),
      counterpartyWorkText: money(statement.counterpartyWorkPiastres),
      closingBalanceText: money(statement.closingBalancePiastres),
      closingBeneficiaryText: statement.beneficiary === "AHMED" ? "لصالح أحمد أبو علي" :
        statement.beneficiary === "COUNTERPARTY" ? `لصالح ${name}` : "الحساب متعادل",
      movementCountText: String(statement.movementCount),
    },
    rows: statement.rows.map(row => ({
      reference: row.id, workDate: row.workDate,
      directionText: row.direction === "AHMED_SUPPLIES" ? "أحمد جاب العربيات لشغل المقاول" : "المقاول جاب العربيات لشغل أحمد",
      amountText: money(row.signedDeltaPiastres),
      runningBalanceText: money(row.runningBalancePiastres),
    })),
  };
}
