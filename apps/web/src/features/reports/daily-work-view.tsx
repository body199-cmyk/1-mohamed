"use client";

import React, { useMemo, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { buildDailyWorkReport, type DailyWorkTotals } from "./daily-work-report";
import styles from "./daily-work.module.css";
import { ReportExportActions } from "./report-export-actions";
import { toDailyWorkOperationalReport } from "./report-export-documents";

function currentCairoDate(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const find = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return find("year") + "-" + find("month") + "-" + find("day");
}

function egp(piastres: string): string {
  const result = formatEgpFromPiastres(piastres);
  return result.ok ? result.amount + " ج.م" : "غير صالح";
}

function TotalCard({ label, totals }: { label: string; totals: DailyWorkTotals }) {
  return <section className={styles.card} aria-label={label}>
    <h2>{label}</h2>
    <dl>
      <div><dt>عدد النقلات</dt><dd>{totals.tripCount}</dd></div>
      <div><dt>الوزن</dt><dd>{totals.totalWeightTonnes} طن</dd></div>
      <div><dt>قيمة شغل المقاول</dt><dd>{egp(totals.contractorTotalPiastres)}</dd></div>
      <div><dt>مستحق العربيات عن الشغل</dt><dd>{egp(totals.vehicleTotalPiastres)}</dd></div>
    </dl>
  </section>;
}

export function DailyWorkView() {
  const { contractors, vehicles, trips } = useDemoStore();
  const [workDate, setWorkDate] = useState(currentCairoDate);
  const [contractorId, setContractorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");

  const report = useMemo(
    () => buildDailyWorkReport(trips, { workDate, contractorId, vehicleId }),
    [trips, workDate, contractorId, vehicleId]
  );
  const contractorNames = useMemo(() => new Map(contractors.map(c => [c.id, c.name])), [contractors]);
  const vehiclePlates = useMemo(() => new Map(vehicles.map(v => [v.id, v.plateNumber])), [vehicles]);

  const exportDocument = useMemo(() => report.ok ? toDailyWorkOperationalReport(report, {
    workDate,
    contractorLabel: contractorId ? contractorNames.get(contractorId) ?? contractorId : "جميع المقاولين",
    vehicleLabel: vehicleId ? vehiclePlates.get(vehicleId) ?? vehicleId : "جميع العربيات",
    contractorNames,
    vehiclePlates,
  }) : null, [report, workDate, contractorId, vehicleId, contractorNames, vehiclePlates]);

  return <div className={styles.page}>
    <header>
      <h1>تقرير الشغل اليومي</h1>
      <p className={styles.muted}>معاينة تجريبية من النقلات المسجلة في نفس الجلسة. القيم حجم شغل واستحقاقات، وليست رصيد فرق الشغل أو النقد المتبقي بعد الدفعات.</p>
    </header>

    <section className={styles.filters} aria-label="فلاتر التقرير اليومي">
      <label>تاريخ التقرير
        <input type="date" aria-label="تاريخ التقرير" value={workDate}
          onChange={e => setWorkDate(e.target.value)} />
      </label>
      <label>المقاول
        <select aria-label="فلتر المقاول" value={contractorId} onChange={e => setContractorId(e.target.value)}>
          <option value="">جميع المقاولين</option>
          {contractors.map(c => <option key={c.id} value={c.id}>
            {c.name}{c.isArchived ? " — مؤرشف" : ""}
          </option>)}
        </select>
      </label>
      <label>العربية
        <select aria-label="فلتر العربية" value={vehicleId} onChange={e => setVehicleId(e.target.value)}>
          <option value="">جميع العربيات</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>
            {v.plateNumber}{v.isArchived ? " — مؤرشفة" : ""}
          </option>)}
        </select>
      </label>
      <button type="button" className={styles.reset}
        onClick={() => { setContractorId(""); setVehicleId(""); }}>
        عرض الجميع في اليوم
      </button>
    </section>

    {!report.ok ? <p role="alert" className={styles.error}>
      {report.error === "INVALID_DATE"
        ? "اختر تاريخًا صحيحًا لعرض التقرير."
        : "تم إيقاف عرض المجاميع: بيانات نقلة غير متطابقة مع محرك الحساب" +
          (report.tripId ? " (" + report.tripId + ")." : ".")}
    </p> : <>
      {exportDocument && <ReportExportActions document={exportDocument} fileNameBase={"daily-work-" + workDate} />}
      <div className={styles.stats}>
        <TotalCard label="إجمالي اليوم المحدد" totals={report.totals} />
        <TotalCard label="شغل أحمد للطرف الآخر" totals={report.ahmedSupplies} />
        <TotalCard label="شغل الطرف الآخر لأحمد" totals={report.otherSupplies} />
      </div>
      {report.rows.length === 0 ? <p role="status" className={styles.empty}>
        لا توجد نقلات في اليوم والفلاتر المحددة. جرّب تاريخًا أو مقاولًا أو عربية أخرى.
      </p> : <>
        <h2 className={styles.tableTitle}>تفاصيل النقلات ({report.rows.length})</h2>
        <div className={styles.tableScroll} role="region" aria-label="التمرير الأفقي لجدول النقلات" tabIndex={0}>
          <table className={styles.table} aria-label="نقلات اليوم">
            <thead><tr>
              <th scope="col">رقم النقلة</th>
              <th scope="col">المقاول</th>
              <th scope="col">العربية</th>
              <th scope="col">الاتجاه</th>
              <th scope="col">من / إلى</th>
              <th scope="col">الوزن (طن)</th>
              <th scope="col">قيمة شغل المقاول</th>
              <th scope="col">مستحق العربية</th>
            </tr></thead>
            <tbody>{report.rows.map(t => <tr key={t.id}>
              <th scope="row">{t.id}</th>
              <td>{contractorNames.get(t.counterpartyId) ?? t.counterpartyId}</td>
              <td>{vehiclePlates.get(t.vehicleId) ?? t.vehicleId}</td>
              <td>{t.direction === "AHMED_SUPPLIES" ? "شغل أحمد" : "شغل المقاول"}</td>
              <td>{t.origin || "—"} / {t.destination || "—"}</td>
              <td>{t.weightTonnes}</td>
              <td>{egp(t.contractorTotalPiastres)}</td>
              <td>{egp(t.vehicleTotalPiastres)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
      <p className={styles.muted}>كل نقلة تظهر مرة واحدة. المبالغ معروضة وفق حساب النقلة الأصلي، ولا تُضاف افتتاحيات النقد أو يُخصم أي دفع في هذا التقرير.</p>
    </>}
  </div>;
}
