import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/** H059: screen-by-screen review evidence, not live-device or user approval. */
const screens = [
  ["/demo/dashboard", "dashboard"],
  ["/demo/trips", "trips"],
  ["/demo/contractors", "contractor"],
  ["/demo/master-data", "master-data"],
  ["/demo/reports/daily", "daily"],
  ["/demo/reports/vehicle-cash", "vehicle-cash"],
  ["/demo/payments", "payments"],
] as const;

function contrastRatio(foreground: string, background: string): number {
  function luminance(color: string): number {
    const channels = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    if (channels.length !== 3) throw new Error("Expected an opaque RGB color: " + color);
    const linear = channels.map(value => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722;
  }
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test.describe("H059 final pre-cloud visual review matrix", () => {
  test("active header route text meets 4.5:1 in light and dark", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/demo/dashboard");
    for (const theme of ["light", "dark"] as const) {
      if (await page.locator("html").getAttribute("data-theme") !== theme) {
        await page.getByRole("button", {
          name: theme === "dark" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح",
        }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const active = page.getByRole("navigation", { name: "التنقل الرئيسي" })
        .locator('[aria-current="page"]');
      const colors = await active.evaluate(el => ({
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el).backgroundColor,
      }));
      expect(contrastRatio(colors.fg,colors.bg), theme + " active navigation").toBeGreaterThanOrEqual(4.5);
    }
  });

  for (const width of [360,768,1280] as const) {
    for (const theme of ["light", "dark"] as const) {
      test("captures all seven routes in " + theme + " at " + width + "px", async ({ page }) => {
        test.setTimeout(120_000);
        await mkdir("artifacts/h059", { recursive: true });
        await page.setViewportSize({ width, height: 780 });
        await page.goto("/demo/dashboard");
        if (await page.locator("html").getAttribute("data-theme") !== theme) {
          await page.getByRole("button", {
            name: theme === "dark" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح",
          }).click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        for (const [path,name] of screens) {
          await page.goto(path);
          await expect(page.locator("main#main-content")).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
          const nav=page.getByRole("navigation", { name: "التنقل الرئيسي" });
          await expect(nav).toBeVisible();
          const selected=nav.locator('[aria-current="page"]');
          await expect(selected).toHaveCount(1);
          await selected.scrollIntoViewIfNeeded();
          const overflow=await page.evaluate(() =>
            document.documentElement.scrollWidth > innerWidth + 1);
          expect(overflow, path+" viewport "+width+" theme "+theme).toBe(false);
          await page.screenshot({
            path:"artifacts/h059/"+name+"-"+theme+"-"+width+".png",
            fullPage:true,
          });
        }
      });
    }
  }
});
