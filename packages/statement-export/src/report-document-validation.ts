import type { OperationalReportDocument } from "./document-types";

export const MAX_OPERATIONAL_REPORT_ROWS = 25000;

export function assertOperationalReportDocument(doc: OperationalReportDocument): void {
  if (!doc || typeof doc !== "object" ||
      typeof doc.businessName !== "string" || typeof doc.title !== "string" ||
      typeof doc.subtitle !== "string" || typeof doc.generatedAtLabel !== "string" ||
      typeof doc.emptyMessage !== "string") {
    throw new Error("مستند التقرير غير صالح.");
  }
  if (!Array.isArray(doc.columns) || doc.columns.length < 1 || doc.columns.length > 16) {
    throw new Error("عدد أعمدة التقرير غير مدعوم.");
  }
  if (!Array.isArray(doc.rows) || doc.rows.length > MAX_OPERATIONAL_REPORT_ROWS) {
    throw new Error("التقرير يتجاوز حد ٢٥٠٠٠ حركة؛ اختر فترة أقصر، ولن تُحذف بيانات بصمت.");
  }
  if (!Array.isArray(doc.metadata) || doc.metadata.length > 12 ||
      !Array.isArray(doc.summarySections) || doc.summarySections.length > 12 ||
      !Array.isArray(doc.footerNotes) || doc.footerNotes.length > 10) {
    throw new Error("أقسام التقرير تتجاوز الحدود المدعومة.");
  }
  let weightTotal = 0;
  for (const column of doc.columns) {
    if (!column || typeof column.label !== "string" ||
        !Number.isFinite(column.widthWeight) || column.widthWeight <= 0 ||
        (column.direction !== undefined && column.direction !== "rtl" && column.direction !== "ltr")) {
      throw new Error("تعريف أحد أعمدة التقرير غير صالح.");
    }
    weightTotal += column.widthWeight;
  }
  if (!Number.isFinite(weightTotal) || weightTotal <= 0) {
    throw new Error("توزيع أعمدة التقرير غير صالح.");
  }
  for (const row of doc.rows) {
    if (!Array.isArray(row) || row.length !== doc.columns.length ||
        row.some(value => typeof value !== "string")) {
      throw new Error("صف في التقرير لا يطابق عدد الأعمدة؛ تم إيقاف التصدير.");
    }
  }
  for (const item of doc.metadata) {
    if (!item || typeof item.label !== "string" || typeof item.value !== "string" ||
        (item.direction !== undefined && item.direction !== "rtl" && item.direction !== "ltr")) {
      throw new Error("بيانات تعريف التقرير غير صالحة.");
    }
  }
  if (doc.footerNotes.some(note => typeof note !== "string")) {
    throw new Error("ملاحظات التقرير غير صالحة.");
  }
  for (const section of doc.summarySections) {
    if (!section || typeof section.title !== "string" || !Array.isArray(section.metrics) ||
        section.metrics.length > 24) {
      throw new Error("ملخص التقرير غير صالح.");
    }
    for (const metric of section.metrics) {
      if (!metric || typeof metric.label !== "string" || typeof metric.value !== "string" ||
          (metric.direction !== undefined && metric.direction !== "rtl" && metric.direction !== "ltr")) {
        throw new Error("قيمة في ملخص التقرير غير صالحة.");
      }
    }
  }
}
