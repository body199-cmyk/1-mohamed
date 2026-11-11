"use client";
import { ContractorMoney } from "../contractor-statements/contractor-money";

import React, { useMemo, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { QuickAddModal } from "../trips/quick-add-modal";
import { MasterRecordEditor, type MasterAction } from "./master-record-editor";
import { CashOpeningsPanel } from "./cash-openings-panel";
import styles from "./master-data.module.css";

type DataTab = "contractor" | "vehicle" | "cash";
type Selection = { kind: "contractor" | "vehicle"; id: string; action: MasterAction };

const matchesSearch = (value: string, search: string) =>
  value.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar"));

/**
 * UI-BASE-01A — a single searchable index over the existing demo records.
 * Reuses QuickAddModal and the same context as trip entry and statements:
 * no duplicate accounting implementation, remote API or persistent storage.
 */
export function MasterDataView() {
  const { contractors, vehicles, addContractor, addVehicle, editContractor, editVehicle, archiveContractor, archiveVehicle, masterAudit } = useDemoStore();
  const [tab, setTab] = useState<DataTab>("contractor");
  const [search, setSearch] = useState("");
  const [quickAdd, setQuickAdd] = useState<"contractor" | "vehicle" | null>(null);
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);

  const visibleContractors = useMemo(
    () =>
      contractors.filter(
        (item) =>
          matchesSearch(item.name, search) ||
          matchesSearch(item.id, search)
      ),
    [contractors, search]
  );
  const visibleVehicles = useMemo(
    () =>
      vehicles.filter(
        (item) =>
          matchesSearch(item.plateNumber, search) ||
          matchesSearch(item.driverName, search) ||
          matchesSearch(item.id, search)
      ),
    [vehicles, search]
  );

  const changeTab = (value: DataTab) => {
    setTab(value);
    setSearch("");
    setNotice("");
    setSelection(null);
  };

  const chooseAction = (kind: Selection["kind"], id: string, action: MasterAction) =>
    setSelection(s => s?.kind === kind && s.id === id && s.action === action ? null : { kind, id, action });
  const actionEditor = (kind: Selection["kind"], id: string, name: string, driver = "") => {
    if (selection?.kind !== kind || selection.id !== id) return null;
    return <MasterRecordEditor key={id + selection.action} kind={kind} action={selection.action}
      name={name} driver={driver} onCancel={() => setSelection(null)}
      onSave={(newName, newDriver, reason) => {
        const result = selection.action === "edit"
          ? kind === "contractor" ? editContractor(id, newName, reason) : editVehicle(id, newName, newDriver, reason)
          : kind === "contractor" ? archiveContractor(id, selection.action === "archive", reason)
            : archiveVehicle(id, selection.action === "archive", reason);
        if (result) { setSelection(null); setNotice("تم التغيير وتسجيل السبب في المعاينة فقط."); }
        return result;
      }} />;
  };
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>بيانات المقاولين والعربيات</h1>
          <p className={styles.muted}>
            بحث وإضافة وتعديل وأرشفة وافتتاحي نقد للتجربة. كل التغييرات مؤقتة
            وتختفي عند إعادة تحميل الصفحة.
          </p>
        </div>
        {tab !== "cash" && <button
          type="button"
          className={styles.primary}
          onClick={() => setQuickAdd(tab === "contractor" ? "contractor" : "vehicle")}
        >
          + {tab === "contractor" ? "إضافة مقاول" : "إضافة عربية"}
        </button>}
      </header>

      <div className={styles.tabBar} role="tablist" aria-label="نوع البيانات">
        <button
          type="button"
          role="tab"
          aria-controls="master-data-results"
          aria-selected={tab === "contractor"}
          className={tab === "contractor" ? styles.activeTab : styles.tab}
          onClick={() => changeTab("contractor")}
        >
          المقاولون ({contractors.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-controls="master-data-results"
          aria-selected={tab === "vehicle"}
          className={tab === "vehicle" ? styles.activeTab : styles.tab}
          onClick={() => changeTab("vehicle")}
        >
          العربيات ({vehicles.length})
        </button>
        <button type="button" role="tab" aria-controls="master-data-results" aria-selected={tab === "cash"} className={tab === "cash" ? styles.activeTab : styles.tab} onClick={() => changeTab("cash")}>افتتاحيات نقد العربيات</button>
      </div>

      {tab !== "cash" && <div className={styles.filters}>
        <label htmlFor="master-data-search">
          {tab === "contractor"
            ? "بحث باسم المقاول أو رقمه"
            : "بحث برقم اللوحة أو اسم السائق"}
        </label>
        <input
          id="master-data-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tab === "contractor" ? "ابحث عن مقاول..." : "ابحث عن عربية..."}
          autoComplete="off"
        />
      </div>}

      {notice && <p role="status" className={styles.notice}>{notice}</p>}

      <section
        id="master-data-results"
        role="tabpanel"
        aria-label={tab === "contractor" ? "قائمة المقاولين" : tab === "vehicle" ? "قائمة العربيات" : "افتتاحيات النقد"}
      >
        {tab === "contractor" && (
          <div className={styles.grid}>
            {visibleContractors.map((contractor) => {
              const formatted = formatEgpFromPiastres(
                contractor.openingBalancePiastres
              );
              const balance = formatted.ok ? formatted.amount : "غير صالح";
              const sign = BigInt(contractor.openingBalancePiastres);
              const beneficiary =
                sign === 0n ? "رصيد متعادل" :
                sign > 0n ? "لصالح أحمد" : "لصالح المقاول";

              return (
                <article className={styles.card} key={contractor.id}>
                  <div className={styles.cardHeading}>
                    <h2>{contractor.name}</h2>
                    <span className={styles.id}>{contractor.id}</span>
                  </div>
                  {contractor.isArchived && <strong className={styles.archived}>مؤرشف — محفوظ للتاريخ</strong>}
                  <dl>
                    <div><dt>بداية الحساب</dt><dd>{contractor.openingDate}</dd></div>
                    <div>
                      <dt>افتتاحي فرق الشغل</dt>
                      <dd><ContractorMoney value={contractor.openingBalancePiastres} /></dd>
                    </div>
                  </dl>
                  <div className={styles.actions}>
                    {!contractor.isArchived && <button type="button" className={styles.secondary} onClick={() => chooseAction("contractor", contractor.id, "edit")}>تعديل المقاول</button>}
                    <button type="button" className={styles.secondary} onClick={() => chooseAction("contractor", contractor.id, contractor.isArchived ? "reactivate" : "archive")}>{contractor.isArchived ? "إعادة تفعيل المقاول" : "أرشفة المقاول"}</button>
                  </div>
                  {actionEditor("contractor", contractor.id, contractor.name)}
                </article>
              );
            })}
          </div>
        )}

        {tab === "vehicle" && (
          <div className={styles.grid}>
            {visibleVehicles.map((vehicle) => (
              <article className={styles.card} key={vehicle.id}>
                <div className={styles.cardHeading}>
                  <h2>{vehicle.plateNumber}</h2>
                  <span className={styles.id}>{vehicle.id}</span>
                </div>
                {vehicle.isArchived && <strong className={styles.archived}>مؤرشفة — محفوظة للتاريخ</strong>}
                <dl>
                  <div><dt>السائق</dt><dd>{vehicle.driverName || "غير محدد"}</dd></div>
                </dl>
                <p className={styles.muted}>
                  الافتتاحي النقدي للعربية يخص حسابها عند كل مقاول مسؤول،
                  وليس رصيد فرق شغل المقاول.
                </p>
                <div className={styles.actions}>
                  {!vehicle.isArchived && <button type="button" className={styles.secondary} onClick={() => chooseAction("vehicle", vehicle.id, "edit")}>تعديل العربية</button>}
                  <button type="button" className={styles.secondary} onClick={() => chooseAction("vehicle", vehicle.id, vehicle.isArchived ? "reactivate" : "archive")}>{vehicle.isArchived ? "إعادة تفعيل العربية" : "أرشفة العربية"}</button>
                </div>
                {actionEditor("vehicle", vehicle.id, vehicle.plateNumber, vehicle.driverName)}
              </article>
            ))}
          </div>
        )}

        {tab === "cash" && <CashOpeningsPanel />}
        {((tab === "contractor" && visibleContractors.length === 0) ||
          (tab === "vehicle" && visibleVehicles.length === 0)) && (
          <p className={styles.empty} role="status">مفيش نتائج مطابقة للبحث.</p>
        )}
      </section>

      <section className={styles.audit} aria-label="سجل مراجعة التغييرات التجريبية">
        <h2>سجل التغييرات التجريبي ({masterAudit.length})</h2>
        {masterAudit.length === 0 ? <p className={styles.muted}>لا توجد تغييرات بعد.</p> : <ol>
          {masterAudit.map((entry, i) => <li key={entry.at + i}>
            <strong>{entry.action} — {entry.target} / {entry.key}</strong> — {entry.reason}
            <details><summary>قبل وبعد</summary><pre>{entry.before}{"\n"}{entry.after}</pre></details>
          </li>)}
        </ol>}
      </section>
      <QuickAddModal
        key={`${quickAdd ?? "closed"}-${String(quickAdd !== null)}`}
        type={quickAdd ?? "contractor"}
        isOpen={quickAdd !== null}
        onClose={() => setQuickAdd(null)}
        existingContractorNames={contractors.map((item) => item.name)}
        existingVehiclePlates={vehicles.map((item) => item.plateNumber)}
        onAddContractor={(name, date, balance) => {
          const created = addContractor(name, date, balance);
          setSearch("");
          setNotice(`تمت إضافة المقاول ${created.name} للتجربة فقط.`);
        }}
        onAddVehicle={(plate, driver) => {
          const created = addVehicle(plate, driver);
          setSearch("");
          setNotice(`تمت إضافة العربية ${created.plateNumber} للتجربة فقط.`);
        }}
      />
    </div>
  );
}
