import type { ContractorStatementDocument } from "./document-types";

const UTF8_BOM = "\uFEFF";
const CSV_NEWLINE = "\r\n";
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@"]);

function guardSpreadsheetFormula(value: string): string {
  if (value.length === 0) {
    return value;
  }

  const firstChar = value[0]!;
  if (firstChar === "\t" || firstChar === "\r" || firstChar === "\n") {
    return `'${value}`;
  }

  const trimmedLeading = value.trimStart();
  if (
    trimmedLeading.length > 0 &&
    FORMULA_TRIGGER_CHARS.has(trimmedLeading[0]!)
  ) {
    return `'${value}`;
  }

  return value;
}

function formatCsvCell(value: string): string {
  const guarded = guardSpreadsheetFormula(value);
  const escapedQuotes = guarded.replace(/"/g, '""');
  return `"${escapedQuotes}"`;
}

function formatCsvRow(cells: readonly string[]): string {
  return cells.map(formatCsvCell).join(",");
}

export function renderContractorStatementCsv(
  document: ContractorStatementDocument
): string {
  const lines: string[] = [
    formatCsvRow(["اسم المنشأة", document.businessName]),
    formatCsvRow(["نوع التقرير", "كشف شغل مقاول"]),
    formatCsvRow(["المقاول", document.counterpartyName]),
    formatCsvRow(["من تاريخ", document.period.from]),
    formatCsvRow(["إلى تاريخ", document.period.to]),
    formatCsvRow(["تاريخ الإعداد", document.generatedAtLabel]),
    "",
    formatCsvRow(["رصيد أول الفترة", document.summary.openingBalanceText]),
    formatCsvRow(["شغل أحمد خلال الفترة", document.summary.ahmedWorkText]),
    formatCsvRow([
      "شغل المقاول خلال الفترة",
      document.summary.counterpartyWorkText,
    ]),
    formatCsvRow(["رصيد آخر الفترة", document.summary.closingBalanceText]),
    formatCsvRow(["النتيجة", document.summary.closingBeneficiaryText]),
    formatCsvRow(["عدد الحركات", document.summary.movementCountText]),
    "",
    formatCsvRow([
      "رقم النقلة",
      "التاريخ",
      "رقم الإيصال",
      "اتجاه الشغل",
      "الأثر على حساب أحمد (+/−) — جنيه",
      "الرصيد بعد الحركة — جنيه",
    ]),
  ];

  for (let i = 0; i < document.rows.length; i += 1) {
    const row = document.rows[i]!;
    lines.push(
      formatCsvRow([
        row.reference,
        row.workDate,
        row.receiptNumber?.trim() || "—",
        row.directionText,
        row.amountText,
        row.runningBalanceText,
      ])
    );
  }

  return UTF8_BOM + lines.join(CSV_NEWLINE);
}
