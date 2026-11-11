import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { selectThemeViaSettings } from "./support/approved-theme";

const reports = [
  ["/demo/contractors", "contractors", 'div[class*="tableWrapper"]'],
  ["/demo/reports/daily", "daily", 'div[class*="tableScroll"]'],
  ["/demo/reports/vehicle-cash", "vehicle-cash", 'div[class*="_scroll_"]'],
] as const;

async function setTheme(page: import("@playwright/test").Page, theme: "light"|"dark") {
  await selectThemeViaSettings(page,theme);
}

const expectedTripIds = ["TRIP-HIST-001", "TRIP-HIST-002", "TRIP-HIST-003"] as const;

async function downloadReport(page: import("@playwright/test").Page, label: string) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", {name: label}).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Missing downloaded report bytes");
  const bytes = await readFile(path);
  return {bytes, name: download.suggestedFilename(),
    sha: createHash("sha256").update(bytes).digest("hex")};
}

test.describe("H062 responsive report screens, device-independent exported papers", () => {
  test("captures 18 light/dark report layouts at 360/768/1280 without losing rows", async({page}) => {
    test.setTimeout(180_000);
    await page.clock.setFixedTime(new Date("2026-11-06T12:00:00+02:00"));
    await mkdir("artifacts/h062",{recursive:true});
    for(const width of [360,768,1280] as const) {
      await page.setViewportSize({width,height:760});
      for(const theme of ["light","dark"] as const) {
        await page.goto("/demo/contractors");
        await setTheme(page,theme);
        for(const [path,name,tableSelector] of reports) {
          await page.goto(path);
          await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
          await expect(page.locator("main#main-content")).toBeVisible();
          expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            name + " whole-page overflow at " + width + " " + theme).toBe(false);
          if(width===360 && name==="contractors") {
            // Approved mobile screen uses expandable cards rather than the hidden
            // desktop table; prove the same IDs/deltas remain accessible.
            const cards=page.locator('main div[class*="mobileMovements"] details');
            await expect(cards).toHaveCount(3);
            await expect(cards.first()).toBeVisible();
            await cards.first().locator("summary").click();
            await expect(cards.first()).toHaveAttribute("open","");
            await expect(cards.first()).toContainText("رقم النقلة");
            for (const tripId of expectedTripIds) {
              const matchingCard = cards.filter({ hasText: tripId });
              await expect(matchingCard).toHaveCount(1);
              await expect(matchingCard).toContainText(tripId);
            }
          } else {
            const scroller=page.locator("main").locator(tableSelector).first();
            await expect(scroller).toBeVisible();
            const props=await scroller.evaluate(el=>({
              overflowX:getComputedStyle(el).overflowX,
              scroll:el.scrollWidth,client:el.clientWidth,
            }));
            expect(props.overflowX,name+" table must scroll locally").toBe("auto");
            if(width===360) expect(props.scroll,name+" table should be scrollable on phone").toBeGreaterThan(props.client);
          }
          await page.screenshot({
            path:"artifacts/h062/"+name+"-"+theme+"-"+width+".png",
            fullPage:true,
          });
        }
      }
    }
  });

  test("PNG and direct A4 PDF bytes are identical on phone-light and desktop-dark",async({page})=>{
    test.setTimeout(120_000);
    await page.clock.setFixedTime(new Date("2026-11-06T12:00:00+02:00"));
    const results=[];
    for(const [width,theme] of [[360,"light"],[1280,"dark"]] as const) {
      await page.setViewportSize({width,height:780});
      await page.goto("/demo/contractors");
      await setTheme(page,theme);
      const png=await downloadReport(page,"تنزيل صورة PNG");
      const pdf=await downloadReport(page,"تنزيل PDF مباشر");
      expect(png.bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(png.bytes.readUInt32BE(16)).toBe(1440);
      expect(pdf.bytes.subarray(0,8).toString()).toBe("%PDF-1.4");
      expect(pdf.bytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
      // Save one real exported PDF and PNG for independent visual inspection.
      if (width === 360) {
        await mkdir("artifacts/h062", {recursive:true});
        await writeFile("artifacts/h062/contractor-statement-fixed-A4.pdf",pdf.bytes);
        await writeFile("artifacts/h062/contractor-statement-fixed-1440.png",png.bytes);
      }
      results.push({png,pdf});
    }
    expect(results[0]!.png.name).toBe(results[1]!.png.name);
    expect(results[0]!.pdf.name).toBe(results[1]!.pdf.name);
    expect(results[0]!.png.sha,"PNG canvas pixels must not change with viewport or UI theme")
      .toBe(results[1]!.png.sha);
    expect(results[0]!.pdf.sha,"PDF paper bytes must not change with viewport or UI theme")
      .toBe(results[1]!.pdf.sha);
  });

  test("CSV and RTL Excel workbook bytes are identical on phone-dark and desktop-light",async({page})=>{
    test.setTimeout(100_000);
    await page.clock.setFixedTime(new Date("2026-11-06T12:00:00+02:00"));
    const results=[];
    for(const [width,theme] of [[360,"dark"],[1280,"light"]] as const) {
      await page.setViewportSize({width,height:780});
      await page.goto("/demo/contractors");
      await setTheme(page,theme);
      const csv=await downloadReport(page,"تنزيل CSV");
      const xlsx=await downloadReport(page,"تنزيل Excel XLSX");
      expect(csv.bytes.toString("utf8")).toContain("رصيد");
      expect(xlsx.bytes.subarray(0,4).toString()).toBe("PK\u0003\u0004");
      results.push({csv,xlsx});
    }
    expect(results[0]!.csv.sha,"CSV data cannot depend on viewport or UI theme").toBe(results[1]!.csv.sha);
    expect(results[0]!.xlsx.sha,"RTL workbook must keep identical bytes").toBe(results[1]!.xlsx.sha);
  });
});
