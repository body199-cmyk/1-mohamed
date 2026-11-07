import type { OperationalReportDocument } from "./document-types";
import { assertOperationalReportDocument } from "./report-document-validation";
import { escapeXlsxText, makeStoredZip, type XlsxFilePart } from "./render-statement-xlsx";

const XML_START = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

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
  rows: readonly (readonly string[])[],
  widths: readonly number[],
  headerRows: readonly number[],
  freezeFirstRow: boolean,
): string {
  const columns = widths.map((width, index) =>
    '<col min="' + (index + 1) + '" max="' + (index + 1) +
    '" width="' + width + '" customWidth="1"/>'
  ).join("");
  const rowXml = rows.map((values, rowIndex) => {
    const rowId = rowIndex + 1;
    const header = headerRows.includes(rowId);
    const cells = values.map((value, columnIndex) =>
      '<c r="' + columnLetter(columnIndex) + rowId + '" t="inlineStr"' +
      (header ? ' s="1"' : '') + '><is><t xml:space="preserve">' +
      escapeXlsxText(value) + '</t></is></c>'
    ).join("");
    return '<row r="' + rowId + '" ht="' + (header ? "27" : "22") +
      '" customHeight="1">' + cells + '</row>';
  }).join("");
  const lastColumn = columnLetter(Math.max(0, widths.length - 1));
  const sheetView = '<sheetViews><sheetView workbookViewId="0" rightToLeft="1">' +
    (freezeFirstRow ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : '') +
    '</sheetView></sheetViews>';
  return XML_START + '<worksheet xmlns="' + SHEET_NS + '">' + sheetView +
    '<sheetFormatPr defaultRowHeight="22"/><cols>' + columns + '</cols>' +
    '<sheetData>' + rowXml + '</sheetData>' +
    (freezeFirstRow ? '<autoFilter ref="A1:' + lastColumn + rows.length + '"/>' : '') +
    '<pageSetup orientation="landscape" paperSize="9"/></worksheet>';
}

export function createOperationalReportXlsxParts(
  doc: OperationalReportDocument,
): readonly XlsxFilePart[] {
  assertOperationalReportDocument(doc);
  const summaryRows: string[][] = [
    [doc.title],
    ["اسم المنشأة", doc.businessName],
    ...doc.metadata.map(item => [item.label, item.value]),
    ["تاريخ الإعداد", doc.generatedAtLabel],
    [],
  ];
  const headerRows = [1];
  for (const section of doc.summarySections) {
    summaryRows.push([section.title]);
    headerRows.push(summaryRows.length);
    summaryRows.push(["المؤشر", "القيمة"]);
    headerRows.push(summaryRows.length);
    for (const metric of section.metrics) summaryRows.push([metric.label, metric.value]);
    summaryRows.push([]);
  }
  for (const note of doc.footerNotes) summaryRows.push(["ملاحظة", note]);
  const detailRows: string[][] = [
    doc.columns.map(column => column.label),
    ...(doc.rows.length
      ? doc.rows.map(row => [...row])
      : [[doc.emptyMessage, ...doc.columns.slice(1).map(() => "")]]),
  ];
  const widths = doc.columns.map(column =>
    Math.max(12, Math.min(42, Math.round(column.widthWeight * 10)))
  );
  const workbook = XML_START + '<workbook xmlns="' + SHEET_NS + '" xmlns:r="' + REL_NS + '">' +
    '<bookViews><workbookView/></bookViews><sheets>' +
    '<sheet name="ملخص التقرير" sheetId="1" r:id="rId1"/>' +
    '<sheet name="تفاصيل التقرير" sheetId="2" r:id="rId2"/>' +
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
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const rootRels = XML_START + '<Relationships xmlns="' + PACKAGE_REL_NS + '">' +
    '<Relationship Id="rId1" Type="' + REL_NS + '/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const workbookRels = XML_START + '<Relationships xmlns="' + PACKAGE_REL_NS + '">' +
    '<Relationship Id="rId1" Type="' + REL_NS + '/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="' + REL_NS + '/worksheet" Target="worksheets/sheet2.xml"/>' +
    '<Relationship Id="rId3" Type="' + REL_NS + '/styles" Target="styles.xml"/></Relationships>';
  return [
    { name: "[Content_Types].xml", content: contentTypes },
    { name: "_rels/.rels", content: rootRels },
    { name: "xl/workbook.xml", content: workbook },
    { name: "xl/_rels/workbook.xml.rels", content: workbookRels },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: renderSheet(summaryRows, [36, 72], headerRows, false) },
    { name: "xl/worksheets/sheet2.xml", content: renderSheet(detailRows, widths, [1], true) },
  ];
}

export function renderOperationalReportXlsx(doc: OperationalReportDocument): Blob {
  const bytes = makeStoredZip(createOperationalReportXlsxParts(doc));
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
