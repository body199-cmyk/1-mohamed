import { expect, test } from "@playwright/test";

test.describe("T08.4/5 vehicle cash report uses existing payment cash ledger",()=>{
  test("shows the correct contractor-owner cash, date range and receipt without work difference",async({page})=>{
    await page.goto("/demo/reports/vehicle-cash");
    await expect(page.getByRole("heading",{name:"كشف حساب نقد العربية"})).toBeVisible();
    const summary=page.getByRole("region",{name:"ملخص كشف نقد العربية"});
    await expect(summary).toContainText("280.00 ج.م");
    await expect(summary).toContainText("0.00 ج.م");
    await expect(page.getByRole("table",{name:"جدول حركات كشف العربية"})).toContainText("REC-001");
    await expect(page.getByRole("table",{name:"جدول حركات كشف العربية"})).not.toContainText("REC-002");
    await page.getByLabel("مسؤول النقد في الكشف").selectOption("K1");
    await expect(page.getByRole("region",{name:"ملخص كشف نقد العربية"})).toContainText("0.00 ج.م");
    await page.getByLabel("عربية كشف النقد").selectOption("V3");
    await expect(page.getByRole("region",{name:"ملخص كشف نقد العربية"})).toContainText("525.00 ج.م");
    await expect(page.getByRole("table",{name:"جدول حركات كشف العربية"})).toContainText("REC-003");
  });
  test("payment uses real payment date and carries balance to next period without counting it twice",async({page})=>{
    await page.goto("/demo/payments");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-03");
    await page.getByLabel("المبلغ بالجنيه").fill("100");
    await page.getByLabel("رقم إيصال الدفعة").fill("000012");
    await page.getByRole("button",{name:"تسجيل الدفعة"}).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await page.getByRole("link",{name:"كشف حساب نقد العربية"}).click();
    await page.getByLabel("من تاريخ كشف العربية").fill("2026-11-03");
    await page.getByLabel("إلى تاريخ كشف العربية").fill("2026-11-05");
    const summary=page.getByRole("region",{name:"ملخص كشف نقد العربية"});
    await expect(summary).toContainText("280.00 ج.م");
    await expect(summary).toContainText("100.00 ج.م");
    await expect(summary).toContainText("180.00 ج.م");
    const table=page.getByRole("table",{name:"جدول حركات كشف العربية"});
    await expect(table).toContainText("000012");
    await expect(table).not.toContainText("REC-001");
    await page.getByLabel("من تاريخ كشف العربية").fill("2026-11-04");
    await expect(page.getByRole("main").getByRole("status")).toContainText("لا توجد حركات");
    await expect(summary).toContainText("180.00 ج.م");
  });
  test("archived vehicle keeps its historical report and mobile has no page overflow",async({page})=>{
    await page.setViewportSize({width:360,height:740});
    await page.goto("/demo/master-data");
    await page.getByRole("tab",{name:/^العربيات \(/}).click();
    const vehicle=page.locator("article").filter({hasText:"د هـ و 5678"});
    await vehicle.getByRole("button",{name:"أرشفة العربية"}).click();
    const modal=page.getByRole("form",{name:"أرشفة العربية"});
    await modal.getByRole("textbox",{name:"سبب التغيير"}).fill("حفظ التاريخ");
    await modal.getByRole("button",{name:"تأكيد أرشفة"}).click();
    await page.getByRole("link",{name:"كشف حساب نقد العربية"}).click();
    await page.getByLabel("عربية كشف النقد").selectOption("V2");
    await expect(page.getByRole("table",{name:"جدول حركات كشف العربية"})).toContainText("REC-002");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });
});
