"use client";
import React, { useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { parseOpeningEgp, validOpeningDate } from "./master-data-validation";
import styles from "./master-data.module.css";
import { DEMO_PRIMARY_RESPONSIBLE_ID } from "../payments/cash-ledger";
type Direction = "VEHICLE" | "CONTRACTOR" | "ZERO";

export function CashOpeningsPanel() {
  const { contractors, vehicles, cashOpenings, saveCashOpening } = useDemoStore();
  const [contractorId, setContractorId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState("2026-11-01");
  const [amount, setAmount] = useState("0.00");
  const [direction, setDirection] = useState<Direction>("ZERO");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const selectPair = (contractor: string, vehicle: string) => {
    setContractorId(contractor); setVehicleId(vehicle); setError(""); setSuccess(""); setReason("");
    const record = cashOpenings.find(x => x.contractorId === contractor && x.vehicleId === vehicle);
    setDate(record?.startDate ?? "2026-11-01");
    const signed = record ? BigInt(record.signedPiastres) : 0n;
    setDirection(signed > 0n ? "VEHICLE" : signed < 0n ? "CONTRACTOR" : "ZERO");
    const formatted = formatEgpFromPiastres((signed < 0n ? -signed : signed).toString());
    setAmount(formatted.ok ? formatted.amount : "0.00");
  };
  const exists = cashOpenings.some(x => x.contractorId === contractorId && x.vehicleId === vehicleId);
  return <div className={styles.cashPanel}>
    <p className={styles.muted}>افتتاحي النقد منفصل لكل (عربية + مقاول مسؤول)، وليس فرق شغل المقاول. التسجيل هنا مؤقت وولا يُضاف لفرق الشغل. يؤثر على حساب الدفعات التجريبي فقط، ويُرفض تغييره إن تسبب في عجز تاريخي. لا تحويل للتاريخ القديم قبل D04.</p>
    <form className={styles.editor} aria-label="افتتاحي نقد العربية" onSubmit={e => {
      e.preventDefault(); setError(""); setSuccess("");
      const signed = parseOpeningEgp(amount, direction);
      if (!contractorId || !vehicleId || !validOpeningDate(date) || signed === null || !reason.trim()) {
        setError("راجع المقاول والعربية والتاريخ والمبلغ وسبب التغيير."); return;
      }
      if (!saveCashOpening({ contractorId, vehicleId, startDate: date, signedPiastres: signed }, reason)) {
        setError("لا يمكن الحفظ؛ الحساب مؤرشف أو البيانات لم تتغير."); return;
      }
      setReason(""); setSuccess("حُفظ الافتتاحي في المعاينة فقط مع سجل التعديل.");
    }}>
      <h2>تسجيل / تعديل افتتاحي نقد العربية</h2>
      <div className={styles.formGrid}>
        <label>المقاول المسؤول
          <select aria-label="المقاول المسؤول" required value={contractorId} onChange={e => selectPair(e.target.value, vehicleId)}>
            <option value="">اختر المقاول</option>
            <option value={DEMO_PRIMARY_RESPONSIBLE_ID}>أحمد أبو علي (المقاول الأساسي)</option>
            {contractors.filter(c => !c.isArchived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>العربية
          <select aria-label="العربية للحساب النقدي" required value={vehicleId} onChange={e => selectPair(contractorId, e.target.value)}>
            <option value="">اختر العربية</option>
            {vehicles.filter(v => !v.isArchived).map(v => <option key={v.id} value={v.id}>{v.plateNumber}</option>)}
          </select>
        </label>
        <label>تاريخ بداية الحساب
          <input aria-label="تاريخ افتتاحي النقد" type="date" required value={date} onChange={e => setDate(e.target.value)} />
        </label>
        <label>اتجاه الافتتاحي
          <select aria-label="اتجاه الافتتاحي النقدي" value={direction} onChange={e => setDirection(e.target.value as Direction)}>
            <option value="ZERO">رصيد صفري</option>
            <option value="VEHICLE">لصالح العربية</option>
            <option value="CONTRACTOR">على العربية لصالح المقاول المسؤول</option>
          </select>
        </label>
        {direction !== "ZERO" && <label>مبلغ الافتتاحي بالجنيه
          <input aria-label="مبلغ افتتاحي النقد" required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
        </label>}
        <label>سبب تسجيل / تعديل الافتتاحي
          <input aria-label="سبب تعديل افتتاحي النقد" required value={reason} onChange={e => setReason(e.target.value)} />
        </label>
      </div>
      <p className={styles.muted}>{exists ? "الحساب له افتتاحي سابق؛ سيتم استبداله في المعاينة وتوثيق القديم والجديد." : "هذا الحساب ليس له افتتاحي سابق."}</p>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status" className={styles.notice}>{success}</p>}
      <button type="submit" className={styles.primary}>حفظ افتتاحي النقد التجريبي</button>
    </form>
    <h2>الافتتاحيات النقدية التجريبية ({cashOpenings.length})</h2>
    <div className={styles.grid}>{cashOpenings.map(x => {
      const c = contractors.find(y => y.id === x.contractorId);
      const v = vehicles.find(y => y.id === x.vehicleId);
      const amount = formatEgpFromPiastres(x.signedPiastres);
      const sign = BigInt(x.signedPiastres);
      return <article key={x.contractorId + "|" + x.vehicleId} className={styles.card}>
        <h3>{v?.plateNumber ?? x.vehicleId} / {x.contractorId === DEMO_PRIMARY_RESPONSIBLE_ID ? "أحمد أبو علي" : c?.name ?? x.contractorId}</h3>
        <p>تاريخ البداية: {x.startDate}</p>
        <p>افتتاحي النقد: {amount.ok ? amount.amount : "غير صالح"} ج.م — {sign > 0n ? "لصالح العربية" : sign < 0n ? "على العربية" : "متعادل"}</p>
        <button type="button" className={styles.secondary} disabled={c?.isArchived || v?.isArchived} onClick={() => selectPair(x.contractorId, x.vehicleId)}>تعديل هذا الافتتاحي</button>
      </article>;
    })}</div>
  </div>;
}
