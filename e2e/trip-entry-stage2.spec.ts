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
    await expect(page.getByText("كل العربيات")).toBeVisible();
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
