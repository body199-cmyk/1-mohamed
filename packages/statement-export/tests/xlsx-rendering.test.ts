import { describe, expect, it } from "vitest";
import {
  createStatementXlsxParts, renderContractorStatementXlsx, makeStoredZip,
} from "../src/render-statement-xlsx";
import type { ContractorStatementDocument } from "../src/document-types";

const fixture = (count = 2): ContractorStatementDocument => ({
  businessName: "أحمد أبو علي", counterpartyName: "شركة النيل",
  period: { from:"2026-11-01",to:"2026-11-30" },generatedAtLabel:"٥ نوفمبر",
  summary:{openingBalanceText:"-400.00 ج.م",ahmedWorkText:"1200.00 ج.م",
    counterpartyWorkText:"200.00 ج.م",closingBalanceText:"600.00 ج.م",
    closingBeneficiaryText:"لصالح أحمد",movementCountText:String(count)},
  rows:Array.from({length:count},(_,i)=>({
    reference:"000"+i,workDate:"2026-11-05",directionText:"شغل أحمد",
    amountText:"90071992547409.93 ج.م",runningBalanceText:"-123.45 ج.م"
  }))
});
function file(parts:readonly {name:string;content:string}[],name:string) {
  const p=parts.find(x=>x.name===name);
  expect(p).toBeTruthy();
  return p!.content;
}
function localZipEntries(zip:Uint8Array):Map<string,string> {
  const view=new DataView(zip.buffer,zip.byteOffset,zip.byteLength);
  const result=new Map<string,string>();
  const decoder=new TextDecoder();
  let cursor=0;
  while(cursor +30 <= zip.length && view.getUint32(cursor,true)===0x04034b50) {
    const size=view.getUint32(cursor+18,true);
    const nameLen=view.getUint16(cursor+26,true);
    const extraLen=view.getUint16(cursor+28,true);
    const nameStart=cursor+30;
    const payloadStart=nameStart+nameLen+extraLen;
    result.set(decoder.decode(zip.subarray(nameStart,nameStart+nameLen)),
      decoder.decode(zip.subarray(payloadStart,payloadStart+size)));
    cursor=payloadStart+size;
  }
  expect(view.getUint32(cursor,true)).toBe(0x02014b50);
  expect(view.getUint32(zip.length-22,true)).toBe(0x06054b50);
  return result;
}

describe("T09.3 exact text-only Office Open XML workbook",()=>{
  it("contains the same period, 6 summary values and all rows with leading-zero IDs",()=>{
    const doc=fixture();
    const parts=createStatementXlsxParts(doc);
    const summary=file(parts,"xl/worksheets/sheet1.xml");
    const detail=file(parts,"xl/worksheets/sheet2.xml");
    for(const v of [
      doc.businessName,doc.counterpartyName,doc.period.from,doc.period.to,
      doc.summary.openingBalanceText,doc.summary.ahmedWorkText,
      doc.summary.counterpartyWorkText,doc.summary.closingBalanceText,
      doc.summary.closingBeneficiaryText,doc.summary.movementCountText
    ])expect(summary).toContain(v);
    expect(detail).toContain("0000");
    expect(detail).toContain("0001");
    expect(detail).toContain("90071992547409.93 ج.م");
    expect(detail).toContain('t="inlineStr"');
    expect(detail).not.toContain("<f>");
    expect(detail).toContain('rightToLeft="1"');
    expect(detail).toContain('ySplit="1"');
  });
  it("writes a real ZIP XLSX with standard workbook, style and worksheet entries",async()=>{
    const blob=renderContractorStatementXlsx(fixture());
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const zip=new Uint8Array(await blob.arrayBuffer());
    expect([...zip.subarray(0,4)]).toEqual([0x50,0x4b,0x03,0x04]);
    const entries=localZipEntries(zip);
    expect(entries.size).toBe(7);
    expect(entries.get("xl/workbook.xml")).toContain('sheet name="تفاصيل الحركات"');
    expect(entries.get("[Content_Types].xml")).toContain("spreadsheetml.sheet.main+xml");
  });
  it("preserves an empty period as an explicit row and refuses truncation of huge reports",()=>{
    expect(file(createStatementXlsxParts(fixture(0)),"xl/worksheets/sheet2.xml"))
      .toContain("لا توجد حركات خلال الفترة");
    expect(()=>createStatementXlsxParts(fixture(25001))).toThrow(/لن تُحذف حركات/);
    expect(file(createStatementXlsxParts(fixture(500)),"xl/worksheets/sheet2.xml"))
      .toContain("000499");
  });
  it("escapes hostile XML and Excel-looking formula text as literal string data",()=>{
    const doc=fixture();
    const altered={...doc,rows:[{...doc.rows[0]!,reference:"=SUM(1,1)",
      directionText:"<note>& \" tricky </note>"}]};
    const detail=file(createStatementXlsxParts(altered),"xl/worksheets/sheet2.xml");
    expect(detail).toContain(">=SUM(1,1)</t>"); // literal inlineStr is not a formula
    expect(detail).toContain("&lt;note&gt;&amp;");
    expect(detail).not.toContain("<f>");
    expect(detail).not.toContain("<note>");
  });
  it("rejects illegal XML control chars and duplicate ZIP entry names",()=>{
    expect(()=>createStatementXlsxParts({...fixture(),counterpartyName:"عربيات\u0000"}))
      .toThrow(/حروف تحكم/);
    expect(()=>makeStoredZip([{name:"x.xml",content:"a"},{name:"x.xml",content:"b"}]))
      .toThrow(/مكررة/);
  });
});
