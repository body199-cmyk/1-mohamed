import { expect, test } from "@playwright/test";

test.describe("Contractor statement approved UX stage 3", () => {
  test("defaults to the active Cairo month and shows unique vehicles plus expandable daily summaries", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-07T10:00:00.000Z") });
    await page.goto("/demo/contractors");

    await expect(page.getByLabel("نطاق كشف الحساب")).toHaveValue("range");
    await expect(page.getByLabel("من تاريخ")).toHaveValue("2026-11-01");
    await expect(page.getByLabel("إلى تاريخ")).toHaveValue("2026-11-07");
    await expect(page.getByText(/3 نقلة • 3 عربية/)).toBeVisible();

    const daily = page.locator('[aria-label="الملخص اليومي حسب العربية والوجهة"]');
    const day = daily.locator("details").filter({ hasText: "شغل يوم 2026-11-05" });
    await expect(day).toContainText("1 نقلة — 1 عربية");
    await day.locator("summary").click();
    await expect(day).toContainText("العربية: د هـ و 5678");
    await expect(day).toContainText("العاصمة الإدارية — 1 نقلة");
    await expect(day).toContainText("إجمالي قيمة النقلات: 1000.00 ج.م");
    await expect(day).toContainText("شغل أحمد: 1000.00 ج.م");
  });

  test("advanced operational filters expose scoped subtotals and removable chips without changing account net", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-07T10:00:00.000Z") });
    await page.goto("/demo/contractors");
    const advanced = page.locator("details").filter({ hasText: "فلاتر متقدمة للموقع والاتجاه" });
    await advanced.locator("summary").click();
    await expect(advanced).toHaveAttribute("open", "");

    await advanced.getByRole("combobox", { name: "فلتر موقع التحميل" }).selectOption("محجر السويس");
    await advanced.getByRole("combobox", { name: "فلتر اتجاه الشغل" }).selectOption("AHMED_SUPPLIES");

    const scoped = page.getByRole("region", { name: "ملخص قيمة الشغل في النتائج المفلترة" });
    await expect(scoped).toContainText("2 نقلة • 2 عربية");
    await expect(scoped).toContainText("شغل أحمد في النتائج: 1300.00 ج.م");
    await expect(scoped).toContainText("لا يمثل صافي حساب المقاول النهائي");

    const chips = page.locator('[aria-label="فلاتر كشف المقاول النشطة"]');
    await expect(chips.getByRole("button", { name: "إزالة فلتر اتجاه الشغل" })).toBeVisible();
    await chips.getByRole("button", { name: "إزالة فلتر اتجاه الشغل" }).click();
    await expect(advanced.getByRole("combobox", { name: "فلتر اتجاه الشغل" })).toHaveValue("");
    await expect(scoped).toContainText("2 نقلة • 2 عربية");

    await chips.getByRole("button", { name: "إزالة فلتر موقع التحميل" }).click();
    await expect(scoped).toContainText("3 نقلة • 3 عربية");
    await expect(page.getByText(/3 نقلة • 3 عربية/)).toBeVisible();
  });

  test("search filter is always available and exports remain explicitly full-account", async ({ page }) => {
    await page.goto("/demo/contractors");
    const search = page.getByRole("searchbox", { name: "بحث في كشف المقاول" });
    await expect(search).toBeVisible();
    await search.fill("TRIP-HIST-002");
    await expect(page.getByRole("heading", { name: "حركات الفترة المفصلة (1 حركة)" })).toBeVisible();
    await expect(page.getByText(/التصدير يعرض كشف الحساب الكامل للفترة/)).toBeVisible();
    await expect(page.getByRole("region", { name: "ملخص كشف حساب: المقاول أحمد علام" })).toContainText("3 نقلة • 3 عربية");
  });
});
