import { expect, test } from "@playwright/test";

for (const scenario of [
  { responsible: "PRIMARY_AHMED", direction: "أحمد جاب العربيات" },
  { responsible: "K1", direction: "المقاول جاب العربيات" },
]) {
  test(`FIN-03 rejects an earlier trip and accepts opening day for ${scenario.responsible}`, async ({ page }) => {
    await page.goto("/demo/master-data");
    await page.getByRole("tab", { name: "افتتاحيات نقد العربيات" }).click();
    const opening = page.getByRole("form", { name: "افتتاحي نقد العربية" });
    await opening.getByRole("combobox", { name: "المقاول المسؤول", exact: true }).selectOption(scenario.responsible);
    await opening.getByRole("combobox", { name: "العربية للحساب النقدي" }).selectOption("V3");
    await opening.getByLabel("تاريخ افتتاحي النقد").fill("2026-11-05");
    await opening.getByRole("textbox", { name: "سبب تعديل افتتاحي النقد" }).fill("FIN-03 regression");
    await opening.getByRole("button", { name: "حفظ افتتاحي النقد التجريبي" }).click();
    await expect(opening.getByRole("status")).toContainText("حُفظ الافتتاحي");

    // Navigate inside the SPA: the demo store must retain the cash opening.
    await page.getByRole("link", { name: "تسجيل النقلات", exact: true }).click();
    await page.locator('input[aria-label="تاريخ النقلة"]').fill("2026-11-04");
    await page.getByRole("combobox", { name: "المقاول الطرف الآخر" }).selectOption("K1");
    await page.getByRole("radio", { name: scenario.direction }).check();
    await page.getByRole("combobox", { name: "السيارة المنفذة" }).selectOption("V3");
    await page.getByRole("textbox", { name: "الوزن بالطن" }).fill("1");
    await page.getByRole("textbox", { name: "سعر المقاول للطن" }).fill("100");
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "افتتاحي نقد العربية" })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "تم تسجيل النقلة بنجاح" })).toHaveCount(0);

    // A rejected attempt must not claim the submission lock or block a valid retry.
    await page.locator('input[aria-label="تاريخ النقلة"]').fill("2026-11-05");
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).click();
    await expect(page.getByRole("status").filter({ hasText: "تم تسجيل النقلة بنجاح" })).toBeVisible();
  });
}
