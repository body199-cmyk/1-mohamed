"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./trip-entry-design.module.css";
import { useModalFocus } from "../../components/use-modal-focus";
import { validateQuickContractorName, validateQuickPlate } from "./quick-add-validation";

type Option = { id: string; label: string };

/**
 * Opens a (vehicle × contractor) cash account for the payment form: pick existing
 * records or create them inline, then ensure the account through the ledger write path.
 * Each creation step stores its confirmed id, so a retry resumes from the failed
 * step and never re-creates an already-created record. Closing here does not
 * undo confirmed creations. A synchronous ref guard blocks double submits, and
 * Escape cannot close while a write is in flight.
 */
export function PaymentAccountModal({ open, busy, vehicles, contractors, activePlates,
  activeContractorNames, onRefreshLists, onClose, createVehicle, createContractor,
  ensureAccount, onAccountReady }: {
  open: boolean; busy: boolean;
  vehicles: readonly Option[]; contractors: readonly Option[];
  activePlates: readonly string[]; activeContractorNames: readonly string[];
  onRefreshLists?: () => void;
  onClose: () => void;
  createVehicle: (plate: string, driver: string) => Promise<string | null>;
  createContractor: (name: string) => Promise<string | null>;
  ensureAccount: (vehicleId: string, contractorId: string) => Promise<boolean>;
  onAccountReady: (vehicleId: string, contractorId: string) => void;
}): ReactNode | null {
  const [existingVehicle, setExistingVehicle] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [existingContractor, setExistingContractor] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);
  const [createdContractorId, setCreatedContractorId] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const inFlight = useRef(false);
  const dialogRef = useModalFocus(open, () => { if (!inFlight.current) onClose(); });
  useEffect(() => {
    if (open) return;
    setExistingVehicle(""); setNewPlate(""); setDriver("");
    setExistingContractor(""); setNewName(""); setError("");
    setCreatedVehicleId(null); setCreatedContractorId(null); setOpened(false);
  }, [open]);
  if (!open) return null;
  const locked = busy || inFlight.current;
  const progress = createdVehicleId || createdContractorId
    ? "تم إنشاء: " + [
        createdVehicleId ? "العربية" : null,
        createdContractorId ? "المقاول" : null,
      ].filter(Boolean).join(" و") + ". أعد المحاولة لاستكمال الباقي."
    : "";

  async function save(event: FormEvent) {
    event.preventDefault();
    // Guard on the live ref, not only the render-time closure: two submits
    // dispatched in the same React flush (e.g. double requestSubmit) both see
    // the closure's stale `locked`, but the second call still sees the ref set.
    if (locked || inFlight.current) return;
    // When both an existing choice and a new value are filled, the new value
    // wins silently; after a partial failure the confirmed step's input is
    // locked in and edits to that side are ignored until the dialog resets.
    const plateError = newPlate.trim() && !createdVehicleId
      ? validateQuickPlate(newPlate, activePlates) : null;
    if (plateError) { setError(plateError); return; }
    const nameError = newName.trim() && !createdContractorId
      ? validateQuickContractorName(newName, activeContractorNames) : null;
    if (nameError) { setError(nameError); return; }
    if (!newPlate.trim() && !existingVehicle) { setError("اختر عربية أو أدخل لوحة جديدة."); return; }
    if (!newName.trim() && !existingContractor) { setError("اختر مقاولًا أو أدخل اسمًا جديدًا."); return; }
    setError("");
    inFlight.current = true;
    // Whether the vehicle step creates a new record in this pass (not pre-created
    // in a previous attempt), so a later failure reports progress accurately.
    const vehicleWasNew = createdVehicleId === null && Boolean(newPlate.trim());
    try {
      const vehicleId = createdVehicleId
        ?? (newPlate.trim() ? await createVehicle(newPlate.trim(), driver.trim()) : existingVehicle);
      if (createdVehicleId === null && vehicleId !== null) setCreatedVehicleId(vehicleId);
      if (!vehicleId) { setError("لم يتم فتح الحساب. راجع رسالة النظام أعلى الصفحة."); return; }
      const contractorId = createdContractorId
        ?? (newName.trim() ? await createContractor(newName.trim()) : existingContractor);
      if (createdContractorId === null && contractorId !== null) setCreatedContractorId(contractorId);
      if (!contractorId) {
        setError(vehicleWasNew
          ? "أُنشئت العربية. أعد المحاولة لاستكمال إنشاء المقاول وفتح الحساب."
          : "لم يتم فتح الحساب. راجع رسالة النظام أعلى الصفحة.");
        return;
      }
      // The ensure operation is idempotent; retrying it never duplicates the account.
      if (!(await ensureAccount(vehicleId, contractorId))) {
        setError("لم يتم فتح الحساب. راجع رسالة النظام أعلى الصفحة.");
        return;
      }
      setOpened(true);
      setError("");
      onAccountReady(vehicleId, contractorId); // Caller keeps the dialog open until the refreshed accounts contain the pair.
    } finally {
      inFlight.current = false;
    }
  }

  return <div ref={dialogRef} className={styles.overlay}>
    <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="فتح حساب عربية جديد">
      <header className={styles.dialogHeading}><h3>فتح حساب عربية جديد</h3>
      <p>للدفعات النقدية: اختر العربية والمقاول المسؤول، أو أنشئهما هنا فورًا ثم يُفتح الحساب بينهما.</p></header>
      {opened && <p role="status">تم فتح الحساب بنجاح. في انتظار تحديث القوائم…</p>}
      {opened && onRefreshLists &&
        <button className={styles.secondaryButton} type="button" onClick={onRefreshLists} disabled={busy}>تحديث القوائم</button>}
      {progress && !opened && <p role="status">{progress}</p>}
      {error && <p role="alert">{error}</p>}
      {!opened && <form className={styles.dialogForm} onSubmit={save}>
        <label htmlFor="quick-account-vehicle">العربية الموجودة</label>
        <select id="quick-account-vehicle" className={styles.control} value={existingVehicle}
          onChange={e => setExistingVehicle(e.target.value)} disabled={locked}>
          <option value="">اختر العربية</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <label htmlFor="quick-account-plate">لوحة عربية جديدة (اختياري)</label>
        <input id="quick-account-plate" className={styles.control} value={newPlate}
          onChange={e => setNewPlate(e.target.value)} disabled={locked} placeholder="مثال: ج س ر 7777" />
        <label htmlFor="quick-account-driver">اسم السائق (اختياري، مع اللوحة الجديدة)</label>
        <input id="quick-account-driver" className={styles.control} value={driver}
          onChange={e => setDriver(e.target.value)} disabled={locked} />
        <label htmlFor="quick-account-contractor">المقاول الموجود</label>
        <select id="quick-account-contractor" className={styles.control} value={existingContractor}
          onChange={e => setExistingContractor(e.target.value)} disabled={locked}>
          <option value="">اختر المقاول</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label htmlFor="quick-account-name">اسم مقاول جديد (اختياري)</label>
        <input id="quick-account-name" className={styles.control} value={newName}
          onChange={e => setNewName(e.target.value)} disabled={locked} placeholder="مثال: مصنع النور" />
        <footer className={styles.dialogActions}><button className={styles.primaryButton} type="submit" disabled={locked}>فتح الحساب</button><button className={styles.secondaryButton} type="button" onClick={onClose} disabled={locked}>إلغاء</button></footer>
      </form>}
    </div>
  </div>;
}
