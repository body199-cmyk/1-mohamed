import type { OperationalReportDocument } from "./document-types";
import { assertOperationalReportDocument } from "./report-document-validation";
import { assemblePdfJpegPages, type PdfJpegPage } from "./render-statement-pdf";
import { createOperationalReportImageLayout, paintOperationalReportImage } from "./render-report-image";

const PDF_WIDTH = 1440;
const PDF_HEIGHT = 2036;
const ROWS_PER_PAGE = 14;
const MAX_PAGES = 60;

export function paginateOperationalReportForPdf(
  doc: OperationalReportDocument,
): readonly OperationalReportDocument[] {
  assertOperationalReportDocument(doc);
  const count = Math.max(1, Math.ceil(doc.rows.length / ROWS_PER_PAGE));
  if (count > MAX_PAGES) {
    throw new Error("التقرير أكبر من حد ٦٠ صفحة PDF المباشر؛ اختر فترة أقصر أو استخدم الطباعة وCSV. لن تُحذف أي حركة.");
  }
  return Array.from({ length: count }, (_, index) => ({
    ...doc,
    rows: doc.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE),
  }));
}

async function toJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result =>
    result && result.type === "image/jpeg"
      ? resolve(result)
      : reject(new Error("متصفحك لم يستطع إنشاء صورة صفحة PDF.")),
  "image/jpeg", 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderOperationalReportPdf(doc: OperationalReportDocument): Promise<Blob> {
  const pages = paginateOperationalReportForPdf(doc);
  if (typeof document === "undefined") {
    throw new Error("تصدير PDF المباشر متاح من المتصفح فقط.");
  }
  await Promise.all([
    document.fonts.load("400 18px Cairo"),
    document.fonts.load("700 22px Cairo"),
  ]);
  await document.fonts.ready;
  const images: PdfJpegPage[] = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    const layout = createOperationalReportImageLayout(page, {
      fixedHeight: PDF_HEIGHT,
      pageLabel: "صفحة " + (index + 1) + " من " + pages.length,
    });
    const canvas = document.createElement("canvas");
    canvas.width = PDF_WIDTH;
    canvas.height = PDF_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("متصفحك لا يدعم إعداد صفحات PDF.");
    paintOperationalReportImage(ctx, layout);
    images.push({ width: PDF_WIDTH, height: PDF_HEIGHT, jpeg: await toJpegBytes(canvas) });
    canvas.width = 0;
    canvas.height = 0;
  }
  return new Blob([assemblePdfJpegPages(images)], { type: "application/pdf" });
}
