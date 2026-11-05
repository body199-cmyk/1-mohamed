"use client";

import React, { useMemo, useState } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { QuickAddModal } from "../trips/quick-add-modal";
import styles from "./master-data.module.css";

type DataTab = "contractor" | "vehicle";

const matchesSearch = (value: string, search: string) =>
  value.toLocaleLowerCase("ar").includes(search.toLocaleLowerCase("ar"));

/**
 * UI-BASE-01A — a single searchable index over the existing demo records.
 * Reuses QuickAddModal and the same context as trip entry and statements:
 * no duplicate accounting implementation, remote API or persistent storage.
 */
export function MasterDataView() {
  const { contractors, vehicles, addContractor, addVehicle } = useDemoStore();
  const [tab, setTab] = useState<DataTab>("contractor");
  const [search, setSearch] = useState("");
  const [quickAdd, setQuickAdd] = useState<DataTab | null>(null);
  const [notice, setNotice] = useState("");

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
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>بيانات المقاولين والعربيات</h1>
          <p className={styles.muted}>
            استعراض وبحث وإضافة للتجربة. كل التغييرات مؤقتة
            وتختفي عند إعادة تحميل الصفحة.
          </p>
        </div>
        <button
          type="button"
          className={styles.primary}
          onClick={() => setQuickAdd(tab)}
        >
          + {tab === "contractor" ? "إضافة مقاول" : "إضافة عربية"}
        </button>
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
      </div>

      <div className={styles.filters}>
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
      </div>

      {notice && <p role="status" className={styles.notice}>{notice}</p>}

      <section
        id="master-data-results"
        role="tabpanel"
        aria-label={tab === "contractor" ? "قائمة المقاولين" : "قائمة العربيات"}
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
                  <dl>
                    <div><dt>بداية الحساب</dt><dd>{contractor.openingDate}</dd></div>
                    <div>
                      <dt>افتتاحي فرق الشغل</dt>
                      <dd>{balance} ج.م — {beneficiary}</dd>
                    </div>
                  </dl>
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
                <dl>
                  <div><dt>السائق</dt><dd>{vehicle.driverName || "غير محدد"}</dd></div>
                </dl>
                <p className={styles.muted}>
                  الافتتاحي النقدي للعربية يخص حسابها عند كل مقاول مسؤول،
                  وليس رصيد فرق شغل المقاول.
                </p>
              </article>
            ))}
          </div>
        )}

        {((tab === "contractor" && visibleContractors.length === 0) ||
          (tab === "vehicle" && visibleVehicles.length === 0)) && (
          <p className={styles.empty} role="status">مفيش نتائج مطابقة للبحث.</p>
        )}
      </section>

      <QuickAddModal
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
