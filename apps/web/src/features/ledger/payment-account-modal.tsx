"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useModalFocus } from "../../components/use-modal-focus";
import { validateQuickContractorName, validateQuickPlate } from "./quick-add-validation";

const field: React.CSSProperties = { display: "block", padding: 10, width: "100%", maxWidth: 460, margin: "6px 0 12px" };
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(15,23,42,.45)", zIndex: 40,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const dialog: React.CSSProperties = {
  background: "var(--surface-color,#fff)", color: "var(--text-color,#111)",
  border: "1px solid var(--border-color,#d0d7e2)", borderRadius: 12, padding: 16,
  width: "100%", maxWidth: 500, maxHeight: "90vh", overflow: "auto",
};

type Option = { id: string; label: string };
const FAIlURE = "لم يتم فتح الحساب. راجع رسالة النظام أعلى الصفحة.";

/**
 * Opens a (vehicle × contractor) cash account for the payment form: pick existing
 * records or create them inline, then ensure the account through the ledger write path.
 */
export function PaymentAccountModal({ open, busy, vehicles, contractors, activePlates,
  activeContractorNames, onClose, createVehicle, createContractor, ensureAccount, onAccountReady }: {
  open: boolean; busy: boolean;
  vehicles: readonly Option[]; contractors: readonly Option[];
  activePlates: readonly string[]; activeContractorNames: readonly string[];
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
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useModalFocus(open, onClose);
  if (!open) return null;
  const locked = busy || submitting;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    const plateError = newPlate.trim() ? validateQuickPlate(newPlate, activePlates) : null;
    if (plateError) { setError(plateError); return; }
    const nameError = newName.trim() ? validateQuickContractorName(newName, activeContractorNames) : null;
    if (nameError) { setError(nameError); return; }
    if (!newPlate.trim() && !existingVehicle) { setError("اختر عربية أو أدخل لوحة جديدة."); return; }
    if (!newName.trim() && !existingContractor) { setError("اختر مقاولًا أو أدخل اسمًا جديدًا."); return; }
    setError("");
    setSubmitting(true);
    try {
      const vehicleId = newPlate.trim()
        ? await createVehicle(newPlate.trim(), driver.trim())
        : existingVehicle;
      const contractorId = newName.trim()
        ? await createContractor(newName.trim())
        : existingContractor;
      if (!vehicleId || !contractorId) { setError(FAIlURE); return; }
      if (!(await ensureAccount(vehicleId, contractorId))) { setError(FAIlURE); return; }
      onAccountReady(vehicleId, contractorId);
      setExistingVehicle(""); setNewPlate(""); setDriver("");
      setExistingContractor(""); setNewName(""); setError("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return <div ref={dialogRef} style={overlay}>
    <div style={dialog} role="dialog" aria-modal="true" aria-label="فتح حساب عربية جديد">
      <h3>➕ فتح حساب عربية جديد</h3>
      <p>للدفعات النقدية: اختر العربية والمقاول المسؤول، أو أنشئهما هنا فورًا ثم يُفتح الحساب بينهما.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={save}>
        <label htmlFor="quick-account-vehicle">العربية الموجودة</label>
        <select id="quick-account-vehicle" style={field} value={existingVehicle}
          onChange={e => setExistingVehicle(e.target.value)} disabled={locked}>
          <option value="">اختر العربية</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <label htmlFor="quick-account-plate">لوحة عربية جديدة (اختياري)</label>
        <input id="quick-account-plate" style={field} value={newPlate}
          onChange={e => setNewPlate(e.target.value)} disabled={locked} placeholder="مثال: ج س ر 7777" />
        <label htmlFor="quick-account-driver">اسم السائق (اختياري، مع اللوحة الجديدة)</label>
        <input id="quick-account-driver" style={field} value={driver}
          onChange={e => setDriver(e.target.value)} disabled={locked} />
        <label htmlFor="quick-account-contractor">المقاول الموجود</label>
        <select id="quick-account-contractor" style={field} value={existingContractor}
          onChange={e => setExistingContractor(e.target.value)} disabled={locked}>
          <option value="">اختر المقاول</option>
          {contractors.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <label htmlFor="quick-account-name">اسم مقاول جديد (اختياري)</label>
        <input id="quick-account-name" style={field} value={newName}
          onChange={e => setNewName(e.target.value)} disabled={locked} placeholder="مثال: مصنع النور" />
        <button type="button" onClick={onClose} disabled={locked}>إلغاء</button>{" "}
        <button type="submit" disabled={locked}>فتح الحساب</button>
      </form>
    </div>
  </div>;
}
