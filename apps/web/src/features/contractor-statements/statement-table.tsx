import React from "react";
import type { ContractorStatementRow } from "@ledger/contractor-statements";
import { formatEgpFromPiastres } from "@ledger/accounting";
import styles from "./statements.module.css";

interface StatementTableProps {
  rows: readonly ContractorStatementRow[];
  receiptByTripId: ReadonlyMap<string, string>;
  tripDetailsById: ReadonlyMap<string, { vehicle: string; route: string }>;
}

export function StatementTable({ rows, receiptByTripId, tripDetailsById }: StatementTableProps) {
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
              <th>العربية</th>
              <th>المسار / الوجهة</th>
              <th>رقم النقلة</th>
              <th>الاتجاه والمسؤولية</th>
              <th>الأثر على حساب أحمد (+/−)</th>
              <th>الرصيد التراكمي</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const deltaFmt = formatEgpFromPiastres(row.signedDeltaPiastres);
              const runningFmt = formatEgpFromPiastres(row.runningBalancePiastres);

              const isAhmed = row.direction === "AHMED_SUPPLIES";

              return (
                <React.Fragment key={row.id}>
                {(index === 0 || rows[index - 1].workDate !== row.workDate) && <tr style={{background:"var(--color-primary-bg)"}}><th colSpan={7} scope="rowgroup" style={{color:"var(--text-main)",fontSize:"1rem",padding:"12px 16px"}}>📅 شغل يوم {row.workDate}</th></tr>}
                <tr>
                  <td>{row.workDate}</td>
                  <td>{tripDetailsById.get(row.id)?.vehicle || "—"}</td>
                  <td style={{whiteSpace:"normal",minWidth:140}}>{tripDetailsById.get(row.id)?.route || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {row.id}
                  </td>
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
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
