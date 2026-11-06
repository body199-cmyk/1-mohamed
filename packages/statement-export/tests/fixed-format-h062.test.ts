import { describe, expect, it } from "vitest";
import { STATEMENT_PRINT_STYLES } from "../src/statement-print-styles";
import { createStatementImageLayout } from "../src/render-statement-image";
import { createStatementXlsxParts } from "../src/render-statement-xlsx";
import type { ContractorStatementDocument } from "../src/document-types";

const sample: ContractorStatementDocument = {
  businessName: "مكتب النقل", counterpartyName: "مقاول",
  period: {from:"2026-11-01",to:"2026-11-30"}, generatedAtLabel:"٦ نوفمبر",
  summary: {openingBalanceText:"0.00 ج.م",ahmedWorkText:"100.00 ج.م",
    counterpartyWorkText:"0.00 ج.م",closingBalanceText:"100.00 ج.م",
    closingBeneficiaryText:"لصالح أحمد",movementCountText:"1"},
  rows:[{reference:"0001",workDate:"2026-11-05",directionText:"شغل أحمد",
    amountText:"100.00 ج.م",runningBalanceText:"100.00 ج.م"}],
};

describe("H062 fixed-format report contract independent of UI device",()=>{
  it("uses an immutable A4 paper grid with no viewport or app theme selectors",()=>{
    expect(STATEMENT_PRINT_STYLES).toMatch(/@page\s*\{\s*size:\s*A4;/);
    expect(STATEMENT_PRINT_STYLES).toContain("margin: 14mm 12mm");
    expect(STATEMENT_PRINT_STYLES).toContain("background-color: #ffffff");
    expect(STATEMENT_PRINT_STYLES).toContain("#206bc4");
    expect(STATEMENT_PRINT_STYLES).not.toContain("@media (max-width");
    expect(STATEMENT_PRINT_STYLES).not.toContain("data-theme");
  });
  it("uses the same 1440px document canvas and RTL workbook regardless of viewport",()=>{
    const layout=createStatementImageLayout(sample);
    expect(layout.width).toBe(1440);
    expect(layout.rows).toHaveLength(1);
    const workbook=createStatementXlsxParts(sample);
    const detail=workbook.find(p=>p.name==="xl/worksheets/sheet2.xml")?.content;
    const styles=workbook.find(p=>p.name==="xl/styles.xml")?.content;
    expect(detail).toContain('rightToLeft="1"');
    expect(detail).toContain("0001");
    expect(styles).toContain("FF206BC4");
  });
});
