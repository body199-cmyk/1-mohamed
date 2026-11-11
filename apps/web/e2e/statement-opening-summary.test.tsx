import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildContractorStatement } from "@ledger/contractor-statements";
import { StatementSummaryCard } from "../src/features/contractor-statements/statement-summary-card";

describe("visible carried contractor balance", () => {
  it.each([
    ["-40000", "30000", "لصالح المقاول أحمد علام عند أحمد"],
    ["40000", "110000", "لصالح أحمد عند المقاول أحمد علام"],
    ["0", "70000", "لا يوجد رصيد سابق لأي طرف"],
  ])("includes opening %s exactly once", (opening, closing, owner) => {
    const result = buildContractorStatement({
      counterpartyId: "K1",
      opening: { startDate: "2026-11-01", signedPiastres: opening },
      period: { from: "2026-11-01", to: "2026-11-11" },
      movements: [
        { id: "1", counterpartyId: "K1", workDate: "2026-11-02", direction: "AHMED_SUPPLIES", contractorTotalPiastres: "130000" },
        { id: "2", counterpartyId: "K1", workDate: "2026-11-03", direction: "COUNTERPARTY_SUPPLIES", contractorTotalPiastres: "60000" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Invalid fixture");
    expect(result.statement.closingBalancePiastres).toBe(closing);
    const html = renderToStaticMarkup(<StatementSummaryCard statement={result.statement} contractorName="المقاول أحمد علام" />);
    const visibleSummary = html.split("<details")[0];
    expect(visibleSummary).toContain('data-testid="opening-balance-summary"');
    expect(visibleSummary).toContain(owner);
    expect(visibleSummary).toContain("الصافي النهائي = الحساب السابق + شغل أحمد − شغل المقاول");
    if (opening === "-40000") expect(visibleSummary).toContain("-400.00 + 1300.00 − 600.00 = 300.00");
  });
});

import { ContractorMoney } from "../src/features/contractor-statements/contractor-money";
it.each([["100", "color:var(--contractor-credit)", "لأحمد", "+"], ["-100", "color:var(--contractor-debit)", "على أحمد", "-"], ["0", "color:var(--text-muted)", "متعادل", "0.00"]])("contractor identity %s", (value,color,label,sign) => { const html=renderToStaticMarkup(<ContractorMoney value={value} />); expect(html).toContain(color); expect(html).toContain(label); expect(html).toContain(sign); });
