"use client";

import React, { useState, useMemo } from "react";
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

          <StatementExportActions statement={statementResult.statement} name={currentContractor.name} />
          <StatementTable rows={statementResult.statement.rows} tripDetailsById={tripDetailsById} />
        </>
      )}
    </div>
  );
}
