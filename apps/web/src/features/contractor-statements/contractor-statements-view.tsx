"use client";

import React, { useState, useMemo } from "react";
import { formatEgpFromPiastres } from "@ledger/accounting";
import { useDemoStore } from "../../demo/demo-context";
import { StatementSummaryCard } from "./statement-summary-card";
import { StatementTable } from "./statement-table";
import { StatementExportActions } from "./statement-export-actions";
import styles from "./statements.module.css";

function cairoDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function ContractorStatementsView() {
  const { contractors, vehicles, trips, getStatementForContractor } = useDemoStore();

  const today = cairoDate(new Date());
  const monthStart = today.slice(0, 7) + "-01";
  const initialContractor = contractors[0];
  const [selectedContractorId, setSelectedContractorId] = useState<string>(
    initialContractor?.id ?? "K1"
  );
  const [periodMode, setPeriodMode] = useState<"all" | "range">("range");
  const [fromDate, setFromDate] = useState(() =>
    initialContractor?.openingDate && initialContractor.openingDate > monthStart
      ? initialContractor.openingDate : monthStart
  );
  const [toDate, setToDate] = useState(today);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"" | "AHMED_SUPPLIES" | "OTHER_SUPPLIES">("");

  const currentContractor = useMemo(
    () => contractors.find((c) => c.id === selectedContractorId),
    [contractors, selectedContractorId]
  );

  const effectiveFromDate = periodMode === "all" ? (currentContractor?.openingDate ?? fromDate) : fromDate;

  const statementResult = useMemo(() => {
    if (!selectedContractorId || !effectiveFromDate || !toDate) {
      return null;
    }
    return getStatementForContractor(selectedContractorId, effectiveFromDate, toDate);
  }, [selectedContractorId, effectiveFromDate, toDate, getStatementForContractor]);

  const tripDetailsById = useMemo(() => new Map(trips.map(trip => [trip.id, {
    vehicle: vehicles.find(vehicle => vehicle.id === trip.vehicleId)?.plateNumber ?? trip.vehicleId,
    vehicleId: trip.vehicleId,
    origin: trip.origin,
    destination: trip.destination,
    route: [trip.origin, trip.destination].filter(Boolean).join(" ← "),
  }] as const)), [trips, vehicles]);
  const contractorTrips = useMemo(() => trips.filter(trip =>
    trip.counterpartyId === selectedContractorId &&
    trip.workDate >= effectiveFromDate && trip.workDate <= toDate
  ), [trips, selectedContractorId, effectiveFromDate, toDate]);
  const originOptions = [...new Set(contractorTrips.map(trip => trip.origin.trim()).filter(Boolean))].sort();
  const destinationOptions = [...new Set(contractorTrips.map(trip => trip.destination.trim()).filter(Boolean))].sort();
  const statementRows = statementResult?.ok ? statementResult.statement.rows : [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("ar");
    return statementRows.filter(row => {
      const details = tripDetailsById.get(row.id);
      const searchable = [row.id, details?.vehicle, details?.route, details?.origin, details?.destination]
        .filter(Boolean).join(" ").toLocaleLowerCase("ar");
      return (!query || searchable.includes(query)) &&
        (!originFilter || details?.origin === originFilter) &&
        (!destinationFilter || details?.destination === destinationFilter) &&
        (!directionFilter || row.direction === directionFilter);
    });
  }, [statementRows, tripDetailsById, search, originFilter, destinationFilter, directionFilter]);
  const hasActiveFilters = !!search.trim() || !!originFilter || !!destinationFilter || !!directionFilter;
  const filteredWorkSummary = useMemo(() => {
    let ahmed = 0n, counterparty = 0n;
    const vehicleIds = new Set<string>();
    for (const row of filteredRows) {
      const amount = BigInt(row.contractorTotalPiastres);
      if (row.direction === "AHMED_SUPPLIES") ahmed += amount;
      else counterparty += amount;
      const vehicleId = tripDetailsById.get(row.id)?.vehicleId;
      if (vehicleId) vehicleIds.add(vehicleId);
    }
    return { count: filteredRows.length, vehicleCount: vehicleIds.size, ahmed, counterparty };
  }, [filteredRows, tripDetailsById]);
  const displayMoney = (amount: bigint) => {
    const result = formatEgpFromPiastres(amount.toString());
    return result.ok ? result.amount + " ج.م" : "غير صالح";
  };

  return (
    <div className={styles.pageContainer}>
      {/* Filters Card */}
      <div className={styles.filtersCard}>
        <div className={styles.filtersGrid}>
          {/* Select Contractor */}
          <div className={styles.formGroup}>
            <label className={styles.label}>اختر المقاول</label>
            <select
              aria-label="اختر المقاول"
              value={selectedContractorId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedContractorId(id);
                const next = contractors.find(item => item.id === id);
                if (next?.openingDate && fromDate < next.openingDate) setFromDate(next.openingDate);
                setSearch(""); setOriginFilter(""); setDestinationFilter(""); setDirectionFilter("");
              }}
              className={styles.select}
            >
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}><label className={styles.label}>نطاق كشف الحساب</label><select aria-label="نطاق كشف الحساب" className={styles.select} value={periodMode} onChange={e=>setPeriodMode(e.target.value as "all" | "range")}><option value="all">من بداية حساب المقاول</option><option value="range">فترة محددة</option></select></div>
          {/* From Date */}
          {periodMode === "range" && <div className={styles.formGroup}>
            <label className={styles.label}>من تاريخ</label>
            <input
              type="date"
              aria-label="من تاريخ"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className={styles.input}
            />
          </div>}

          {/* To Date */}
          <div className={styles.formGroup}>
            <label className={styles.label}>إلى تاريخ</label>
            <input
              type="date"
              aria-label="إلى تاريخ"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="contractor-statement-search">بحث دائم في النقلات</label>
            <input id="contractor-statement-search" type="search" aria-label="بحث في كشف المقاول" value={search}
              onChange={event => setSearch(event.target.value)} className={styles.input}
              placeholder="رقم النقلة أو العربية أو المسار" />
          </div>
          <details className={styles.advancedFilters}>
            <summary>فلاتر متقدمة للموقع والاتجاه</summary>
            <div className={styles.advancedFiltersGrid}>
              <label className={styles.formGroup}>موقع التحميل
                <select aria-label="فلتر موقع التحميل" className={styles.select} value={originFilter} onChange={event => setOriginFilter(event.target.value)}>
                  <option value="">كل المواقع</option>{originOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className={styles.formGroup}>الوجهة
                <select aria-label="فلتر الوجهة" className={styles.select} value={destinationFilter} onChange={event => setDestinationFilter(event.target.value)}>
                  <option value="">كل الوجهات</option>{destinationOptions.map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className={styles.formGroup}>اتجاه الشغل
                <select aria-label="فلتر اتجاه الشغل" className={styles.select} value={directionFilter} onChange={event => setDirectionFilter(event.target.value as typeof directionFilter)}>
                  <option value="">كل الاتجاهات</option><option value="AHMED_SUPPLIES">أحمد جاب العربيات</option><option value="OTHER_SUPPLIES">المقاول جاب العربيات</option>
                </select>
              </label>
            </div>
          </details>
          {hasActiveFilters && <div className={styles.activeFilterChips} aria-label="فلاتر كشف المقاول النشطة">
            {search.trim() && <button type="button" aria-label="إزالة بحث كشف المقاول" onClick={() => setSearch("")}>بحث: {search} ×</button>}
            {originFilter && <button type="button" aria-label="إزالة فلتر موقع التحميل" onClick={() => setOriginFilter("")}>الموقع: {originFilter} ×</button>}
            {destinationFilter && <button type="button" aria-label="إزالة فلتر الوجهة" onClick={() => setDestinationFilter("")}>الوجهة: {destinationFilter} ×</button>}
            {directionFilter && <button type="button" aria-label="إزالة فلتر اتجاه الشغل" onClick={() => setDirectionFilter("")}>الاتجاه: {directionFilter === "AHMED_SUPPLIES" ? "أحمد جاب العربيات" : "المقاول جاب العربيات"} ×</button>}
            <button type="button" className={styles.clearFilterButton} onClick={() => { setSearch(""); setOriginFilter(""); setDestinationFilter(""); setDirectionFilter(""); }}>مسح كل الفلاتر</button>
          </div>}
          <div className={styles.formGroup}>
            <label className={styles.label}>فترة سريعة</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {(["اليوم","الأسبوع","الشهر"] as const).map(period => <button key={period} type="button" className={styles.select}
                style={{width:"auto",minHeight:44,cursor:"pointer",fontWeight:700}}
                onClick={() => {
                  const [year, month, day] = today.split("-").map(Number);
                  const utcDate = new Date(Date.UTC(year, month - 1, day));
                  const start = new Date(utcDate);
                  if (period === "الأسبوع") start.setUTCDate(day - ((utcDate.getUTCDay() + 1) % 7));
                  if (period === "الشهر") start.setUTCDate(1);
                  setPeriodMode("range"); setFromDate(start.toISOString().slice(0, 10)); setToDate(today);
                }}>{period}</button>)}
            </div>
          </div>
          {/* Quick Reset */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className={styles.select}
              style={{
                cursor: "pointer",
                fontWeight: 600,
                textAlign: "center",
                backgroundColor: "var(--surface-hover)",
              }}
              onClick={() => {
                setPeriodMode("range");
                setFromDate(currentContractor?.openingDate && currentContractor.openingDate > monthStart ? currentContractor.openingDate : monthStart);
                setToDate(today);
              }}
            >
              هذا الشهر
            </button>
          </div>
        </div>
      </div>

      {!statementResult && currentContractor && <p role="alert">حدد بداية الفترة ونهايتها لعرض الكشف والتصدير.</p>}
      {/* Statement Result rendering */}
      {!currentContractor && (
        <div className={styles.errorState}>
          يرجى اختيار مقاول لعرض كشف الحساب.
        </div>
      )}

      {currentContractor && statementResult && !statementResult.ok && (
        <div className={styles.errorState} role="alert">
          <p style={{ margin: 0, fontWeight: 700 }}>
            ⚠️ تعذر إنشاء كشف الحساب:
          </p>
          <p style={{ margin: "6px 0 0", fontSize: "0.9rem" }}>
            {statementResult.error.code === "PERIOD_BEFORE_START" &&
              `تاريخ بداية الفترة (${effectiveFromDate}) يسبق تاريخ بداية حساب المقاول (${currentContractor.openingDate}).`}
            {statementResult.error.code === "INVALID_PERIOD" &&
              `تاريخ نهاية الفترة (${toDate}) يسبق تاريخ بداية الفترة (${fromDate}).`}
            {statementResult.error.code === "MOVEMENT_BEFORE_START" &&
              "توجد نقلات مسجلة بتواريخ تسبق تاريخ بداية حساب المقاول."}
            {statementResult.error.code !== "PERIOD_BEFORE_START" &&
              statementResult.error.code !== "INVALID_PERIOD" &&
              statementResult.error.code !== "MOVEMENT_BEFORE_START" &&
              `خطأ في التحقق من صحة البيانات (${statementResult.error.code}).`}
          </p>
        </div>
      )}

      {currentContractor && statementResult && statementResult.ok && (
        <>
          <StatementSummaryCard
            statement={statementResult.statement}
            contractorName={currentContractor.name}
            uniqueVehicleCount={new Set(statementResult.statement.rows.map(row => tripDetailsById.get(row.id)?.vehicleId ?? row.id)).size}
          />

          {hasActiveFilters && <section className={styles.filteredWorkSummary} aria-label="ملخص قيمة الشغل في النتائج المفلترة">
            <strong>ملخص الشغل في النتائج المفلترة فقط — لا يمثل صافي حساب المقاول النهائي</strong>
            <div>{filteredWorkSummary.count} نقلة • {filteredWorkSummary.vehicleCount} عربية</div>
            <div>شغل أحمد في النتائج: {displayMoney(filteredWorkSummary.ahmed)}</div>
            <div>شغل المقاول في النتائج: {displayMoney(filteredWorkSummary.counterparty)}</div>
          </section>}
          {hasActiveFilters && <p className={styles.exportScopeNote}>الرصيد التراكمي في كل حركة يعكس الحساب الكامل؛ قد تظهر قفزات عند إخفاء حركات أخرى بالفلاتر. الملخص أعلاه يعرض قيمة الشغل في النتائج فقط ولا يمثل صافي المستحق.</p>}
          <p className={styles.exportScopeNote}>التصدير يعرض كشف الحساب الكامل للفترة، بينما الفلاتر تحدد تفاصيل العرض على الشاشة فقط. صافي المستحق النهائي يظل محسوبًا على الحساب كاملًا.</p>
          <StatementExportActions statement={statementResult.statement} name={currentContractor.name} />
          <StatementTable rows={filteredRows} tripDetailsById={tripDetailsById} />
        </>
      )}
    </div>
  );
}
