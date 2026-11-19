import { test, expect, type Page } from "@playwright/test";
import { createPortableBackup, PORTABLE_BACKUP_TABLES } from "../../apps/web/src/lib/backup/export";

async function openSettings(page: Page) {
  await page.route("**/api/ledger/master?**", route => route.fulfill({
    json: { ok: true, data: [], hasMore: false },
  }));
  await page.route("**/api/backup/history", route => route.fulfill({
    json: { ok: true, backups: [] },
  }));
  await page.route("**/api/auth/members", route => route.fulfill({
    json: { isOwner: false, members: [] },
  }));
  await page.goto("/");
  const more = page.locator('[data-testid="mobile-more"]');
  if (await more.isVisible()) {
    await more.locator("summary").click();
    await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  } else {
    await page.getByRole("navigation").getByRole("button", { name: "الإعدادات", exact: true }).click();
  }
  await expect(page.getByRole("region", { name: "فحص نسخة محلية قبل الاستعادة" })).toBeVisible();
}

test("valid portable file is inspected locally without a restore/upload request on desktop and mobile", async ({ page }) => {
  const unexpected: string[] = [];
  page.on("request", request => {
    if (/\/api\/backup\/(?:restore|upload|import)/.test(request.url())) unexpected.push(request.url());
  });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 850 });
    await openSettings(page);
    const tables = Object.fromEntries(PORTABLE_BACKUP_TABLES.map(key => [key, [] as object[]]));
    tables.trips = [{ id: "TRIP-1", vehicle_total_piastres: "9007199254741000" }];
    tables.payments = [{ id: "PAYMENT-1", amount_piastres: "25000" }];
    const archive = createPortableBackup(tables, "2026-11-19T12:00:00.000Z");
    await page.locator("#local-backup-preview-file").setInputFiles({
      name: "safe-local-export.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(archive)),
    });
    const section = page.getByRole("region", { name: "فحص نسخة محلية قبل الاستعادة" });
    await expect(section.getByRole("status")).toContainText("الملف اجتاز فحص الصيغة والبصمة");
    await expect(section).toContainText("الاستعادة إلى المشروع غير مفعّلة");
    await expect(section).toContainText("النقلات: ١");
    await expect(section).toContainText("الدفعات: ١");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(unexpected).toEqual([]);
  }
});

test("tampered local file is rejected without restore actions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSettings(page);
  const tables = Object.fromEntries(PORTABLE_BACKUP_TABLES.map(key => [key, [] as object[]]));
  tables.trips = [{ id: "TRIP-1", vehicle_total_piastres: "10000" }];
  const archive = createPortableBackup(tables, "2026-11-19T12:00:00.000Z");
  (archive.tables.trips[0] as Record<string, unknown>).vehicle_total_piastres = "20000";
  await page.locator("#local-backup-preview-file").setInputFiles({
    name: "changed.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(archive)),
  });
  const section = page.getByRole("region", { name: "فحص نسخة محلية قبل الاستعادة" });
  await expect(section.getByRole("alert")).toContainText("بصمة الملف مختلفة");
  await expect(section.getByRole("status")).toHaveCount(0);
});
