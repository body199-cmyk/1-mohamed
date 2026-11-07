import type { OperationalReportDocument } from "./document-types";
import { assertOperationalReportDocument } from "./report-document-validation";

const UTF8_BOM = "\uFEFF";
const CSV_NEWLINE = "\r\n";
const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@"]);

function guardSpreadsheetFormula(value: string): string {
  if (value.length === 0) return value;
  const firstChar = value[0]!;
  if (firstChar === "\t" || firstChar === "\r" || firstChar === "\n") return "'" + value;
  const trimmedLeading = value.trimStart();
  if (trimmedLeading.length > 0 && FORMULA_TRIGGER_CHARS.has(trimmedLeading[0]!)) {
    return "'" + value;
  }
  return value;
}

function cell(value: string): string {
  return '"' + guardSpreadsheetFormula(value).replace(/"/g, '""') + '"';
}

function row(values: readonly string[]): string {
  return values.map(cell).join(",");
}

export function renderOperationalReportCsv(doc: OperationalReportDocument): string {
  assertOperationalReportDocument(doc);
  const lines: string[] = [
    row(["اسم المنشأة", doc.businessName]),
    row(["نوع التقرير", doc.title]),
    row(["وصف التقرير", doc.subtitle]),
    ...doc.metadata.map(item => row([item.label, item.value])),
    row(["تاريخ الإعداد", doc.generatedAtLabel]),
    "",
  ];
  for (const section of doc.summarySections) {
    lines.push(row([section.title]));
    lines.push(row(["المؤشر", "القيمة"]));
    for (const metric of section.metrics) lines.push(row([metric.label, metric.value]));
    lines.push("");
  }
  lines.push(row(doc.columns.map(column => column.label)));
  if (doc.rows.length) {
    for (const detail of doc.rows) lines.push(row(detail));
  } else {
    lines.push(row([doc.emptyMessage, ...doc.columns.slice(1).map(() => "")]));
  }
  for (const note of doc.footerNotes) lines.push(row(["ملاحظة", note]));
  return UTF8_BOM + lines.join(CSV_NEWLINE);
}
