"use client";
import React, { useState } from "react";
import styles from "./master-data.module.css";

export type MasterAction = "edit" | "archive" | "reactivate";
interface Props {
  kind: "contractor" | "vehicle";
  action: MasterAction;
  name: string;
  driver?: string;
  onCancel: () => void;
  onSave: (name: string, driver: string, reason: string) => boolean;
}
export function MasterRecordEditor({ kind, action, name, driver = "", onCancel, onSave }: Props) {
  const [value, setValue] = useState(name);
  const [driverValue, setDriverValue] = useState(driver);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const verb = action === "edit" ? "تعديل" : action === "archive" ? "أرشفة" : "إعادة تفعيل";
  const noun = kind === "contractor" ? "المقاول" : "العربية";
  return <form className={styles.editor} aria-label={verb + " " + noun} onSubmit={e => {
    e.preventDefault(); setError("");
    if (!reason.trim()) { setError("سبب التغيير مطلوب."); return; }
    if (action === "edit" && !value.trim()) { setError("الاسم أو رقم اللوحة مطلوب."); return; }
    if (!onSave(value, driverValue, reason)) setError("التغيير غير صالح أو مكرر أو لم تتغير البيانات.");
  }}>
    <strong>{verb} {noun}</strong>
    {action === "archive" && <p className={styles.muted}>الأرشفة تمنع الاختيار في النقلات الجديدة ولا تحذف التاريخ.</p>}
    {action === "edit" && <>
      <label>{kind === "contractor" ? "اسم المقاول" : "رقم اللوحة"}
        <input aria-label={kind === "contractor" ? "اسم المقاول الجديد" : "رقم اللوحة الجديد"}
          required value={value} onChange={e => setValue(e.target.value)} />
      </label>
      {kind === "vehicle" && <label>اسم السائق
        <input aria-label="اسم السائق الجديد" value={driverValue} onChange={e => setDriverValue(e.target.value)} />
      </label>}
      {kind === "contractor" && <p className={styles.muted}>الافتتاحي القديم وتاريخه غير قابلين للتحرير هنا حتى حسم D04.</p>}
    </>}
    <label>سبب التغيير
      <input aria-label="سبب التغيير" required value={reason} onChange={e => setReason(e.target.value)} />
    </label>
    {error && <p role="alert">{error}</p>}
    <div className={styles.actions}>
      <button type="submit" className={styles.primary}>تأكيد {verb}</button>
      <button type="button" className={styles.secondary} onClick={onCancel}>إلغاء</button>
    </div>
  </form>;
}
