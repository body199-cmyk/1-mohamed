import type { OperationalReportDocument } from "./document-types";
import { assertOperationalReportDocument } from "./report-document-validation";
import { assemblePdfJpegPages, type PdfJpegPage } from "./render-statement-pdf";
import { createOperationalReportImageLayout, paintOperationalReportImage } from "./render-report-image";

const PDF_WIDTH = 1440;
export const OPERATIONAL_REPORT_PAGE_HEIGHT = 2036;
const ROWS_PER_PAGE = 14;
const MAX_PAGES = 60;

export function paginateOperationalReportForPdf(
  doc: OperationalReportDocument,
  { maxPages = MAX_PAGES }: { readonly maxPages?: number } = {},
): readonly OperationalReportDocument[] {
  assertOperationalReportDocument(doc);
  if(doc.presentation==='compact-statement')return paginateCompact(doc,maxPages);
  const count = Math.max(1, Math.ceil(doc.rows.length / ROWS_PER_PAGE));
  if (count > maxPages) {
    throw new Error("التقرير أكبر من حد ٦٠ صفحة PDF المباشر؛ اختر فترة أقصر أو استخدم الطباعة وCSV. لن تُحذف أي حركة.");
  }
  return Array.from({ length: count }, (_, index) => ({
    ...doc,
    rows: doc.rows.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE),
    ...(doc.rowTones?{rowTones:doc.rowTones.slice(index * ROWS_PER_PAGE, (index + 1) * ROWS_PER_PAGE)}:{}),
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
      fixedHeight: OPERATIONAL_REPORT_PAGE_HEIGHT,
      pageLabel: "صفحة " + (index + 1) + " من " + pages.length,
    });
    const canvas = document.createElement("canvas");
    canvas.width = PDF_WIDTH;
    canvas.height = OPERATIONAL_REPORT_PAGE_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("متصفحك لا يدعم إعداد صفحات PDF.");
    paintOperationalReportImage(ctx, layout);
    images.push({ width: PDF_WIDTH, height: OPERATIONAL_REPORT_PAGE_HEIGHT, jpeg: await toJpegBytes(canvas) });
    canvas.width = 0;
    canvas.height = 0;
  }
  return new Blob([assemblePdfJpegPages(images)], { type: "application/pdf" });
}

/** Fit complete rows, including separate payments, against actual document height. */
function paginateCompact(doc:OperationalReportDocument,maxPages:number):readonly OperationalReportDocument[]{
 type Section=NonNullable<OperationalReportDocument['detailSections']>[number];
 const source:Section[]=[{title:doc.detailsTitle??'تفاصيل التقرير',columns:doc.columns,rows:doc.rows,emptyMessage:doc.emptyMessage,...(doc.rowTones?{rowTones:doc.rowTones}:{})},...(doc.detailSections??[])];
 const pages:OperationalReportDocument[]=[];let sections:Section[]=[];
 const documentFor=(parts:Section[]):OperationalReportDocument=>({...doc,detailsTotal:parts[0]!.title===doc.detailsTitle?doc.detailsTotal:undefined,detailsTitle:parts[0]!.title,columns:parts[0]!.columns,rows:parts[0]!.rows,rowTones:parts[0]!.rowTones,emptyMessage:parts[0]!.emptyMessage,detailSections:parts.slice(1)});
 const fit=(parts:Section[])=>{try{createOperationalReportImageLayout(documentFor(parts),{fixedHeight:OPERATIONAL_REPORT_PAGE_HEIGHT});return true;}catch{return false;}};
 for(const section of source){
  const records=section.rows.length?section.rows:[null];let starts=true;
  for(let i=0;i<records.length;i++){
   const value=records[i];const one:Section={...section,rows:value?[value]:[],rowTones:section.rowTones&&value?[section.rowTones[i]!]:undefined};
   let candidate:Section[];
   if(starts)candidate=[...sections,one];else {const previous=sections[sections.length-1]!;candidate=[...sections.slice(0,-1),{...previous,rows:[...previous.rows,...one.rows],rowTones:previous.rowTones?[...previous.rowTones,...(one.rowTones??[])]:undefined}];}
   if(!fit(candidate)){
    if(!sections.length)throw new Error('صف التقرير أطول من صفحة PDF؛ استخدم Excel أو الطباعة. لن تُحذف أي حركة.');
    pages.push(documentFor(sections));if(pages.length>=maxPages)throw new Error('التقرير أكبر من حد ٦٠ صفحة PDF؛ اختر فترة أقصر. لن تُحذف أي حركة.');
    candidate=[one];if(!fit(candidate))throw new Error('صف التقرير أطول من صفحة PDF؛ لن تُحذف أي حركة.');
   }
   sections=candidate;starts=false;
  }
 }
 if(sections.length)pages.push(documentFor(sections));return pages;
}
