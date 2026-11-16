"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./trip-entry-design.module.css";
import {QuickOpeningFields,emptyOpening,parseQuickOpening,type QuickOpening} from "./quick-opening-fields";
import { useModalFocus } from "../../components/use-modal-focus";
import { validateQuickContractorName, validateQuickPlate } from "./quick-add-validation";

export type QuickRecordKind = "vehicle" | "contractor";
export type QuickRecordInput = { plate: string; driver: string; name: string; opening?:QuickOpening };

/**
 * Small creation dialog for one record from a choice field. Saving goes through
 * the caller's onCreate, which must use the official ledger write path only.
 * A synchronous ref guard blocks double submits in the same tick; Escape and
 * cancel cannot close while a write is in flight. After the server confirms the
 * save the dialog waits (pending) until the caller closes it, once the refreshed
 * lists contain the record; a refresh retry button is offered without re-creating.
 */
export function QuickRecordModal({ kind, open, busy, existing, onRefreshLists, onClose, onCreate, onCreated, contractors=[], onCreateOpening }: {
  kind: QuickRecordKind; open: boolean; busy: boolean; existing: readonly string[];
  onRefreshLists?: () => void;
  onClose: () => void;
  onCreate: (input: QuickRecordInput) => Promise<string | null>;
  onCreated: (id: string) => void;
  contractors?:{id:string;name:string}[];
  onCreateOpening?:(id:string,opening:QuickOpening)=>Promise<boolean>;
}): ReactNode | null {
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [name, setName] = useState("");
  const [opening,setOpening]=useState(emptyOpening);
  const [createdId,setCreatedId]=useState<string|null>(null);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const dialogRef = useModalFocus(open, () => { if (!inFlight.current) onClose(); });
  // A closed dialog resets fully, so reopening never inherits stale fields or state.
  useEffect(() => {
    if (open) return;
    setSavedId(null);setCreatedId(null);setOpening(emptyOpening());setError("");
    setPlate(""); setDriver(""); setName("");
  }, [open]);
  if (!open) return null;
  const locked = busy || inFlight.current;

  async function save(event: FormEvent) {
    event.preventDefault();
    // Guard on the live ref, not only the render-time closure: two submits
    // dispatched in the same React flush (e.g. double requestSubmit) both see
    // the closure's stale `locked`, but the second call still sees the ref set.
    if (locked || inFlight.current) return;
    const message = createdId?null:kind === "vehicle"
      ? validateQuickPlate(plate, existing)
      : validateQuickContractorName(name, existing);
    setError(message ?? "");
    if (message) return;
    let parsed:QuickOpening|undefined;
    try{parsed=parseQuickOpening(kind,opening);}catch(cause){setError(cause instanceof Error?cause.message:'راجع الرصيد القديم.');return;}
    if(parsed&&kind==='vehicle'&&(!onCreateOpening||!contractors.some(c=>c.id===parsed?.contractorId))){setError('اختر مقاولًا مسؤولًا متاحًا.');return;}
    inFlight.current = true;
    try {
      const id = createdId??await onCreate({ plate: plate.trim(), driver: driver.trim(), name: name.trim(),...(parsed?{opening:parsed}:{}) });
      if (id === null) {
        setError("لم تتم الإضافة. راجع رسالة النظام أعلى الصفحة.");
        return;
      }
      setCreatedId(id);
      if(kind==='vehicle'&&parsed&&!(await onCreateOpening!(id,parsed))){
        setError('تم إنشاء العربية وحسابها، لكن حفظ الرصيد القديم لم يتأكد. أعد المحاولة لاستكمال الرصيد فقط.');return;
      }
      setError(""); // A success must not keep a previous failure alert on screen.
      setSavedId(id);
      onCreated(id); // Caller keeps the dialog open until the refreshed lists select the record.
      setPlate(""); setDriver(""); setName("");
    } catch(cause){setError(cause instanceof Error?cause.message:'تعذر استكمال الإضافة. أعد المحاولة بنفس البيانات.');}
    finally {
      inFlight.current = false;
    }
  }

  return <div ref={dialogRef} className={styles.overlay}>
    <div className={styles.dialog} role="dialog" aria-modal="true"
      aria-label={kind === "vehicle" ? "إضافة عربية سريعة" : "إضافة مقاول سريع"}>
      <header className={styles.dialogHeading}><h3>{kind === "vehicle" ? "إضافة عربية جديدة" : "إضافة مقاول جديد"}</h3><p>أضف البيانات وكمّل تسجيل النقلة من نفس المكان.</p></header>
      {savedId !== null && <p role="status">تم الحفظ بنجاح. في انتظار تحديث القوائم…</p>}
      {savedId !== null && onRefreshLists &&
        <button className={styles.secondaryButton} type="button" onClick={onRefreshLists} disabled={busy}>تحديث القوائم</button>}
      {createdId!==null&&savedId===null&&<p role="status">العربية أُنشئت بالفعل. إعادة المحاولة تستكمل الرصيد، والإغلاق لا يلغي ما حُفظ.</p>}
      {error && <p role="alert">{error}</p>}
      {savedId === null && <form onSubmit={save} className={styles.dialogForm}>
        {kind === "vehicle" ? <>
          <label htmlFor="quick-plate">رقم اللوحة</label>
          <input id="quick-plate" className={styles.control} required value={plate}
            onChange={e => setPlate(e.target.value)} disabled={locked||createdId!==null} placeholder="مثال: د هـ و 5678" />
          <label htmlFor="quick-driver">اسم السائق (اختياري)</label>
          <input id="quick-driver" className={styles.control} value={driver}
            onChange={e => setDriver(e.target.value)} disabled={locked||createdId!==null} placeholder="مثال: محمود حسن" />
        </> : <>
          <label htmlFor="quick-name">اسم المقاول</label>
          <input id="quick-name" className={styles.control} required value={name}
            onChange={e => setName(e.target.value)} disabled={locked||createdId!==null} placeholder="مثال: مصنع النور" />
        </>}
        <QuickOpeningFields kind={kind} draft={opening} onChange={setOpening} disabled={locked||createdId!==null} contractors={contractors}/>
        <footer className={styles.dialogActions}>
          <button className={styles.primaryButton} type="submit" disabled={locked}>{createdId!==null?"استكمال الرصيد القديم":"حفظ وإضافة"}</button>
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={locked}>{createdId!==null?"إغلاق":"إلغاء"}</button>
        </footer>
      </form>}
    </div>
  </div>;
}
