"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./trip-entry-design.module.css";
import { useModalFocus } from "../../components/use-modal-focus";
import { validateQuickContractorName, validateQuickPlate } from "./quick-add-validation";

export type QuickRecordKind = "vehicle" | "contractor";
export type QuickRecordInput = { plate: string; driver: string; name: string };

/**
 * Small creation dialog for one record from a choice field. Saving goes through
 * the caller's onCreate, which must use the official ledger write path only.
 * A synchronous ref guard blocks double submits in the same tick; Escape and
 * cancel cannot close while a write is in flight. After the server confirms the
 * save the dialog waits (pending) until the caller closes it, once the refreshed
 * lists contain the record; a refresh retry button is offered without re-creating.
 */
export function QuickRecordModal({ kind, open, busy, existing, onRefreshLists, onClose, onCreate, onCreated }: {
  kind: QuickRecordKind; open: boolean; busy: boolean; existing: readonly string[];
  onRefreshLists?: () => void;
  onClose: () => void;
  onCreate: (input: QuickRecordInput) => Promise<string | null>;
  onCreated: (id: string) => void;
}): ReactNode | null {
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const dialogRef = useModalFocus(open, () => { if (!inFlight.current) onClose(); });
  // A closed dialog resets fully, so reopening never inherits stale fields or state.
  useEffect(() => {
    if (open) return;
    setSavedId(null); setError("");
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
    const message = kind === "vehicle"
      ? validateQuickPlate(plate, existing)
      : validateQuickContractorName(name, existing);
    setError(message ?? "");
    if (message) return;
    inFlight.current = true;
    try {
      const id = await onCreate({ plate: plate.trim(), driver: driver.trim(), name: name.trim() });
      if (id === null) {
        setError("لم تتم الإضافة. راجع رسالة النظام أعلى الصفحة.");
        return;
      }
      setError(""); // A success must not keep a previous failure alert on screen.
      setSavedId(id);
      onCreated(id); // Caller keeps the dialog open until the refreshed lists select the record.
      setPlate(""); setDriver(""); setName("");
    } finally {
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
      {error && <p role="alert">{error}</p>}
      {savedId === null && <form onSubmit={save} className={styles.dialogForm}>
        {kind === "vehicle" ? <>
          <label htmlFor="quick-plate">رقم اللوحة</label>
          <input id="quick-plate" className={styles.control} required value={plate}
            onChange={e => setPlate(e.target.value)} disabled={locked} placeholder="مثال: د هـ و 5678" />
          <label htmlFor="quick-driver">اسم السائق (اختياري)</label>
          <input id="quick-driver" className={styles.control} value={driver}
            onChange={e => setDriver(e.target.value)} disabled={locked} placeholder="مثال: محمود حسن" />
        </> : <>
          <label htmlFor="quick-name">اسم المقاول</label>
          <input id="quick-name" className={styles.control} required value={name}
            onChange={e => setName(e.target.value)} disabled={locked} placeholder="مثال: مصنع النور" />
        </>}
        <footer className={styles.dialogActions}>
          <button className={styles.primaryButton} type="submit" disabled={locked}>حفظ وإضافة</button>
          <button className={styles.secondaryButton} type="button" onClick={onClose} disabled={locked}>إلغاء</button>
        </footer>
      </form>}
    </div>
  </div>;
}
