import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

function contrast(foreground: string, background: string): number {
  const linear = (color: string) => {
    const values = (color.match(/[\\d.]+/g) ?? []).slice(0, 3).map(Number);
    if (values.length !== 3) throw new Error("Expected RGB computed color: " + color);
    const [r, g, b] = values.map(x => {
      const v = x / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return r! * .2126 + g! * .7152 + b! * .0722;
  };
  const a=linear(foreground),b=linear(background);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

test.describe("H060 open-source dashboard identity — Tabler-inspired RTL shell", () => {
  test("desktop has one right-hand sidebar and routes remain usable", async ({page}) => {
    await page.setViewportSize({width:1280,height:780});
    await page.goto("/demo/dashboard");
    const dims=await page.evaluate(() => {
      const header=document.querySelector("header");
      const nav=document.querySelector('nav[aria-label="التنقل الرئيسي"]');
      const workspace=document.querySelector(".appWorkspace");
      if (!header || !nav || !workspace) throw new Error("Missing shell");
      const sidebar=header.getBoundingClientRect();
      const main=workspace.getBoundingClientRect();
      return {
        sidebarLeft:sidebar.left, sidebarRight:sidebar.right, width:sidebar.width,
        mainRight:main.right, navDirection:getComputedStyle(nav).flexDirection,
        scrollWidth:document.documentElement.scrollWidth,
        viewport:innerWidth,
      };
    });
    expect(dims.navDirection).toBe("column");
    expect(dims.width).toBeGreaterThan(220);
    expect(dims.width).toBeLessThan(290);
    expect(dims.sidebarRight).toBeCloseTo(1280,0);
    expect(dims.sidebarLeft).toBeGreaterThanOrEqual(dims.mainRight-1);
    expect(dims.scrollWidth).toBeLessThanOrEqual(dims.viewport+1);
    const nav=page.getByRole("navigation",{name:"التنقل الرئيسي"});
    await expect(nav.getByRole("link",{name:"الرئيسية"})).toHaveAttribute("aria-current","page");
    await nav.getByRole("link",{name:"دفعات العربيات"}).click();
    await expect(page.getByRole("heading",{name:"دفعات العربيات"})).toBeVisible();
    await expect(nav.getByRole("link",{name:"دفعات العربيات"})).toHaveAttribute("aria-current","page");
  });

  test("mobile keeps a keyboard-reachable single-row navigation and no body overflow", async ({page}) => {
    await page.setViewportSize({width:360,height:760});
    await page.goto("/demo/dashboard");
    const nav=page.getByRole("navigation",{name:"التنقل الرئيسي"});
    const values=await nav.evaluate(el => ({
      direction:getComputedStyle(el).flexDirection,
      overflow:getComputedStyle(el).overflowX,
      scroll:el.scrollWidth, client:el.clientWidth,
    }));
    expect(values.direction).toBe("row");
    expect(values.overflow).toBe("auto");
    expect(values.scroll).toBeGreaterThan(values.client);
    await nav.getByRole("link",{name:"كشف حساب نقد العربية"}).click();
    await expect(page.getByRole("heading",{name:"كشف حساب نقد العربية"})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });

  test("live dashboard CTA stays readable in both themes; capture four screen-size and theme pairs",async({page})=>{
    await mkdir("artifacts/h060",{recursive:true});
    for(const width of [360,1280]){
      await page.setViewportSize({width,height:780});
      for(const theme of ["light","dark"] as const){
        await page.goto("/demo/dashboard");
        if(await page.locator("html").getAttribute("data-theme")!==theme){
          await page.getByRole("button",{name:theme==="dark"?"تفعيل الوضع الداكن":"تفعيل الوضع الفاتح"}).click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
        const c=await page.getByRole("link",{name:"+ تسجيل نقلة جديدة"}).evaluate(el=>({
          fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor
        }));
        expect(contrast(c.fg,c.bg),theme+" primary button").toBeGreaterThanOrEqual(4.5);
        for(const [route,name] of [["/demo/dashboard","dashboard"],["/demo/contractors","statement"]] as const){
          await page.goto(route);
          await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
          await page.screenshot({path:"artifacts/h060/"+name+"-"+theme+"-"+width+".png",fullPage:true});
        }
      }
    }
  });
});
