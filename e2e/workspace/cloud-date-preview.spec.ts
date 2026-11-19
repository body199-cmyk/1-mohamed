import { test, expect } from "@playwright/test";

test("settings can select a recorded Drive date and cannot restore or delete anything", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/backup") && request.method() !== "GET") writes.push(request.url());
  });
  await page.route("**/api/ledger/master?**", route => route.fulfill({
    json: { ok: true, data: [], hasMore: false },
  }));
  await page.route("**/api/auth/members", route => route.fulfill({
    json: { isOwner: false, members: [] },
  }));
  await page.route("**/api/backup/history", route => route.fulfill({ json: { ok: true, backups: [
    { backup_date:"2026-11-19", format:"1-mohamed-business-recovery-v1",
      file_name:"1-mohamed-2026-11-19-restore.tar.gz", drive_file_id:"uniqueDriveId20261119",
      drive_web_view_link:"https://drive.google.com/file/d/uniqueDriveId20261119/view",
      size_bytes:1789,sha256:"a".repeat(64),table_counts:{trips:100},
      created_at:"2026-11-19T01:00:00.000Z" },
    { backup_date:"2026-11-18", format:"1-mohamed-full-supabase-logical-backup",
      file_name:"1-mohamed-2026-11-18.tar.gz.age", drive_file_id:"uniqueDriveId20261118",
      drive_web_view_link:null,size_bytes:3456,sha256:"b".repeat(64),
      table_counts:{trips:90},created_at:"2026-11-18T01:00:00.000Z" },
  ] } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const more = page.locator('[data-testid="mobile-more"]');
  await more.locator("summary").click();
  await page.getByRole("button", { name: "الإعدادات", exact: true }).click();
  const region = page.getByRole("region", { name: "اختيار نسخة سحابية حسب التاريخ" });
  await expect(region).toContainText("2026-11-19");
  await expect(region).toContainText("1-mohamed-business-recovery-v1");
  await page.locator("#cloud-backup-date").selectOption("2026-11-18");
  await expect(region).toContainText("1-mohamed-full-supabase-logical-backup");
  await expect(region).toContainText("الاستعادة الفعلية لهذه النسخة غير مفعّلة");
  await expect(region.getByRole("link", { name: "فتح الملف المحدد في Google Drive" }))
    .toHaveAttribute("href", /drive.google.com/);
  expect(writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
