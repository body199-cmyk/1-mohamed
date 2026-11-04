import React, { useState } from "react";
import type {
  EntryState,
  EntryAction,
  WorkDirection,
} from "@ledger/trip-entry";
import type { DemoContractor } from "../../demo/demo-types";
import { normalizeArabicNumbers } from "./arabic-number-normalizer";
import styles from "./trips.module.css";

interface SharedDataPanelProps {
  state: EntryState;
  dispatch: (action: EntryAction) => void;
  contractors: readonly DemoContractor[];
  onOpenNewSession: () => void;
  onOpenQuickAddContractor: () => void;
}

export function SharedDataPanel({
  state,
  dispatch,
  contractors,
  onOpenNewSession,
  onOpenQuickAddContractor,
}: SharedDataPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isApplied = state.appliedShared !== null;
  const draft = state.sharedDraft;

  return (
    <div className={styles.card} style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 className={styles.cardTitle} style={{ fontSize: "1.1rem" }}>
            ⚙️ البيانات المشتركة (تثبيت للعمل المتكرر)
          </h3>
          {isApplied ? (
            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
              ✓ المشترك معتمد ومطبق
            </span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeWarning}`}>
              غير مفعّل
            </span>
          )}
        </div>

        <button
          type="button"
          className={styles.btnOutline}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          aria-expanded={isOpen}
        >
          {isOpen ? "طي الإعدادات ▲" : "تعديل المشترك ▼"}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--border-color)" }}>
          <div className={styles.formGrid}>
            {/* Work Date */}
            <div className={styles.formGroup}>
              <label className={styles.label}>تاريخ العمل المشترك</label>
              <input
                type="date"
                aria-label="تاريخ العمل المشترك" value={draft.workDate}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_TEXT",
                    field: "workDate",
                    value: e.target.value,
                  })
                }
                className={styles.input}
              />
            </div>

            {/* Contractor */}
            <div className={styles.formGroup}>
              <div className={styles.labelRow}>
                <label className={styles.label}>المقاول المشترك</label>
                <button
                  type="button"
                  className={styles.quickActionBtn}
                  onClick={onOpenQuickAddContractor}
                >
                  + مقاول جديد
                </button>
              </div>
              <select
                aria-label="المقاول المشترك" value={draft.counterpartyId ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_COUNTERPARTY",
                    counterpartyId: e.target.value ? e.target.value : null,
                  })
                }
                className={styles.select}
              >
                <option value="">-- بدون مقاول مشترك --</option>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Direction */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>اتجاه الشغل المشترك</label>
              <div className={styles.directionGrid}>
                <div
                  className={`${styles.directionOption} ${
                    draft.direction === "AHMED_SUPPLIES"
                      ? styles.directionOptionActive
                      : ""
                  }`}
                  onClick={() =>
                    dispatch({
                      type: "EDIT_SHARED_DIRECTION",
                      direction: "AHMED_SUPPLIES",
                    })
                  }
                >
                  <div className={styles.directionTitle}>
                    <input
                      type="radio"
                      name="shared-direction"
                      aria-label="أحمد جاب العربيات" checked={draft.direction === "AHMED_SUPPLIES"}
                      onChange={() =>
                        dispatch({
                          type: "EDIT_SHARED_DIRECTION",
                          direction: "AHMED_SUPPLIES",
                        })
                      }
                    />
                    <span>شغل أحمد (المقاول مدين لأحمد)</span>
                  </div>
                  <div className={styles.directionDesc}>
                    عربيات أحمد أو طرفه تورّد للمقاول المسؤول
                  </div>
                </div>

                <div
                  className={`${styles.directionOption} ${
                    draft.direction === "OTHER_SUPPLIES"
                      ? styles.directionOptionActive
                      : ""
                  }`}
                  onClick={() =>
                    dispatch({
                      type: "EDIT_SHARED_DIRECTION",
                      direction: "OTHER_SUPPLIES",
                    })
                  }
                >
                  <div className={styles.directionTitle}>
                    <input
                      type="radio"
                      name="shared-direction"
                      aria-label="المقاول جاب العربيات" checked={draft.direction === "OTHER_SUPPLIES"}
                      onChange={() =>
                        dispatch({
                          type: "EDIT_SHARED_DIRECTION",
                          direction: "OTHER_SUPPLIES",
                        })
                      }
                    />
                    <span>شغل المقاول (أحمد مدين للمقاول)</span>
                  </div>
                  <div className={styles.directionDesc}>
                    عربيات المقاول تورّد لشغل أحمد
                  </div>
                </div>
              </div>
            </div>

            {/* Origin & Destination */}
            <div className={styles.formGroup}>
              <label className={styles.label}>مكان التحميل المشترك</label>
              <input
                type="text"
                placeholder="مثال: محجر السويس"
                aria-label="مكان التحميل المشترك" value={draft.origin}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_TEXT",
                    field: "origin",
                    value: e.target.value,
                  })
                }
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>مكان التعتيق المشترك</label>
              <input
                type="text"
                placeholder="مثال: العاصمة الإدارية"
                aria-label="مكان التعتيق المشترك" value={draft.destination}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_TEXT",
                    field: "destination",
                    value: e.target.value,
                  })
                }
                className={styles.input}
              />
            </div>

            {/* Same Rate Checkbox */}
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.checkboxContainer}>
                <input
                  type="checkbox"
                  checked={draft.sameRate}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_SHARED_SAME_RATE",
                      sameRate: e.target.checked,
                    })
                  }
                  className={styles.checkbox}
                />
                <span className={styles.label}>
                  ربط سعر السيارة بسعر المقاول تلقائياً في المشترك
                </span>
              </label>
            </div>

            {/* Rates */}
            <div className={styles.formGroup}>
              <label className={styles.label}>سعر المقاول للطن (ج.م)</label>
              <input
                type="text"
                placeholder="0.00"
                aria-label="سعر المقاول المشترك" value={draft.contractorRateEgp}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_CONTRACTOR_RATE",
                    value: normalizeArabicNumbers(e.target.value),
                  })
                }
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>سعر السيارة للطن (ج.م)</label>
              <input
                type="text"
                placeholder="0.00"
                aria-label="سعر العربية المشترك" value={draft.vehicleRateEgp}
                disabled={draft.sameRate}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_VEHICLE_RATE",
                    value: normalizeArabicNumbers(e.target.value),
                  })
                }
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>مصاريف النقلة المشتركة (كارتات وخلافه) (ج.م)</label>
              <input
                type="text"
                placeholder="0.00"
                aria-label="مصاريف النقلة المشتركة" value={draft.expenseEgp}
                onChange={(e) =>
                  dispatch({
                    type: "EDIT_SHARED_TEXT",
                    field: "expenseEgp",
                    value: normalizeArabicNumbers(e.target.value),
                  })
                }
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.btnGroup} style={{ marginTop: "16px" }}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => dispatch({ type: "APPLY_SHARED" })}
            >
              ✓ اعتماد المشترك للنقلات التالية
            </button>

            {isApplied && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => dispatch({ type: "DISABLE_SHARED" })}
              >
                إلغاء تفعيل المشترك
              </button>
            )}

            <button
              type="button"
              className={styles.btnOutline}
              onClick={onOpenNewSession}
            >
              📅 بدء يوم عمل جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
