"use client";

import { useMemo, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { DEMO_PRIMARY_RESPONSIBLE_ID } from "../payments/cash-ledger";
import { buildVehicleCashReport } from "./vehicle-cash-report";
import styles from "../payments/payments.module.css";

function egp(piastres: string): string {
  const result = formatEgpFromPiastres(piastres);
  return result.ok ? result.amount + " ج.م" : "مبلغ غير صالح";
}

export function VehicleCashView() {
  const { contractors, vehicles, trips, payments, cashOpenings } = useDemoStore();
  const [responsibleId, setResponsibleId] = useState(DEMO_PRIMARY_RESPONSIBLE_ID);
  const [vehicleId, setVehicleId] = useState("V1");
  const [from, setFrom] = useState("2026-11-01");
  const [to, setTo] = useState("2026-11-30");

  const result = useMemo(() => buildVehicleCashReport(
    { trips, payments, cashOpenings },
    { vehicleId, responsibleContractorId: responsibleId, from, to }
  ), [trips, payments, cashOpenings, vehicleId, responsibleId, from, to]);

  const vehicle = vehicles.find(v => v.id === vehicleId);
  const responsibleName = responsibleId === DEMO_PRIMARY_RESPONSIBLE_ID
    ? "أحمد أبو علي"
    : contractors.find(c => c.id === responsibleId)?.name ?? "غير معروف";

  return <div className={styles.page}>
    <header>
      <h1>كشف حساب نقد العربية</h1>
      <p className={styles.muted}>المستحق والمدفوع والمتبقي لكل عربية عند المقاول المسؤول عن دفعها. الرصيد السابق محسوب من جميع الحركات السابقة للفترة، وليس افتتاحيًا جديدًا.</p>
    </header>

    <section className={styles.filters} aria-label="فلاتر كشف نقد العربية">
      <label>المقاول المسؤول
        <select aria-label="مسؤول النقد في الكشف" value={responsibleId}
          onChange={e => setResponsibleId(e.target.value)}>
          <option value={DEMO_PRIMARY_RESPONSIBLE_ID}>أحمد أبو علي (الأساسي)</option>
          {contractors.map(c => <option key={c.id} value={c.id}>
            {c.name}{c.isArchived ? " — مؤرشف" : ""}
          </option>)}
        </select>
      </label>
      <label>العربية
        <select aria-label="عربية كشف النقد" value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}>
          {vehicles.map(v => <option key={v.id} value={v.id}>
            {v.plateNumber}{v.isArchived ? " — مؤرشفة" : ""}
          </option>)}
        </select>
      </label>
      <label>من تاريخ
        <input aria-label="من تاريخ كشف العربية" type="date" value={from}
          onChange={e => setFrom(e.target.value)} />
      </label>
      <label>إلى تاريخ
        <input aria-label="إلى تاريخ كشف العربية" type="date" value={to}
          onChange={e => setTo(e.target.value)} />
      </label>
    </section>

    <section className={styles.section} aria-label="تعريف الحساب النقدي">
      <h2>{vehicle?.plateNumber ?? "عربية غير معروفة"} — {responsibleName}</h2>
      <p className={styles.muted}>المقاول المسؤول هو صاحب التزام النقد لهذه العربية؛ أموال الشغل المتبادل بين المقاولين لا تدخل في هذا الكشف. السجلات المؤرشفة تظل ظاهرة تاريخيًا.</p>
    </section>

    {!result.ok ? <p className={styles.error} role="alert">{result.error}</p> : <>
      <section className={styles.summary} aria-label="ملخص كشف نقد العربية">
        <div><span>الرصيد السابق للفترة</span><strong>{egp(result.value.openingPiastres)}</strong></div>
        <div><span>مستحق شغل العربية خلال الفترة</span><strong>{egp(result.value.workPiastres)}</strong></div>
        <div><span>الدفعات خلال الفترة</span><strong>{egp(result.value.paidPiastres)}</strong></div>
        <div><span>المتبقي آخر الفترة</span><strong>{egp(result.value.closingPiastres)}</strong></div>
        <p>النقلات: {result.value.tripCount} — الدفعات السارية: {result.value.paymentCount}. الدفعة تُحسب بتاريخ دفعها الحقيقي؛ والملغاة تبقى في سجل الدفعات ولا تُخصم مرتين.</p>
      </section>

      <section className={styles.section} aria-label="تفاصيل كشف نقد العربية">
        <h2>حركات العربية من {from} إلى {to}</h2>
        {result.value.rows.length === 0 ?
          <p className={styles.muted} role="status">لا توجد حركات في الفترة المحددة. الرصيد السابق والختامي محفوظان في الملخص.</p> :
          <div className={styles.scroll} role="region" aria-label="تمرير جدول كشف العربية" tabIndex={0}>
            <table aria-label="جدول حركات كشف العربية">
              <thead><tr><th>تاريخ الحركة</th><th>النوع</th><th>البيان / الإيصال</th><th>القيمة</th><th>الرصيد بعد الحركة</th></tr></thead>
              <tbody>{result.value.rows.map(row =>
                <tr key={row.type + "|" + row.id}>
                  <td>{row.date}</td>
                  <td>{row.type === "WORK" ? "مستحق نقلة" : "دفعة نقدية"}</td>
                  <td>{row.label}</td>
                  <td>{egp(row.amountPiastres)}</td>
                  <td>{egp(row.balancePiastres)}</td>
                </tr>
              )}</tbody>
            </table>
          </div>}
      </section>
    </>}
    <p className={styles.muted}>دي معاينة ببيانات الجلسة التجريبية؛ لا حفظ دائم ولا ربط بقاعدة Supabase حتى مرحلة التكامل المتفق عليها.</p>
  </div>;
}
