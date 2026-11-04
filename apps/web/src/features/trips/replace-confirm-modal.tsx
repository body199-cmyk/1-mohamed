import React from "react";
import { useModalFocus } from "../../components/use-modal-focus";
import styles from "./trips.module.css";

interface ReplaceConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ReplaceConfirmModal({
  isOpen,
  title = "تأكيد إلغاء المسودة الحالية",
  message = "توجد بيانات معدلة في مسودة النقلة الحالية لم يتم حفظها. هل تريد إلغاء التغييرات والبدء من جديد؟",
  onConfirm,
  onCancel,
}: ReplaceConfirmModalProps) {
  const dialogRef = useModalFocus(isOpen, onCancel);
  if (!isOpen) return null;

  return (
    <div ref={dialogRef} className={styles.modalOverlay} aria-label="تأكيد استبدال المسودة" role="dialog" aria-modal="true">
      <div className={styles.modalDialog}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle} style={{ color: "var(--color-warning)" }}>
            ⚠️ {title}
          </h3>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onCancel}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <p style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onCancel}
          >
            إلغاء والعودة للمسودة
          </button>
          <button
            type="button"
            className={styles.btnDangerOutline}
            onClick={onConfirm}
          >
            نعم، ابدأ نقلة جديدة
          </button>
        </div>
      </div>
    </div>
  );
}
