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

test.describe("UI-BASE-01B — safe demo mutations", () => {
  test("edit must have reason and unique identity; archive and reactivate keep history", async ({ page }) => {
    await page.goto("/demo/master-data");
    const card = page.locator("article").filter({ hasText: "شركة النيل للمقاولات" });
    await card.getByRole("button", { name: "تعديل المقاول" }).click();
    const edit = page.getByRole("form", { name: "تعديل المقاول" });
    await edit.getByRole("textbox", { name: "اسم المقاول الجديد" }).fill("المقاول أحمد علام");
    await edit.getByRole("textbox", { name: "سبب التغيير" }).fill("اختبار التكرار");
    await edit.getByRole("button", { name: "تأكيد تعديل" }).click();
    await expect(edit.getByRole("alert")).toContainText("غير صالح أو مكرر");
    await edit.getByRole("textbox", { name: "اسم المقاول الجديد" }).fill("شركة النيل الجديدة");
    await edit.getByRole("button", { name: "تأكيد تعديل" }).click();
    const updated = page.locator("article").filter({ hasText: "شركة النيل الجديدة" });
    await expect(updated).toBeVisible();
    await updated.getByRole("button", { name: "أرشفة المقاول" }).click();
    const archive = page.getByRole("form", { name: "أرشفة المقاول" });
    await archive.getByRole("textbox", { name: "سبب التغيير" }).fill("إيقاف مؤقت");
    await archive.getByRole("button", { name: "تأكيد أرشفة" }).click();
    await expect(updated).toContainText("مؤرشف");
    await expect(page.getByRole("heading", { name: /سجل التغييرات التجريبي \(2\)/ })).toBeVisible();
    await page.getByRole("link", { name: "تسجيل النقلات" }).click();
    await expect(page.locator('select[aria-label="المقاول الطرف الآخر"] option').filter({ hasText: "شركة النيل الجديدة" })).toHaveCount(0);
    await page.getByRole("link", { name: "بيانات المقاولين والعربيات" }).click();
    const archived = page.locator("article").filter({ hasText: "شركة النيل الجديدة" });
    await archived.getByRole("button", { name: "إعادة تفعيل المقاول" }).click();
    const restore = page.getByRole("form", { name: "إعادة تفعيل المقاول" });
    await restore.getByRole("textbox", { name: "سبب التغيير" }).fill("استئناف العمل");
    await restore.getByRole("button", { name: "تأكيد إعادة تفعيل" }).click();
    await expect(archived).not.toContainText("مؤرشف");
    await page.reload();
    await expect(page.getByRole("tabpanel")).toContainText("شركة النيل للمقاولات");
    await expect(page.getByRole("heading", { name: /سجل التغييرات التجريبي \(0\)/ })).toBeVisible();
  });

  test("vehicle editing prevents duplicate plates and an archived vehicle cannot be selected for a new trip", async ({ page }) => {
    await page.goto("/demo/master-data");
    await page.getByRole("tab", { name: /العربيات/ }).click();
    const vehicle = page.locator("article").filter({ hasText: "د هـ و 5678" });
    await vehicle.getByRole("button", { name: "تعديل العربية" }).click();
    const edit = page.getByRole("form", { name: "تعديل العربية" });
    await edit.getByRole("textbox", { name: "رقم اللوحة الجديد" }).fill("أ ب ج ١٢٣٤");
    await edit.getByRole("textbox", { name: "سبب التغيير" }).fill("تجربة");
    await edit.getByRole("button", { name: "تأكيد تعديل" }).click();
    await expect(edit.getByRole("alert")).toContainText("مكرر");
    await edit.getByRole("button", { name: "إلغاء" }).click();
    await vehicle.getByRole("button", { name: "أرشفة العربية" }).click();
    const arch = page.getByRole("form", { name: "أرشفة العربية" });
    await arch.getByRole("textbox", { name: "سبب التغيير" }).fill("خارج الخدمة");
    await arch.getByRole("button", { name: "تأكيد أرشفة" }).click();
    await page.getByRole("link", { name: "تسجيل النقلات" }).click();
    await expect(page.locator('select[aria-label="السيارة المنفذة"] option').filter({ hasText: "د هـ و 5678" })).toHaveCount(0);
  });

  test("cash openings are keyed by contractor and vehicle, edit is audited, and refresh clears them", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/master-data");
    await page.getByRole("tab", { name: "افتتاحيات نقد العربيات" }).click();
    const form = page.getByRole("form", { name: "افتتاحي نقد العربية" });
    await form.getByRole("combobox", { name: "المقاول المسؤول" }).selectOption("K1");
    await form.getByRole("combobox", { name: "العربية للحساب النقدي" }).selectOption("V1");
    await form.getByRole("combobox", { name: "اتجاه الافتتاحي النقدي" }).selectOption("VEHICLE");
    await form.getByRole("textbox", { name: "مبلغ افتتاحي النقد" }).fill("١٢٠٫٢٥");
    await form.getByRole("textbox", { name: "سبب تعديل افتتاحي النقد" }).fill("رصيد قديم للتجربة");
    await form.getByRole("button", { name: "حفظ افتتاحي النقد التجريبي" }).click();
    await expect(page.getByText("افتتاحي النقد: 120.25 ج.م")).toBeVisible();

    await form.getByRole("combobox", { name: "المقاول المسؤول" }).selectOption("K2");
    await form.getByRole("combobox", { name: "اتجاه الافتتاحي النقدي" }).selectOption("CONTRACTOR");
    await form.getByRole("textbox", { name: "مبلغ افتتاحي النقد" }).fill("20.00");
    await form.getByRole("textbox", { name: "سبب تعديل افتتاحي النقد" }).fill("حساب مقاول مختلف");
    await form.getByRole("button", { name: "حفظ افتتاحي النقد التجريبي" }).click();
    await expect(page.getByText("الافتتاحيات النقدية التجريبية (2)")).toBeVisible();
    await expect(page.getByText("افتتاحي النقد: -20.00 ج.م")).toBeVisible();
    await expect(page.getByRole("heading", { name: /سجل التغييرات التجريبي \(2\)/ })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false);
    await page.reload();
    await page.getByRole("tab", { name: "افتتاحيات نقد العربيات" }).click();
    await expect(page.getByText("الافتتاحيات النقدية التجريبية (0)")).toBeVisible();
  });
});
