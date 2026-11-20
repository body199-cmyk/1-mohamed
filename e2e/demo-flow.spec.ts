import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.join(__dirname, "..", "apps", "web", "e2e", "screenshots");

async function setDemoTheme(page: Page, theme: "light" | "dark") {
  const originalPath = new URL(page.url()).pathname;
  await page.goto("/demo/settings");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", /^(light|dark)$/);
  if (await html.getAttribute("data-theme") !== theme) {
    await page.getByRole("button", { name: "تغيير المظهر" }).click();
  }
  await expect(html).toHaveAttribute("data-theme", theme);
  await page.goto(originalPath);
  await expect(html).toHaveAttribute("data-theme", theme);
}

async function openOptionalTripDetails(page: Page) {
  await page.getByText("٣. المسار والمصاريف والملاحظات (اختياري)", { exact: true }).click();
}

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe("أحمد أبو علي — حسابات النقل — سيناريوهات المعاينة التجريبية (APP-01)", () => {
  test("السيناريو 11 و 1: شريط التحذير، والتسجيل المباشر بدون مشترك، والشاشات المتجاوبة", async ({
    page,
  }) => {
    // 1. Visit trips demo page
    await page.goto("/demo/trips");
    await page.waitForLoadState("networkidle");

    // Scenario 11: Verify demo banner
    const banner = page.locator("header, div").filter({
      hasText: "نسخة تجريبية — البيانات مؤقتة وتُمسح عند إعادة تحميل الصفحة",
    });
    await expect(banner.first()).toBeVisible();

    // Verify viewports and capture screenshots in light & dark modes
    const viewports = [
      { name: "mobile-390", width: 390, height: 844 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "desktop-1440", width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      // Light mode
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `trips-${vp.name}-light.png`),
        fullPage: false,
      });

      // Switch to dark mode
      await setDemoTheme(page, "dark");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `trips-${vp.name}-dark.png`),
        fullPage: false,
      });

      // Switch back to light mode
      await setDemoTheme(page, "light");
    }

    // Reset viewport to desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // Scenario 1: Direct registration without shared data
    // Select contractor K1
    await page.selectOption('select:has-text("اختر المقاول")', "K1");

    // Select direction: AHMED_SUPPLIES
    await page.getByRole("radio", { name: "أحمد جاب العربيات", exact: true }).check();

    // Select vehicle V1
    await page.selectOption('select:has-text("اختر السيارة")', "V1");

    // Enter weight: 25.500
    await page.fill('input[placeholder="مثال: 25.450"]', "25.500");

    // Uncheck same rate to enter separate rates
    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (await sameRateCheckbox.isChecked()) {
      await sameRateCheckbox.uncheck();
    }

    // Rates: contractor 150, vehicle 130, expense 50
    await page.fill('input[placeholder="مثال: 120"]', "150");
    await page.fill('input[placeholder="مثال: 110"]', "130");
    await openOptionalTripDetails(page);
    await page.getByRole("textbox", { name: "مصاريف النقلة" }).fill("50");

    // Verify preview card: contractor total = 25.500 * 150 = 3,825 + 50 = 3,875
    await expect(page.getByText("المقاول مدين لأحمد بهذا المبلغ (+3,875 ج.م)")).toBeVisible();
    // vehicle total = 25.500 * 130 = 3,315 + 50 = 3,365
    await expect(page.getByText("3,365 ج.م", { exact: true })).toBeVisible();

    // Submit trip
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).click();

    // Verify success notification
    await expect(page.getByRole("status").filter({ hasText: "تم تسجيل النقلة بنجاح" })).toBeVisible();
  });

  test("السيناريو 2 و 3: المشترك واعتماده وتعديله مع الحفاظ على المسودة", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Open Shared Data Panel
    await page.click('button:has-text("تعديل المشترك")');

    // Fill shared origin & destination
    await page.fill('input[placeholder="مثال: محجر السويس"]', "محجر السويس");
    await page.fill('input[placeholder="مثال: العاصمة الإدارية"]', "العاصمة الإدارية");

    // Choose shared contractor K2
    const sharedContractorSelect = page.locator('select:has-text("بدون مقاول مشترك")');
    await sharedContractorSelect.selectOption("K2");

    // Choose shared direction: AHMED_SUPPLIES
    const sharedAhmedRadio = page.locator('input[name="shared-direction"]').first();
    await sharedAhmedRadio.check();

    // Click "اعتماد المشترك للنقلات التالية"
    await page.click('button:has-text("اعتماد المشترك للنقلات التالية")');
    await expect(page.locator("text=المشترك معتمد ومطبق")).toBeVisible();

    // Scenario 3: Modify draft specific field (weight)
    await page.fill('input[placeholder="مثال: 25.450"]', "10.000");

    // Edit shared origin while preserving draft
    await page.fill('input[placeholder="مثال: محجر السويس"]', "كسارة عتاقة");

    // Verify draft weight is still 10.000
    const weightVal = await page.inputValue('input[placeholder="مثال: 25.450"]');
    expect(weightVal).toBe("10.000");
  });

  test("السيناريو 4 و 5: ربط السعرين وفكّهما، ورفض الدقة الزائدة (4 أرقام في الوزن و3 في السعر)", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Select contractor and direction
    await page.selectOption('select:has-text("اختر المقاول")', "K1");
    await page.getByRole("radio", { name: "أحمد جاب العربيات", exact: true }).check();

    // Rate linking test:
    // Check same rate
    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (!(await sameRateCheckbox.isChecked())) {
      await sameRateCheckbox.check();
    }

    // Enter contractor rate 200
    await page.fill('input[placeholder="مثال: 120"]', "200");
    // Vehicle rate should be disabled and synchronized
    const vehicleRateInput = page.locator('input[placeholder="مثال: 110"]');
    await expect(vehicleRateInput).toBeDisabled();
    expect(await vehicleRateInput.inputValue()).toBe("200");

    // Uncheck same rate: vehicle rate becomes editable
    await sameRateCheckbox.uncheck();
    await expect(vehicleRateInput).toBeEnabled();
    await vehicleRateInput.fill("180");
    expect(await vehicleRateInput.inputValue()).toBe("180");

    // Scenario 5: Excess precision test
    // 4 decimal places in weight
    await page.fill('input[placeholder="مثال: 25.450"]', "15.1234");
    // Live preview shows error
    await expect(
      page.locator("text=الوزن يقبل حتى 3 أرقام عشرية فقط")
    ).toBeVisible();

    // Fix weight, add 3 decimal places in contractor rate
    await page.fill('input[placeholder="مثال: 25.450"]', "15.123");
    await page.fill('input[placeholder="مثال: 120"]', "150.123");
    await expect(
      page.locator("text=اكتب الأسعار والمبالغ بالجنيه؛ تُقرّب لأقرب جنيه صحيح.")
    ).toBeVisible();
  });

  test("السيناريو 6: النوافذ السريعة لإضافة سيارة ومقاول دون فقد المسودة", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Enter draft weight & notes
    await page.fill('input[placeholder="مثال: 25.450"]', "30.500");
    await openOptionalTripDetails(page);
    await page.getByRole("textbox", { name: "ملاحظات النقلة" }).fill("ملاحظة اختبار المسودة");

    // Open quick vehicle modal
    await page.click('button:has-text("+ سيارة جديدة")');
    await expect(page.locator("text=إضافة سيارة سريعة")).toBeVisible();

    // Fill new vehicle
    await page.fill('input[placeholder="مثال: د هـ و 5678"]', "ق ر ش 4444");
    await page.fill('input[placeholder="مثال: محمود حسن"]', "سعيد أحمد");
    await page.getByRole("dialog", { name: "إضافة سجل جديد" }).getByRole("button", { name: "حفظ وإضافة", exact: true }).click();

    // Verify vehicle modal closed and newly added vehicle is selected
    await expect(page.locator("text=إضافة سيارة سريعة")).not.toBeVisible();
    await expect(page.getByRole("combobox", { name: "السيارة المنفذة" }).locator("option:checked"))
      .toContainText("ق ر ش 4444");

    // Verify draft weight and notes are preserved!
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("30.500");
    await expect(page.getByRole("textbox", { name: "ملاحظات النقلة" })).toHaveValue("ملاحظة اختبار المسودة");

    // Open quick contractor modal
    await page.click('button:has-text("+ مقاول جديد")');
    await expect(page.locator("text=إضافة مقاول سريع")).toBeVisible();
    await page.fill('input[placeholder="مثال: مقاولات الأمل"]', "شركة الفرسان للمقاولات");
    await page.getByRole("dialog", { name: "إضافة سجل جديد" }).getByRole("button", { name: "حفظ وإضافة", exact: true }).click();

    // Verify contractor modal closed and draft preserved
    await expect(page.locator("text=إضافة مقاول سريع")).not.toBeVisible();
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("30.500");
  });

  test("السيناريو 7 و 8: الانعكاس الفوري في كشف الحساب وتأثير عكس الاتجاه (OTHER_SUPPLIES)", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // 1. First check contractor statements for K1
    await page.goto("/demo/contractors");
    await page.waitForLoadState("networkidle");

    // Pre-seeded trips for K1 in Nov 2026:
    // Opening: -400 EGP
    // Trip 1 (2026-11-02): +300
    // Trip 2 (2026-11-05): +1,000
    // Trip 3 (2026-11-06): -600
    // Ahmed work: 1,300, Counterparty work: 600, Net closing: +300 EGP (لصالح أحمد)
    await expect(page.locator("text=ملخص كشف حساب: المقاول أحمد علام")).toBeVisible();
    await expect(page.getByText("+1,300", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText("-600", { exact: true }).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "صافي المستحق النهائي" })).toContainText("+300 ج.م");

    // Capture screenshots of contractor statements viewports
    const viewports = [
      { name: "mobile-390", width: 390, height: 844 },
      { name: "tablet-768", width: 768, height: 1024 },
      { name: "desktop-1440", width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `contractors-${vp.name}-light.png`),
        fullPage: false,
      });

      // Dark mode
      await setDemoTheme(page, "dark");
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `contractors-${vp.name}-dark.png`),
        fullPage: false,
      });

      // Light mode
      await setDemoTheme(page, "light");
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // Now navigate to trips and add a new trip for K1 with OTHER_SUPPLIES (reverse direction)
    await page.getByRole("link", { name: "تسجيل النقلات", exact: true }).click();

    // Select K1
    await page.selectOption('select:has-text("اختر المقاول")', "K1");

    // Select OTHER_SUPPLIES (شغل المقاول)
    await page.getByRole("radio", { name: "المقاول جاب العربيات", exact: true }).check();

    // Select vehicle V1
    await page.selectOption('select:has-text("اختر السيارة")', "V1");

    // Weight 10.000, rates: contractor 100, vehicle 90, expense 0
    await page.fill('input[placeholder="مثال: 25.450"]', "10.000");

    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (await sameRateCheckbox.isChecked()) {
      await sameRateCheckbox.uncheck();
    }

    await page.fill('input[placeholder="مثال: 120"]', "100");
    await page.fill('input[placeholder="مثال: 110"]', "90");
    await openOptionalTripDetails(page);
    await page.getByRole("textbox", { name: "مصاريف النقلة" }).fill("0");

    await expect(page.getByText("أحمد مدين للمقاول بهذا المبلغ (-1,000 ج.م)")).toBeVisible();

    // Submit trip
    await page.getByRole("button", { name: "حفظ وإضافة نقلة جديدة" }).click();
    await expect(page.getByRole("status").filter({ hasText: "تم تسجيل النقلة بنجاح" })).toBeVisible();

    // Navigate to contractor statement and verify immediate reflection!
    await page.getByRole("link", { name: "كشف المقاول", exact: true }).click();

    // Counterparty work was 600, now + 1,000 = 1,600 EGP
    await expect(page.getByText("-1,600", { exact: true }).filter({ visible: true }).first()).toBeVisible();

    // Closing was +300, now - 1,000 = -700 EGP (لصالح المقاول!)
    const closing = page.getByRole("status").filter({ hasText: "صافي المستحق النهائي" });
    await expect(closing).toContainText("-700 ج.م");
    await expect(closing).toContainText("المقاول أحمد علام له عند أحمد أبو علي");
  });

  test("السيناريو 9 و 10: بدء يوم جديد وتأكيد استبدال المسودة المعدلة وإلغاؤه", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Scenario 10: Confirm replacing modified draft
    // Type in weight
    await page.fill('input[placeholder="مثال: 25.450"]', "22.000");

    // Click "+ نقلة جديدة"
    await page.getByRole("button", { name: "+ نقلة جديدة", exact: true }).click();

    // Confirm modal should appear
    await expect(page.getByRole("dialog", { name: "تأكيد استبدال المسودة" })).toBeVisible();

    // Click "إلغاء والعودة للمسودة"
    await page.click('button:has-text("إلغاء والعودة للمسودة")');
    await expect(page.getByRole("dialog", { name: "تأكيد استبدال المسودة" })).not.toBeVisible();
    // Weight is still intact!
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("22.000");

    // Click "+ نقلة جديدة" again and confirm replacement
    await page.getByRole("button", { name: "+ نقلة جديدة", exact: true }).click();
    await page.click('button:has-text("نعم، ابدأ نقلة جديدة")');
    await expect(page.getByRole("dialog", { name: "تأكيد استبدال المسودة" })).not.toBeVisible();
    // Weight should be reset
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("");

    // Scenario 9: Start new work session
    await page.click('button:has-text("تعديل المشترك")');
    await page.click('button:has-text("📅 بدء يوم عمل جديد")');
    await expect(page.locator('h3:has-text("بدء يوم عمل جديد")')).toBeVisible();

    await page.fill('div[role="dialog"] input[type="date"]', "2026-11-08");
    await page.click('button:has-text("تأكيد بدء اليوم")');

    // Modal closes
    await expect(page.locator('h3:has-text("بدء يوم عمل جديد")')).not.toBeVisible();
  });
});
