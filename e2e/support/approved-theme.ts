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


/**
 * Wait for finite CSS transitions affecting a measured element, then verify
 * its computed foreground/background/border colors are unchanged across two
 * animation frames. This waits for the actual visual state; it does not retry
 * or relax the contrast assertion.
 */
export async function waitForElementVisualStability(target: import("@playwright/test").Locator): Promise<void> {
  await target.evaluate(async element => {
    const nextFrame = () => new Promise<void>(resolve => {
      requestAnimationFrame(() => resolve());
    });

    // Let style changes from theme hydration reach the element before
    // collecting the CSS transitions created by those changes.
    await nextFrame();
    const transitions = element.getAnimations({ subtree: true }).filter(animation => {
      const timing = animation.effect?.getComputedTiming();
      return animation.playState !== "finished" &&
        animation.playState !== "idle" &&
        timing?.iterations !== Infinity;
    });
    await Promise.all(transitions.map(animation =>
      animation.finished.catch(() => undefined)
    ));

    await nextFrame();
    const readColors = () => {
      const style = getComputedStyle(element);
      return [style.color, style.backgroundColor, style.borderColor].join("|");
    };
    const first = readColors();
    await nextFrame();
    const second = readColors();
    if (first !== second) {
      throw new Error("Theme colors changed after finite CSS transitions completed.");
    }
  });
}
