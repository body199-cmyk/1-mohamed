import { expect, type Page } from "@playwright/test";

/** Use the approved Settings route; the mobile bottom bar hides its theme control. */
export async function selectThemeViaSettings(page: Page, wanted: "light" | "dark") {
  await page.goto("/demo/settings");
  await expect(page.getByRole("heading",{name:"الإعدادات"})).toBeVisible();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", /^(light|dark)$/);
  if (await html.getAttribute("data-theme") !== wanted) {
    await page.getByRole("button",{name:"تغيير المظهر"}).click();
  }
  await expect(html).toHaveAttribute("data-theme",wanted);
}
