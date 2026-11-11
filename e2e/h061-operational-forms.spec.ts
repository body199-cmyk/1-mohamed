import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { selectThemeViaSettings, waitForElementVisualStability } from "./support/approved-theme";

/** H061: only appearance changes; existing payment, trip and master-data contracts stay live. */
const routes = [
  ["/demo/trips", "trips"],
  ["/demo/master-data", "master-data"],
  ["/demo/payments", "payments"],
] as const;

function contrast(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const rgb = (color.match(/[\d.]+/g) ?? []).slice(0,3).map(Number);
    if (rgb.length !== 3) throw new Error("Expected computed RGB: " + color);
    const [r,g,b] = rgb.map(value => {
      const c = value / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    });
    return r! * .2126 + g! * .7152 + b! * .0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test.describe("H061 Tabler-style operational entry and payment screens", () => {
  test.describe.configure({ retries: 0 });
  test("three routes retain right-sidebar/compact-nav layouts and capture 12 light/dark screenshots",async({page})=>{
    test.setTimeout(120_000);
    await mkdir("artifacts/h061",{recursive:true});
    for (const width of [360,1280] as const) {
      await page.setViewportSize({width,height:780});
      for (const theme of ["light","dark"] as const) {
        await page.goto("/demo/trips");
        await selectThemeViaSettings(page,theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
        for (const [path,name] of routes) {
          await page.goto(path);
          await expect(page.locator("main#main-content")).toBeVisible();
          await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
          const nav = page.getByRole("navigation",{name:"التنقل الرئيسي"});
          await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),
            path+" "+theme+" "+width).toBe(false);
          await page.screenshot({
            path:"artifacts/h061/"+name+"-"+theme+"-"+width+".png",
            fullPage:true,
          });
        }
      }
    }
  });

  test("primary actions and selected master-data tabs meet 4.5:1 contrast in both themes",async({page})=>{
    await page.setViewportSize({width:360,height:780});
    for (const theme of ["light","dark"] as const) {
      await page.goto("/demo/trips");
      await selectThemeViaSettings(page,theme);
      for(const [path] of routes) {
        await page.goto(path);
        // A route navigation can server-render before ThemeProvider rehydrates.
        await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
        const button = path==="/demo/trips"
          ? page.locator('main button[class*="btnPrimary"]').first()
          : page.locator('main button[class*="_primary_"]').first();
        await expect(button).toBeVisible();
        await waitForElementVisualStability(button);
        const colors=await button.evaluate(el=>({
          fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor,
        }));
        expect(contrast(colors.fg,colors.bg),path+" "+theme+" primary action, computed colors "+JSON.stringify(colors))
          .toBeGreaterThanOrEqual(4.5);
        if(path==="/demo/master-data") {
          const tab = page.locator('[role="tab"][aria-selected="true"]');
          await expect(tab).toHaveCount(1);
          await waitForElementVisualStability(tab);
          const tabColors=await tab.evaluate(el=>({
            fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor,
          }));
          expect(contrast(tabColors.fg,tabColors.bg),theme+" selected data tab")
            .toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });
});
