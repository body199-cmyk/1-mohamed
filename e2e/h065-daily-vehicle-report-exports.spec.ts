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
  const previous = new URL(page.url()).pathname;
  await page.goto("/demo/settings");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", /^(light|dark)$/);
  if (await html.getAttribute("data-theme") !== theme) {
    await page.getByRole("button",{name:"تغيير المظهر"}).click();
  }
  await expect(html).toHaveAttribute("data-theme",theme);
  if(previous!=="/demo/settings") await page.goto(previous);
  await expect(page.locator("html")).toHaveAttribute("data-theme",theme);
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

function expectTokens(actual: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) {
    expect.soft(actual, label + " should contain " + token).toContain(token);
  }
}

function expectTokenCount(actual: string, token: string, count: number, label: string): void {
  expect.soft(actual.split(token).length - 1, label + " occurrence count for " + token).toBe(count);
}

function expectDetailRowCount(html: string, count: number, label: string): void {
  const tableStart = html.indexOf('<table class="details-table"');
  const bodyStart = html.indexOf("<tbody>", tableStart);
  const bodyEnd = html.indexOf("</tbody>", bodyStart);
  expect.soft(tableStart >= 0 && bodyStart >= 0 && bodyEnd >= 0, label + " details table").toBe(true);
  if (bodyStart >= 0 && bodyEnd >= 0) {
    const body = html.slice(bodyStart + "<tbody>".length, bodyEnd);
    expect.soft((body.match(/<tr>/g) ?? []).length, label + " detail rows").toBe(count);
  }
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
        slug: "daily-work-2026-11-05-all-contractors-all-vehicles",
        periodTokens: ["2026-11-05"],
        movementTokens: ["TRIP-HIST-002", "محجر السويس", "العاصمة الإدارية", "2.000", "1000.00 ج.م", "900.00 ج.م"],
        summaryTokens: ["عدد النقلات", "1", "إجمالي الوزن", "2.000 طن", "قيمة شغل المقاول", "1000.00 ج.م", "مستحق العربيات", "900.00 ج.م"],
        movementKey: "TRIP-HIST-002",
        receiptToken: "REC-002",
        expectedDetailRows: 1,
      },
      {
        path: "/demo/reports/vehicle-cash",
        title: "كشف حساب نقد العربية",
        slug: "vehicle-cash-V1-PRIMARY_AHMED-2026-11-01-2026-11-30",
        periodTokens: ["2026-11-01", "2026-11-30"],
        movementTokens: ["2026-11-02", "مستحق نقلة", "محجر السويس", "العاصمة الإدارية", "أحمد جاب العربية", "280.00 ج.م"],
        summaryTokens: ["الرصيد السابق للفترة", "0.00 ج.م", "مستحق شغل العربية", "280.00 ج.م", "الدفعات خلال الفترة", "0.00 ج.م", "المتبقي آخر الفترة", "280.00 ج.م", "عدد النقلات", "1", "عدد الدفعات السارية", "0"],
        movementKey: "2026-11-02",
        receiptToken: "REC-001",
        expectedDetailRows: 1,
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

        if (width === 360) {
          const movementTable = report.path === "/demo/reports/daily"
            ? page.getByRole("table", { name: "نقلات اليوم" })
            : page.getByRole("table", { name: "جدول حركات كشف العربية" });
          await expect.soft(movementTable.locator("tbody tr"), report.title + " UI movement rows").toHaveCount(report.expectedDetailRows);
          await expect.soft(movementTable, report.title + " UI must not expose receipt metadata").not.toContainText(report.receiptToken);
          await expect.soft(movementTable).toContainText(report.movementKey);
          await expect.soft(movementTable).toContainText(report.movementTokens[report.movementTokens.length - 1]!);
        }

        const html = await printHtml(page, report.title);
        const expectedContent = [...report.periodTokens, ...report.movementTokens, ...report.summaryTokens];
        expectTokens(html, expectedContent, report.title + " HTML/Print");
        expect.soft(html, report.title + " HTML/Print must not expose receipt metadata").not.toContain(report.receiptToken);
        expectTokenCount(html, report.movementKey, 1, report.title + " HTML/Print movement");
        expectDetailRowCount(html, report.expectedDetailRows, report.title + " HTML/Print");
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
            expect.soft(csv.startsWith("\uFEFF")).toBe(true);
            expectTokens(csv, [report.title, ...expectedContent], report.title + " CSV");
            expect.soft(csv, report.title + " CSV must not expose receipt metadata").not.toContain(report.receiptToken);
            expectTokenCount(csv, report.movementKey, 1, report.title + " CSV movement");
          } else {
            expect(file.bytes.subarray(0, 4).toString()).toBe("PK\u0003\u0004");
            const xlsxXml = file.bytes.toString("utf8");
            expectTokens(xlsxXml, [report.title, ...expectedContent], report.title + " XLSX");
            expect.soft(xlsxXml, report.title + " XLSX must not expose receipt metadata").not.toContain(report.receiptToken);
            expectTokenCount(xlsxXml, report.movementKey, 1, report.title + " XLSX movement");
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
  test("negative cash payments keep the leading minus sign in print and downloadable reports", async ({ page }) => {
    test.setTimeout(120_000);
    await page.clock.setFixedTime(new Date("2026-11-05T12:00:00+02:00"));
    await mkdir("artifacts/h065", { recursive: true });
    await page.goto("/demo/payments");
    await page.getByLabel("تاريخ الدفع الحقيقي").fill("2026-11-03");
    await page.getByLabel("المبلغ بالجنيه").fill("100");
    await page.getByRole("button", { name: "تسجيل الدفعة" }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("تم تسجيل الدفعة");
    await page.getByRole("navigation",{name:"التنقل الرئيسي"})
      .getByRole("link",{name:"نقدية العربية",exact:true}).click();
    await expect(page.getByRole("heading", { name: "كشف حساب نقد العربية" })).toBeVisible();
    const table = page.getByRole("table", { name: "جدول حركات كشف العربية" });
    await expect.soft(table.locator("tbody tr"), "cash ledger must retain both work and payment movements").toHaveCount(2);
    await expect.soft(table, "cash ledger must not expose the payment receipt number").not.toContainText("000012");
    await expect.soft(table).toContainText("مستحق نقلة");
    await expect.soft(table).toContainText("دفعة نقدية");
    await expect.soft(table).toContainText("-100.00 ج.م");

    const html = await printHtml(page, "كشف حساب نقد العربية");
    expectTokens(html, ["2026-11-01", "2026-11-30", "2026-11-02", "2026-11-03", "مستحق نقلة", "دفعة نقدية", "محجر السويس", "العاصمة الإدارية", "أحمد جاب العربية", "280.00 ج.م", "-100.00 ج.م", "180.00 ج.م"], "negative-payment HTML/Print");
    expect.soft(html, "negative-payment HTML/Print must not expose payment receipt metadata").not.toContain("000012");
    await writeFile("artifacts/h065/vehicle-cash-negative-payment.html", html, "utf8");

    const csv = await download(page, "تنزيل CSV");
    const negativeCsv = csv.bytes.toString("utf8");
    expectTokens(negativeCsv, ["2026-11-01", "2026-11-30", "2026-11-02", "2026-11-03", "مستحق نقلة", "دفعة نقدية", "محجر السويس", "العاصمة الإدارية", "أحمد جاب العربية", "280.00 ج.م", "'-100.00 ج.م", "180.00 ج.م"], "negative-payment CSV");
    expect.soft(negativeCsv, "negative-payment CSV must not expose payment receipt metadata").not.toContain("000012");
    await writeFile("artifacts/h065/vehicle-cash-negative-payment.csv", csv.bytes);

    const xlsx = await download(page, "تنزيل Excel XLSX");
    expect(xlsx.bytes.subarray(0, 4).toString()).toBe("PK\u0003\u0004");
    const negativeXlsx = xlsx.bytes.toString("utf8");
    expectTokens(negativeXlsx, ["2026-11-01", "2026-11-30", "2026-11-02", "2026-11-03", "مستحق نقلة", "دفعة نقدية", "محجر السويس", "العاصمة الإدارية", "أحمد جاب العربية", "280.00 ج.م", "-100.00 ج.م", "180.00 ج.م"], "negative-payment XLSX");
    expect.soft(negativeXlsx, "negative-payment XLSX must not expose payment receipt metadata").not.toContain("000012");
    await writeFile("artifacts/h065/vehicle-cash-negative-payment.xlsx", xlsx.bytes);

    const png = await download(page, "تنزيل صورة PNG");
    expect(png.bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.bytes.readUInt32BE(16)).toBe(1440);
    await writeFile("artifacts/h065/vehicle-cash-negative-payment.png", png.bytes);

    const pdf = await download(page, "تنزيل PDF مباشر");
    expect(pdf.bytes.subarray(0, 8).toString()).toBe("%PDF-1.4");
    expect(pdf.bytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
    await writeFile("artifacts/h065/vehicle-cash-negative-payment.pdf", pdf.bytes);
  });

  test("FIN-07 writes a numeric-sized cash aggregate into all five actual exports", async ({ page }) => {
    test.setTimeout(180_000);
    await page.clock.setFixedTime(new Date("2026-11-09T12:00:00+02:00"));
    await page.setViewportSize({width:390,height:844});
    await page.goto("/demo/master-data");
    await page.getByRole("tab",{name:"افتتاحيات نقد العربيات"}).click();
    const form=page.getByRole("form",{name:"افتتاحي نقد العربية"});
    await form.getByRole("combobox",{name:"المقاول المسؤول",exact:true}).selectOption("PRIMARY_AHMED");
    await form.getByRole("combobox",{name:"العربية للحساب النقدي"}).selectOption("V1");
    await form.getByLabel("تاريخ افتتاحي النقد").fill("2026-11-01");
    await form.getByRole("combobox",{name:"اتجاه الافتتاحي النقدي"}).selectOption("VEHICLE");
    await form.getByRole("textbox",{name:"مبلغ افتتاحي النقد"}).fill("92233720368547758.07");
    await form.getByRole("textbox",{name:"سبب تعديل افتتاحي النقد"}).fill("FIN-07 boundary test");
    await form.getByRole("button",{name:"حفظ افتتاحي النقد التجريبي"}).click();
    await expect(form.getByRole("status")).toContainText("حُفظ الافتتاحي");
    // Navigate inside the mounted demo provider: a full page reload drops the opening.
    await page.getByRole("navigation",{name:"التنقل الرئيسي"})
      .getByRole("link",{name:"نقدية العربية",exact:true}).click();
    const exact="92233720368548038.07";
    await expect(page.getByRole("region",{name:"ملخص كشف نقد العربية"})).toContainText(exact);
    const html=await printHtml(page,"كشف حساب نقد العربية");
    expect(html).toContain(exact);
    const csv=await download(page,"تنزيل CSV");
    expect(csv.bytes.subarray(0,3).toString("hex")).toBe("efbbbf");
    expect(csv.bytes.toString("utf8")).toContain(exact);
    const xlsx=await download(page,"تنزيل Excel XLSX");
    expect(xlsx.bytes.subarray(0,4).toString("hex")).toBe("504b0304");
    expect(xlsx.bytes.toString("utf8")).toContain(exact);
    const png=await download(page,"تنزيل صورة PNG");
    expect(png.bytes.subarray(0,8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.bytes.readUInt32BE(16)).toBe(1440);
    const pdf=await download(page,"تنزيل PDF مباشر");
    expect(pdf.bytes.subarray(0,8).toString()).toBe("%PDF-1.4");
    expect(pdf.bytes.toString("latin1")).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  });


});
