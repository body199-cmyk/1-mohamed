import { describe, expect, it } from "vitest";
import type { OperationalReportDocument } from "../src/document-types";
import { renderOperationalReportCsv } from "../src/render-report-csv";
import { renderOperationalReportHtml } from "../src/render-report-html";
import {
  createOperationalReportImageLayout, paintOperationalReportImage,
} from "../src/render-report-image";
import { paginateOperationalReportForPdf } from "../src/render-report-pdf";
import {
  createOperationalReportXlsxParts, renderOperationalReportXlsx,
} from "../src/render-report-xlsx";

function fixture(count = 2): OperationalReportDocument {
  return {
    businessName: "أحمد أبو علي — بيانات تجريبية",
    title: "تقرير الشغل اليومي",
    subtitle: "حجم الشغل فقط، دون خلط النقد.",
    generatedAtLabel: "٥ نوفمبر ٢٠٢٦ ١٨:٣٠",
    metadata: [
      { label: "تاريخ التقرير", value: "2026-11-05", direction: "ltr" },
      { label: "المقاول", value: "شركة النيل" },
    ],
    summarySections: [{
      title: "إجمالي اليوم المحدد",
      metrics: [
        { label: "عدد النقلات", value: "2", direction: "ltr" },
        { label: "إجمالي الوزن", value: "3.500 طن", direction: "ltr" },
        { label: "قيمة شغل المقاول", value: "1500.00 ج.م", direction: "ltr" },
        { label: "مستحق العربيات", value: "1200.00 ج.م", direction: "ltr" },
      ],
    }],
    columns: [
      { label: "رقم النقلة", direction: "ltr", widthWeight: 1 },
      { label: "المقاول", widthWeight: 1.5 },
      { label: "القيمة", direction: "ltr", widthWeight: 1 },
    ],
    rows: Array.from({ length: count }, (_, index) => [
      "000" + String(index + 1),
      "شركة النيل",
      index === 0 ? "-100.00 ج.م" : "150.00 ج.م",
    ]),
    emptyMessage: "لا توجد حركات خلال الفترة.",
    footerNotes: ["تقرير تجريبي؛ لا يمثل بيانات محفوظة دائمًا."],
  };
}

function capturePaint(doc: OperationalReportDocument): string[] {
  const calls: string[] = [];
  const ctx = {
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText(value: string) { calls.push(value); },
    measureText(value: string) { return { width: value.length * 8 } as TextMetrics; },
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", textBaseline: "",
    direction: "rtl", lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
  paintOperationalReportImage(ctx, createOperationalReportImageLayout(doc));
  return calls;
}

function localZipEntries(zip: Uint8Array): Map<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const result = new Map<string, string>();
  const decoder = new TextDecoder();
  let cursor = 0;
  while (cursor + 30 <= zip.length && view.getUint32(cursor, true) === 0x04034b50) {
    const size = view.getUint32(cursor + 18, true);
    const nameLength = view.getUint16(cursor + 26, true);
    const extraLength = view.getUint16(cursor + 28, true);
    const nameStart = cursor + 30;
    const payloadStart = nameStart + nameLength + extraLength;
    result.set(decoder.decode(zip.subarray(nameStart, nameStart + nameLength)),
      decoder.decode(zip.subarray(payloadStart, payloadStart + size)));
    cursor = payloadStart + size;
  }
  expect(view.getUint32(cursor, true)).toBe(0x02014b50);
  expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50);
  return result;
}

describe("H065 operational report exports — one fixed document, five formats", () => {
  it("renders complete escaped RTL HTML with A4 paper and summary before details", () => {
    const doc = fixture();
    const html = renderOperationalReportHtml({
      ...doc,
      businessName: "<script>alert(1)</script>",
      rows: [["0001", "شركة <النيل>", "-100.00 ج.م"]],
    });
    expect(html.startsWith("<!doctype html>\n<html lang=\"ar\" dir=\"rtl\">")).toBe(true);
    expect(html).toContain("@page");
    expect(html).toContain("size: A4");
    expect(html).toContain("#206bc4");
    expect(html).not.toContain("data-theme");
    expect(html).not.toContain("@media (max-width");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;النيل&gt;");
    expect(html).toContain('<span class="meta-value">٥ نوفمبر ٢٠٢٦ ١٨:٣٠</span>');
    expect(html.indexOf("إجمالي اليوم المحدد")).toBeLessThan(html.indexOf("رقم النقلة"));
    expect(html).toContain("0001");
  });

  it("quotes CSV cells, writes BOM/CRLF, preserves all metadata and guards formula-like cells", () => {
    const doc = fixture();
    const csv = renderOperationalReportCsv({
      ...doc,
      rows: [["=HYPERLINK(\"x\")", "شركة، النيل", "-100.00 ج.م"]],
    });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.slice(1)).not.toContain("\uFEFF");
    expect(csv).toContain("\r\n");
    expect(csv).toContain('"تقرير الشغل اليومي"');
    expect(csv).toContain("وصف التقرير");
    expect(csv).toContain("'=HYPERLINK(\"\"x\"\")");
    expect(csv).toContain("شركة، النيل");
    expect(csv).toContain("'-100.00 ج.م");
    const empty = renderOperationalReportCsv({ ...doc, rows: [] });
    expect(empty).toContain("لا توجد حركات خلال الفترة.");
    expect(empty).toContain("إجمالي اليوم المحدد");
  });

  it("uses a fixed 1440px canvas and paints every supplied row and summary value", () => {
    const doc = fixture(4);
    const layout = createOperationalReportImageLayout(doc);
    expect(layout.width).toBe(1440);
    expect(layout.height).toBeGreaterThan(700);
    expect(layout.rows).toBe(doc.rows);
    const calls = capturePaint(doc);
    for (const value of ["0001", "0002", "0003", "0004", "شركة النيل", "1500.00", "إجمالي اليوم المحدد", "تاريخ الإعداد: ٥ نوفمبر ٢٠٢٦ ١٨:٣٠"]) {
      expect(calls.some(call => call.includes(value))).toBe(true);
    }
    expect(calls.filter(call => /^000[1-4]$/.test(call))).toHaveLength(4);
  });

  it("keeps negative cash movements as leading LTR signs in image/PDF painting and guards CSV", () => {
    const doc = {
      ...fixture(1),
      title: "كشف حساب نقد العربية",
      columns: [
        { label: "البيان", widthWeight: 1 },
        { label: "حركة", direction: "ltr" as const, widthWeight: 1 },
        { label: "الرصيد", direction: "ltr" as const, widthWeight: 1 },
      ],
      rows: [["دفعة 000012", "-100.00 ج.م", "180.00 ج.م"]],
    };
    const calls = capturePaint(doc);
    expect(calls).toContain("-100.00");
    expect(calls).toContain("ج.م");
    const csv = renderOperationalReportCsv(doc);
    expect(csv).toContain("'-100.00 ج.م");
    const detail = createOperationalReportXlsxParts(doc)
      .find(part => part.name === "xl/worksheets/sheet2.xml")!.content;
    expect(detail).toContain("-100.00 ج.م");
  });

  it("prints an explicit empty row and refuses an oversized single PNG rather than truncating", () => {
    const empty = fixture(0);
    expect(capturePaint(empty)).toContain(empty.emptyMessage);
    expect(() => createOperationalReportImageLayout(fixture(140))).toThrow(/لن تُحذف أي حركة/);
    expect(createOperationalReportImageLayout(fixture(10)).rows).toHaveLength(10);
  });

  it("paginates PDF without losing rows and rejects more than 60 pages", () => {
    const doc = fixture(15);
    const pages = paginateOperationalReportForPdf(doc);
    expect(pages.map(page => page.rows.length)).toEqual([14, 1]);
    expect(pages.flatMap(page => page.rows.map(row => row[0]))).toEqual(
      doc.rows.map(row => row[0])
    );
    expect(pages.every(page => page.metadata === doc.metadata &&
      page.summarySections === doc.summarySections)).toBe(true);
    expect(() => paginateOperationalReportForPdf(fixture(841))).toThrow(/لن تُحذف أي حركة/);
    expect(paginateOperationalReportForPdf(fixture(0))).toHaveLength(1);
  });

  it("creates a real RTL XLSX with summary and detail sheets, exact text IDs and no formulas", async () => {
    const doc = fixture();
    const parts = createOperationalReportXlsxParts(doc);
    const detail = parts.find(part => part.name === "xl/worksheets/sheet2.xml")!.content;
    const summary = parts.find(part => part.name === "xl/worksheets/sheet1.xml")!.content;
    expect(summary).toContain("إجمالي اليوم المحدد");
    expect(summary).toContain("2026-11-05");
    expect(detail).toContain("0001");
    expect(detail).toContain("0002");
    expect(detail).toContain('rightToLeft="1"');
    expect(detail).toContain('t="inlineStr"');
    expect(detail).not.toContain("<f>");
    const blob = renderOperationalReportXlsx(doc);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const zip = new Uint8Array(await blob.arrayBuffer());
    expect([...zip.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const entries = localZipEntries(zip);
    expect(entries.size).toBe(7);
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="تفاصيل التقرير"');
    expect(entries.get("[Content_Types].xml")).toContain("spreadsheetml.sheet.main+xml");
  });

  it("keeps empty details explicit, escapes hostile XML, and validates row shape", () => {
    const doc = fixture(0);
    const emptyDetail = createOperationalReportXlsxParts(doc)
      .find(part => part.name === "xl/worksheets/sheet2.xml")!.content;
    expect(emptyDetail).toContain("لا توجد حركات خلال الفترة.");
    const hostile = fixture(1);
    const altered = { ...hostile, rows: [["=1+1", "<img>&", "third"] ] };
    const detail = createOperationalReportXlsxParts(altered)
      .find(part => part.name === "xl/worksheets/sheet2.xml")!.content;
    expect(detail).toContain("=1+1");
    expect(detail).toContain("&lt;img&gt;&amp;");
    expect(detail).not.toContain("<f>");
    expect(() => renderOperationalReportCsv({ ...hostile, rows: [["short"]] }))
      .toThrow(/لا يطابق عدد الأعمدة/);
    expect(() => createOperationalReportXlsxParts({
      ...hostile, rows: [["bad\u0000value", "x", "y"]],
    })).toThrow(/حروف تحكم/);
  });
});
