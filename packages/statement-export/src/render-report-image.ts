import type {
  OperationalReportColumn,
  OperationalReportDocument,
  OperationalReportMetadata,
  OperationalReportSummarySection,
} from "./document-types";
import { assertOperationalReportDocument } from "./report-document-validation";

const WIDTH = 1440;
const HEIGHT = 2036;
const LEFT = 80;
const RIGHT = 1360;
const CONTENT_WIDTH = 1280;
const ROW_HEIGHT = 54;
const MAX_CANVAS_HEIGHT = 8192;
const NAVY = "#16324f";
const MUTED = "#425b71";
const BLUE = "#206bc4";
const BORDER = "#d1deec";
const STRIPE = "#f2f7fd";

export interface OperationalReportImageLayout {
  readonly width: number;
  readonly height: number;
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
  readonly summaryStart: number;
  readonly tableTitleY: number;
  readonly headerY: number;
  readonly rowsTop: number;
  readonly pageLabel?: string;
}

export function createOperationalReportImageLayout(
  doc: OperationalReportDocument,
  options: { readonly fixedHeight?: number; readonly pageLabel?: string } = {},
): OperationalReportImageLayout {
  assertOperationalReportDocument(doc);
  const metadataRows = Math.ceil(doc.metadata.length / 2);
  const summaryStart = 220 + metadataRows * 48 + 14;
  let summaryBottom = summaryStart;
  for (const section of doc.summarySections) {
    summaryBottom += 34 + Math.ceil(section.metrics.length / 3) * 72 + 14;
  }
  const tableTitleY = summaryBottom + 18;
  const headerY = tableTitleY + 30;
  const rowsTop = headerY + 58;
  const renderedRows = Math.max(1, doc.rows.length);
  const contentBottom = rowsTop + renderedRows * ROW_HEIGHT + doc.footerNotes.length * 28 + 74;
  const height = options.fixedHeight ?? contentBottom;
  if (height > MAX_CANVAS_HEIGHT || height < contentBottom ||
      (options.fixedHeight !== undefined && options.fixedHeight !== HEIGHT)) {
    throw new Error("التقرير أطول من مساحة الصورة أو صفحة PDF؛ اختر فترة أقصر أو استخدم CSV/Excel. لن تُحذف أي حركة.");
  }
  return {
    width: WIDTH, height, businessName: doc.businessName, title: doc.title,
    subtitle: doc.subtitle, generatedAtLabel: doc.generatedAtLabel,
    metadata: doc.metadata, summarySections: doc.summarySections, columns: doc.columns,
    rows: doc.rows, emptyMessage: doc.emptyMessage, footerNotes: doc.footerNotes,
    summaryStart, tableTitleY, headerY, rowsTop, pageLabel: options.pageLabel,
  };
}

function write(
  ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  options: { readonly size?: number; readonly bold?: boolean; readonly color?: string;
    readonly maxWidth?: number; readonly ltr?: boolean } = {},
): void {
  const size = options.size ?? 18;
  ctx.fillStyle = options.color ?? NAVY;
  ctx.font = (options.bold ? "700 " : "400 ") + size + "px Cairo, Tahoma, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  const maxWidth = options.maxWidth ?? 1160;
  if (options.ltr && value.endsWith(" ج.م")) {
    const amount = value.slice(0, -" ج.م".length);
    ctx.direction = "ltr";
    ctx.fillText(amount, x, y, maxWidth);
    const amountWidth = Math.min(ctx.measureText(amount).width, maxWidth);
    ctx.direction = "rtl";
    ctx.fillText("ج.م", x - amountWidth - 5, y, Math.max(12, maxWidth - amountWidth - 5));
  } else {
    ctx.direction = options.ltr ? "ltr" : "rtl";
    ctx.fillText(value, x, y, maxWidth);
  }
}

function paintMetadata(ctx: CanvasRenderingContext2D, items: readonly OperationalReportMetadata[]): void {
  const rows = Math.ceil(items.length / 2);
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const column = i % 2;
    const row = Math.floor(i / 2);
    const x = RIGHT - column * 640;
    const y = 220 + row * 48;
    write(ctx, item.label, x, y, { size: 16, color: MUTED, maxWidth: 600 });
    write(ctx, item.value, x, y + 21, {
      size: 18, bold: true, maxWidth: 600, ltr: item.direction === "ltr",
    });
  }
  void rows;
}

function paintSummaries(
  ctx: CanvasRenderingContext2D,
  sections: readonly OperationalReportSummarySection[],
  start: number,
): void {
  let y = start;
  for (const section of sections) {
    write(ctx, section.title, RIGHT, y + 23, { size: 22, bold: true });
    for (let i = 0; i < section.metrics.length; i++) {
      const metric = section.metrics[i]!;
      const column = i % 3;
      const row = Math.floor(i / 3);
      const x = LEFT + column * 426;
      const boxY = y + 34 + row * 72;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, boxY, 410, 64);
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, boxY + 0.5, 409, 63);
      write(ctx, metric.label, x + 390, boxY + 23, {
        size: 15, color: MUTED, maxWidth: 370,
      });
      write(ctx, metric.value, x + 390, boxY + 49, {
        size: 19, bold: true, maxWidth: 370, ltr: metric.direction === "ltr",
      });
    }
    y += 34 + Math.ceil(section.metrics.length / 3) * 72 + 14;
  }
}

function paintTable(
  ctx: CanvasRenderingContext2D,
  layout: OperationalReportImageLayout,
): number {
  write(ctx, "تفاصيل التقرير", RIGHT, layout.tableTitleY + 23, { size: 22, bold: true });
  ctx.fillStyle = BLUE;
  ctx.fillRect(LEFT, layout.headerY, CONTENT_WIDTH, 58);
  const totalWeight = layout.columns.reduce((sum, column) => sum + column.widthWeight, 0);
  let cellRight = RIGHT;
  const fontSize = layout.columns.length >= 9 ? 14 : layout.columns.length >= 7 ? 16 : 18;
  for (const column of layout.columns) {
    const width = CONTENT_WIDTH * column.widthWeight / totalWeight;
    write(ctx, column.label, cellRight - 8, layout.headerY + 37, {
      size: fontSize, bold: true, color: "#ffffff", maxWidth: width - 14,
    });
    cellRight -= width;
  }
  const rows: readonly (readonly string[])[] = layout.rows.length
    ? layout.rows
    : [[layout.emptyMessage, ...layout.columns.slice(1).map(() => "")]];
  rows.forEach((values, rowIndex) => {
    const y = layout.rowsTop + rowIndex * ROW_HEIGHT;
    ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : STRIPE;
    ctx.fillRect(LEFT, y, CONTENT_WIDTH, ROW_HEIGHT);
    ctx.strokeStyle = BORDER;
    ctx.beginPath();
    ctx.moveTo(LEFT, y + ROW_HEIGHT - 0.5);
    ctx.lineTo(RIGHT, y + ROW_HEIGHT - 0.5);
    ctx.stroke();
    let right = RIGHT;
    for (let columnIndex = 0; columnIndex < layout.columns.length; columnIndex++) {
      const column = layout.columns[columnIndex]!;
      const width = CONTENT_WIDTH * column.widthWeight / totalWeight;
      const value = values[columnIndex] ?? "";
      write(ctx, value, right - 8, y + 34, {
        size: fontSize, maxWidth: width - 14, ltr: column.direction === "ltr",
        color: value.startsWith("-") && column.direction === "ltr" ? "#a34a20" : NAVY,
      });
      right -= width;
    }
  });
  return layout.rowsTop + rows.length * ROW_HEIGHT;
}

export function paintOperationalReportImage(
  ctx: CanvasRenderingContext2D,
  layout: OperationalReportImageLayout,
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, layout.width, 14);
  write(ctx, layout.businessName, RIGHT, 72, { size: 21, color: MUTED, maxWidth: 1250 });
  write(ctx, layout.title, RIGHT, 132, { size: 38, bold: true, maxWidth: 1250 });
  write(ctx, layout.subtitle, RIGHT, 176, { size: 17, color: MUTED, maxWidth: 1250 });
  write(ctx, "تاريخ الإعداد: " + layout.generatedAtLabel, RIGHT, 204, {
    size: 16, color: MUTED, maxWidth: 1250,
  });
  paintMetadata(ctx, layout.metadata);
  paintSummaries(ctx, layout.summarySections, layout.summaryStart);
  const rowsBottom = paintTable(ctx, layout);
  let footerY = rowsBottom + 28;
  for (const note of layout.footerNotes) {
    write(ctx, note, RIGHT, footerY, { size: 16, color: MUTED, maxWidth: CONTENT_WIDTH });
    footerY += 26;
  }
  if (layout.pageLabel) {
    write(ctx, layout.pageLabel, RIGHT, layout.height - 38, {
      size: 18, bold: true, color: MUTED, maxWidth: CONTENT_WIDTH,
    });
  }
}

async function loadCairoFonts(): Promise<void> {
  if (typeof document === "undefined") throw new Error("تصدير الصور متاح داخل المتصفح فقط.");
  await Promise.all([
    document.fonts.load("400 18px Cairo"),
    document.fonts.load("700 22px Cairo"),
  ]);
  await document.fonts.ready;
}

export async function renderOperationalReportPng(doc: OperationalReportDocument): Promise<Blob> {
  const layout = createOperationalReportImageLayout(doc);
  await loadCairoFonts();
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("متصفحك لا يدعم إنشاء صورة التقرير.");
  paintOperationalReportImage(ctx, layout);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob
    ? resolve(blob)
    : reject(new Error("تعذر إنشاء صورة PNG. استخدم CSV أو الطباعة.")), "image/png"));
}
