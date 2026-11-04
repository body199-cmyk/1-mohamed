import type { ContractorStatementInput } from "../src/statement-types";

export function makeBaseInput(): ContractorStatementInput {
  return {
    counterpartyId: "K1",
    opening: {
      startDate: "2026-11-01",
      signedPiastres: "0",
    },
    period: {
      from: "2026-11-05",
      to: "2026-11-10",
    },
    movements: [],
  };
}
