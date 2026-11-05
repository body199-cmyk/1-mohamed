import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.describe("T09.1 — download real PNG of same work statement", () => {
  test("exports actual PNG with selected period and report values", async ({ page }) => {
    await page.goto("/demo/contractors");
    await expect(page.getByRole("button", { name: "تنزيل صورة PNG" })).toBeVisible();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "تنزيل صورة PNG" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("demo-statement-2026-11-01-2026-11-30.png");
    const file = await download.path();
    expect(file).toBeTruthy();
    const data = await readFile(file!);
    expect(data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))).toBe(true);
    expect(data.readUInt32BE(16)).toBe(1440);
    expect(data.readUInt32BE(20)).toBeGreaterThan(900);
    expect(data.length).toBeGreaterThan(10000);
  });

  test("empty valid period exports PNG; invalid period prevents export", async ({ page }) => {
    await page.goto("/demo/contractors");
    await page.getByLabel("من تاريخ").fill("2026-11-12");
    await page.getByLabel("إلى تاريخ").fill("2026-11-13");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "تنزيل صورة PNG" }).click(),
    ]);
    expect(download.suggestedFilename()).toContain("2026-11-12-2026-11-13.png");
    await page.getByLabel("من تاريخ").fill("2026-10-01");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("يسبق تاريخ بداية حساب المقاول");
    await expect(page.getByRole("button", { name: "تنزيل صورة PNG" })).toHaveCount(0);
  });
});
