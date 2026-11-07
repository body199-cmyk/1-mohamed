import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const EXPORTS = [
  ["تنزيل PDF مباشر", "pdf"],
  ["تنزيل صورة PNG", "png"],
  ["تنزيل CSV", "csv"],
  ["تنزيل Excel XLSX", "xlsx"],
] as const;

async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-theme", /^(light|dark)$/);
  if (await page.locator("html").getAttribute("data-theme") !== theme) {
    await page.getByRole("button", {
      name: theme === "dark" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح",
    }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function download(page: Page, label: string) {
  const [event] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: label }).click(),
  ]);
  const path = await event.path();
  if (!path) throw new Error("Missing exported report bytes");
  const bytes = await readFile(path);
  return {
    bytes,
    name: event.suggestedFilename(),
    sha: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function printHtml(page: Page, title: string): Promise<string> {
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("button", { name: "طباعة / حفظ PDF" }).click(),
  ]);
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("h1")).toHaveText(title);
  const html = await popup.locator("html").evaluate(element => element.outerHTML);
  expect(html).toContain("@page");
  expect(html).toContain("size: A4");
  await popup.close();
  return html;
}

test.describe("H065 daily and vehicle cash exports", () => {
  test("all five outputs are complete and device/theme independent for both reports", async ({ page }) => {
    test.setTimeout(240_000);
    await page.clock.setFixedTime(new Date("2026-11-05T12:00:00+02:00"));
    await mkdir("artifacts/h065", { recursive: true });

    const reports = [
      {
        path: "/demo/reports/daily",
        title: "تقرير الشغل اليومي",
        slug: "daily-work-2026-11-05",
        expectedCsv: "REC-002",
      },
      {
        path: "/demo/reports/vehicle-cash",
        title: "كشف حساب نقد العربية",
        slug: "vehicle-cash-2026-11-01-2026-11-30",
        expectedCsv: "REC-001",
      },
    ] as const;

    for (const report of reports) {
      const results: Array<{ name: string; sha: string }> = [];
      let firstHtml = "";
      for (const [width, theme] of [[360, "light"], [1280, "dark"]] as const) {
        await page.setViewportSize({ width, height: 780 });
        await page.goto("/demo/contractors");
        await setTheme(page, theme);
        await page.goto(report.path);
        await expect(page.getByRole("heading", { name: report.title })).toBeVisible();
        await expect(page.getByRole("region", { name: "تصدير التقرير" })).toBeVisible();

        const html = await printHtml(page, report.title);
        const outputs = [];
        for (const [label, extension] of EXPORTS) {
          const file = await download(page, label);
          expect(file.name).toBe(report.slug + "." + extension);
          if (extension === "png") {
            expect(file.bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
            expect(file.bytes.readUInt32BE(16)).toBe(1440);
          } else if (extension === "pdf") {
            expect(file.bytes.subarray(0, 8).toString()).toBe("%PDF-1.4");
            expect(file.bytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
          } else if (extension === "csv") {
            const csv = file.bytes.toString("utf8");
            expect(csv.startsWith("\uFEFF")).toBe(true);
            expect(csv).toContain(report.title);
            expect(csv).toContain(report.expectedCsv);
          } else {
            expect(file.bytes.subarray(0, 4).toString()).toBe("PK\u0003\u0004");
          }
          outputs.push(file);
          if (width === 360) {
            await writeFile("artifacts/h065/" + report.slug + "." + extension, file.bytes);
          }
        }
        if (width === 360) {
          firstHtml = html;
          await writeFile("artifacts/h065/" + report.slug + ".html", html, "utf8");
        } else {
          expect(html).toBe(firstHtml);
        }
        if (results.length) {
          for (let i = 0; i < outputs.length; i++) {
            expect(outputs[i]!.sha, report.title + " " + outputs[i]!.name +
              " must not depend on viewport or theme").toBe(results[i]?.sha);
          }
        }
        results.push(...outputs.map(file => ({ name: file.name, sha: file.sha })));
      }
      for (let i = 0; i < EXPORTS.length; i++) {
        expect(results[i]!.name).toBe(results[i + EXPORTS.length]!.name);
        expect(results[i]!.sha, report.title + " export bytes differ by device/theme")
          .toBe(results[i + EXPORTS.length]!.sha);
      }
    }
  });
});
