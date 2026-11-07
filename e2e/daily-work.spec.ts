import { expect, test } from "@playwright/test";

test.describe("REPORTS-01 — isolated daily work report", () => {
  test("renders exact daily totals, both directions and empty day without cash-mixing", async ({ page }) => {
    await page.goto("/demo/reports/daily");
    await expect(page.getByRole("heading", { name: "تقرير الشغل اليومي" })).toBeVisible();
    await page.getByLabel("تاريخ التقرير").fill("2026-11-05");
    const table = page.getByRole("table", { name: "نقلات اليوم" });
    await expect(table).toContainText("REC-002");
    await expect(table).not.toContainText("REC-001");
    await expect(page.getByRole("region", { name: "إجمالي اليوم المحدد" })).toContainText("1000.00 ج.م");
    await expect(page.getByRole("region", { name: "إجمالي اليوم المحدد" })).toContainText("900.00 ج.م");
    await expect(page.getByRole("region", { name: "شغل الطرف الآخر لأحمد" })).toContainText("0.000 طن");
    await page.getByLabel("تاريخ التقرير").fill("2026-11-06");
    await expect(table).toContainText("REC-003");
    await expect(page.getByRole("region", { name: "شغل الطرف الآخر لأحمد" })).toContainText("600.00 ج.م");
    await page.getByLabel("تاريخ التقرير").fill("2026-11-04");
    await expect(page.getByRole("main").getByRole("status")).toContainText("لا توجد نقلات");
    await expect(page.getByRole("table", { name: "نقلات اليوم" })).toHaveCount(0);
  });

  test("filters contractor and vehicle independently and can reset without duplicating work", async ({ page }) => {
    await page.goto("/demo/reports/daily");
    await page.getByLabel("تاريخ التقرير").fill("2026-11-05");
    await page.getByRole("combobox", { name: "فلتر المقاول" }).selectOption("K2");
    await expect(page.getByRole("main").getByRole("status")).toContainText("لا توجد نقلات");
    await page.getByRole("combobox", { name: "فلتر المقاول" }).selectOption("K1");
    await page.getByRole("combobox", { name: "فلتر العربية" }).selectOption("V1");
    await expect(page.getByRole("main").getByRole("status")).toContainText("لا توجد نقلات");
    await page.getByRole("combobox", { name: "فلتر العربية" }).selectOption("V2");
    await expect(page.getByRole("table", { name: "نقلات اليوم" })).toContainText("REC-002");
    await page.getByRole("button", { name: "عرض الجميع في اليوم" }).click();
    await expect(page.getByRole("table", { name: "نقلات اليوم" }).getByRole("row")).toHaveCount(2);
  });

  test("retains historic trips of archived vehicles and fits mobile without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/master-data");
    await page.getByRole("tab", { name: /^العربيات \(/ }).click();
    const vehicle = page.locator("article").filter({ hasText: "د هـ و 5678" });
    await vehicle.getByRole("button", { name: "أرشفة العربية" }).click();
    const archive = page.getByRole("form", { name: "أرشفة العربية" });
    await archive.getByRole("textbox", { name: "سبب التغيير" }).fill("مراجعة تاريخية");
    await archive.getByRole("button", { name: "تأكيد أرشفة" }).click();
    await page.goto("/demo/reports/daily");
    await page.getByLabel("تاريخ التقرير").fill("2026-11-05");
    await expect(page.getByRole("table", { name: "نقلات اليوم" })).toContainText("د هـ و 5678");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "تقرير الشغل اليومي" })).toBeVisible();
  });
});
