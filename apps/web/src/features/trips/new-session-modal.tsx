import React, { useState } from "react";
import { useModalFocus } from "../../components/use-modal-focus";
import styles from "./trips.module.css";

interface NewSessionModalProps {
  isOpen: boolean;
  currentDate: string;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
}

export function NewSessionModal({
  isOpen,
  currentDate,
  onClose,
  onConfirm,
}: NewSessionModalProps) {
  const [sessionDate, setSessionDate] = useState(currentDate || new Date().toISOString().slice(0, 10));

  const dialogRef = useModalFocus(isOpen, onClose);
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionDate) return;
    onConfirm(sessionDate);
    onClose();
  };

  return (
    <div ref={dialogRef} className={styles.modalOverlay} aria-label="بدء يوم عمل جديد" role="dialog" aria-modal="true">
      <div className={styles.modalDialog}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            📅 بدء يوم عمل جديد
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
              بدء يوم جديد يقوم بتحديث تاريخ الجلسة وتهيئة المشترك لليوم الجديد دون إلغاء المسودة الحالية المفتوحة.
            </p>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                تاريخ يوم العمل الجديد <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className={styles.input}
                
              />
            </div>
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
              تأكيد بدء اليوم
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
