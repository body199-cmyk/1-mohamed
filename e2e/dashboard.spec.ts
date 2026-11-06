import { expect, test } from "@playwright/test";

test.describe("T08.6 dashboard — daily indicators and independent payments",()=>{
  test("root shows the daily dashboard with tested work totals and usable report links",async({page})=>{
    // The demo fixtures are dated 2026-11-05; the live Cairo date must not change financial assertions.
    await page.clock.setFixedTime(new Date("2026-11-05T12:00:00+02:00"));
    await page.goto("/");
    await expect(page).toHaveURL(/\/demo\/dashboard$/);
    await expect(page.getByRole("heading",{name:"الرئيسية — ملخص اليوم"})).toBeVisible();
    const metrics=page.getByRole("region",{name:"المؤشرات اليومية"});
    await expect(metrics).toContainText("1");
    await expect(metrics).toContainText("2.000 طن");
    await expect(metrics).toContainText("1000.00 ج.م");
    await expect(metrics).toContainText("900.00 ج.م");
    await expect(page.getByRole("region",{name:"آخر النقلات"})).toContainText("REC-002");
    await page.getByRole("navigation",{name:"اختصارات الرئيسية"}).getByRole("link",{name:"تقرير الشغل اليومي"}).click();
    await expect(page.getByRole("heading",{name:"تقرير الشغل اليومي"})).toBeVisible();
  });
  test("new same-day payment changes only independent payment KPI, not work amount; mobile has no overflow",async({page})=>{
    await page.clock.setFixedTime(new Date("2026-11-05T12:00:00+02:00"));
    await page.setViewportSize({width:360,height:740});
    await page.goto("/demo/payments");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-05");
    await page.getByLabel("المبلغ بالجنيه").fill("100");
    await page.getByRole("button",{name:"تسجيل الدفعة"}).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await page.getByRole("link",{name:"الرئيسية"}).click();
    const cash=page.getByRole("region",{name:"دفعات نقد العربيات اليوم"});
    const work=page.getByRole("region",{name:"المؤشرات اليومية"});
    await expect(cash).toContainText("100.00 ج.م");
    await expect(cash).toContainText("1 دفعة");
    await expect(work).toContainText("900.00 ج.م");
    await expect(page.getByRole("region",{name:"آخر دفعات العربيات"})).toContainText("100.00 ج.م");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });
});
