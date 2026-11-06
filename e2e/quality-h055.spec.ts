import { expect, test } from "@playwright/test";

const routes = [
  "/demo/dashboard", "/demo/trips", "/demo/contractors",
  "/demo/master-data", "/demo/reports/daily",
  "/demo/reports/vehicle-cash", "/demo/payments",
] as const;

// CSS-based ratio, using actual computed colors in each browser theme.
function contrast(foreground: string, background: string): number {
  const luminance = (rgb: string) => {
    const components = (rgb.match(/[\d.]+/g) ?? []).slice(0,3).map(Number);
    if (components.length !== 3) throw new Error("Expected computed RGB color: " + rgb);
    const linear = components.map(c => {
      const x = c / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}

test.describe("H055 / T11: bounded desktop-Chromium UX quality gate", () => {
  test("360px and 768px: all key demo routes fit the viewport without a sticky multi-row menu", async ({ page }) => {
    for (const width of [360,768]) {
      await page.setViewportSize({ width, height: 740 });
      for (const path of routes) {
        await page.goto(path);
        await expect(page.getByRole("navigation",{name:"التنقل الرئيسي"})).toBeVisible();
        const sizes = await page.evaluate(() => {
          const header = document.querySelector("header");
          const nav = document.querySelector('nav[aria-label="التنقل الرئيسي"]');
          if (!header || !nav) throw new Error("Header/nav missing");
          const headerBox = header.getBoundingClientRect();
          const navBox = nav.getBoundingClientRect();
          return {
            doc: document.documentElement.scrollWidth,
            viewport: innerWidth,
            headerHeight: headerBox.height,
            navWidth: navBox.width,
            navScrollWidth: nav.scrollWidth,
            navClientWidth: nav.clientWidth,
          };
        });
        expect(sizes.doc, path + " document overflows at " + width).toBeLessThanOrEqual(sizes.viewport + 1);
        expect(sizes.headerHeight, path + " sticky header blocks the screen").toBeLessThan(165);
        expect(sizes.navWidth, path + " navigation is wider than the viewport").toBeLessThanOrEqual(sizes.viewport);
        if(width===360)expect(sizes.navScrollWidth).toBeGreaterThan(sizes.navClientWidth);
      }
    }
  });

  test("1024px tablet: a single-line nav exposes distant routes by scrolling inside the header", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/demo/dashboard");
    const nav = page.getByRole("navigation",{name:"التنقل الرئيسي"});
    // Measurement hygiene (same pattern as BUG-010/BUG-011 fixes in H061):
    // hydration may replace the server-rendered nav node mid-measure, which
    // yields empty computed styles. Wait for the connected, styled element.
    // Terminal expectations below are unchanged from H055.
    await expect.poll(async () => (await nav.evaluate(n => ({
      connected: n.isConnected,
      overflow: getComputedStyle(n).overflowX,
      flexDirection: getComputedStyle(n).flexDirection,
    })))).toEqual({ connected: true, overflow: "auto", flexDirection: "row" });
    const props = await nav.evaluate(n => ({
      height:n.getBoundingClientRect().height,
      wrapped:Array.from(n.children).some((child,i,a) => i>0 &&
        Math.abs(child.getBoundingClientRect().top - a[0]!.getBoundingClientRect().top)>6),
    }));
    expect(props.height).toBeLessThan(66);
    expect(props.wrapped).toBe(false);
    await nav.getByRole("link",{name:"دفعات العربيات"}).click();
    await expect(page.getByRole("heading",{name:"دفعات العربيات"})).toBeVisible();
  });

  test("keyboard skip link appears on focus, bypasses navigation and links expose focus outlines", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/demo/dashboard");
    const skip = page.getByRole("link",{name:"تخطي التنقل إلى المحتوى الرئيسي"});
    await page.keyboard.press("Tab");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main-content")).toBeFocused();
    const menu = page.getByRole("navigation",{name:"التنقل الرئيسي"});
    const reports = menu.getByRole("link",{name:"تقرير الشغل اليومي"});
    await reports.focus();
    const outline = await reports.evaluate(el => ({
      style:getComputedStyle(el).outlineStyle,
      width:parseFloat(getComputedStyle(el).outlineWidth),
    }));
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });

  test("demo warning text has at least WCAG AA 4.5:1 contrast in both themes", async ({ page }) => {
    await page.goto("/demo/dashboard");
    const banner = page.getByRole("status",{name:"تنبيه النسخة التجريبية"});
    for (const expectedTheme of ["light","dark"] as const) {
      if(expectedTheme==="dark")await page.getByRole("button",{name:"تفعيل الوضع الداكن"}).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme",expectedTheme);
      // The status banner has no CSS color transition; once the root theme
      // attribute is applied, measure its final theme tokens directly.
      const style = await banner.evaluate(el => ({
        foreground:getComputedStyle(el).color,
        background:getComputedStyle(el).backgroundColor,
      }));
      expect(contrast(style.foreground,style.background),expectedTheme+" contrast")
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  test("records local Chromium baseline metrics without inventing real Android speed budgets", async ({ page }) => {
    await page.setViewportSize({width:360,height:740});
    await page.goto("/demo/dashboard");
    const result = await page.evaluate(() => ({
      navigation:Math.round(performance.getEntriesByType("navigation").length),
      resources:performance.getEntriesByType("resource").length,
      documentWidth:document.documentElement.scrollWidth,
      viewport:innerWidth,
      route:location.pathname,
    }));
    expect(result.navigation).toBe(1);
    expect(result.resources).toBeGreaterThan(0);
    expect(result.documentWidth).toBeLessThanOrEqual(result.viewport+1);
    console.log("H055 local Chromium-only baseline (not Android/LTE): " + JSON.stringify(result));
  });
});
