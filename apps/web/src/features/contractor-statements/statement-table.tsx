import React from "react";
import type { ContractorStatementRow } from "@ledger/contractor-statements";
import { formatEgpFromPiastres } from "@ledger/accounting";
import styles from "./statements.module.css";

interface StatementTableProps {
  rows: readonly ContractorStatementRow[];
  tripDetailsById: ReadonlyMap<string, { vehicle: string; vehicleId: string; route: string; origin: string; destination: string }>;
}

export function StatementTable({ rows, tripDetailsById }: StatementTableProps) {
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

  const byDate = new Map<string, typeof rows[number][]>();
  for (const row of rows) byDate.set(row.workDate, [...(byDate.get(row.workDate) ?? []), row]);
  const dailySummaries = [...byDate.entries()].map(([date, dayRows]) => {
    const byVehicle = new Map<string, {
      vehicle: string; count: number; total: bigint; ahmed: bigint; counterparty: bigint;
      destinations: Map<string, number>;
    }>();
    for (const row of dayRows) {
      const details = tripDetailsById.get(row.id);
      const key = details?.vehicleId ?? details?.vehicle ?? "unknown";
      const current = byVehicle.get(key) ?? {
        vehicle: details?.vehicle ?? "عربية غير معروفة", count: 0, total: 0n,
        ahmed: 0n, counterparty: 0n, destinations: new Map<string, number>(),
      };
      const amount = BigInt(row.contractorTotalPiastres);
      current.count += 1;
      current.total += amount;
      if (row.direction === "AHMED_SUPPLIES") current.ahmed += amount;
      else current.counterparty += amount;
      const destination = details?.destination?.trim() || details?.route || "وجهة غير محددة";
      current.destinations.set(destination, (current.destinations.get(destination) ?? 0) + 1);
      byVehicle.set(key, current);
    }
    return { date, count: dayRows.length, vehicles: [...byVehicle.values()] };
  });
  const money = (amount: bigint) => {
    const formatted = formatEgpFromPiastres(amount.toString());
    return formatted.ok ? formatted.amount + " ج.م" : "غير صالح";
  };

  return (
    <div className={styles.tableCard}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>حركات الفترة المفصلة ({rows.length} حركة)</h3>
      </div>
      <div className={styles.dailySummaryList} aria-label="الملخص اليومي حسب العربية والوجهة">
        {dailySummaries.map(day => <details className={styles.dailySummary} key={day.date}>
          <summary>شغل يوم {day.date} — {day.count} نقلة — {day.vehicles.length} عربية</summary>
          <div className={styles.dailySummaryContent}>
            {day.vehicles.map(vehicle => <section className={styles.dailyVehicleSummary} key={vehicle.vehicle}>
              <h4>العربية: {vehicle.vehicle}</h4>
              <div className={styles.dailyVehicleMetrics}>
                <span>{vehicle.count} نقلة</span>
                <span>إجمالي قيمة النقلات: {money(vehicle.total)}</span>
                <span>شغل أحمد: {money(vehicle.ahmed)}</span>
                <span>شغل المقاول: {money(vehicle.counterparty)}</span>
              </div>
              <ul>{[...vehicle.destinations.entries()].map(([destination, count]) =>
                <li key={destination}>{destination} — {count} نقلة</li>
              )}</ul>
            </section>)}
          </div>
        </details>)}
      </div>

      <div className={styles.mobileMovements} aria-label="حركات المقاول على الموبايل">
        {rows.map(row => {
          const details = tripDetailsById.get(row.id);
          const delta = formatEgpFromPiastres(row.signedDeltaPiastres);
          const balance = formatEgpFromPiastres(row.runningBalancePiastres);
          return <details className={styles.mobileMovement} key={row.id}>
            <summary>{row.workDate} — {details?.vehicle ?? "عربية غير معروفة"} — {delta.ok ? delta.amount : "غير صالح"} ج.م</summary>
            <dl>
              <dt>المسار</dt><dd>{details?.route || "—"}</dd>
              <dt>الاتجاه</dt><dd>{row.direction === "AHMED_SUPPLIES" ? "شغل أحمد للمقاول" : "شغل المقاول لأحمد"}</dd>
              <dt>رقم النقلة</dt><dd dir="ltr">{row.id}</dd>
              <dt>أثر الحركة</dt><dd dir="ltr">{delta.ok ? delta.amount : "غير صالح"} ج.م</dd>
              <dt>الرصيد بعد الحركة</dt><dd dir="ltr">{balance.ok ? balance.amount : "غير صالح"} ج.م</dd>
            </dl>
          </details>;
        })}
      </div>
      <div className={`${styles.tableWrapper} ${styles.desktopMovements}`}>
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
