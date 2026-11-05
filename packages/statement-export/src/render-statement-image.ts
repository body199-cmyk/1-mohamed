import type { ContractorStatementDocument, ContractorStatementRow } from "./document-types";

/**
 * T09.1 — PNG from the exact existing statement document.
 * Never recompute balances or omit movements silently.
 */
export interface StatementImageLayout {
  readonly width: number;
  readonly height: number;
  readonly businessName: string;
  readonly counterpartyName: string;
  readonly from: string;
  readonly to: string;
  readonly generatedAtLabel: string;
  readonly metrics: readonly { readonly label: string; readonly value: string }[];
  readonly rows: readonly ContractorStatementRow[];
}

const WIDTH = 1440;
const ROW_HEIGHT = 62;
const ROWS_TOP = 752;
const FOOTER_HEIGHT = 100;
const MAX_CANVAS_HEIGHT = 8192;

export function createStatementImageLayout(doc: ContractorStatementDocument): StatementImageLayout {
  const height = ROWS_TOP + Math.max(1, doc.rows.length) * ROW_HEIGHT + FOOTER_HEIGHT;
  if (height > MAX_CANVAS_HEIGHT) {
    throw new Error(
      "الكشف طويل جدًا للتصدير كصورة واحدة. اختر فترة أقصر أو استخدم الطباعة/CSV؛ لن يتم حذف أي حركة من الصورة."
    );
  }
  return {
    width: WIDTH,
    height,
    businessName: doc.businessName,
    counterpartyName: doc.counterpartyName,
    from: doc.period.from,
    to: doc.period.to,
    generatedAtLabel: doc.generatedAtLabel,
    metrics: [
      { label: "رصيد أول الفترة", value: doc.summary.openingBalanceText },
      { label: "شغل أحمد خلال الفترة", value: doc.summary.ahmedWorkText },
      { label: "شغل المقاول خلال الفترة", value: doc.summary.counterpartyWorkText },
      { label: "رصيد آخر الفترة", value: doc.summary.closingBalanceText },
      { label: "النتيجة", value: doc.summary.closingBeneficiaryText },
      { label: "عدد الحركات", value: doc.summary.movementCountText },
    ],
    rows: doc.rows,
  };
}

const NAVY = "#16324f";
const MUTED = "#425b71";
const BLUE = "#205cb3";
const BORDER = "#d1deec";
const STRIPE = "#f2f7fd";

function write(
  ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  options: { size?: number; bold?: boolean; color?: string; maxWidth?: number; ltr?: boolean } = {}
): void {
  ctx.fillStyle = options.color ?? NAVY;
  ctx.font = (options.bold ? "700" : "400") + " " + (options.size ?? 23) + "px Cairo, Tahoma, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.direction = options.ltr ? "ltr" : "rtl";
  ctx.fillText(value, x, y, options.maxWidth ?? 1160);
}

export function paintStatementImage(
  ctx: CanvasRenderingContext2D, layout: StatementImageLayout
): void {
  const right = 1360;
  const left = 80;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, layout.width, 14);

  write(ctx, layout.businessName, right, 71, { size: 22, maxWidth: 1250, color: MUTED });
  write(ctx, "كشف شغل مقاول — معاينة تجريبية", right, 132, { bold: true, size: 43 });
  write(ctx, "المقاول: " + layout.counterpartyName, right, 195, { size: 29, maxWidth: 1240 });
  write(ctx, "الفترة: " + layout.from + " إلى " + layout.to, right, 242, { size: 24 });
  write(ctx, "تاريخ الإعداد: " + layout.generatedAtLabel, right, 278, { size: 21, color: MUTED });

  ctx.fillStyle = STRIPE;
  ctx.fillRect(left, 296, 1280, 302);
  write(ctx, "ملخص الكشف", right - 20, 337, { size: 29, bold: true });

  for (let i = 0; i < layout.metrics.length; i++) {
    const metric = layout.metrics[i]!;
    const x = left + (2 - (i % 3)) * 426;
    const y = 351 + Math.floor(i / 3) * 118;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, 410, 108);
    ctx.strokeStyle = BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 409, 107);
    write(ctx, metric.label, x + 386, y + 39, { size: 19, color: MUTED, maxWidth: 370 });
    write(ctx, metric.value, x + 386, y + 82, { size: 25, bold: true, maxWidth: 370 });
  }

  write(ctx, "تفاصيل الحركات", right, 647, { size: 29, bold: true });
  const widths = [230, 170, 360, 250, 270];
  const headings = ["المرجع", "التاريخ", "اتجاه الشغل", "قيمة الشغل", "الرصيد بعد الحركة"];

  ctx.fillStyle = BLUE;
  ctx.fillRect(left, 682, 1280, 70);
  let x = right;
  for (let i = 0; i < headings.length; i++) {
    write(ctx, headings[i]!, x - 15, 727, { size: 21, bold: true, color: "#ffffff", maxWidth: widths[i]! - 26 });
    x -= widths[i]!;
  }

  const rows: readonly ContractorStatementRow[] = layout.rows.length
    ? layout.rows
    : [{ reference: "—", workDate: "—", directionText: "لا توجد حركات خلال الفترة", amountText: "—", runningBalanceText: "—" }];

  rows.forEach((row, index) => {
    const y = ROWS_TOP + index * ROW_HEIGHT;
    ctx.fillStyle = index % 2 === 0 ? "#ffffff" : STRIPE;
    ctx.fillRect(left, y, 1280, ROW_HEIGHT);
    ctx.strokeStyle = BORDER;
    ctx.beginPath();
    ctx.moveTo(left, y + ROW_HEIGHT - 0.5);
    ctx.lineTo(right, y + ROW_HEIGHT - 0.5);
    ctx.stroke();

    const cells = [row.reference, row.workDate, row.directionText, row.amountText, row.runningBalanceText];
    let cellRight = right;
    for (let column = 0; column < cells.length; column++) {
      write(ctx, cells[column]!, cellRight - 15, y + 39, {
        size: 20, maxWidth: widths[column]! - 28,
        ltr: column === 0 || column === 1,
      });
      cellRight -= widths[column]!;
    }
  });

  const footerY = ROWS_TOP + rows.length * ROW_HEIGHT + 41;
  write(ctx, "فرق الشغل فقط؛ لا يشمل دفعات العربيات أو نقدها المستقل.", right, footerY, {
    size: 21, color: MUTED, maxWidth: 1260,
  });
}

export async function renderContractorStatementPng(doc: ContractorStatementDocument): Promise<Blob> {
  const layout = createStatementImageLayout(doc);
  if (typeof document === "undefined") {
    throw new Error("تصدير PNG متاح داخل المتصفح فقط.");
  }
  await Promise.all([
    document.fonts.load("400 23px Cairo"),
    document.fonts.load("700 25px Cairo"),
  ]);
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("متصفحك لا يدعم إنشاء صورة التقرير.");
  paintStatementImage(ctx, layout);
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob
      ? resolve(blob)
      : reject(new Error("تعذر إنشاء صورة PNG. استخدم CSV أو الطباعة.")), "image/png");
  });
}
