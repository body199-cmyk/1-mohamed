import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const previewName = "معاينة التقرير";

async function openTripReport(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "التقارير والكشوف", exact: true }).click();
  await page.locator("#report-from").fill("2026-11-01");
  await page.locator("#report-to").fill("2026-11-16");
  await expect(page.getByRole("status").filter({hasText:"البيانات تتحدث تلقائيًا"})).toBeVisible();
}

async function expectMatchingPng(page: Page, preview: Locator, existing: Locator) {
  const image = preview.getByRole("img");
  await expect(image).toBeVisible();
  await expect(existing).toBeVisible();
  const original = await existing.elementHandle();
  expect(await preview.evaluate((element, next) =>
    !!(element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING), original)).toBe(true);
  const imageHash = await image.evaluate(async element => {
    const content = await (await fetch((element as HTMLImageElement).src)).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", content)),
      value => value.toString(16).padStart(2, "0")).join("");
  });
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "تنزيل صورة PNG", exact: true }).click();
  const file = await event;
  expect(createHash("sha256").update(await readFile(await file.path())).digest("hex")).toBe(imageHash);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function downloadReport(page: Page, name: string) {
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return readFile(await (await event).path());
}

test("trip exports use fixed paper styling while both existing previews keep their layout", async ({ page }, info) => {
  const master: Record<string, unknown[]> = {
    contractors: [{ id: "K_AHMED", name: "أحمد أبو علي", is_primary: true }, { id: "C1", name: "شركة النور" }],
    vehicles: [{ id: "V1", plate_number: "عربية ١" }],
    vehicle_accounts: [{ vehicle_id: "V1", contractor_id: "K_AHMED" }],
  };
  await page.route("**/api/ledger/master?**", route => route.fulfill({ json: {
    ok: true, data: master[new URL(route.request().url()).searchParams.get("type") ?? ""] ?? [], hasMore: false,
  } }));
  const trip = {
    id: "PREVIEW-TRIP", vehicle_id: "V1", counterparty_contractor_id: "C1", responsible_contractor_id: "K_AHMED",
    trip_date: "2026-11-10", direction: "AHMED_SUPPLIES", origin: "بني سويف", destination: "القاهرة",
    weight_milli_tonnes: "25000", contractor_rate_piastres: "10000", vehicle_rate_piastres: "8000",
    expense_piastres: "5000", contractor_total_piastres: "255000", vehicle_total_piastres: "205000", is_cancelled: false,
  };
  await page.route("**/api/ledger/read", route => {
    const { operation } = route.request().postDataJSON();
    const cash = operation === "cash.statement";
    return route.fulfill({ json: { ok: true, data: {
      status: "OK", snapshot: "1:1", total_count: cash ? "2" : "1", next_cursor: null,
      date_from: "2026-11-01", date_to: "2026-11-16", vehicle_id: "V1", responsible_contractor_id: "K_AHMED",
      period_opening_piastres: "100000", work_piastres: "205000", paid_piastres: "315000",
      period_closing_piastres: "-10000", current_cash_balance_piastres: "-10000",
      ...(!cash ? { totals: { contractor_total_piastres: "255000", vehicle_total_piastres: "205000",
        ahmed_work_piastres: "255000", counterparty_work_piastres: "0", active_count: "1" } } : {}),
      rows: cash ? [
        { id: trip.id, date: trip.trip_date, movement_type: "WORK", signed_delta_piastres: "205000", running_balance_piastres: "305000" },
        { id: "PREVIEW-PAYMENT", date: "2026-11-12", movement_type: "PAYMENT", signed_delta_piastres: "-315000", running_balance_piastres: "-10000" },
      ] : [trip],
    } } });
  });
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator('#shared-contractor option[value="C1"]')).toHaveCount(1);
  await openTripReport(page);
  const preview = page.getByRole("region", { name: previewName, exact: true });
  const tripImage = preview.getByRole("img");
  await expect(tripImage).toBeVisible();
  await expect(page.getByRole("list", { name: "ملخص سجلات التقرير" })).toBeVisible();
  const previewHash = await tripImage.evaluate(async element => {
    const image = await (await fetch((element as HTMLImageElement).src)).arrayBuffer();
    return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", image)));
  });
  const png = await downloadReport(page, "تنزيل صورة PNG");
  const pdf = await downloadReport(page, "تنزيل PDF مباشر");
  expect(png.readUInt32BE(16)).toBe(1440);
  expect(createHash("sha256").update(png).digest()).not.toEqual(Buffer.from(previewHash));
  await preview.screenshot({ path: info.outputPath("desktop-trip-preview.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await downloadReport(page, "تنزيل صورة PNG")).toEqual(png);
  expect(await downloadReport(page, "تنزيل PDF مباشر")).toEqual(pdf);
  await expect(tripImage).toBeVisible();

  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.open = (...args) => {
      const popup = open(...args);
      if (popup) popup.print = () => popup.document.documentElement.setAttribute("data-print-ready", "true");
      return popup;
    };
  });
  const popupEvent = page.waitForEvent("popup");
  await page.getByRole("button", { name: "طباعة / حفظ PDF", exact: true }).click();
  const print = await popupEvent;
  const paper = print.locator(".statement-page");
  await expect(print.locator("html")).toHaveAttribute("data-print-ready", "true");
  await expect(paper.locator(".statement-header")).toHaveCSS("text-align", "center");
  await expect(paper.locator(".wide-table thead th")).toHaveCount(16);
  await expect(paper.getByText("2026-11-10", { exact: true })).toHaveClass("ltr-token");
  await expect(paper.locator(".wide-table tbody td .ltr-token").first()).toContainText("PREVIEW-TRIP");
  const mobileWidth = await paper.evaluate(node => node.getBoundingClientRect().width);
  await print.setViewportSize({ width: 1440, height: 1000 });
  expect(await paper.evaluate(node => node.getBoundingClientRect().width)).toBe(mobileWidth);
  await print.close();

  await page.locator("#report-to").fill("2026-11-17");
  await expect(preview).toHaveCount(0);

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.getByRole("navigation").getByRole("button", { name: "حسابات العربيات والدفعات", exact: true }).click();
  await page.locator("#cash-account").selectOption("V1|K_AHMED");
  await page.locator("#cash-from").fill("2026-11-01");
  await page.locator("#cash-to").fill("2026-11-16");
  await page.getByRole("button", { name: "عرض كشف النقدية", exact: true }).click();
  await expect(preview).toBeFocused();
  const existing = page.getByLabel("ملخص نقدية العربية");
  await expect(existing).toContainText("على العربية");
  await expectMatchingPng(page, preview, existing);
  const viewport = preview.getByRole("region", { name: "صورة التقرير" });
  expect(await viewport.evaluate(element => element.scrollWidth === element.clientWidth)).toBe(true);
  await preview.screenshot({ path: info.outputPath("mobile-vehicle-preview.png") });
  const zoom = preview.getByRole("button", { name: "تكبير المعاينة" });
  await zoom.click();
  await expect(zoom).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Tab");
  await expect(viewport).toBeFocused();
  expect(await viewport.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
});

test("partial reports hide the preview and long reports show complete numbered PDF-style pages", async ({ page }) => {
  await page.route("**/api/ledger/master?**", route => route.fulfill({ json: { ok: true, data: [], hasMore: false } }));
  await page.route("**/api/ledger/read", route => {
    const { payload } = route.request().postDataJSON();
    const more = !!payload.cursor;
    const rows = Array.from({ length: more ? 50 : 100 }, (_, index) => ({
      id: `PREVIEW-${(more ? 100 : 0) + index}`, trip_date: "2026-11-10", origin: "بني سويف",
    }));
    return route.fulfill({ json: { ok: true, data: {
      status: "OK", snapshot: "1:1", rows, total_count: "150", next_cursor: more ? null : { date: "2026-11-10", id: "PREVIEW-99" },
    } } });
  });
  await page.goto("/");
  await openTripReport(page);
  const preview = page.getByRole("region", { name: previewName, exact: true });
  await expect(page.getByRole("list", { name: "ملخص سجلات التقرير" }).locator("li")).toHaveCount(100);
  await expect(preview).toHaveCount(0);
  await page.getByRole("button", { name: "تحميل 200 سجل إضافي", exact: true }).click();
  await expect(preview.getByText("صفحة 1 من 11", { exact: true })).toBeVisible();
  const pdf = await downloadReport(page, "تنزيل PDF مباشر");
  expect(Number(pdf.toString("latin1").match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(1);
  const image = preview.getByRole("img");
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalHeight)).toBe(2036);
  const first = await image.getAttribute("src");
  await preview.getByRole("button", { name: "الصفحة التالية" }).click();
  await expect(preview.getByText("صفحة 2 من 11", { exact: true })).toBeVisible();
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect(image).not.toHaveAttribute("src", first!);
  await expect(page.getByRole("list", { name: "ملخص سجلات التقرير" }).locator("li")).toHaveCount(150);

  await page.route("**/api/ledger/read", route => route.fulfill({ status: 403, json: { error: "غير مصرح." } }));
  await page.locator("#report-to").fill("2026-11-17");
  await expect(page.getByRole("status").filter({hasText:"البيانات تتحدث تلقائيًا"})).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("غير مصرح");
  await expect(preview).toHaveCount(0);
});
