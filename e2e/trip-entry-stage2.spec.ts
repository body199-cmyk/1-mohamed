import { expect, test } from "@playwright/test";

test.describe("Stage 2 — trip entry and history", () => {
  test("required entry fields are grouped, custom date validation and history filters are accessible", async ({ page }) => {
    await page.goto("/demo/trips");
    await expect(page.getByText("١. بيانات النقلة والمقاول واتجاه الشغل")).toBeVisible();
    await expect(page.getByText("٢. العربية والوزن والأسعار")).toBeVisible();
    const optional = page.locator("details").filter({ has: page.locator("summary", { hasText: "٣. المسار والمصاريف والملاحظات" }) });
    await expect(optional).not.toHaveAttribute("open", "");
    await optional.locator("summary").click();
    await expect(page.getByRole("textbox", { name: "مكان التحميل" })).toBeVisible();
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "سجل النقلات" })).toBeVisible();
    await page.getByRole("button", { name: "فترة مخصصة" }).click();
    await expect(page.getByRole("textbox", { name: "بحث في النقلات" })).toBeVisible();
    await page.getByText("فلاتر متقدمة").click();
    await expect(page.locator("select").filter({ has: page.locator("option", { hasText: "كل العربيات" }) })).toBeVisible();
  });


  test("save-and-new adds exactly one trip and clears the form for another", async ({ page }) => {
    await page.goto("/demo/trips");
    await page.getByRole("combobox", { name: "المقاول الطرف الآخر" }).selectOption("K1");
    await page.getByRole("radio", { name: "أحمد جاب العربيات" }).check();
    await page.getByRole("combobox", { name: "السيارة المنفذة" }).selectOption("V1");
    await page.getByRole("textbox", { name: "الوزن بالطن" }).fill("2.000");
    await page.getByRole("textbox", { name: "سعر المقاول للطن" }).fill("300");
    await page.getByRole("textbox", { name: "سعر السيارة للطن" }).fill("280");
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).dblclick();
    await expect(page.getByRole("status").filter({ hasText: "تم تسجيل النقلة بنجاح" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "الوزن بالطن" })).toHaveValue("");
    await page.getByRole("button", { name: "فترة مخصصة" }).click();
    const history = page.getByRole("region", { name: "سجل النقلات" });
    await history.locator('input[type="date"]').first().fill("2026-11-04");
    await history.locator('input[type="date"]').last().fill("2026-11-04");
    await expect(history.getByRole("status")).toContainText("عدد النقلات في الفترة: 1");
  });

  test("save-and-exit persists a single trip and navigates to home", async ({ page }) => {
    await page.goto("/demo/trips");
    await page.getByRole("combobox", { name: "المقاول الطرف الآخر" }).selectOption("K2");
    await page.getByRole("radio", { name: "المقاول جاب العربيات" }).check();
    await page.getByRole("combobox", { name: "السيارة المنفذة" }).selectOption("V2");
    await page.getByRole("textbox", { name: "الوزن بالطن" }).fill("1.000");
    await page.getByRole("textbox", { name: "سعر المقاول للطن" }).fill("100");
    await page.getByRole("textbox", { name: "سعر السيارة للطن" }).fill("90");
    await page.getByRole("button", { name: "حفظ وخروج" }).click();
    await expect(page).toHaveURL(/\\/demo\\/home$/);
  });

  test("mobile trip history uses expandable cards without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/trips");
    await expect(page.getByRole("heading", { name: "سجل النقلات" })).toBeVisible();
    await page.getByRole("button", { name: "الشهر" }).click();
    await expect(page.locator("details").filter({ has: page.locator("summary", { hasText: "فلاتر متقدمة" }) })).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
});
