import { formatEgpFromPiastres } from "@ledger/accounting";
import type { ContractorStatement } from "@ledger/contractor-statements";
import type { ContractorStatementDocument, OperationalReportDocument } from "@ledger/statement-export";

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

export function toStatementPaper(document: ContractorStatementDocument): OperationalReportDocument {
  const { summary, period, counterpartyName } = document;
  return {
    presentation: "compact-statement",
    businessName: document.businessName,
    title: "كشف شغل مقاول",
    subtitle: counterpartyName,
    generatedAtLabel: document.generatedAtLabel,
    metadata: [
      { label: "من تاريخ", value: period.from, direction: "ltr" },
      { label: "إلى تاريخ", value: period.to, direction: "ltr" },
      { label: "عدد النقلات", value: summary.movementCountText, direction: "ltr" },
    ],
    summarySections: [{
      title: "ملخص الكشف",
      metrics: [
        { label: "رصيد أول الفترة", value: summary.openingBalanceText, direction: "ltr" },
        { label: "شغل أحمد", value: summary.ahmedWorkText, direction: "ltr", tone: "credit" },
        { label: "شغل المقاول", value: summary.counterpartyWorkText, direction: "ltr", tone: "debit" },
        { label: summary.closingBeneficiaryText, value: summary.closingBalanceText, direction: "ltr", emphasis: true },
      ],
    }],
    columns: [
      { label: "رقم النقلة", widthWeight: 1.4, direction: "ltr" },
      { label: "التاريخ", widthWeight: 1.2, direction: "ltr" },
      { label: "اتجاه الشغل", widthWeight: 2, direction: "rtl" },
      { label: "الأثر على حساب أحمد", widthWeight: 1.3, direction: "ltr" },
      { label: "الرصيد بعد الحركة", widthWeight: 1.3, direction: "ltr" },
    ],
    rows: document.rows.map(row => [
      row.reference, row.workDate, row.directionText, row.amountText, row.runningBalanceText,
    ]),
    rowTones: document.rows.map(row =>
      row.amountText.startsWith("-") ? "debit" : row.amountText.startsWith("+") ? "credit" : "neutral"),
    emptyMessage: "لا توجد حركات خلال الفترة.",
    footerNotes: ["الموجب لصالح أحمد أبو علي، والسالب لصالح المقاول."],
  };
}
