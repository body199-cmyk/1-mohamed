import type { ContractorStatementDocument } from "./document-types";
import { createStatementImageLayout, paintStatementImage } from "./render-statement-image";

/**
 * T09.2: Offline browser PDF assembled from 1440px Cairo-rendered JPEG pages.
 * The old browser print route remains for selectable/searchable PDF.
 * No third-party service, PDF server, or financial recomputation.
 */
const PDF_WIDTH = 1440;
const PDF_HEIGHT = 2036; // A4 proportion at 1440 CSS pixels.
const ROWS_PER_PAGE = 17;
const MAX_PAGES = 60;

export function paginateStatementForPdf(
  doc: ContractorStatementDocument
): readonly ContractorStatementDocument[] {
  const count = Math.max(1, Math.ceil(doc.rows.length / ROWS_PER_PAGE));
  if (count > MAX_PAGES) {
    throw new Error("الكشف أكبر من حد ٦٠ صفحة PDF للصورة المباشرة؛ اختر فترة أصغر أو استخدم الطباعة وCSV. لن تُحذف حركات بصمت.");
  }
  return Array.from({ length: count }, (_, index) => {
    const page: ContractorStatementDocument = {
      ...doc, rows: doc.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE),
    };
    if (createStatementImageLayout(page).height > PDF_HEIGHT - 90) {
      throw new Error("صفوف الكشف لن تتسع في صفحة PDF؛ تم إيقاف التنزيل بدل قصها.");
    }
    return page;
  });
}

export interface PdfJpegPage {
  readonly width: number;
  readonly height: number;
  readonly jpeg: Uint8Array;
}

const encoder = new TextEncoder();

/**
 * Minimal PDF 1.4 object writer: exact byte xref offsets, one JPEG XObject
 * per A4 page. No remote APIs or binary dependency. This owns formatting
 * only; all financial labels are painted from ContractorStatementDocument.
 */
export function assemblePdfJpegPages(pages: readonly PdfJpegPage[]): Uint8Array {
  if (pages.length < 1 || pages.length > MAX_PAGES) {
    throw new Error("عدد صفحات PDF غير مدعوم.");
  }
  for (const p of pages) {
    if (p.width !== PDF_WIDTH || p.height !== PDF_HEIGHT ||
        p.jpeg.length < 4 || p.jpeg[0] !== 0xff || p.jpeg[1] !== 0xd8 ||
        p.jpeg[p.jpeg.length - 2] !== 0xff || p.jpeg[p.jpeg.length - 1] !== 0xd9) {
      throw new Error("محتوى صورة صفحة PDF غير صالح.");
    }
  }

  const lastId = 2 + pages.length * 3;
  const chunks: Uint8Array[] = [];
  const offsets: number[] = Array.from({ length: lastId + 1 }, () => 0);
  let size = 0;
  const append = (part: Uint8Array): void => { chunks.push(part); size += part.length; };
  const put = (text: string): void => append(encoder.encode(text));
  const begin = (id: number): void => { offsets[id] = size; put(id + " 0 obj\n"); };
  const end = (): void => put("\nendobj\n");

  put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  begin(1); put("<< /Type /Catalog /Pages 2 0 R >>"); end();
  const kids = pages.map((_, i) => (3 + i * 3) + " 0 R").join(" ");
  begin(2); put("<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>"); end();

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i]!;
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const imageName = "PgImage" + i;
    begin(pageId);
    put("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89]");
    put(" /Resources << /XObject << /" + imageName + " " + imageId + " 0 R >> >>");
    put(" /Contents " + contentId + " 0 R >>");
    end();

    const content = encoder.encode("q\n595.28 0 0 841.89 0 0 cm\n/" + imageName + " Do\nQ\n");
    begin(contentId);
    put("<< /Length " + content.length + " >>\nstream\n");
    append(content);
    put("endstream");
    end();

    begin(imageId);
    put("<< /Type /XObject /Subtype /Image /Width " + p.width +
      " /Height " + p.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8");
    put(" /Filter /DCTDecode /Length " + p.jpeg.length + " >>\nstream\n");
    append(p.jpeg);
    put("\nendstream");
    end();
  }

  const startXref = size;
  put("xref\n0 " + (lastId + 1) + "\n0000000000 65535 f \n");
  for (let id = 1; id <= lastId; id++) {
    put(String(offsets[id]!).padStart(10, "0") + " 00000 n \n");
  }
  put("trailer\n<< /Size " + (lastId + 1) + " /Root 1 0 R >>\n");
  put("startxref\n" + startXref + "\n%%EOF\n");

  const output = new Uint8Array(size);
  let cursor = 0;
  for (const chunk of chunks) { output.set(chunk, cursor); cursor += chunk.length; }
  return output;
}

async function toJpegBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result =>
    result && result.type === "image/jpeg" ?
      resolve(result) : reject(new Error("متصفحك لم يستطع إنشاء صورة صفحة PDF.")),
  "image/jpeg", 0.9));
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderContractorStatementPdf(doc: ContractorStatementDocument): Promise<Blob> {
  const pageDocs = paginateStatementForPdf(doc);
  if (typeof document === "undefined") {
    throw new Error("تصدير PDF المباشر متاح من المتصفح فقط.");
  }
  await Promise.all([
    document.fonts.load("400 23px Cairo"),
    document.fonts.load("700 25px Cairo"),
  ]);
  await document.fonts.ready;

  const images: PdfJpegPage[] = [];
  for (let i = 0; i < pageDocs.length; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = PDF_WIDTH;
    canvas.height = PDF_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("متصفحك لا يدعم إعداد صفحات PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PDF_WIDTH, PDF_HEIGHT);
    paintStatementImage(ctx, createStatementImageLayout(pageDocs[i]!));
    ctx.strokeStyle = "#d1deec";
    ctx.beginPath();
    ctx.moveTo(80, 1950);
    ctx.lineTo(1360, 1950);
    ctx.stroke();
    ctx.font = "700 24px Cairo, Tahoma, Arial, sans-serif";
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    ctx.fillStyle = "#16324f";
    ctx.fillText("صفحة " + (i + 1) + " من " + pageDocs.length, 1360, 1993);
    images.push({ width: PDF_WIDTH, height: PDF_HEIGHT, jpeg: await toJpegBytes(canvas) });
    canvas.width = 0;
    canvas.height = 0;
  }

  const bytes = assemblePdfJpegPages(images);
  return new Blob([bytes], { type: "application/pdf" });
}
