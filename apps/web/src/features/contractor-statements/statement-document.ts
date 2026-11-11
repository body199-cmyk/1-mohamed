import { formatEgpFromPiastres } from "@ledger/accounting";
import type { ContractorStatement } from "@ledger/contractor-statements";
import type { ContractorStatementDocument } from "@ledger/statement-export";

function money(value: string): string {
  const formatted = formatEgpFromPiastres(value);
  if (!formatted.ok) throw new Error("Invalid statement amount");
  return `${formatted.amount} ج.م`;
}

/** Explicit sign is presentation-only; the accounting engine already owns signed piastres. */
function signedMoney(value: string): string {
  return (BigInt(value) > 0n ? "+" : "") + money(value);
}
function contractorWorkMoney(value: string): string {
  return (BigInt(value) > 0n ? "-" : "") + money(value);
}

/** Formats the exact displayed statement; never recalculates or queries movements.
 */
export function toStatementDocument(
  statement: ContractorStatement,
  name: string,
): ContractorStatementDocument {
  return {
    businessName: "أحمد أبو علي — بيانات تجريبية، ليست كشفًا فعليًا",
    counterpartyName: name,
    period: statement.period,
    generatedAtLabel: new Intl.DateTimeFormat("ar-EG", {
      timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short",
    }).format(new Date()),
    summary: {
      openingBalanceText: signedMoney(statement.openingBalancePiastres),
      ahmedWorkText: signedMoney(statement.ahmedWorkPiastres),
      counterpartyWorkText: contractorWorkMoney(statement.counterpartyWorkPiastres),
      closingBalanceText: signedMoney(statement.closingBalancePiastres),
      closingBeneficiaryText: statement.beneficiary === "AHMED" ? "لصالح أحمد أبو علي" :
        statement.beneficiary === "COUNTERPARTY" ? `لصالح ${name}` : "الحساب متعادل",
      movementCountText: String(statement.movementCount),
    },
    rows: statement.rows.map(row => ({
      reference: row.id, workDate: row.workDate,
      directionText: row.direction === "AHMED_SUPPLIES" ? "أحمد جاب العربيات لشغل المقاول" : "المقاول جاب العربيات لشغل أحمد",
      amountText: signedMoney(row.signedDeltaPiastres),
      runningBalanceText: signedMoney(row.runningBalancePiastres),
    })),
  };
}
