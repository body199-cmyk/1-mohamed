import { expect, test } from "@playwright/test";

test.describe("T08.3 demo vehicle cash payments",()=>{
  test("creates, edits and cancels a cash payment with history and exact balance",async({page})=>{
    await page.goto("/demo/payments");
    await expect(page.getByRole("heading",{name:"دفعات العربيات — معاينة تجريبية"})).toBeVisible();
    const summary=page.getByRole("region",{name:"ملخص حساب نقد العربية"});
    await expect(summary).toContainText("280.00 ج.م");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-02");
    await page.getByLabel("المبلغ بالجنيه").fill("100");
    await page.getByLabel("رقم إيصال الدفعة").fill("0007");
    await page.getByRole("button",{name:"تسجيل الدفعة"}).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await expect(summary).toContainText("180.00 ج.م");
    await expect(page.getByRole("region",{name:"سجل دفعات الحساب"})).toContainText("0007");
    await page.getByRole("button",{name:/تعديل الدفعة P-DEMO-/}).click();
    await page.getByLabel("المبلغ بالجنيه").fill("150");
    await page.getByLabel("سبب تعديل الدفعة").fill("مراجعة المبلغ");
    await page.getByRole("button",{name:"حفظ تعديل الدفعة"}).click();
    await expect(summary).toContainText("130.00 ج.م");
    await page.getByRole("button",{name:/إلغاء الدفعة P-DEMO-/}).click();
    await page.getByLabel("سبب إلغاء الدفعة").fill("إيصال ملغى");
    await page.getByRole("button",{name:"تأكيد إلغاء الدفعة"}).click();
    await expect(summary).toContainText("280.00 ج.م");
    await expect(page.getByRole("region",{name:"سجل دفعات الحساب"})).toContainText("ملغاة: إيصال ملغى");
    await expect(page.getByRole("region",{name:"أثر تعديلات الدفعات"})).toContainText("مراجعة المبلغ");
  });
  test("D16 blocks a backdated payment that exceeds the minimum remaining, not the day-only due",async({page})=>{
    await page.goto("/demo/payments");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-05");
    await page.getByLabel("المبلغ بالجنيه").fill("200");
    await page.getByRole("button",{name:"تسجيل الدفعة"}).click();
    await expect(page.getByRole("region",{name:"ملخص حساب نقد العربية"})).toContainText("80.00 ج.م");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-02");
    await page.getByLabel("المبلغ بالجنيه").fill("100");
    await page.getByRole("button",{name:"تسجيل الدفعة"}).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("D16");
    await expect(page.getByRole("region",{name:"سجل دفعات الحساب"})).not.toContainText("100.00 ج.م");
    await expect(page.getByRole("region",{name:"ملخص حساب نقد العربية"})).toContainText("80.00 ج.م");
  });
  test("cash accounts stay independent, opening of primary Ahmed available, mobile does not overflow",async({page})=>{
    await page.setViewportSize({width:360,height:740});
    await page.goto("/demo/payments");
    await expect(page.getByRole("region",{name:"ملخص حساب نقد العربية"})).toContainText("280.00 ج.م");
    await page.getByRole("combobox",{name:"المقاول المسؤول عن الدفع"}).selectOption("K1");
    await expect(page.getByRole("region",{name:"ملخص حساب نقد العربية"})).toContainText("0.00 ج.م");
    await page.getByRole("combobox",{name:"المقاول المسؤول عن الدفع"}).selectOption("PRIMARY_AHMED");
    await expect(page.getByRole("region",{name:"ملخص حساب نقد العربية"})).toContainText("280.00 ج.م");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    await page.getByRole("link",{name:"بيانات المقاولين والعربيات"}).click();
    await page.getByRole("tab",{name:"افتتاحيات نقد العربيات"}).click();
    await expect(page.getByRole("combobox",{name:"المقاول المسؤول"})).toContainText("أحمد أبو علي (المقاول الأساسي)");
  });
});
