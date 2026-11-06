import { expect, test } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function setTheme(page:import("@playwright/test").Page,theme:"light"|"dark"){
  await expect(page.locator("html")).toHaveAttribute("data-theme",/^(light|dark)$/);
  if(await page.locator("html").getAttribute("data-theme")!==theme){
    await page.getByRole("button",{name:theme==="dark"?"تفعيل الوضع الداكن":"تفعيل الوضع الفاتح"}).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
}
async function getDownload(page:import("@playwright/test").Page,label:string){
  const [d]=await Promise.all([page.waitForEvent("download"),page.getByRole("button",{name:label}).click()]);
  const path=await d.path();if(!path)throw new Error("Download path missing");
  return {name:d.suggestedFilename(),bytes:await readFile(path)};
}

test.describe("H063 contractor work sign and receipt semantics",()=>{
  test("table shows a real separate receipt and signed effects for both directions",async({page})=>{
    await page.goto("/demo/contractors");
    const table=page.locator("main table").first();
    await expect(table.getByRole("columnheader",{name:"رقم النقلة"})).toBeVisible();
    await expect(table.getByRole("columnheader",{name:"رقم الإيصال"})).toBeVisible();
    await expect(table.getByRole("columnheader",{name:/الأثر على حساب أحمد/})).toBeVisible();
    const plus=table.getByRole("row").filter({hasText:"TRIP-HIST-001"});
    const minus=table.getByRole("row").filter({hasText:"TRIP-HIST-003"});
    await expect(plus).toContainText("REC-001");
    await expect(plus).toContainText("+300.00");
    await expect(minus).toContainText("REC-003");
    await expect(minus).toContainText("-600.00");
    await expect(minus).toContainText("خصم على أحمد");
    await expect(page.getByText("-600.00 ج.م").first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });

  test("real CSV and XLSX export preserve signs and receipt/trip identifiers",async({page})=>{
    await page.goto("/demo/contractors");
    const csv=await getDownload(page,"تنزيل CSV");
    const csvText=csv.bytes.toString("utf8");
    for(const token of ["رقم النقلة","رقم الإيصال","TRIP-HIST-001","REC-001","REC-003","+300.00","-600.00"]){
      expect(csvText,token).toContain(token);
    }
    const xlsx=await getDownload(page,"تنزيل Excel XLSX");
    expect(xlsx.bytes.subarray(0,4).toString("hex")).toBe("504b0304");
    const xlsxXml=xlsx.bytes.toString("utf8"); // current XLSX stores XML uncompressed
    for(const token of ["رقم النقلة","رقم الإيصال","REC-001","REC-003","+300.00","-600.00"]){
      expect(xlsxXml,token).toContain(token);
    }
    expect(xlsxXml).toContain('autoFilter ref="A1:F4"');
    expect(xlsxXml).not.toContain("<f>");
  });

  test("capture phone+desktop proof and keep fixed-format PNG/PDF independent of theme",async({page})=>{
    test.setTimeout(120_000);
    await page.clock.setFixedTime(new Date("2026-11-05T12:00:00+02:00"));
    await mkdir("artifacts/h063",{recursive:true});
    const hashes:string[][]=[];
    for(const [width,theme] of [[360,"dark"],[1280,"light"]] as const){
      await page.setViewportSize({width,height:780});
      await page.goto("/demo/contractors");
      await setTheme(page,theme);
      await page.screenshot({path:"artifacts/h063/contractor-"+theme+"-"+width+".png",fullPage:true});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
      const png=await getDownload(page,"تنزيل صورة PNG");
      const pdf=await getDownload(page,"تنزيل PDF مباشر");
      expect(png.bytes.readUInt32BE(16)).toBe(1440);
      expect(pdf.bytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
      hashes.push([createHash("sha256").update(png.bytes).digest("hex"),
        createHash("sha256").update(pdf.bytes).digest("hex")]);
      if(width===360){
        await writeFile("artifacts/h063/contractor-signed-receipts.png",png.bytes);
        await writeFile("artifacts/h063/contractor-signed-receipts.pdf",pdf.bytes);
      }
    }
    expect(hashes[0]).toEqual(hashes[1]);
  });
});
