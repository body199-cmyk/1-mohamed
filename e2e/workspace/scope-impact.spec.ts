import { test, expect } from "@playwright/test";
import { createPortableBackup, PORTABLE_BACKUP_TABLES } from "../../apps/web/src/lib/backup/export";

test("mobile can preview day/vehicle/global scope but cannot cancel or delete from Settings", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (/\/api\/(?:backup|ledger)\//.test(request.url()) && request.method() !== "GET") writes.push(request.url());
  });
  await page.route("**/api/ledger/master?**", route => route.fulfill({
    json: { ok:true, data:[], hasMore:false },
  }));
  await page.route("**/api/backup/history", route => route.fulfill({ json:{ ok:true,backups:[] } }));
  const tables = Object.fromEntries(PORTABLE_BACKUP_TABLES.map(key => [key, [] as Record<string, unknown>[]]));
  tables.vehicles = [{id:"V1",plate_number:"العربية ١"}];
  tables.contractors = [{id:"C1",name:"المقاول ١"}];
  tables.trips = [{id:"T1",trip_date:"2026-11-18",vehicle_id:"V1",counterparty_contractor_id:"C1",
    responsible_contractor_id:"C1",is_cancelled:false}];
  tables.payments = [{id:"P1",linked_trip_id:"T1",vehicle_id:"V1",
    responsible_contractor_id:"C1",payment_date:"2026-11-19",is_cancelled:false}];
  const backup=createPortableBackup(tables);
  await page.route("**/api/backup/export?format=json", route=>route.fulfill({
    contentType:"application/json", status:200, body:JSON.stringify(backup),
  }));
  await page.setViewportSize({ width:390,height:844 });
  await page.goto("/");
  const more=page.locator('[data-testid="mobile-more"]');
  await more.locator("summary").click();
  await page.getByRole("button",{name:"الإعدادات",exact:true}).click();
  await page.getByText("معاينة تأثير إلغاء يومية أو عربية أو مقاول (بدون حذف)").click();
  await page.getByRole("button",{name:"تحميل لقطة البيانات الحالية للمعاينة"}).click();
  await page.locator("#scope-preview-day").fill("2026-11-18");
  await page.getByRole("button",{name:"عرض التأثير المتوقع (بدون تنفيذ)"}).click();
  await expect(page.getByRole("status").filter({hasText:"نتيجة المعاينة"})).toContainText("النقلات المشمولة: 1");
  await expect(page.getByRole("status").filter({hasText:"نتيجة المعاينة"})).toContainText("بتاريخ خارج اليوم المختار");
  await page.locator("#scope-preview-kind").selectOption("vehicle");
  await page.locator("#scope-preview-id").selectOption("V1");
  await page.getByRole("button",{name:"عرض التأثير المتوقع (بدون تنفيذ)"}).click();
  await expect(page.getByRole("status").filter({hasText:"نتيجة المعاينة"})).toContainText("الدفعات النشطة ضمن النطاق");
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
