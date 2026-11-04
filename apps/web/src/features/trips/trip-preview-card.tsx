import React from "react";
import type { WorkDirection } from "@ledger/trip-entry";
import {
  calculateTripAmounts,
  formatEgpFromPiastres,
} from "@ledger/accounting";
import styles from "./trips.module.css";

interface TripPreviewCardProps {
  weightTonnes: string;
  contractorRateEgp: string;
  vehicleRateEgp: string;
  expenseEgp: string;
  direction: WorkDirection | null;
  counterpartyName?: string;
  vehiclePlate?: string;
}

export function TripPreviewCard({
  weightTonnes,
  contractorRateEgp,
  vehicleRateEgp,
  expenseEgp,
  direction,
  counterpartyName,
  vehiclePlate,
}: TripPreviewCardProps) {
  // If required fields are empty, show initial placeholder
  if (!weightTonnes || !contractorRateEgp || !vehicleRateEgp) {
    return (
      <div className={styles.card} aria-live="polite">
        <h3 className={styles.cardTitle} style={{ fontSize: "1.05rem" }}>
          📊 معاينة الحساب المالي المباشر
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "12px 0 0" }}>
          أدخل الوزن وأسعار المقاول والسيارة لعرض الاستحقاق المالي المحسوب فورياً بدقة القروش.
        </p>
      </div>
    );
  }

  const calcResult = calculateTripAmounts({
    weightTonnes,
    contractorRateEgp,
    vehicleRateEgp,
    expenseEgp: expenseEgp.trim() === "" ? "0.00" : expenseEgp,
  });

  if (!calcResult.ok) {
    let errorMsg = "توجد مشكلة في القيم المدخلة";
    const { field, code } = calcResult.error;

    if (code === "EXCESS_PRECISION") {
      if (field === "weightTonnes") {
        errorMsg = "الوزن يقبل حتى 3 أرقام عشرية فقط (مثال: 25.450).";
      } else {
        errorMsg = "المبالغ والأسعار تقبل رقمين عشريين كحد أقصى (قروش).";
      }
    } else if (code === "INVALID_FORMAT") {
      errorMsg = "صيغة الرقم غير صحيحة، يرجى كتابة أرقام موجبة مفصولة بنقطة.";
    }

    return (
      <div
        className={styles.card}
        style={{ borderColor: "var(--color-danger)" }}
        aria-live="polite"
      >
        <h3 className={styles.cardTitle} style={{ color: "var(--color-danger)", fontSize: "1.05rem" }}>
          ⚠️ خطأ في بيانات الحساب
        </h3>
        <p className={styles.fieldError} style={{ fontSize: "0.9rem", marginTop: "8px" }}>
          {errorMsg}
        </p>
      </div>
    );
  }

  const contractorFormatted = formatEgpFromPiastres(
    calcResult.contractorTotalPiastres
  );
  const vehicleFormatted = formatEgpFromPiastres(
    calcResult.vehicleTotalPiastres
  );

  const contractorTotalStr = contractorFormatted.ok
    ? contractorFormatted.amount
    : "0.00";
  const vehicleTotalStr = vehicleFormatted.ok
    ? vehicleFormatted.amount
    : "0.00";

  return (
    <div className={styles.card} aria-live="polite">
      <div className={styles.cardHeader} style={{ marginBottom: "14px", paddingBottom: "10px" }}>
        <h3 className={styles.cardTitle} style={{ fontSize: "1.1rem" }}>
          📊 معاينة الحساب المالي
        </h3>
        <span className={`${styles.badge} ${styles.badgeInfo}`}>محسوب بالقرش</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Contractor entitlement box */}
        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "var(--surface-hover)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              قيمة شغل المقاول:
            </span>
            <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary)" }}>
              {contractorTotalStr} ج.م
            </span>
          </div>

          <div style={{ marginTop: "6px", fontSize: "0.82rem" }}>
            {direction === "AHMED_SUPPLIES" && (
              <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                ✓ شغل أحمد: المقاول مدين لأحمد بهذا المبلغ ({contractorTotalStr} ج.م)
              </span>
            )}
            {direction === "OTHER_SUPPLIES" && (
              <span style={{ color: "var(--color-warning)", fontWeight: 600 }}>
                ✓ شغل المقاول: أحمد مدين للمقاول بهذا المبلغ ({contractorTotalStr} ج.م)
              </span>
            )}
            {!direction && (
              <span style={{ color: "var(--color-danger)" }}>
                ⚠️ لم يتم تحديد اتجاه الشغل بعد
              </span>
            )}
          </div>
        </div>

        {/* Vehicle entitlement box */}
        <div
          style={{
            padding: "12px 14px",
            backgroundColor: "var(--surface-hover)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              مستحق السيارة {vehiclePlate ? `(${vehiclePlate})` : ""}:
            </span>
            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>
              {vehicleTotalStr} ج.م
            </span>
          </div>
          <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            يشمل نولون النقلة بالإضافة إلى العهدة والمصاريف.
          </div>
        </div>

        {/* Summary note */}
        {counterpartyName && (
          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", borderTop: "1px dashed var(--border-color)", paddingTop: "8px" }}>
            المقاول المسؤول: <strong>{counterpartyName}</strong>
          </div>
        )}
      </div>
    </div>
  );
}
