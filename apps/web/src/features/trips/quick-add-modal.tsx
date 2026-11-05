import React, { useState } from "react";
import { calculateTripAmounts } from "@ledger/accounting";
import { buildContractorStatement } from "@ledger/contractor-statements";
import { normalizeArabicNumbers } from "./arabic-number-normalizer";
import { useModalFocus } from "../../components/use-modal-focus";
import styles from "./trips.module.css";

/** Compare plates/names without whitespace or Arabic-digit formatting bypasses. */
function normalizeUniqueName(value: string): string {
  return normalizeArabicNumbers(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ar");
}

interface QuickAddModalProps {
  type: "vehicle" | "contractor";
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (plate: string, driver: string) => void;
  onAddContractor: (name: string, openingDate: string, openingBalancePiastres: string) => void;
  existingContractorNames?: readonly string[];
  existingVehiclePlates?: readonly string[];
}

export function QuickAddModal({
  type,
  isOpen,
  onClose,
  onAddVehicle,
  onAddContractor,
  existingContractorNames = [],
  existingVehiclePlates = [],
}: QuickAddModalProps) {
  // Vehicle fields
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");

  // Contractor fields
  const [contractorName, setContractorName] = useState("");
  const [openingDate, setOpeningDate] = useState("2026-11-01");
  const [openingBalanceEgp, setOpeningBalanceEgp] = useState("0.00");
  const [balanceDirection, setBalanceDirection] = useState<"AHMED" | "CONTRACTOR" | "ZERO">("ZERO");

  const [error, setError] = useState<string | null>(null);

  const dialogRef = useModalFocus(isOpen, onClose);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (type === "vehicle") {
      if (!plate.trim()) return;
      if (existingVehiclePlates.some((value) =>
        normalizeUniqueName(value) === normalizeUniqueName(plate)
      )) {
        setError("رقم اللوحة موجود بالفعل. اختر العربية من القائمة بدل إضافتها مرتين.");
        return;
      }
      onAddVehicle(plate.trim(), driver.trim());
      setPlate("");
      setDriver("");
      onClose();
    } else {
      if (!contractorName.trim()) return;
      if (existingContractorNames.some((value) =>
        normalizeUniqueName(value) === normalizeUniqueName(contractorName)
      )) {
        setError("اسم المقاول موجود بالفعل. اختر المقاول من القائمة بدل إضافته مرتين.");
        return;
      }

      const amount = calculateTripAmounts({ weightTonnes: "0", contractorRateEgp: "0", vehicleRateEgp: "0", expenseEgp: balanceDirection === "ZERO" ? "0" : normalizeArabicNumbers(openingBalanceEgp) });
      if (!amount.ok) { setError("أدخل مبلغًا صحيحًا بالجنيه، بحد أقصى رقمين للقروش ومن غير فواصل آلاف."); return; }
      const signedPiastres = balanceDirection === "CONTRACTOR" && amount.contractorTotalPiastres !== "0"
        ? "-" + amount.contractorTotalPiastres : amount.contractorTotalPiastres;
      const checked = buildContractorStatement({ counterpartyId: "opening", opening: { startDate: openingDate, signedPiastres }, period: { from: openingDate, to: openingDate }, movements: [] });
      if (!checked.ok) { setError("راجع تاريخ بداية الحساب."); return; }
      onAddContractor(contractorName.trim(), openingDate, signedPiastres);
      setContractorName("");
      setOpeningBalanceEgp("0.00");
      setBalanceDirection("ZERO");
      onClose();
    }
  };

  return (
    <div ref={dialogRef} className={styles.modalOverlay} aria-label="إضافة سجل جديد" role="dialog" aria-modal="true">
      <div className={styles.modalDialog}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {type === "vehicle" ? "➕ إضافة سيارة سريعة" : "➕ إضافة مقاول سريع"}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <p role="alert">{error}</p>}
            {type === "vehicle" ? (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    رقم اللوحة <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: د هـ و 5678"
                    aria-label="رقم اللوحة" value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className={styles.input}
                    
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>اسم السائق</label>
                  <input
                    type="text"
                    placeholder="مثال: محمود حسن"
                    aria-label="اسم السائق" value={driver}
                    onChange={(e) => setDriver(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    اسم المقاول <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مقاولات الأمل"
                    aria-label="اسم المقاول" value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    className={styles.input}
                    
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    تاريخ بداية الحساب <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="date"
                    required
                    aria-label="تاريخ بداية الحساب" value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>حالة الرصيد الافتتاحي</label>
                  <select
                    aria-label="حالة الرصيد الافتتاحي" value={balanceDirection}
                    onChange={(e) => setBalanceDirection(e.target.value as "AHMED" | "CONTRACTOR" | "ZERO")}
                    className={styles.select}
                  >
                    <option value="ZERO">رصيد صفري (متعادل)</option>
                    <option value="AHMED">لصالح أحمد (أحمد يطلب المقاول)</option>
                    <option value="CONTRACTOR">لصالح المقاول (المقاول يطلب أحمد)</option>
                  </select>
                </div>
                {balanceDirection !== "ZERO" && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>
                      مبلغ الرصيد الافتتاحي (ج.م) <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 500.00"
                      aria-label="مبلغ الرصيد الافتتاحي" value={openingBalanceEgp}
                      onChange={(e) => setOpeningBalanceEgp(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              إلغاء
            </button>
            <button type="submit" className={styles.btnPrimary}>
              حفظ وإضافة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
