import { expect, test } from "@playwright/test";

test.describe("Stage 3 — cash payment preview shares the save validator", () => {
  test("Arabic-digit amounts produce the same before/after preview as the saved amount parser", async ({ page }) => {
    await page.goto("/demo/payments");
    const form = page.getByRole("form", { name: "نموذج دفعة العربية" });
    const amount = form.getByRole("textbox", { name: "المبلغ بالجنيه" });
    await amount.fill("١٠٫٥٠");
    const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
    await expect(preview).toContainText("10.50");
    await expect(preview).toContainText("269.50");
    await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("269.50");
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
  await amount.fill("100.00");
  const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
  await expect(preview).toContainText("280.00");
  await expect(preview).toContainText("100.00");
  await expect(preview).toContainText("180.00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);

  await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
  await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("180.00");
  await page.getByRole("button", { name: /تعديل الدفعة P-DEMO-/ }).click();
  await expect(amount).toHaveValue("100.00");
  await amount.fill("150.00");
  await expect(preview).toContainText("280.00");
  await expect(preview).toContainText("150.00");
  await expect(preview).toContainText("130.00");
  await form.getByRole("textbox", { name: "سبب تعديل الدفعة" }).fill("Review amount");
  await form.getByRole("button", { name: "حفظ تعديل الدفعة" }).click();
  await expect(page.getByRole("region", { name: "ملخص حساب نقد العربية" })).toContainText("130.00");
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
  await expect(summary).toContainText("80.00");

  await date.fill("2026-11-01");
  await amount.fill("10.00");
  const preview = page.getByRole("region", { name: "الرصيد بعد الدفعة" });
  await expect(preview).toContainText("80.00");
  await expect(preview).toContainText("70.00");
  await form.getByRole("button", { name: "تسجيل الدفعة" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("D16");
  await expect(summary).toContainText("80.00");
  await amount.fill("-1");
  await expect(preview).toHaveCount(0);
  await amount.fill("0");
  await expect(preview).toHaveCount(0);
  await amount.fill("0.001");
  await expect(preview).toHaveCount(0);
});
