import React, { useState } from "react";
import type { TripDraft, EntryAction } from "@ledger/trip-entry";
import type { DemoContractor, DemoVehicle } from "../../demo/demo-types";
import { normalizeArabicNumbers } from "./arabic-number-normalizer";
import styles from "./trips.module.css";

interface TripFormFieldsProps {
  tripDraft: TripDraft;
  dispatch: (action: EntryAction) => void;
  contractors: readonly DemoContractor[];
  vehicles: readonly DemoVehicle[];
  onOpenQuickAddContractor: () => void;
  onOpenQuickAddVehicle: () => void;
}

export function TripFormFields({
  tripDraft,
  dispatch,
  contractors,
  vehicles,
  onOpenQuickAddContractor,
  onOpenQuickAddVehicle,
}: TripFormFieldsProps) {
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [contractorSearch, setContractorSearch] = useState("");
  return (
    <div className={styles.formGrid}>
      {/* Work Date */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          تاريخ النقلة <span className={styles.required}>*</span>
        </label>
        <input
          type="date"
          required
          aria-label="تاريخ النقلة" value={tripDraft.workDate}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "workDate",
              value: e.target.value,
            })
          }
          className={styles.input}
        />
      </div>

      {/* Counterparty */}
      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label}>
            المقاول الطرف الآخر <span className={styles.required}>*</span>
          </label>
          <button
            type="button"
            className={styles.quickActionBtn}
            onClick={onOpenQuickAddContractor}
          >
            + مقاول جديد
          </button>
        </div>
        <input type="search" aria-label="بحث عن مقاول" placeholder="ابحث باسم المقاول" className={styles.input} value={contractorSearch} onChange={e => setContractorSearch(e.target.value)} />
        <select aria-label="المقاول الطرف الآخر" value={tripDraft.counterpartyId ?? ""}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_COUNTERPARTY",
              counterpartyId: e.target.value ? e.target.value : null,
            })
          }
          className={styles.select}
        >
          <option value="">-- اختر المقاول --</option>
          {contractors.filter(c => (c.id === tripDraft.counterpartyId || !c.isArchived) && (c.id === tripDraft.counterpartyId || c.name.includes(contractorSearch.trim()))).map((c) => (
            <option key={c.id} value={c.id} disabled={c.isArchived}>
              {c.name} ({c.id}){c.isArchived ? " — مؤرشف" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Direction Options */}
      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
        <label className={styles.label}>
          اتجاه الشغل والمسؤولية المالية <span className={styles.required}>*</span>
        </label>
        <div className={styles.directionGrid}>
          <div
            className={`${styles.directionOption} ${
              tripDraft.direction === "AHMED_SUPPLIES"
                ? styles.directionOptionActive
                : ""
            }`}
            onClick={() =>
              dispatch({
                type: "EDIT_TRIP_DIRECTION",
                direction: "AHMED_SUPPLIES",
              })
            }
          >
            <div className={styles.directionTitle}>
              <input
                type="radio"
                name="trip-direction"
                aria-label="أحمد جاب العربيات" checked={tripDraft.direction === "AHMED_SUPPLIES"}
                onChange={() =>
                  dispatch({
                    type: "EDIT_TRIP_DIRECTION",
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
              tripDraft.direction === "OTHER_SUPPLIES"
                ? styles.directionOptionActive
                : ""
            }`}
            onClick={() =>
              dispatch({
                type: "EDIT_TRIP_DIRECTION",
                direction: "OTHER_SUPPLIES",
              })
            }
          >
            <div className={styles.directionTitle}>
              <input
                type="radio"
                name="trip-direction"
                aria-label="المقاول جاب العربيات" checked={tripDraft.direction === "OTHER_SUPPLIES"}
                onChange={() =>
                  dispatch({
                    type: "EDIT_TRIP_DIRECTION",
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

      {/* Vehicle */}
      <div className={styles.formGroup}>
        <div className={styles.labelRow}>
          <label className={styles.label}>
            السيارة المنفذة <span className={styles.required}>*</span>
          </label>
          <button
            type="button"
            className={styles.quickActionBtn}
            onClick={onOpenQuickAddVehicle}
          >
            + سيارة جديدة
          </button>
        </div>
        <input type="search" aria-label="بحث عن عربية" placeholder="ابحث برقم العربية أو السائق" className={styles.input} value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} />
        <select aria-label="السيارة المنفذة" value={tripDraft.vehicleId ?? ""}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_VEHICLE",
              vehicleId: e.target.value ? e.target.value : null,
            })
          }
          className={styles.select}
        >
          <option value="">-- اختر السيارة --</option>
          {vehicles.filter(v => (v.id === tripDraft.vehicleId || !v.isArchived) && (v.id === tripDraft.vehicleId || `${v.plateNumber} ${v.driverName}`.includes(vehicleSearch.trim()))).map((v) => (
            <option key={v.id} value={v.id} disabled={v.isArchived}>
              {v.plateNumber} ({v.driverName}){v.isArchived ? " — مؤرشفة" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Weight */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          الوزن بالطن (بحد أقصى 3 أرقام عشرية) <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="مثال: 25.450"
          aria-label="الوزن بالطن" value={tripDraft.weightTonnes}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "weightTonnes",
              value: normalizeArabicNumbers(e.target.value),
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
            checked={tripDraft.sameRate}
            onChange={(e) =>
              dispatch({
                type: "SET_TRIP_SAME_RATE",
                sameRate: e.target.checked,
              })
            }
            className={styles.checkbox}
          />
          <span className={styles.label}>
            ربط سعر السيارة بسعر المقاول تلقائياً (تحديث متزامن)
          </span>
        </label>
      </div>

      {/* Rates */}
      <div className={styles.formGroup}>
        <label className={styles.label}>
          سعر المقاول للطن (ج.م) <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="مثال: 120.00"
          aria-label="سعر المقاول للطن" value={tripDraft.contractorRateEgp}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_CONTRACTOR_RATE",
              value: normalizeArabicNumbers(e.target.value),
            })
          }
          className={styles.input}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          سعر السيارة للطن (ج.م) <span className={styles.required}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="مثال: 110.00"
          aria-label="سعر السيارة للطن" value={tripDraft.vehicleRateEgp}
          disabled={tripDraft.sameRate}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_VEHICLE_RATE",
              value: normalizeArabicNumbers(e.target.value),
            })
          }
          className={styles.input}
        />
      </div>

      {/* Locations */}
      <div className={styles.formGroup}>
        <label className={styles.label}>مكان التحميل</label>
        <input
          type="text"
          placeholder="مثال: محجر السويس"
          aria-label="مكان التحميل" value={tripDraft.origin}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "origin",
              value: e.target.value,
            })
          }
          className={styles.input}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>مكان التعتيق</label>
        <input
          type="text"
          placeholder="مثال: العاصمة الإدارية"
          aria-label="مكان التعتيق" value={tripDraft.destination}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "destination",
              value: e.target.value,
            })
          }
          className={styles.input}
        />
      </div>

      {/* Expense & Receipt */}
      <div className={styles.formGroup}>
        <label className={styles.label}>مصاريف النقلة (كارتات وخلافه) (ج.م)</label>
        <input
          type="text"
          placeholder="0.00"
          aria-label="مصاريف النقلة" value={tripDraft.expenseEgp}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "expenseEgp",
              value: normalizeArabicNumbers(e.target.value),
            })
          }
          className={styles.input}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>رقم البون أو الإيصال</label>
        <input
          type="text"
          placeholder="مثال: REC-908"
          aria-label="رقم الإيصال" value={tripDraft.receiptNumber}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "receiptNumber",
              value: e.target.value,
            })
          }
          className={styles.input}
        />
      </div>

      {/* Notes */}
      <div className={`${styles.formGroup} ${styles.fullWidth}`}>
        <label className={styles.label}>ملاحظات النقلة</label>
        <textarea
          rows={2}
          placeholder="أية ملاحظات خاصة بالنقلة أو السائق أو الموقع..."
          aria-label="ملاحظات النقلة" value={tripDraft.notes}
          onChange={(e) =>
            dispatch({
              type: "EDIT_TRIP_TEXT",
              field: "notes",
              value: e.target.value,
            })
          }
          className={styles.textarea}
        />
      </div>
    </div>
  );
}
