import { describe, expect, it } from "vitest";
import { createStatementImageLayout, paintStatementImage } from "../src/render-statement-image";
import type { ContractorStatementDocument } from "../src/document-types";

const fixture = (count = 2): ContractorStatementDocument => ({
  businessName: "أحمد أبو علي — بيانات تجريبية",
  counterpartyName: "شركة النيل للمقاولات",
  period: { from: "2026-11-01", to: "2026-11-30" },
  generatedAtLabel: "2026-11-05 21:00",
  summary: {
    openingBalanceText: "-400.00 ج.م",
    ahmedWorkText: "1200.00 ج.م",
    counterpartyWorkText: "200.00 ج.م",
    closingBalanceText: "600.00 ج.م",
    closingBeneficiaryText: "لصالح أحمد أبو علي",
    movementCountText: String(count),
  },
  rows: Array.from({ length: count }, (_, index) => ({
    reference: "MOV-000" + (index + 1),
    workDate: "2026-11-05",
    directionText: "أحمد جاب العربيات",
    amountText: (100 + index) + ".00 ج.م",
    runningBalanceText: (1000 + index) + ".00 ج.م",
  })),
});

function capturePaint(count: number): string[] {
  const calls: string[] = [];
  const ctx = {
    fillRect() {}, strokeRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillText(value: string) { calls.push(value); },
    fillStyle: "", strokeStyle: "", font: "", textAlign: "", textBaseline: "", direction: "", lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
  paintStatementImage(ctx, createStatementImageLayout(fixture(count)));
  return calls;
}

describe("T09.1 image export from identical statement document", () => {
  it("preserves complete summary, period and every row without recalculating", () => {
    const doc = fixture();
    const layout = createStatementImageLayout(doc);
    expect(layout.width).toBe(1440);
    expect(layout.height).toBe(976);
    expect(layout.counterpartyName).toBe(doc.counterpartyName);
    expect(layout.from).toBe(doc.period.from);
    expect(layout.to).toBe(doc.period.to);
    expect(layout.generatedAtLabel).toBe(doc.generatedAtLabel);
    expect(layout.rows).toBe(doc.rows);
    expect(layout.metrics.map(m => m.value)).toEqual([
      doc.summary.openingBalanceText, doc.summary.ahmedWorkText,
      doc.summary.counterpartyWorkText, doc.summary.closingBalanceText,
      doc.summary.closingBeneficiaryText, doc.summary.movementCountText,
    ]);
  });

  it("paints exact financial strings and references from the same document", () => {
    const calls = capturePaint(2);
    for (const token of ["-400.00 ج.م", "600.00 ج.م", "MOV-0001", "MOV-0002", "101.00 ج.م", "المقاول: شركة النيل للمقاولات", "2026-11-30"]) {
      expect(calls).toContain(token);
    }
    expect(calls.filter(x => x.startsWith("MOV-000")).length).toBe(2);
  });

  it("prints an explicit empty-period row", () => {
    expect(createStatementImageLayout(fixture(0)).rows).toHaveLength(0);
    expect(capturePaint(0)).toContain("لا توجد حركات خلال الفترة");
  });

  it("rejects oversize images rather than silently omitting old rows", () => {
    expect(() => createStatementImageLayout(fixture(200))).toThrow(/لن يتم حذف أي حركة/);
    const bounded = createStatementImageLayout(fixture(30));
    expect(bounded.rows.length).toBe(30);
    expect(bounded.height).toBe(2712);
  });
});
