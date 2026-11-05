import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test.describe("H056 offline-first design foundation with live demo data", () => {
  test("dashboard is a coherent responsive grid and keeps the same financial values", async ({ page }) => {
    for (const width of [360, 768, 1280]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/demo/dashboard");
      const title = page.getByRole("heading", { name: "الرئيسية — ملخص اليوم" });
      await expect(title).toBeVisible();
      const metrics = page.getByRole("region", { name: "المؤشرات اليومية" });
      await expect(metrics.locator("article")).toHaveCount(6);
      await expect(metrics).toContainText("1000.00 ج.م");
      await expect(metrics).toContainText("900.00 ج.م");
      await expect(page.getByRole("navigation", { name: "اختصارات الرئيسية" }).getByRole("link")).toHaveCount(4);
      const geometry = await page.evaluate(() => {
        const hero = document.querySelector("main header");
        const metrics = document.querySelector("main section[aria-label='المؤشرات اليومية']");
        if (!hero || !metrics) throw new Error("Dashboard layout incomplete");
        const heroRect = hero.getBoundingClientRect();
        return {
          page: document.documentElement.scrollWidth,
          viewport: innerWidth,
          heroWidth: heroRect.width,
          heroFill: getComputedStyle(hero).backgroundImage,
          cards: metrics.children.length,
        };
      });
      expect(geometry.page, "screen overflow at " + width).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.heroWidth).toBeGreaterThan(width * .7);
      expect(geometry.heroWidth).toBeLessThanOrEqual(width);
      expect(geometry.heroFill).toContain("linear-gradient");
      await mkdir("artifacts/h056", { recursive: true });
      await page.screenshot({ path: "artifacts/h056/dashboard-light-" + width + ".png", fullPage: true });
    }
  });

  test("dark mode recolors the hero and cards without hiding buttons, financial warnings or routes", async ({ page }) => {
    for (const width of [360, 1280]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/demo/dashboard");
      if (await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).count()) {
        await page.getByRole("button", { name: "تفعيل الوضع الداكن" }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.getByRole("link", { name: "+ تسجيل نقلة جديدة" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "اختصارات الرئيسية" }).getByRole("link")).toHaveCount(4);
      await expect(page.getByRole("status", { name: "تنبيه النسخة التجريبية" })).toBeVisible();
      const bg = await page.getByRole("region", { name: "المؤشرات اليومية" })
        .locator("article").first().evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe("rgb(255, 255, 255)");
      await mkdir("artifacts/h056", { recursive: true });
      await page.screenshot({ path: "artifacts/h056/dashboard-dark-" + width + ".png", fullPage: true });
    }
  });

  test("professional header identity still preserves keyboard and mobile navigation", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/demo/dashboard");
    await expect(page.locator("header").first()).toContainText("حسابات النقل");
    await expect(page.locator("header").first()).toContainText("معاينة تفاعلية");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "تخطي التنقل إلى المحتوى الرئيسي" })).toBeFocused();
    await page.getByRole("navigation", { name: "التنقل الرئيسي" }).getByRole("link", { name: "تسجيل النقلات" }).click();
    await expect(page).toHaveURL(/\/demo\/trips$/);
  });
});
