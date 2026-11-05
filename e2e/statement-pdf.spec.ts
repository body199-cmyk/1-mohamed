import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("T09.2 actual paginated PDF download",()=>{
  test("creates a real A4 PDF with byte-valid page, image and trailer",async({page})=>{
    await page.goto("/demo/contractors");
    const [download]=await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button",{name:"تنزيل PDF مباشر"}).click()
    ]);
    expect(download.suggestedFilename()).toBe("demo-statement-2026-11-01-2026-11-30.pdf");
    const file=await download.path();
    expect(file).toBeTruthy();
    const pdf=await readFile(file!);
    expect(pdf.subarray(0,8).toString()).toBe("%PDF-1.4");
    const text=pdf.toString("latin1");
    expect(text).toContain("/Type /Pages /Kids [3 0 R] /Count 1");
    expect(text).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter /DCTDecode");
    const startxref=text.match(/startxref\n(\d+)\n%%EOF/);
    expect(startxref).not.toBeNull();
    expect(text.slice(Number(startxref![1]),Number(startxref![1])+5)).toBe("xref\n");
    expect(pdf.length).toBeGreaterThan(10000);
  });
  test("valid empty period exports a PDF, invalid range disables export",async({page})=>{
    await page.goto("/demo/contractors");
    await page.getByLabel("من تاريخ").fill("2026-11-12");
    await page.getByLabel("إلى تاريخ").fill("2026-11-13");
    const [download]=await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button",{name:"تنزيل PDF مباشر"}).click()
    ]);
    expect(download.suggestedFilename()).toContain("2026-11-12-2026-11-13.pdf");
    await page.getByLabel("من تاريخ").fill("2026-10-01");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("يسبق تاريخ بداية حساب المقاول");
    await expect(page.getByRole("button",{name:"تنزيل PDF مباشر"})).toHaveCount(0);
  });
});
