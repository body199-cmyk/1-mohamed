import { describe, expect, it } from "vitest";
import type { ContractorStatementDocument } from "../src/document-types";
import { renderContractorStatementHtml } from "../src/render-statement-html";
import { renderContractorStatementCsv } from "../src/render-statement-csv";
import { createStatementXlsxParts } from "../src/render-statement-xlsx";
import { createStatementImageLayout, paintStatementImage } from "../src/render-statement-image";
import { paginateStatementForPdf } from "../src/render-statement-pdf";

function sample(rows = 2): ContractorStatementDocument {
  return {
    businessName: "أحمد أبو علي — بيانات تجريبية",
    counterpartyName: "مقاول تجريبي",
    period: {from:"2026-11-01",to:"2026-11-30"},
    generatedAtLabel:"2026-11-06 12:00",
    summary: {
      openingBalanceText:"0.00 ج.م",
      ahmedWorkText:"+300.00 ج.م",
      counterpartyWorkText:"-600.00 ج.م",
      closingBalanceText:"-300.00 ج.م",
      closingBeneficiaryText:"لصالح المقاول",
      movementCountText:String(rows),
    },
    rows:Array.from({length:rows},(_,i)=>({
      reference:"TRIP-00"+(i+1),
      workDate:"2026-11-0"+(i%9+1),
      receiptNumber:i===0?"REC-001":undefined,
      directionText:i%2===0?"أحمد جاب العربية":"المقاول جاب العربية",
      amountText:i%2===0?"+300.00 ج.م":"-600.00 ج.م",
      runningBalanceText:i%2===0?"+300.00 ج.م":"-300.00 ج.م",
    })),
  };
}

describe("H063 signed contractor statements from Ahmed's perspective",()=>{
  it("A4 print has separate trip and receipt columns with signed balances and no missing rows",()=>{
    const html=renderContractorStatementHtml(sample());
    for(const t of ["رقم النقلة","رقم الإيصال","REC-001","+300.00 ج.م","-600.00 ج.م","-300.00 ج.م"]) {
      expect(html).toContain(t);
    }
    expect(html).toContain('colspan="6"').toBe(false); // only empty statement gets placeholder
    const first=html.indexOf("TRIP-001"),receipt=html.indexOf("REC-001"),date=html.indexOf("2026-11-01",first);
    expect(first).toBeGreaterThan(-1);
    expect(receipt).toBeGreaterThan(first);
    expect(date).toBeGreaterThan(first);
    expect(html.indexOf('class="col-date"')).toBeLessThan(html.indexOf('class="col-receipt"'));
    expect(renderContractorStatementHtml({...sample(),rows:[]})).toContain('colspan="6"');
  });

  it("CSV preserves both signs and treats untrusted receipts as escaped text, never formula",()=>{
    const csv=renderContractorStatementCsv(sample());
    expect(csv).toContain("رقم النقلة");
    expect(csv).toContain("رقم الإيصال");
    expect(csv).toContain("REC-001");
    expect(csv).toContain("+300.00 ج.م");
    expect(csv).toContain("-600.00 ج.م");
    expect(csv).toContain("—"); // receipt absent on second row
    expect(csv).toContain('"\'-600.00 ج.م"'); // spreadsheet formula guard
  });

  it("XLSX detail sheet has 6 text-only RTL columns and a correct autofilter",()=>{
    const files=createStatementXlsxParts(sample());
    const detail=files.find(p=>p.name==="xl/worksheets/sheet2.xml")!.content;
    expect(detail).toContain("رقم الإيصال");
    expect(detail).toContain("REC-001");
    expect(detail).toContain("-600.00 ج.م");
    expect(detail).toContain('autoFilter ref="A1:F3"');
    expect(detail).toContain('rightToLeft="1"');
    expect(detail).not.toContain("<f>");
    expect((detail.match(/<c r="[A-F]2"/g)||[]).length).toBe(6);
    expect(createStatementXlsxParts({...sample(),rows:[]})
      .find(p=>p.name==="xl/worksheets/sheet2.xml")!.content)
      .toContain("لا توجد حركات خلال الفترة");
  });

  it("PNG/PDF same immutable 1440-wide layout paints six columns, signs and receipt",()=>{
    const doc=sample();
    const layout=createStatementImageLayout(doc);
    expect(layout.width).toBe(1440);
    const calls:string[]=[];
    const ctx={
      fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
      fillText(t:string){calls.push(t)},fillStyle:"",strokeStyle:"",font:"",
      textAlign:"",textBaseline:"",direction:"",lineWidth:0,
    } as unknown as CanvasRenderingContext2D;
    paintStatementImage(ctx,layout);
    for(const t of ["رقم النقلة","رقم الإيصال","REC-001","TRIP-001","-600.00 ج.م","+300.00 ج.م"]) {
      expect(calls.some(x=>x.includes(t)),t).toBe(true);
    }
    const long=sample(35);
    const pages=paginateStatementForPdf(long);
    expect(pages.map(p=>p.rows.length)).toEqual([17,17,1]);
    expect(pages.flatMap(p=>p.rows.map(r=>r.reference))).toEqual(long.rows.map(r=>r.reference));
    expect(pages[0]!.rows[0]!.receiptNumber).toBe("REC-001");
  });
});
