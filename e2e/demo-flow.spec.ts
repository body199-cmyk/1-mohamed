import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.join(__dirname, "..", "apps", "web", "e2e", "screenshots");

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
      await page.click('button[aria-label="تفعيل الوضع الداكن"]');
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `trips-${vp.name}-dark.png`),
        fullPage: false,
      });

      // Switch back to light mode
      await page.click('button[aria-label="تفعيل الوضع الفاتح"]');
    }

    // Reset viewport to desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // Scenario 1: Direct registration without shared data
    // Select contractor K1
    await page.selectOption('select:has-text("اختر المقاول")', "K1");

    // Select direction: AHMED_SUPPLIES
    await page.click('text="شغل أحمد (المقاول مدين لأحمد)"');

    // Select vehicle V1
    await page.selectOption('select:has-text("اختر السيارة")', "V1");

    // Enter weight: 25.500
    await page.fill('input[placeholder="مثال: 25.450"]', "25.500");

    // Uncheck same rate to enter separate rates
    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (await sameRateCheckbox.isChecked()) {
      await sameRateCheckbox.uncheck();
    }

    // Rates: contractor 150.00, vehicle 130.00, expense 50.00
    await page.fill('input[placeholder="مثال: 120.00"]', "150.00");
    await page.fill('input[placeholder="مثال: 110.00"]', "130.00");
    await page.fill('input[placeholder="0.00"]', "50.00");

    // Verify preview card: contractor total = 25.500 * 150 = 3825.00 + 50 = 3875.00
    await expect(page.getByText("3875.00 ج.م", { exact: true })).toBeVisible();
    // vehicle total = 25.500 * 130 = 3315.00 + 50 = 3365.00
    await expect(page.getByText("3365.00 ج.م", { exact: true })).toBeVisible();

    // Submit trip
    await page.click('button:has-text("إضافة للتجربة")');

    // Verify success notification
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل النقلة بنجاح");
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
    await page.click('text="شغل أحمد (المقاول مدين لأحمد)"');

    // Rate linking test:
    // Check same rate
    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (!(await sameRateCheckbox.isChecked())) {
      await sameRateCheckbox.check();
    }

    // Enter contractor rate 200.00
    await page.fill('input[placeholder="مثال: 120.00"]', "200.00");
    // Vehicle rate should be disabled and synchronized
    const vehicleRateInput = page.locator('input[placeholder="مثال: 110.00"]');
    await expect(vehicleRateInput).toBeDisabled();
    expect(await vehicleRateInput.inputValue()).toBe("200.00");

    // Uncheck same rate: vehicle rate becomes editable
    await sameRateCheckbox.uncheck();
    await expect(vehicleRateInput).toBeEnabled();
    await vehicleRateInput.fill("180.00");
    expect(await vehicleRateInput.inputValue()).toBe("180.00");

    // Scenario 5: Excess precision test
    // 4 decimal places in weight
    await page.fill('input[placeholder="مثال: 25.450"]', "15.1234");
    // Live preview shows error
    await expect(
      page.locator("text=الوزن يقبل حتى 3 أرقام عشرية فقط")
    ).toBeVisible();

    // Fix weight, add 3 decimal places in contractor rate
    await page.fill('input[placeholder="مثال: 25.450"]', "15.123");
    await page.fill('input[placeholder="مثال: 120.00"]', "150.123");
    await expect(
      page.locator("text=المبالغ والأسعار تقبل رقمين عشريين كحد أقصى")
    ).toBeVisible();
  });

  test("السيناريو 6: النوافذ السريعة لإضافة سيارة ومقاول دون فقد المسودة", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Enter draft weight & notes
    await page.fill('input[placeholder="مثال: 25.450"]', "30.500");
    await page.fill(
      'textarea[placeholder="أية ملاحظات خاصة بالنقلة أو السائق أو الموقع..."]',
      "ملاحظة اختبار المسودة"
    );

    // Open quick vehicle modal
    await page.click('button:has-text("+ سيارة جديدة")');
    await expect(page.locator("text=إضافة سيارة سريعة")).toBeVisible();

    // Fill new vehicle
    await page.fill('input[placeholder="مثال: د هـ و 5678"]', "ق ر ش 4444");
    await page.fill('input[placeholder="مثال: محمود حسن"]', "سعيد أحمد");
    await page.click('button:has-text("حفظ وإضافة")');

    // Verify vehicle modal closed and newly added vehicle is selected
    await expect(page.locator("text=إضافة سيارة سريعة")).not.toBeVisible();
    const vehicleSelectText = await page.locator('select:has-text("ق ر ش 4444")').textContent();
    expect(vehicleSelectText).toContain("ق ر ش 4444");

    // Verify draft weight and notes are preserved!
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("30.500");
    expect(
      await page.inputValue(
        'textarea[placeholder="أية ملاحظات خاصة بالنقلة أو السائق أو الموقع..."]'
      )
    ).toBe("ملاحظة اختبار المسودة");

    // Open quick contractor modal
    await page.click('button:has-text("+ مقاول جديد")');
    await expect(page.locator("text=إضافة مقاول سريع")).toBeVisible();
    await page.fill('input[placeholder="مثال: مقاولات الأمل"]', "شركة الفرسان للمقاولات");
    await page.click('button:has-text("حفظ وإضافة")');

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
    // Opening: -400.00 EGP
    // Trip 1 (2026-11-02): +300.00
    // Trip 2 (2026-11-05): +1000.00
    // Trip 3 (2026-11-06): -600.00
    // Ahmed work: 1300.00, Counterparty work: 600.00, Net closing: +300.00 EGP (لصالح أحمد)
    await expect(page.locator("text=ملخص كشف حساب: المقاول أحمد علام")).toBeVisible();
    await expect(page.locator("text=+1300.00 ج.م").first()).toBeVisible();
    await expect(page.locator("text=-600.00 ج.م").first()).toBeVisible();
    await expect(page.locator("text=300.00 ج.م").first()).toBeVisible();

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
      await page.click('button[aria-label="تفعيل الوضع الداكن"]');
      await page.waitForTimeout(100);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `contractors-${vp.name}-dark.png`),
        fullPage: false,
      });

      // Light mode
      await page.click('button[aria-label="تفعيل الوضع الفاتح"]');
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // Now navigate to trips and add a new trip for K1 with OTHER_SUPPLIES (reverse direction)
    await page.click('a[href="/demo/trips"]');

    // Select K1
    await page.selectOption('select:has-text("اختر المقاول")', "K1");

    // Select OTHER_SUPPLIES (شغل المقاول)
    await page.click('text="شغل المقاول (أحمد مدين للمقاول)"');

    // Select vehicle V1
    await page.selectOption('select:has-text("اختر السيارة")', "V1");

    // Weight 10.000, rates: contractor 100.00, vehicle 90.00, expense 0.00
    await page.fill('input[placeholder="مثال: 25.450"]', "10.000");

    const sameRateCheckbox = page.locator('input[type="checkbox"]').first();
    if (await sameRateCheckbox.isChecked()) {
      await sameRateCheckbox.uncheck();
    }

    await page.fill('input[placeholder="مثال: 120.00"]', "100.00");
    await page.fill('input[placeholder="مثال: 110.00"]', "90.00");
    await page.fill('input[placeholder="0.00"]', "0.00");

    // Preview shows: أحمد مدين للمقاول بهذا المبلغ (1000.00 ج.م)
    await expect(
      page.locator("text=أحمد مدين للمقاول بهذا المبلغ (1000.00 ج.م)")
    ).toBeVisible();

    // Submit trip
    await page.click('button:has-text("إضافة للتجربة")');
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل النقلة بنجاح");

    // Navigate to contractor statement and verify immediate reflection!
    await page.click('a[href="/demo/contractors"]');

    // Counterparty work was 600.00, now + 1000.00 = 1600.00 EGP
    await expect(page.locator("text=-1600.00 ج.م").first()).toBeVisible();

    // Closing was +300.00, now - 1000.00 = -700.00 EGP (لصالح المقاول!)
    await expect(
      page.locator("text=صافي الرصيد لصالح المقاول (المقاول أحمد علام: -700.00 ج.م)")
    ).toBeVisible();
  });

  test("السيناريو 9 و 10: بدء يوم جديد وتأكيد استبدال المسودة المعدلة وإلغاؤه", async ({
    page,
  }) => {
    await page.goto("/demo/trips");

    // Scenario 10: Confirm replacing modified draft
    // Type in weight
    await page.fill('input[placeholder="مثال: 25.450"]', "22.000");

    // Click "+ نقلة جديدة"
    await page.click('button:has-text("+ نقلة جديدة")');

    // Confirm modal should appear
    await expect(
      page.locator("text=تأكيد إلغاء المسودة الحالية")
    ).toBeVisible();

    // Click "إلغاء والعودة للمسودة"
    await page.click('button:has-text("إلغاء والعودة للمسودة")');
    await expect(
      page.locator("text=تأكيد إلغاء المسودة الحالية")
    ).not.toBeVisible();
    // Weight is still intact!
    expect(await page.inputValue('input[placeholder="مثال: 25.450"]')).toBe("22.000");

    // Click "+ نقلة جديدة" again and confirm replacement
    await page.click('button:has-text("+ نقلة جديدة")');
    await page.click('button:has-text("نعم، ابدأ نقلة جديدة")');
    await expect(
      page.locator("text=تأكيد إلغاء المسودة الحالية")
    ).not.toBeVisible();
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
