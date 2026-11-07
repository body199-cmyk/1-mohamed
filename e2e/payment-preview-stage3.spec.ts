import { expect, test } from "@playwright/test";

test.describe("Stage 3 — cash payment preview shares the save validator", () => {
  test("Arabic-digit amounts produce the same before/after preview as the saved amount parser", async ({ page }) => {
    await page.goto("/demo/payments");
    const form = page.getByRole("form", { name: "نموذج دفعة العربية" });
    const amount = form.getByRole("textbox", { name: "المبلغ بالجنيه" });
    await amount.fill("١٠٫٥٠");
    await expect(page.getByRole("region", { name: "الرصيد بعد الدفعة" })).toContainText("10.50");
    await amount.fill("0.001");
    await expect(page.getByRole("region", { name: "الرصيد بعد الدفعة" })).toHaveCount(0);
    await amount.fill("92233720368547758.08");
    await expect(page.getByRole("region", { name: "الرصيد بعد الدفعة" })).toHaveCount(0);
  });
});
