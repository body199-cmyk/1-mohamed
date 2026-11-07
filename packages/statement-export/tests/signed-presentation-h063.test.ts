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
  it("A4 print has trip IDs but no visible receipts with signed balances and no missing rows",()=>{
    const html=renderContractorStatementHtml(sample());
    for(const t of ["رقم النقلة","+300.00 ج.م","-600.00 ج.م","-300.00 ج.م"]) {
      expect(html).toContain(t);
    }
    expect(html).not.toContain("رقم الإيصال");
    expect(html).not.toContain("REC-001");
    const first=html.indexOf("TRIP-001"),date=html.indexOf("2026-11-01",first);
    expect(first).toBeGreaterThan(-1);
    expect(date).toBeGreaterThan(first);
    expect(renderContractorStatementHtml({...sample(),rows:[]})).toContain('colspan="5"');
  });

  it("CSV preserves both signs and hides receipts without changing monetary values",()=>{
    const csv=renderContractorStatementCsv(sample());
    expect(csv).toContain("رقم النقلة");
    expect(csv).not.toContain("رقم الإيصال");
    expect(csv).not.toContain("REC-001");
    expect(csv).toContain("+300.00 ج.م");
    expect(csv).toContain("-600.00 ج.م");
    expect(csv).toContain('"\'-600.00 ج.م"'); // spreadsheet formula guard
  });

  it("XLSX detail sheet has 5 text-only RTL columns and a correct autofilter",()=>{
    const files=createStatementXlsxParts(sample());
    const detail=files.find(p=>p.name==="xl/worksheets/sheet2.xml")!.content;
    expect(detail).not.toContain("رقم الإيصال");
    expect(detail).not.toContain("REC-001");
    expect(detail).toContain("-600.00 ج.م");
    expect(detail).toContain('autoFilter ref="A1:E3"');
    expect(detail).toContain('rightToLeft="1"');
    expect(detail).not.toContain("<f>");
    expect((detail.match(/<c r="[A-E]2"/g)||[]).length).toBe(5);
    expect(createStatementXlsxParts({...sample(),rows:[]})
      .find(p=>p.name==="xl/worksheets/sheet2.xml")!.content)
      .toContain("لا توجد حركات خلال الفترة");
  });

  it("PNG/PDF same immutable 1440-wide layout paints five columns and signs without receipts",()=>{
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
    for(const t of ["رقم النقلة","TRIP-001","-600.00 ج.م","+300.00 ج.م"]) {
      expect(calls.some(x=>x.includes(t)),t).toBe(true);
    }
    // Financial signs must be a leading LTR numeric token in the rendered PDF/PNG
    // summary too, not visually moved after the amount by bidi currency glyphs.
    expect(calls).toContain("+300.00");
    expect(calls).toContain("-600.00");
    expect(calls).toContain("شغل المقاول خلال الفترة (ج.م)");
    const long=sample(35);
    const pages=paginateStatementForPdf(long);
    expect(pages.map(p=>p.rows.length)).toEqual([17,17,1]);
    expect(pages.flatMap(p=>p.rows.map(r=>r.reference))).toEqual(long.rows.map(r=>r.reference));
    expect(calls).not.toContain("REC-001");
    expect(calls).not.toContain("رقم الإيصال");
  });
});
