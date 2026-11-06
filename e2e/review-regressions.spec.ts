import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function fillTrip(page: Page) {
  await page.goto("/demo/trips");
  await page.getByLabel("المقاول الطرف الآخر", { exact: true }).selectOption("K1");
  await page.getByText("شغل أحمد (المقاول مدين لأحمد)", { exact: true }).click();
  await page.getByLabel("السيارة المنفذة", { exact: true }).selectOption("V1");
  await page.getByLabel("الوزن بالطن", { exact: true }).fill("10");
  await page.getByLabel("سعر المقاول للطن", { exact: true }).fill("100");
}

test("المسودة تبقى بين الشاشتين والإضافة الواحدة لا تتكرر", async ({ page }) => {
  await fillTrip(page);
  await page.locator('a[href="/demo/contractors"]').click();
  await page.locator('a[href="/demo/trips"]').click();
  await expect(page.getByLabel("الوزن بالطن", { exact: true })).toHaveValue("10");
  const submit = page.getByRole("button", { name: "إضافة للتجربة" });
  await submit.dblclick();
  await expect(submit).toBeDisabled();
  await expect(page.getByLabel("الوزن بالطن", { exact: true })).toHaveValue("10");
  await page.locator('a[href="/demo/contractors"]').click();
  await expect(page.getByText("صافي الرصيد لصالح أحمد (+1300.00 ج.م)", { exact: true })).toBeVisible();
});

test("تغيير الطريق وحده يستلزم تأكيدًا قبل استبدال المسودة", async ({ page }) => {
  await page.goto("/demo/trips");
  await page.getByLabel("مكان التحميل", { exact: true }).fill("السويس");
  await page.getByRole("button", { name: "+ نقلة جديدة", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "إلغاء والعودة للمسودة" }).click();
  await expect(page.getByLabel("مكان التحميل", { exact: true })).toHaveValue("السويس");
});

test("رفض الوزن الصفري والفاصلة الملتبسة وتاريخ ما قبل الحساب", async ({ page }) => {
  await fillTrip(page);
  await page.getByLabel("الوزن بالطن", { exact: true }).fill("0.000");
  await page.getByRole("button", { name: "إضافة للتجربة" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("أكبر من صفر");
  await page.getByLabel("الوزن بالطن", { exact: true }).fill("1,000");
  await page.getByRole("button", { name: "إضافة للتجربة" }).click();
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("صيغة");
  await page.getByLabel("الوزن بالطن", { exact: true }).fill("١٠٫٥");
  await page.getByLabel("تاريخ النقلة", { exact: true }).fill("2026-10-31");
  await page.getByRole("button", { name: "إضافة للتجربة" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("لا يسبق");
});

test("الرصيد الافتتاحي العربي دقيق والمبلغ غير الصالح لا يتحول إلى صفر", async ({ page }) => {
  await page.goto("/demo/trips");
  await page.getByRole("button", { name: "+ مقاول جديد", exact: true }).click();
  await page.getByLabel("اسم المقاول", { exact: true }).fill("اختبار الرصيد");
  await page.getByLabel("حالة الرصيد الافتتاحي").selectOption("AHMED");
  await page.getByLabel("مبلغ الرصيد الافتتاحي").fill("1,000");
  await page.getByRole("button", { name: "حفظ وإضافة" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await page.getByLabel("مبلغ الرصيد الافتتاحي").fill("٢٥٫٥٠");
  await page.getByRole("button", { name: "حفظ وإضافة" }).click();
  await page.locator('a[href="/demo/contractors"]').click();
  await page.getByLabel("اختر المقاول").selectOption({ label: "اختبار الرصيد (K4)" });
  await expect(page.getByText("صافي الرصيد لصالح أحمد (+25.50 ج.م)", { exact: true })).toBeVisible();
});

test("الإضافة من المشترك لا تغير مقاول النقلة والبحث والإغلاق يحفظان المسودة", async ({ page }) => {
  await fillTrip(page);
  await page.getByLabel("بحث عن عربية", { exact: true }).fill("غير موجود");
  await expect(page.getByLabel("السيارة المنفذة", { exact: true })).toHaveValue("V1");
  await page.getByRole("button", { name: "تعديل المشترك" }).click();
  await page.getByRole("button", { name: "+ مقاول جديد", exact: true }).first().click();
  await page.getByLabel("اسم المقاول", { exact: true }).fill("مقاول مشترك جديد");
  await page.getByRole("button", { name: "حفظ وإضافة" }).click();
  await expect(page.getByLabel("المقاول المشترك", { exact: true })).toHaveValue("K4");
  await expect(page.getByLabel("المقاول الطرف الآخر", { exact: true })).toHaveValue("K1");
  const addVehicle = page.getByRole("button", { name: "+ سيارة جديدة", exact: true });
  await addVehicle.click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(addVehicle).toBeFocused();
  await expect(page.getByLabel("الوزن بالطن", { exact: true })).toHaveValue("10");
});

test("التصدير يطابق الفترة المعروضة ويدعم العربية والطباعة", async ({ page, context }) => {
  // The OS print dialog is the boundary; inspect its actual HTML input instead.
  await context.addInitScript(() => { window.print = () => {}; });
  await page.goto("/demo/contractors");
  await page.getByLabel("من تاريخ").fill("2026-11-05");
  await page.getByLabel("إلى تاريخ").fill("2026-11-06");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "تنزيل CSV" }).click();
  const download = await downloadEvent;
  const bytes = await readFile((await download.path())!);
  expect([...bytes.subarray(0, 3)]).toEqual([239, 187, 191]);
  const csv = bytes.toString("utf8");
  expect(csv).toContain('"رصيد أول الفترة","\'-100.00 ج.م"');
  // H063 (PR #26): closing balance carries an explicit '+' sign and the formula guard apostrophe.
  expect(csv).toContain('"رصيد آخر الفترة","\'+300.00 ج.م"');
  expect(csv).toContain('"عدد الحركات","2"');
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "طباعة / حفظ PDF" }).click();
  const popup = await popupEvent;
  await expect(popup.locator("body")).toContainText("بيانات تجريبية، ليست كشفًا فعليًا");
  await expect(popup.locator(".details-table tbody tr")).toHaveCount(2);
  await expect(popup.locator("body")).toContainText("300.00 ج.م");
  await popup.evaluate(() => document.fonts.ready);
  await popup.screenshot({ path: "apps/web/e2e/screenshots/statement-print-review.png", fullPage: true });
  await popup.close();
  await page.getByLabel("من تاريخ").fill("");
  await expect(page.getByRole("button", { name: "تنزيل CSV" })).toHaveCount(0);
});

for (const width of [390, 768, 1440]) {
  test(`الواجهتان بلا أخطاء متصفح أو تجاوز عرض ${width}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["trips", "contractors"]) {
      await page.goto(`/demo/${route}`);
      await page.evaluate(() => document.fonts.ready);
      for (const mode of ["light", "dark"]) {
        if (mode === "dark") await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
        await page.screenshot({ path: `apps/web/e2e/screenshots/review-${route}-${width}-${mode}.png`, fullPage: true });
      }
      await page.getByRole("button", { name: "تفعيل الوضع الفاتح" }).click();
    }
    expect(errors).toEqual([]);
  });
}
