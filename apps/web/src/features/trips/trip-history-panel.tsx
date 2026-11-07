"use client";

import { useMemo, useState } from "react";
import { useDemoStore } from "../../demo/demo-context";
import { cairoBusinessDate } from "../payments/cash-ledger";
import { formatEgpFromPiastres } from "@ledger/accounting";
import styles from "./trips.module.css";

type Range = "today" | "week" | "month" | "custom";
const toDate = (value: string) => new Date(value + "T12:00:00Z");
const asDate = (value: Date) => value.toISOString().slice(0, 10);
function rangeStart(today: string, range: Range) {
  const date = toDate(today);
  if (range === "week") date.setUTCDate(date.getUTCDate() - 6);
  if (range === "month") date.setUTCDate(1);
  return asDate(date);
}
const money = (piastres: string) => {
  const result = formatEgpFromPiastres(piastres);
  return result.ok ? result.amount + " ج.م" : "—";
};

export function TripHistoryPanel() {
  const { trips, contractors, vehicles } = useDemoStore();
  const [range, setRange] = useState<Range>("today");
  const [today] = useState(cairoBusinessDate);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState("");
  const [contractorId, setContractorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [direction, setDirection] = useState("");
  const start = range === "custom" ? from : rangeStart(today, range);
  const end = range === "custom" ? to : today;
  const visible = useMemo(() => {
    if (start > end) return [];
    const query = search.trim().toLocaleLowerCase("ar");
    return trips.filter(trip => {
      if (trip.workDate < start || trip.workDate > end) return false;
      if (contractorId && trip.counterpartyId !== contractorId) return false;
      if (vehicleId && trip.vehicleId !== vehicleId) return false;
      if (direction && trip.direction !== direction) return false;
      if (!query) return true;
      const contractor = contractors.find(item => item.id === trip.counterpartyId)?.name ?? "";
      const vehicle = vehicles.find(item => item.id === trip.vehicleId);
      return [trip.id, contractor, vehicle?.plateNumber ?? "", vehicle?.driverName ?? "", trip.origin, trip.destination]
        .some(value => value.toLocaleLowerCase("ar").includes(query));
    }).sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt));
  }, [trips, contractors, vehicles, start, end, search, contractorId, vehicleId, direction]);

  const name = (id: string) => contractors.find(item => item.id === id)?.name ?? id;
  const plate = (id: string) => vehicles.find(item => item.id === id)?.plateNumber ?? id;
  return (
    <section className={styles.card} aria-label="سجل النقلات">
      <h2 className={styles.cardTitle}>سجل النقلات</h2>
      <div className={styles.historyFilters}>
        <div className={styles.historyRanges} role="group" aria-label="فترة النقلات">
          {([["today","اليوم"],["week","آخر 7 أيام"],["month","الشهر"],["custom","فترة مخصصة"]] as const).map(([value,label]) => (
            <button type="button" key={value} aria-pressed={range === value} className={styles.btnSecondary} onClick={() => setRange(value)}>{label}</button>
          ))}
        </div>
        {range === "custom" && <div className={styles.formGrid}>
          <label className={styles.formGroup}>من<input type="date" className={styles.input} value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label className={styles.formGroup}>إلى<input type="date" className={styles.input} value={to} onChange={event => setTo(event.target.value)} /></label>
        </div>}
        <input type="search" aria-label="بحث في النقلات" className={styles.input} placeholder="بحث برقم النقلة أو المقاول أو العربية أو المسار" value={search} onChange={event => setSearch(event.target.value)} />
        <details className={styles.historyAdvanced}>
          <summary>فلاتر متقدمة</summary>
          <div className={styles.formGrid}>
            <label className={styles.formGroup}>المقاول<select className={styles.select} value={contractorId} onChange={event => setContractorId(event.target.value)}><option value="">كل المقاولين</option>{contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className={styles.formGroup}>العربية<select className={styles.select} value={vehicleId} onChange={event => setVehicleId(event.target.value)}><option value="">كل العربيات</option>{vehicles.map(v => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}</select></label>
            <label className={styles.formGroup}>اتجاه الشغل<select className={styles.select} value={direction} onChange={event => setDirection(event.target.value)}><option value="">الاتجاهان</option><option value="AHMED_SUPPLIES">شغل أحمد</option><option value="OTHER_SUPPLIES">شغل المقاول</option></select></label>
          </div>
        </details>
      </div>
      <p role="status" className={styles.historyCount}>{start > end ? "تاريخ البداية بعد النهاية؛ راجع الفترة." : `عدد النقلات في الفترة: ${visible.length}`}</p>
      <div className={styles.historyDesktop}>
        <table className={styles.historyTable}>
          <thead><tr><th>التاريخ</th><th>المقاول</th><th>العربية</th><th>الاتجاه</th><th>المسار</th><th>قيمة شغل المقاول</th></tr></thead>
          <tbody>{visible.map(t => <tr key={t.id}><td>{t.workDate}</td><td>{name(t.counterpartyId)}</td><td>{plate(t.vehicleId)}</td><td>{t.direction === "AHMED_SUPPLIES" ? "شغل أحمد" : "شغل المقاول"}</td><td>{t.origin || "—"} ← {t.destination || "—"}</td><td>{money(t.contractorTotalPiastres)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className={styles.historyMobile}>
        {visible.map(t => <details className={styles.historyTrip} key={t.id}>
          <summary><strong>{t.workDate} · {plate(t.vehicleId)}</strong><span>{name(t.counterpartyId)}</span></summary>
          <dl><dt>الاتجاه</dt><dd>{t.direction === "AHMED_SUPPLIES" ? "شغل أحمد" : "شغل المقاول"}</dd><dt>المسار</dt><dd>{t.origin || "—"} ← {t.destination || "—"}</dd><dt>الوزن</dt><dd>{t.weightTonnes} طن</dd><dt>قيمة شغل المقاول</dt><dd>{money(t.contractorTotalPiastres)}</dd><dt>قيمة العربية</dt><dd>{money(t.vehicleTotalPiastres)}</dd></dl>
        </details>)}
      </div>
      {visible.length === 0 && <p>لا توجد نقلات مطابقة للفترة والفلاتر المختارة.</p>}
    </section>
  );
}
