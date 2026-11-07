import React, { useEffect, useRef, useState } from "react";
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
  const [recentContractors, setRecentContractors] = useState<string[]>([]);
  const [recentVehicles, setRecentVehicles] = useState<string[]>([]);
  const [contractorSheetOpen, setContractorSheetOpen] = useState(false);
  const [vehicleSheetOpen, setVehicleSheetOpen] = useState(false);
  const contractorDialogRef = useRef<HTMLDialogElement>(null);
  const vehicleDialogRef = useRef<HTMLDialogElement>(null);
  const remember = (ids: string[], id: string) => [id, ...ids.filter(item => item !== id)].slice(0, 3);
  const selectedContractor = contractors.find(item => item.id === tripDraft.counterpartyId);
  const selectedVehicle = vehicles.find(item => item.id === tripDraft.vehicleId);
  const contractorQuery = contractorSearch.trim().toLocaleLowerCase("ar");
  const vehicleQuery = vehicleSearch.trim().toLocaleLowerCase("ar");
  const filteredContractors = contractors.filter(item =>
    (item.id === tripDraft.counterpartyId || !item.isArchived) &&
    (item.id === tripDraft.counterpartyId || (item.name + " " + item.id).toLocaleLowerCase("ar").includes(contractorQuery))
  );
  const filteredVehicles = vehicles.filter(item =>
    (item.id === tripDraft.vehicleId || !item.isArchived) &&
    (item.id === tripDraft.vehicleId || (item.plateNumber + " " + item.driverName + " " + item.id).toLocaleLowerCase("ar").includes(vehicleQuery))
  );
  useEffect(() => {
    const dialog = contractorDialogRef.current;
    if (!dialog) return;
    if (contractorSheetOpen && !dialog.open) dialog.showModal();
    else if (!contractorSheetOpen && dialog.open) dialog.close();
  }, [contractorSheetOpen]);
  useEffect(() => {
    const dialog = vehicleDialogRef.current;
    if (!dialog) return;
    if (vehicleSheetOpen && !dialog.open) dialog.showModal();
    else if (!vehicleSheetOpen && dialog.open) dialog.close();
  }, [vehicleSheetOpen]);
  return (
    <div className={styles.formGrid}>
      <details className={styles.formSection} open><summary>١. بيانات النقلة والمقاول واتجاه الشغل</summary><div className={styles.formGrid}>
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
        <div className={styles.desktopChoiceControls}>
          <input type="search" aria-label="بحث عن مقاول" placeholder="ابحث باسم المقاول" className={styles.input} value={contractorSearch} onChange={e => setContractorSearch(e.target.value)} />
          {recentContractors.length > 0 && <div className={styles.recentChoices} aria-label="المقاولون المستخدمون مؤخرًا">{recentContractors.map(id => { const item = contractors.find(entry => entry.id === id && !entry.isArchived); return item ? <button type="button" className={styles.quickActionBtn} key={id} onClick={() => dispatch({ type: "EDIT_TRIP_COUNTERPARTY", counterpartyId: id })}>{item.name}</button> : null; })}</div>}
          <select aria-label="المقاول الطرف الآخر" value={tripDraft.counterpartyId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              dispatch({ type: "EDIT_TRIP_COUNTERPARTY", counterpartyId: id || null });
              if (id) setRecentContractors(previous => remember(previous, id));
            }}
            className={styles.select}
          >
            <option value="">-- اختر المقاول --</option>
            {filteredContractors.map(item => (
              <option key={item.id} value={item.id} disabled={item.isArchived}>
                {item.name} ({item.id}){item.isArchived ? " — مؤرشف" : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={styles.mobileChoiceTrigger}
          aria-label="اختيار المقاول الطرف الآخر" aria-haspopup="dialog" aria-expanded={contractorSheetOpen}
          onClick={() => setContractorSheetOpen(true)}>
          {selectedContractor ? selectedContractor.name + " (" + selectedContractor.id + ")" : "اختر المقاول"}
        </button>
        <dialog ref={contractorDialogRef} className={styles.choiceDialog}
          aria-labelledby="contractor-choice-title"
          onClose={() => setContractorSheetOpen(false)}
          onClick={event => { if (event.target === event.currentTarget) setContractorSheetOpen(false); }}>
          <div className={styles.choiceSheetHeader}>
            <h3 id="contractor-choice-title">اختيار المقاول الطرف الآخر</h3>
            <button type="button" aria-label="إغلاق اختيار المقاول" onClick={() => setContractorSheetOpen(false)}>إغلاق</button>
          </div>
          <input type="search" aria-label="بحث عن مقاول داخل القائمة" autoFocus className={styles.input}
            placeholder="ابحث باسم المقاول أو الكود" value={contractorSearch} onChange={event => setContractorSearch(event.target.value)} />
          {recentContractors.length > 0 && <div className={styles.sheetRecent} aria-label="المقاولون المستخدمون مؤخرًا">
            <strong>المستخدمون مؤخرًا</strong>
            <div>{recentContractors.map(id => { const item = contractors.find(entry => entry.id === id && !entry.isArchived); return item ? <button type="button" key={id} onClick={() => { dispatch({ type: "EDIT_TRIP_COUNTERPARTY", counterpartyId: id }); setRecentContractors(previous => remember(previous, id)); setContractorSheetOpen(false); }}>{item.name}</button> : null; })}</div>
          </div>}
          <div className={styles.choiceList} aria-label="كل المقاولين">
            {filteredContractors.map(item => <button type="button" key={item.id} disabled={item.isArchived}
              aria-pressed={tripDraft.counterpartyId === item.id}
              onClick={() => { dispatch({ type: "EDIT_TRIP_COUNTERPARTY", counterpartyId: item.id }); setRecentContractors(previous => remember(previous, item.id)); setContractorSheetOpen(false); }}>
              <span>{item.name}</span><small>{item.id}{item.isArchived ? " — مؤرشف" : ""}</small>
            </button>)}
            {filteredContractors.length === 0 && <p>لا توجد نتائج مطابقة.</p>}
          </div>
        </dialog>
      </div>

      {/* Native radios inside labels; full card click and keyboard support. */}
      <div className={[styles.formGroup, styles.fullWidth].join(" ")}>
        <p className={styles.label}>اتجاه الشغل والمسؤولية المالية <span className={styles.required}>*</span></p>
        <div className={styles.directionGrid} role="radiogroup" aria-label="اتجاه الشغل والمسؤولية المالية">
          <label className={[styles.directionOption, tripDraft.direction === "AHMED_SUPPLIES" ? styles.directionOptionActive : ""].join(" ")}>
            <span className={styles.directionTitle}>
              <input type="radio" name="trip-direction" aria-label="أحمد جاب العربيات"
                checked={tripDraft.direction === "AHMED_SUPPLIES"}
                onChange={() => dispatch({ type: "EDIT_TRIP_DIRECTION", direction: "AHMED_SUPPLIES" })} />
              <span>شغل أحمد (المقاول مدين لأحمد)</span>
            </span>
            <span className={styles.directionDesc}>عربيات أحمد أو طرفه تورّد للمقاول المسؤول</span>
          </label>
          <label className={[styles.directionOption, tripDraft.direction === "OTHER_SUPPLIES" ? styles.directionOptionActive : ""].join(" ")}>
            <span className={styles.directionTitle}>
              <input type="radio" name="trip-direction" aria-label="المقاول جاب العربيات"
                checked={tripDraft.direction === "OTHER_SUPPLIES"}
                onChange={() => dispatch({ type: "EDIT_TRIP_DIRECTION", direction: "OTHER_SUPPLIES" })} />
              <span>شغل المقاول (أحمد مدين للمقاول)</span>
            </span>
            <span className={styles.directionDesc}>عربيات المقاول تورّد لشغل أحمد</span>
          </label>
        </div>
      </div>

      </div></details>
      <details className={styles.formSection} open><summary>٢. العربية والوزن والأسعار</summary><div className={styles.formGrid}>
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
        <div className={styles.desktopChoiceControls}>
          <input type="search" aria-label="بحث عن عربية" placeholder="ابحث برقم العربية أو السائق" className={styles.input} value={vehicleSearch} onChange={e => setVehicleSearch(e.target.value)} />
          {recentVehicles.length > 0 && <div className={styles.recentChoices} aria-label="العربيات المستخدمة مؤخرًا">{recentVehicles.map(id => { const item = vehicles.find(entry => entry.id === id && !entry.isArchived); return item ? <button type="button" className={styles.quickActionBtn} key={id} onClick={() => dispatch({ type: "EDIT_TRIP_VEHICLE", vehicleId: id })}>{item.plateNumber}</button> : null; })}</div>}
          <select aria-label="السيارة المنفذة" value={tripDraft.vehicleId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              dispatch({ type: "EDIT_TRIP_VEHICLE", vehicleId: id || null });
              if (id) setRecentVehicles(previous => remember(previous, id));
            }}
            className={styles.select}
          >
            <option value="">-- اختر السيارة --</option>
            {filteredVehicles.map(item => (
              <option key={item.id} value={item.id} disabled={item.isArchived}>
                {item.plateNumber} ({item.driverName}){item.isArchived ? " — مؤرشفة" : ""}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className={styles.mobileChoiceTrigger}
          aria-label="اختيار السيارة المنفذة" aria-haspopup="dialog" aria-expanded={vehicleSheetOpen}
          onClick={() => setVehicleSheetOpen(true)}>
          {selectedVehicle ? selectedVehicle.plateNumber + " (" + selectedVehicle.driverName + ")" : "اختر السيارة"}
        </button>
        <dialog ref={vehicleDialogRef} className={styles.choiceDialog}
          aria-labelledby="vehicle-choice-title"
          onClose={() => setVehicleSheetOpen(false)}
          onClick={event => { if (event.target === event.currentTarget) setVehicleSheetOpen(false); }}>
          <div className={styles.choiceSheetHeader}>
            <h3 id="vehicle-choice-title">اختيار السيارة المنفذة</h3>
            <button type="button" aria-label="إغلاق اختيار العربية" onClick={() => setVehicleSheetOpen(false)}>إغلاق</button>
          </div>
          <input type="search" aria-label="بحث عن عربية داخل القائمة" autoFocus className={styles.input}
            placeholder="ابحث برقم العربية أو السائق أو الكود" value={vehicleSearch} onChange={event => setVehicleSearch(event.target.value)} />
          {recentVehicles.length > 0 && <div className={styles.sheetRecent} aria-label="العربيات المستخدمة مؤخرًا">
            <strong>المستخدمون مؤخرًا</strong>
            <div>{recentVehicles.map(id => { const item = vehicles.find(entry => entry.id === id && !entry.isArchived); return item ? <button type="button" key={id} onClick={() => { dispatch({ type: "EDIT_TRIP_VEHICLE", vehicleId: id }); setRecentVehicles(previous => remember(previous, id)); setVehicleSheetOpen(false); }}>{item.plateNumber}</button> : null; })}</div>
          </div>}
          <div className={styles.choiceList} aria-label="كل العربيات">
            {filteredVehicles.map(item => <button type="button" key={item.id} disabled={item.isArchived}
              aria-pressed={tripDraft.vehicleId === item.id}
              onClick={() => { dispatch({ type: "EDIT_TRIP_VEHICLE", vehicleId: item.id }); setRecentVehicles(previous => remember(previous, item.id)); setVehicleSheetOpen(false); }}>
              <span>{item.plateNumber}</span><small>{item.driverName}{item.isArchived ? " — مؤرشفة" : ""}</small>
            </button>)}
            {filteredVehicles.length === 0 && <p>لا توجد نتائج مطابقة.</p>}
          </div>
        </dialog>
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

      </div></details>
      <details className={styles.formSection}><summary>٣. المسار والمصاريف والملاحظات (اختياري)</summary><div className={styles.formGrid}>
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
      </div></details>
    </div>
  );
}
