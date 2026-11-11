import React from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
export function ContractorMoney({ value }: { value: string }) {
 const n = BigInt(value); const f = formatEgpFromPiastres(value);
 if (!f.ok) throw new Error("Invalid contractor balance");
 return <span style={{color:n>0n?"var(--contractor-credit)":n<0n?"var(--contractor-debit)":"var(--text-muted)"}}><bdi dir="ltr">{n>0n?"+":""}{f.amount}</bdi> ج.م — {n>0n?"لأحمد":n<0n?"على أحمد":"متعادل"}</span>;
}
