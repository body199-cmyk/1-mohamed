import { expect, test } from "@playwright/test";

test.describe("UI-BASE-01A — demo master data (no persistent storage)", () => {
  test("renders both registers, filters, and keeps contractor work opening separate", async ({ page }) => {
    await page.goto("/demo/master-data");
    await expect(page.getByRole("heading", { name: "بيانات المقاولين والعربيات" })).toBeVisible();
    await expect(page.getByRole("tabpanel", { name: "قائمة المقاولين" })).toContainText("المقاول أحمد علام");
    await expect(page.getByRole("tabpanel", { name: "قائمة المقاولين" })).toContainText("افتتاحي فرق الشغل");
    await page.getByRole("searchbox", { name: "بحث باسم المقاول أو رقمه" }).fill("النيل");
    await expect(page.getByRole("tabpanel")).toContainText("شركة النيل للمقاولات");
    await expect(page.getByRole("tabpanel")).not.toContainText("مقاولات الصعيد");

    await page.getByRole("tab", { name: /العربيات/ }).click();
    await expect(page.getByRole("tabpanel", { name: "قائمة العربيات" })).toContainText("أ ب ج 1234");
    await expect(page.getByRole("tabpanel")).toContainText("الافتتاحي النقدي للعربية");
    await page.getByRole("searchbox", { name: "بحث برقم اللوحة أو اسم السائق" }).fill("محمود");
    await expect(page.getByRole("tabpanel")).toContainText("د هـ و 5678");
    await expect(page.getByRole("tabpanel")).not.toContainText("س ص ع 9012");

    await page.getByRole("searchbox", { name: "بحث برقم اللوحة أو اسم السائق" }).fill("غير معروف");
    await expect(page.getByRole("status", { name: "" }).filter({ hasText: "مفيش نتائج" })).toBeVisible();
  });

  test("adding a contractor reuses the trip form's live demo list and rejects duplicates", async ({ page }) => {
    await page.goto("/demo/master-data");
    await page.getByRole("button", { name: /إضافة مقاول/ }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة سجل جديد" });
    await dialog.getByRole("textbox", { name: "اسم المقاول" }).fill("مقاولات التجربة");
    await dialog.getByRole("button", { name: "حفظ وإضافة" }).click();

    await expect(page.getByRole("tabpanel")).toContainText("مقاولات التجربة");
    await page.getByRole("button", { name: /إضافة مقاول/ }).click();
    const duplicate = page.getByRole("dialog", { name: "إضافة سجل جديد" });
    await duplicate.getByRole("textbox", { name: "اسم المقاول" }).fill("  مقاولات  التجربة ");
    await duplicate.getByRole("button", { name: "حفظ وإضافة" }).click();
    await expect(duplicate.getByRole("alert")).toContainText("اسم المقاول موجود بالفعل");
    await duplicate.getByRole("button", { name: "إغلاق النافذة" }).click();

    await page.getByRole("link", { name: "تسجيل النقلات" }).click();
    await expect(page.locator("select option").filter({ hasText: "مقاولات التجربة" }).first()).toHaveCount(1);

    await page.reload();
    await page.goto("/demo/master-data");
    await expect(page.getByRole("tabpanel")).not.toContainText("مقاولات التجربة");
  });

  test("rejects equivalent Arabic-digit vehicle plates and remains usable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/master-data");
    await page.getByRole("tab", { name: /العربيات/ }).click();
    await page.getByRole("button", { name: /إضافة عربية/ }).click();
    const dialog = page.getByRole("dialog", { name: "إضافة سجل جديد" });
    await dialog.getByRole("textbox", { name: "رقم اللوحة" }).fill("ط س ر ١٢٣");
    await dialog.getByRole("textbox", { name: "اسم السائق" }).fill("سائق تجريبي");
    await dialog.getByRole("button", { name: "حفظ وإضافة" }).click();
    await expect(page.getByRole("tabpanel")).toContainText("ط س ر ١٢٣");

    await page.getByRole("button", { name: /إضافة عربية/ }).click();
    const duplicate = page.getByRole("dialog", { name: "إضافة سجل جديد" });
    await duplicate.getByRole("textbox", { name: "رقم اللوحة" }).fill("  ط س ر 123 ");
    await duplicate.getByRole("button", { name: "حفظ وإضافة" }).click();
    await expect(duplicate.getByRole("alert")).toContainText("رقم اللوحة موجود بالفعل");

    await duplicate.getByRole("button", { name: "إغلاق النافذة" }).click();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(horizontalOverflow).toBe(false);
  });
});
