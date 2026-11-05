import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.describe("H057 pre-cloud form polish",()=>{
  test("trip direction is a native radio group with clickable cards and full keyboard access", async({page})=>{
    await page.setViewportSize({width:360,height:740});
    await page.goto("/demo/trips");
    const group=page.getByRole("radiogroup",{name:"اتجاه الشغل والمسؤولية المالية"});
    await expect(group).toBeVisible();
    const ahmed=group.getByRole("radio",{name:"أحمد جاب العربيات"});
    const other=group.getByRole("radio",{name:"المقاول جاب العربيات"});
    // Start from actual demo state; do not assume which direction the form defaults to.
    await group.getByText("شغل المقاول (أحمد مدين للمقاول)").click();
    await expect(other).toBeChecked();
    await ahmed.focus();
    await page.keyboard.press("Space");
    await expect(ahmed).toBeChecked();
    const outline=await ahmed.evaluate(el=>getComputedStyle(el.closest("label")!).outlineWidth);
    expect(parseFloat(outline)).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });

  test("editable entry, master register and payment screens fit phone/tablet/desktop",async({page})=>{
    for(const width of [360,768,1280]){
      await page.setViewportSize({width,height:780});
      for(const path of ["/demo/trips","/demo/master-data","/demo/payments"]){
        await page.goto(path);
        await expect(page.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),
          path+" at "+width).toBe(false);
      }
    }
  });

  test("renders six before-cloud form screenshots in dark and light themes",async({page})=>{
    await mkdir("artifacts/h057",{recursive:true});
    await page.setViewportSize({width:360,height:760});
    for(const [path,name] of [
      ["/demo/trips","trips"],["/demo/master-data","master-data"],["/demo/payments","payments"]
    ]){
      await page.goto(path);
      await page.screenshot({path:"artifacts/h057/"+name+"-light-360.png",fullPage:true});
    }
    await page.goto("/demo/trips");
    if(await page.getByRole("button",{name:"تفعيل الوضع الداكن"}).count()){
      await page.getByRole("button",{name:"تفعيل الوضع الداكن"}).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
    for(const [path,name] of [
      ["/demo/trips","trips"],["/demo/master-data","master-data"],["/demo/payments","payments"]
    ]){
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
      await page.screenshot({path:"artifacts/h057/"+name+"-dark-360.png",fullPage:true});
    }
  });
});
