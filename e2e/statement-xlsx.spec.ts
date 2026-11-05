import { expect,test } from "@playwright/test";
import { readFile } from "node:fs/promises";

function entries(buffer:Buffer):Map<string,string>{
  const view=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);
  const result=new Map<string,string>();
  let off=0;
  while(off+30<=buffer.length && view.getUint32(off,true)===0x04034b50) {
    const len=view.getUint32(off+18,true);
    const nameLen=view.getUint16(off+26,true);
    const extra=view.getUint16(off+28,true);
    const start=off+30;
    const data=start+nameLen+extra;
    result.set(buffer.subarray(start,start+nameLen).toString("utf8"),
      buffer.subarray(data,data+len).toString("utf8"));
    off=data+len;
  }
  expect(view.getUint32(off,true)).toBe(0x02014b50);
  expect(view.getUint32(buffer.length-22,true)).toBe(0x06054b50);
  return result;
}

test.describe("T09.3 download actual XLSX with exact Arabic source strings",()=>{
  test("exports a valid ZIP workbook with two RTL sheets and original statement values",async({page})=>{
    await page.goto("/demo/contractors");
    const [download]=await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button",{name:"تنزيل Excel XLSX"}).click()
    ]);
    expect(download.suggestedFilename()).toBe("demo-statement-2026-11-01-2026-11-30.xlsx");
    const path=await download.path();
    expect(path).toBeTruthy();
    const zip=await readFile(path!);
    expect(zip.subarray(0,4).toString("hex")).toBe("504b0304");
    const files=entries(zip);
    expect(files.size).toBe(7);
    expect(files.get("xl/workbook.xml")).toContain('sheet name="ملخص الكشف"');
    expect(files.get("xl/worksheets/sheet1.xml")).toContain("شركة");
    expect(files.get("xl/worksheets/sheet2.xml")).toContain("TRIP-HIST-001");
    expect(files.get("xl/worksheets/sheet2.xml")).toContain('t="inlineStr"');
  });
  test("exports empty period without phantom financial rows, invalid period cannot export",async({page})=>{
    await page.goto("/demo/contractors");
    await page.getByLabel("من تاريخ").fill("2026-11-12");
    await page.getByLabel("إلى تاريخ").fill("2026-11-13");
    const [download]=await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button",{name:"تنزيل Excel XLSX"}).click()
    ]);
    expect(download.suggestedFilename()).toContain("2026-11-12-2026-11-13.xlsx");
    await page.getByLabel("من تاريخ").fill("2026-10-01");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("يسبق تاريخ بداية حساب المقاول");
    await expect(page.getByRole("button",{name:"تنزيل Excel XLSX"})).toHaveCount(0);
  });
});
