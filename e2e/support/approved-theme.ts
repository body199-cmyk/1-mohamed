import { expect, type Page } from "@playwright/test";

/** Change theme via approved Settings view, then return to the previous route. */
export async function selectThemeViaSettings(page: Page, wanted: "light" | "dark") {
  const previous = new URL(page.url()).pathname;
  await page.goto("/demo/settings");
  const control=page.getByRole("button",{name:"تغيير المظهر"});
  await expect(control).toBeVisible();
  const root=page.locator("html");
  await expect(root).toHaveAttribute("data-theme", /^(light|dark)$/);
  if(await root.getAttribute("data-theme")!==wanted) await control.click();
  await expect(root).toHaveAttribute("data-theme",wanted);
  if(previous!=="/demo/settings") await page.goto(previous);
  await expect(page.locator("html")).toHaveAttribute("data-theme",wanted);
}
