import type { ContractorStatementDocument } from "./document-types";

/**
 * T09.3: real Office Open XML .xlsx with two RTL sheets, no remote provider.
 * Every financial display value and every reference is an inline TEXT cell:
 * never coerce high-precision piastres or leading-zero identifiers to Excel's
 * limited-precision IEEE754 numeric cells, or turn user content into formulas.
 */
export interface XlsxFilePart {
  readonly name: string;
  readonly content: string;
}
const MAX_ROWS = 25000;
const XML_START = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

export function escapeXlsxText(value: string): string {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new Error("الكشف يحتوي على حروف تحكم غير صالحة لملف Excel؛ صحح السجل قبل التصدير.");
  }
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function columnLetter(index: number): string {
  let i = index + 1;
  let result = "";
  while (i > 0) {
    i--;
    result = String.fromCharCode(65 + (i % 26)) + result;
    i = Math.floor(i / 26);
  }
  return result;
}

function renderSheet(
  rows: readonly (readonly string[])[], widths: readonly number[], headerRows: readonly number[],
  freezeFirstRow: boolean
): string {
  const columns = widths.map((width,i) =>
    '<col min="' + (i+1) + '" max="' + (i+1) + '" width="' + width + '" customWidth="1"/>'
  ).join("");
  const rowXml = rows.map((values,ri) => {
    const rowId = ri + 1;
    const header = headerRows.includes(rowId);
    const cells = values.map((text,i) =>
      '<c r="' + columnLetter(i) + rowId + '" t="inlineStr"' +
      (header ? ' s="1"' : '') + '><is><t xml:space="preserve">' +
      escapeXlsxText(text) + '</t></is></c>'
    ).join("");
    return '<row r="' + rowId + '" ht="' + (header ? "27" : "22") +
      '" customHeight="1">' + cells + '</row>';
  }).join("");

  const sheetView = '<sheetViews><sheetView workbookViewId="0" rightToLeft="1">' +
    (freezeFirstRow ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '') +
    '</sheetView></sheetViews>';
  return XML_START + '<worksheet xmlns="' + SHEET_NS + '">' + sheetView +
    '<sheetFormatPr defaultRowHeight="22"/><cols>' + columns + '</cols>' +
    '<sheetData>' + rowXml + '</sheetData>' +
    (freezeFirstRow ? '<autoFilter ref="A1:F' + rows.length + '"/>' : '') +
    '<pageSetup orientation="landscape" paperSize="9"/></worksheet>';
}

export function createStatementXlsxParts(doc: ContractorStatementDocument): readonly XlsxFilePart[] {
  if (doc.rows.length > MAX_ROWS) {
    throw new Error("كشف Excel يتجاوز حد ٢٥٠٠٠ حركة في تصدير المتصفح؛ اختر فترة أقصر، ولن تُحذف حركات بصمت.");
  }
  const summaryRows = [
    ["كشف شغل مقاول — بيانات تجريبية"],
    ["المنشأة", doc.businessName],
    ["المقاول", doc.counterpartyName],
    ["الفترة من", doc.period.from],
    ["الفترة إلى", doc.period.to],
    ["تاريخ الإعداد", doc.generatedAtLabel],
    [],
    ["المؤشر", "القيمة"],
    ["رصيد أول الفترة", doc.summary.openingBalanceText],
    ["شغل أحمد خلال الفترة", doc.summary.ahmedWorkText],
    ["شغل المقاول خلال الفترة", doc.summary.counterpartyWorkText],
    ["رصيد آخر الفترة", doc.summary.closingBalanceText],
    ["النتيجة", doc.summary.closingBeneficiaryText],
    ["عدد الحركات", doc.summary.movementCountText],
    [],
    ["ملاحظة", "فرق الشغل فقط؛ لا تشمل هذه الأرقام النقد المسدد للعربيات أو أرصدتها المستقلة."],
    ["دقة الأرقام", "القيم المالية والمراجع محفوظة كنص للعرض الحرفي دون تقريب Excel أو إزالة الأصفار البادئة."],
  ];

  const detailsRows = [
    ["رقم النقلة", "التاريخ", "رقم الإيصال", "اتجاه الشغل", "الأثر على حساب أحمد (+/−)", "الرصيد بعد الحركة"],
    ...(doc.rows.length ? doc.rows.map(r => [
      r.reference, r.workDate, r.receiptNumber?.trim() || "—", r.directionText, r.amountText, r.runningBalanceText
    ]) : [["لا توجد حركات خلال الفترة", "", "", "", "", ""]]),
  ];
  const summaryXml = renderSheet(summaryRows,[31,65],[1,8],false);
  const detailsXml = renderSheet(detailsRows,[29,20,23,54,30,32],[1],true);

  const workbook = XML_START + '<workbook xmlns="' + SHEET_NS + '" xmlns:r="' + REL_NS + '">' +
    '<bookViews><workbookView/></bookViews><sheets>' +
    '<sheet name="ملخص الكشف" sheetId="1" r:id="rId1"/>' +
    '<sheet name="تفاصيل الحركات" sheetId="2" r:id="rId2"/>' +
    '</sheets></workbook>';
  const styles = XML_START + '<styleSheet xmlns="' + SHEET_NS + '">' +
    '<fonts count="2"><font><sz val="11"/><name val="Cairo"/></font>' +
    '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Cairo"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FF206BC4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const contentTypes = XML_START +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';
  const rootRels = XML_START + '<Relationships xmlns="' + PACKAGE_REL_NS + '">' +
    '<Relationship Id="rId1" Type="' + REL_NS + '/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const workbookRels = XML_START + '<Relationships xmlns="' + PACKAGE_REL_NS + '">' +
    '<Relationship Id="rId1" Type="' + REL_NS + '/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="' + REL_NS + '/worksheet" Target="worksheets/sheet2.xml"/>' +
    '<Relationship Id="rId3" Type="' + REL_NS + '/styles" Target="styles.xml"/>' +
    '</Relationships>';
  return [
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: summaryXml },
    { name: "xl/worksheets/sheet2.xml", content: detailsXml },
  ];
}

const encoder = new TextEncoder();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Standards-compliant ZIP STORE archive for an offline XLSX (no compression deps). */
export function makeStoredZip(parts: readonly XlsxFilePart[]): Uint8Array {
  if (!parts.length || parts.length > 100 ||
      new Set(parts.map(p => p.name)).size !== parts.length) {
    throw new Error("قائمة ملفات Excel غير صالحة أو تحتوي أسماء مكررة.");
  }
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const put = (bytes: Uint8Array): void => { chunks.push(bytes); offset += bytes.length; };
  const central: Uint8Array[] = [];
  const view16 = (dv: DataView,n:number,value:number):void => dv.setUint16(n,value,true);
  const view32 = (dv: DataView,n:number,value:number):void => dv.setUint32(n,value,true);

  for (const part of parts) {
    if (!/^[A-Za-z0-9_\-./[\]]+$/.test(part.name) ||
        part.name.startsWith("/") || part.name.includes("..")) {
      throw new Error("اسم ملف Excel الداخلي غير صالح.");
    }
    const name = encoder.encode(part.name);
    const data = encoder.encode(part.content);
    if (data.length > 0xffffffff || name.length > 65535) {
      throw new Error("ملف Excel يتجاوز الحدود المسموحة.");
    }
    const crc = crc32(data);
    const localOffset = offset;
    const local = new Uint8Array(30);
    const l = new DataView(local.buffer);
    view32(l,0,0x04034b50);
    view16(l,4,20);
    view16(l,6,0);
    view16(l,8,0);
    view16(l,10,0);
    view16(l,12,0x21); // 1980-01-01 (valid DOS date)
    view32(l,14,crc);
    view32(l,18,data.length);
    view32(l,22,data.length);
    view16(l,26,name.length);
    view16(l,28,0);
    put(local); put(name); put(data);

    const directory = new Uint8Array(46);
    const d = new DataView(directory.buffer);
    view32(d,0,0x02014b50);
    view16(d,4,20);
    view16(d,6,20);
    view16(d,8,0);
    view16(d,10,0);
    view16(d,12,0);
    view16(d,14,0x21);
    view32(d,16,crc);
    view32(d,20,data.length);
    view32(d,24,data.length);
    view16(d,28,name.length);
    view16(d,30,0);
    view16(d,32,0);
    view16(d,34,0);
    view16(d,36,0);
    view32(d,38,0);
    view32(d,42,localOffset);
    central.push(directory,name);
  }
  const centralStart = offset;
  for (const chunk of central) put(chunk);
  const centralSize = offset - centralStart;
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  view32(e,0,0x06054b50);
  view16(e,4,0);view16(e,6,0);
  view16(e,8,parts.length);view16(e,10,parts.length);
  view32(e,12,centralSize);view32(e,16,centralStart);view16(e,20,0);
  put(end);
  const zip = new Uint8Array(offset);
  let next = 0;
  for (const chunk of chunks) { zip.set(chunk,next);next+=chunk.length; }
  return zip;
}

export function renderContractorStatementXlsx(doc: ContractorStatementDocument): Blob {
  const bytes = makeStoredZip(createStatementXlsxParts(doc));
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
