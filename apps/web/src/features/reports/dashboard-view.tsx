"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { cairoBusinessDate } from "../payments/cash-ledger";
import { buildDashboardSummary } from "./dashboard-summary";
import styles from "./dashboard.module.css";

function egp(value: string): string {
  const result = formatEgpFromPiastres(value);
  return result.ok ? result.amount + " ج.م" : "قيمة غير صالحة";
}

export function DashboardView() {
  const { trips, payments, contractors, vehicles } = useDemoStore();
  const [today] = useState(cairoBusinessDate);
  const summary = useMemo(() => buildDashboardSummary(trips, payments, today),
    [trips, payments, today]);
  const recentTrips = useMemo(() => [...trips].sort((a,b) =>
    b.workDate.localeCompare(a.workDate) ||
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  ).slice(0, 5), [trips]);
  const recentPayments = useMemo(() => [...payments].sort((a,b) =>
    b.paymentDate.localeCompare(a.paymentDate) ||
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  ).slice(0, 5), [payments]);
  const plates = useMemo(() => new Map(vehicles.map(v => [v.id, v.plateNumber])), [vehicles]);
  const names = useMemo(() => new Map(contractors.map(c => [c.id, c.name])), [contractors]);

  return <div className={styles.page}>
    <header className={styles.head}>
      <div>
        <h1>الرئيسية — ملخص اليوم</h1>
        <p className={styles.muted}>تاريخ العمل: {today} بتوقيت القاهرة. المؤشرات للشغل المسجل بهذا التاريخ في المعاينة التجريبية، وليست إجمالي أرصدة المقاولين أو النقد.</p>
      </div>
      <Link className={styles.mainLink} href="/demo/trips">+ تسجيل نقلة جديدة</Link>
    </header>

    {!summary.ok ? <p className={styles.error} role="alert">{summary.error}</p> :
      <>
        <section className={styles.metrics} aria-label="المؤشرات اليومية">
          <article className={styles.metric}><h2>عدد نقلات اليوم</h2><strong>{summary.work.totals.tripCount}</strong></article>
          <article className={styles.metric}><h2>إجمالي الوزن اليوم</h2><strong>{summary.work.totals.totalWeightTonnes} طن</strong></article>
          <article className={styles.metric}><h2>إجمالي قيمة شغل اليوم للطرفين</h2><strong>{egp(summary.work.totals.contractorTotalPiastres)}</strong><p>قيمة حركة الشغل، وليست صافي فرق المقاولين.</p></article>
          <article className={styles.metric}><h2>مستحق العربيات عن شغل اليوم</h2><strong>{egp(summary.work.totals.vehicleTotalPiastres)}</strong><p>استحقاق ناتج عن النقلات، قبل خصم أي دفعات.</p></article>
          <article className={styles.metric}><h2>شغل أحمد للطرف الآخر</h2><strong>{summary.work.ahmedSupplies.tripCount} نقلة</strong></article>
          <article className={styles.metric}><h2>شغل المقاول الآخر لأحمد</h2><strong>{summary.work.otherSupplies.tripCount} نقلة</strong></article>
        </section>
        <section className={styles.cashSection} aria-label="دفعات نقد العربيات اليوم">
          <div>
            <h2>دفعات نقد العربيات بتاريخ اليوم</h2>
            <strong>{egp(summary.paidPiastres)}</strong>
            <p>{summary.paymentCount} دفعة سارية. هذا إجمالي مدفوعات مسجلة اليوم من حسابات نقدية منفصلة، وليس مبلغًا يُخصم من قيمة شغل المقاولين أو يُستخدم كرصيد عام.</p>
          </div>
          <Link href="/demo/payments" className={styles.textLink}>إدارة دفعات العربيات</Link>
        </section>
      </>
    }

    <nav className={styles.shortcuts} aria-label="اختصارات الرئيسية">
      <Link href="/demo/reports/daily">تقرير الشغل اليومي</Link>
      <Link href="/demo/reports/vehicle-cash">كشف حساب نقد العربية</Link>
      <Link href="/demo/contractors">كشف فرق شغل المقاول</Link>
      <Link href="/demo/master-data">المقاولون والعربيات</Link>
    </nav>

    <div className={styles.columns}>
      <section className={styles.panel} aria-label="آخر النقلات">
        <h2>آخر النقلات المسجلة ({Math.min(trips.length,5)})</h2>
        {recentTrips.length===0 ?
          <p className={styles.muted}>لم تُسجل نقلات حتى الآن.</p> :
          <ol>{recentTrips.map(trip => <li key={trip.id}>
            <strong>{trip.receiptNumber || trip.id}</strong>
            <span>{trip.workDate} — {plates.get(trip.vehicleId) ?? trip.vehicleId}</span>
            <span>{names.get(trip.counterpartyId) ?? trip.counterpartyId}</span>
            <small>{trip.direction === "AHMED_SUPPLIES" ? "أحمد جاب العربية" : "المقاول جاب العربية"}</small>
          </li>)}</ol>}
        <Link href="/demo/reports/daily" className={styles.textLink}>عرض تفاصيل اليوم</Link>
      </section>
      <section className={styles.panel} aria-label="آخر دفعات العربيات">
        <h2>آخر دفعات العربيات ({Math.min(payments.length,5)})</h2>
        {recentPayments.length===0 ?
          <p className={styles.muted}>لم تُسجل دفعات حتى الآن.</p> :
          <ol>{recentPayments.map(p => <li key={p.id}>
            <strong>{egp(p.amountPiastres)}{p.isCancelled ? " — ملغاة" : ""}</strong>
            <span>{p.paymentDate} — {plates.get(p.vehicleId) ?? p.vehicleId}</span>
            <span>{p.receiptNumber || p.id}</span>
          </li>)}</ol>}
        <Link href="/demo/payments" className={styles.textLink}>عرض دفعات العربيات</Link>
      </section>
    </div>
    <p className={styles.muted}>كل البيانات هنا تجريبية وتختفي عند إعادة تحميل الصفحة؛ لا حفظ إنتاجي أو اتصال Supabase/Vercel. لا تُجمع أرصدة عربيات أو مقاولين مختلفين في رقم واحد.</p>
  </div>;
}
