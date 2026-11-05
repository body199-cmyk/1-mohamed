import { describe, expect, it } from "vitest";
import { assemblePdfJpegPages, paginateStatementForPdf } from "../src/render-statement-pdf";
import { createStatementImageLayout } from "../src/render-statement-image";
import type { ContractorStatementDocument } from "../src/document-types";

const fixture = (n=1):ContractorStatementDocument => ({
  businessName:"أحمد — بيانات تجريبية",counterpartyName:"مقاول",
  period:{from:"2026-11-01",to:"2026-11-30"},generatedAtLabel:"٥ نوفمبر",
  summary:{openingBalanceText:"0.00 ج.م",ahmedWorkText:"100.00 ج.م",
    counterpartyWorkText:"0.00 ج.م",closingBalanceText:"100.00 ج.م",
    closingBeneficiaryText:"لصالح أحمد",movementCountText:String(n)},
  rows:Array.from({length:n},(_,i)=>({
    reference:"000"+i,workDate:"2026-11-05",directionText:"شغل أحمد",
    amountText:"100.00 ج.م",runningBalanceText:"100.00 ج.م"
  }))
});
const minimalJpeg=new Uint8Array([0xff,0xd8,0xff,0xd9]);

describe("T09.2 direct A4 paginated PDF from identical report",()=>{
  it("splits all 35 detail records into 17/17/1 without loss, summary or period changes",()=>{
    const doc=fixture(35);
    const pages=paginateStatementForPdf(doc);
    expect(pages.map(p=>p.rows.length)).toEqual([17,17,1]);
    expect(pages.flatMap(p=>p.rows.map(r=>r.reference))).toEqual(doc.rows.map(r=>r.reference));
    expect(pages.every(p=>p.summary===doc.summary && p.period===doc.period)).toBe(true);
    expect(pages.every(p=>createStatementImageLayout(p).height <= 2036-90)).toBe(true);
  });
  it("empty statement still has exactly one page",()=>{
    expect(paginateStatementForPdf(fixture(0)).map(p=>p.rows.length)).toEqual([0]);
  });
  it("rejects over 60 pages rather than silently losing entries",()=>{
    expect(()=>paginateStatementForPdf(fixture(17*60+1))).toThrow(/لن تُحذف حركات/);
  });
  it("creates valid byte-addressable PDF catalog, page objects, xref and trailer",()=>{
    const pdf=assemblePdfJpegPages([
      {width:1440,height:2036,jpeg:minimalJpeg},
      {width:1440,height:2036,jpeg:minimalJpeg}
    ]);
    const binary=new TextDecoder("latin1").decode(pdf);
    expect(binary.startsWith("%PDF-1.4")).toBe(true);
    expect(binary).toContain("/Type /Pages /Kids [3 0 R 6 0 R] /Count 2");
    expect((binary.match(/\/Subtype \/Image/g)||[]).length).toBe(2);
    expect(binary).toContain("/MediaBox [0 0 595.28 841.89]");
    const trailer=binary.match(/startxref\n(\d+)\n%%EOF/);
    expect(trailer).not.toBeNull();
    const offset=Number(trailer![1]);
    expect(binary.slice(offset,offset+5)).toBe("xref\n");
    const xref=binary.slice(offset).split("\n");
    for(let id=1;id<=8;id++){
      const objectOffset=Number(xref[2+id]!.slice(0,10));
      expect(binary.slice(objectOffset,objectOffset+8)).toBe(id+" 0 obj\n");
    }
  });
  it("rejects missing, PNG or incorrect-size page bytes",()=>{
    expect(()=>assemblePdfJpegPages([])).toThrow(/عدد صفحات/);
    expect(()=>assemblePdfJpegPages([{width:1440,height:2036,jpeg:new Uint8Array([0x89,0x50,0x4e,0x47])}])).toThrow(/غير صالح/);
    expect(()=>assemblePdfJpegPages([{width:1200,height:2036,jpeg:minimalJpeg}])).toThrow(/غير صالح/);
  });
});
