import { expect, test } from "@playwright/test";

function previewValue(preview: import("@playwright/test").Locator, heading: RegExp) {
  return preview.locator(":scope > div").filter({ hasText: heading }).locator("strong");
}


test.describe("Stage 3 — cash payment preview shares the save validator", () => {
  test("Arabic-digit amounts produce the same before/after preview as the saved amount parser", async ({ page }) => {
    await page.goto("/demo/payments");
    const form = page.getByRole("form", { name: "نموذج دفعة العربية" });
    const amount = form.getByRole("textbox", { name: "المبلغ بالجنيه" });
    await amount.fill("١٠٫٥٠");
    const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
    await expect(preview).toContainText("11 ج.م");
    await expect(preview).toContainText("269 ج.م");
    await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("269 ج.م");
    await amount.fill("0.001");
    await expect(page.getByRole("region", { name: "الرصيد بعد الدفعة" })).toHaveCount(0);
    await amount.fill("92233720368547758.08");
    await expect(page.getByRole("region", { name: "الرصيد بعد الدفعة" })).toHaveCount(0);
  });
});


test("UI-01 shows exact 390px before/after preview for normal amount and a payment edit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo/payments");
  const form = page.getByRole("form", { name: "نموذج دفعة العربية" });
  const amount = form.getByRole("textbox", { name: "المبلغ بالجنيه" });
  await amount.fill("100");
  const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
  await expect(previewValue(preview, /المتبقي قبل الدفعة/)).toHaveText("280 ج.م");
  await expect(previewValue(preview, /قيمة الدفعة الجديدة/)).toHaveText("100 ج.م");
  await expect(previewValue(preview, /المتبقي للعربية بعد الدفعة/)).toHaveText("180 ج.م");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

  await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
  await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("180");
  await page.getByRole("button", { name: /تعديل الدفعة P-DEMO-/ }).click();
  await expect(amount).toHaveValue("100");
  await amount.fill("150");
  await expect(previewValue(preview, /المتبقي قبل الدفعة/)).toHaveText("280 ج.م");
  await expect(previewValue(preview, /قيمة الدفعة الجديدة/)).toHaveText("150 ج.م");
  await expect(previewValue(preview, /المتبقي للعربية بعد الدفعة/)).toHaveText("130 ج.م");
  await form.getByRole("textbox", { name: "سبب تعديل الدفعة" }).fill("Review amount");
  await form.getByRole("button", { name: "حفظ تعديل الدفعة" }).click();
  await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("130");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
});

test("UI-01 separates optimistic current preview from historical D16 acceptance", async ({ page }) => {
  await page.goto("/demo/payments");
  const form = page.getByRole("form", { name: "نموذج دفعة العربية" });
  const amount = form.getByRole("textbox", { name: "المبلغ بالجنيه" });
  const date = form.getByLabel("تاريخ الدفع الحقيقي");
  await date.fill("2026-11-02");
  await amount.fill("200");
  await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
  const summary = page.getByRole("region", { name: "ملخص حساب نقد العربية" });
  await expect(summary).toContainText("80");

  await date.fill("2026-11-01");
  await amount.fill("10");
  const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
  await expect(previewValue(preview, /المتبقي قبل الدفعة/)).toHaveText("80 ج.م");
  await expect(previewValue(preview, /قيمة الدفعة الجديدة/)).toHaveText("10 ج.م");
  await expect(previewValue(preview, /المتبقي للعربية بعد الدفعة/)).toHaveText("70 ج.م");
  const paymentRows = page.getByRole("region", { name: "جدول دفعات العربية" }).locator("tbody tr");
  await expect(paymentRows).toHaveCount(1);
  await expect(paymentRows.first()).toContainText("2026-11-02");
  await expect(paymentRows.first()).toContainText("200 ج.م");
  await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("D16");
  await expect(summary).toContainText("80");
  await expect(paymentRows).toHaveCount(1);
  await expect(paymentRows.first()).toContainText("2026-11-02");
  await expect(paymentRows.first()).toContainText("200 ج.م");
  await amount.fill("-1");
  await expect(preview).toHaveCount(0);
  await amount.fill("0");
  await expect(preview).toHaveCount(0);
  await amount.fill("0.001");
  await expect(preview).toHaveCount(0);
});
