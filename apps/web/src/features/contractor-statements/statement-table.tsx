import React from "react";
import type { ContractorStatementRow } from "@ledger/contractor-statements";
import { formatEgpFromPiastres } from "@ledger/accounting";
import styles from "./statements.module.css";

interface StatementTableProps {
  rows: readonly ContractorStatementRow[];
  receiptByTripId: ReadonlyMap<string, string>;
}

export function StatementTable({ rows, receiptByTripId }: StatementTableProps) {
  if (rows.length === 0) {
    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>حركات الفترة المفصلة</h3>
        </div>
        <div className={styles.emptyState}>
          <p style={{ fontSize: "1rem", margin: 0 }}>
            📭 لا توجد نقلات مسجلة للمقاول ضمن هذه الفترة المحددة.
          </p>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "6px" }}>
            يمكنك تسجيل نقلات جديدة من شاشة تسجيل النقلات أو تغيير فترة البحث.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>حركات الفترة المفصلة ({rows.length} حركة)</h3>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>تاريخ النقلة</th>
              <th>رقم النقلة</th>
              <th>رقم الإيصال</th>
              <th>الاتجاه والمسؤولية</th>
              <th>الأثر على حساب أحمد (+/−)</th>
              <th>الرصيد التراكمي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const deltaFmt = formatEgpFromPiastres(row.signedDeltaPiastres);
              const runningFmt = formatEgpFromPiastres(row.runningBalancePiastres);

              const isAhmed = row.direction === "AHMED_SUPPLIES";

              return (
                <tr key={row.id}>
                  <td>{row.workDate}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {row.id}
                  </td>
                  <td>{receiptByTripId.get(row.id)?.trim() || "—"}</td>
                  <td>
                    {isAhmed ? (
                      <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                        ✓ شغل أحمد (إضافة له)
                      </span>
                    ) : (
                      <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>
                        ✓ شغل المقاول (خصم على أحمد)
                      </span>
                    )}
                  </td>
                  <td dir="ltr"
                    style={{
                      fontWeight: 700,
                      color: isAhmed
                        ? "var(--color-success)"
                        : "var(--color-warning)",
                    }}
                  >
                    {isAhmed ? "+" : ""}
                    {deltaFmt.ok ? deltaFmt.amount : "0.00"} ج.م
                  </td>
                  <td dir="ltr" style={{ fontWeight: 700, color: "var(--text-main)" }}>
                    {runningFmt.ok ? runningFmt.amount : "0.00"} ج.م
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
