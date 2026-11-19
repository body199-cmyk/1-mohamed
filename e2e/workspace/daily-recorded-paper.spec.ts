import { expect, test, type Page } from "@playwright/test";

const contractors = [
  { id: "K_AHMED", name: "أحمد أبو علي", is_primary: true, is_archived: false, version: 1 },
  { id: "C1", name: "المقاول الأول", is_primary: false, is_archived: false, version: 1 },
];
const vehicles = [{ id: "V1", plate_number: "عربية ١", is_archived: false, version: 1 }];
const trip = {
  id: "TRIP-1", trip_date: "2026-11-16", vehicle_id: "V1",
  counterparty_contractor_id: "C1", responsible_contractor_id: "K_AHMED",
  direction: "AHMED_SUPPLIES", origin: "بني سويف", destination: "القاهرة",
  weight_milli_tonnes: "25000", contractor_rate_piastres: "10000",
  vehicle_rate_piastres: "8000", expense_piastres: "5000",
  contractor_total_piastres: "255000", vehicle_total_piastres: "205000",
  is_cancelled: false, notes: "حمولة اليوم", version: 1,
};
const totals = {
  active_count: "3", contractor_total_piastres: "765000",
  vehicle_total_piastres: "615000", ahmed_work_piastres: "765000",
  counterparty_work_piastres: "0",
};

async function setup(page: Page, drift = false) {
  await page.route("**/api/ledger/master?**", route => {
    const kind = new URL(route.request().url()).searchParams.get("type");
    return route.fulfill({ json: {
      ok: true, data: kind === "contractors" ? contractors :
        kind === "vehicles" ? vehicles :
        [{ vehicle_id: "V1", contractor_id: "K_AHMED" }], hasMore: false,
    } });
  });
  await page.route("**/api/ledger/read", route => {
    const { operation, payload } = route.request().postDataJSON();
    if (operation !== "trips.list" || payload.date_from !== "2026-11-16") {
      return route.fulfill({ json: { ok: true, data: {
        status: "OK", snapshot: "1:1", total_count: "0", rows: [], next_cursor: null,
      } } });
    }
    const more = Boolean(payload.cursor);
    return route.fulfill({ json: { ok: true, data: {
      status: "OK", snapshot: more && drift ? "2:2" : "1:1",
      total_count: "3", totals,
      rows: more ? [{ ...trip, id: "TRIP-2" }, { ...trip, id: "TRIP-3" }] : [trip],
      next_cursor: more ? null : { date: "2026-11-16", id: "TRIP-1" },
    } } });
  });
  await page.goto("/");
  await expect(page.locator("#shared-contractor option[value='C1']")).toHaveCount(1);
  await page.locator("#daily-recorded-date").fill("2026-11-16");
  await page.getByRole("button", { name: "عرض المسجّل لهذا اليوم", exact: true }).click();
}

test("recorded daily trips show complete fixed paper above unchanged paginated list on desktop and mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  const section = page.getByRole("region", { name: "المعاينة المنسقة لنقلات اليوم" });
  const image = section.getByRole("img");
  const records = page.getByRole("region", { name: "النقلات المسجلة في اليومية" });
  await expect(image).toBeVisible();
  await expect(records).toContainText("تم تحميل 1 من 3 نقلة");
  await expect(records.locator("li").filter({ hasText: "حمولة اليوم" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "تحميل النقلات التالية" })).toBeVisible();
  await expect(page.getByRole("button", { name: "فتح هذا اليوم في التقارير للتعديل أو الإلغاء" })).toBeVisible();
  expect(await section.evaluate((element, other) =>
    Boolean(element.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING),
    await records.locator("ul").elementHandle())).toBe(true);
  const bytes = await image.evaluate(async node => {
    const response = await fetch((node as HTMLImageElement).src);
    return Array.from(new Uint8Array(await response.arrayBuffer()));
  });
  expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBe(1440);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(image).toBeVisible();
  expect(await image.evaluate(async node => Array.from(new Uint8Array(
    await (await fetch((node as HTMLImageElement).src)).arrayBuffer())))).toEqual(bytes);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const zoom = section.getByRole("button", { name: "تكبير المعاينة" });
  await zoom.click();
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  await expect(section.getByRole("region", { name: "صورة التقرير" }).evaluate(
    element => element.scrollWidth > element.clientWidth)).resolves.toBe(true);
  await page.getByRole("button", { name: "تحميل النقلات التالية" }).click();
  await expect(records).toContainText("تم تحميل 3 من 3 نقلة");
  await expect(records.locator("li").filter({ hasText: "حمولة اليوم" })).toHaveCount(3);
  await expect(image).toBeVisible();
});

test("snapshot drift hides incomplete paper but preserves familiar recorded trips", async ({ page }) => {
  await setup(page, true);
  const paper = page.getByRole("region", { name: "المعاينة المنسقة لنقلات اليوم" });
  await expect(paper.getByRole("status")).toContainText("تغيرت البيانات");
  await expect(paper.getByRole("img")).toHaveCount(0);
  const records = page.getByRole("region", { name: "النقلات المسجلة في اليومية" });
  await expect(records).toContainText("تم تحميل 1 من 3 نقلة");
  await expect(page.getByRole("button", { name: "تحميل النقلات التالية" })).toBeVisible();
  await page.locator("#daily-recorded-date").fill("2026-11-17");
  await expect(paper).toHaveCount(0);
  await expect(records).toContainText("لا توجد نقلات محفوظة في اليوم المختار");
});
