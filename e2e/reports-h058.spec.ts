import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { selectThemeViaSettings } from "./support/approved-theme";

const reports = [
  ["/demo/contractors","contractor"],
  ["/demo/reports/daily","daily"],
  ["/demo/reports/vehicle-cash","vehicle-cash"],
] as const;

test.describe("H058 pre-cloud reports and export visual polish",()=>{
  test("three report pages fit 360/768/1280 with real scrolling confined to tables",async({page})=>{
    for(const width of [360,768,1280]){
      await page.setViewportSize({width,height:760});
      for(const [path] of reports){
        await page.goto(path);
        await expect(page.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),
          path+" at "+width).toBe(false);
      }
    }
  });

  test("five export actions are clearly buttons with focus outlines; PDF primary and values unchanged",async({page})=>{
    await page.setViewportSize({width:360,height:760});
    await page.goto("/demo/contractors");
    const actions=page.getByRole("region",{name:"تصدير كشف الحساب"});
    for(const name of ["طباعة / حفظ PDF","تنزيل PDF مباشر","تنزيل صورة PNG","تنزيل CSV","تنزيل Excel XLSX"]) {
      await expect(actions.getByRole("button",{name,exact:true})).toHaveCount(1);
    }
    await expect(actions.getByRole("button",{name:"مشاركة صورة الكشف مباشرة"})).toHaveCount(1);
    const pdf=actions.getByRole("button",{name:"تنزيل PDF مباشر"});
    const xlsx=actions.getByRole("button",{name:"تنزيل Excel XLSX"});
    await expect(pdf).toBeVisible();
    await expect(xlsx).toBeVisible();
    await pdf.focus();
    const outline=await pdf.evaluate(el=>({
      style:getComputedStyle(el).outlineStyle,
      width:parseFloat(getComputedStyle(el).outlineWidth),
      height:el.getBoundingClientRect().height,
    }));
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
    expect(outline.height).toBeGreaterThanOrEqual(44);
    await expect(actions).toContainText("المبالغ والمراجع كنص");
  });

  test("captures the three report screens in both light and dark without server deployment",async({page})=>{
    await mkdir("artifacts/h058",{recursive:true});
    await page.setViewportSize({width:360,height:760});
    for(const [path,name] of reports){
      await page.goto(path);
      await page.screenshot({path:"artifacts/h058/"+name+"-light-360.png",fullPage:true});
    }
    await selectThemeViaSettings(page,"dark");
    await page.goto("/demo/contractors");
    await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
    for(const [path,name] of reports){
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
      await page.screenshot({path:"artifacts/h058/"+name+"-dark-360.png",fullPage:true});
    }
  });
});
