import React from "react";
import type { ContractorStatement } from "@ledger/contractor-statements";
import { formatEgpFromPiastres } from "@ledger/accounting";
import styles from "./statements.module.css";

interface StatementSummaryCardProps {
  statement: ContractorStatement;
  contractorName: string;
}

export function StatementSummaryCard({
  statement,
  contractorName,
}: StatementSummaryCardProps) {
  const openingFormatted = formatEgpFromPiastres(statement.openingBalancePiastres);
  const ahmedWorkFormatted = formatEgpFromPiastres(statement.ahmedWorkPiastres);
  const counterpartyWorkFormatted = formatEgpFromPiastres(
    statement.counterpartyWorkPiastres
  );
  const closingFormatted = formatEgpFromPiastres(statement.closingBalancePiastres);

  const openingAmount = openingFormatted.ok ? openingFormatted.amount : "0.00";
  const ahmedAmount = ahmedWorkFormatted.ok ? ahmedWorkFormatted.amount : "0.00";
  const counterpartyAmount = counterpartyWorkFormatted.ok
    ? counterpartyWorkFormatted.amount
    : "0.00";
  const closingAmount = closingFormatted.ok ? closingFormatted.amount : "0.00";

  // Beneficiary badge presentation
  let beneficiaryBadgeClass = styles.badgeBalanced;
  let beneficiaryText = "الحساب متعادل (0.00 ج.م)";
  let beneficiaryIcon = "⚖️";

  if (statement.beneficiary === "AHMED") {
    beneficiaryBadgeClass = styles.badgeAhmed;
    beneficiaryText = `صافي الرصيد لصالح أحمد (+${closingAmount} ج.م)`;
    beneficiaryIcon = "🟢";
  } else if (statement.beneficiary === "COUNTERPARTY") {
    beneficiaryBadgeClass = styles.badgeCounterparty;
    beneficiaryText = `صافي الرصيد لصالح المقاول (${contractorName}: ${closingAmount} ج.م)`;
    beneficiaryIcon = "🟡";
  }

  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        <div>
          <h2 className={styles.summaryTitle}>
            <span>📋 ملخص كشف حساب: {contractorName}</span>
          </h2>
          <div style={{ marginTop: "6px" }}>
            <span
              className={`${styles.beneficiaryBadge} ${beneficiaryBadgeClass}`}
            >
              <span>{beneficiaryIcon}</span>
              <span>{beneficiaryText}</span>
            </span>
          </div>
        </div>

        <div className={styles.periodBadge}>
          الفترة من {statement.period.from} إلى {statement.period.to} (
          {statement.movementCount} نقلة)
        </div>
      </div>

      <div role="status" style={{ background: "#175CD3", color: "#fff", borderRadius: 16, padding: "20px 24px", marginBottom: 18 }}>
        <div style={{ fontSize: 13, opacity: 0.9 }}>مين باقي له عند مين؟ — حتى {statement.period.to}</div>
        <div style={{ fontSize: "clamp(1.2rem, 3vw, 1.9rem)", fontWeight: 800, marginTop: 8 }}>
          {statement.beneficiary === "AHMED"
            ? `المقاول ${contractorName} عليه لأحمد أبو علي ${closingAmount} ج.م`
            : statement.beneficiary === "COUNTERPARTY"
              ? `أحمد أبو علي عليه للمقاول ${contractorName} ${closingAmount} ج.م`
              : "الحساب متعادل — لا يوجد رصيد مستحق لأي طرف"}
        </div>
        <div style={{ fontSize: 13, marginTop: 10, opacity: 0.9 }}>
          الرصيد يشمل الرصيد السابق وشغل الطرفين المسجل حتى نهاية الفترة، وفق حساب الكشف.
        </div>
      </div>

      <div className={styles.summaryGrid}>
        {/* Metric 1: Opening Balance */}
        <div className={styles.metricBox}>
          <span className={styles.metricLabel}>الرصيد الافتتاحي قبل الفترة</span>
          <span className={styles.metricValue}>{openingAmount} ج.م</span>
          <span className={styles.metricSubtext}>
            {BigInt(statement.openingBalancePiastres) > 0n
              ? "لصالح أحمد (+)"
              : BigInt(statement.openingBalancePiastres) < 0n
              ? "لصالح المقاول (-)"
              : "رصيد متعادل"}
          </span>
        </div>

        {/* Metric 2: Ahmed Work */}
        <div className={styles.metricBox}>
          <span className={styles.metricLabel}>إجمالي شغل أحمد (إضافة له)</span>
          <span className={styles.metricValue} style={{ color: "var(--color-success)" }}>
            +{ahmedAmount} ج.م
          </span>
          <span className={styles.metricSubtext}>أحمد جاب العربيات لشغل المقاول</span>
        </div>

        {/* Metric 3: Counterparty Work */}
        <div className={styles.metricBox}>
          <span className={styles.metricLabel}>إجمالي شغل المقاول (خصم على أحمد)</span>
          <span className={styles.metricValue} style={{ color: "var(--color-warning)" }}>
            -{counterpartyAmount} ج.م
          </span>
          <span className={styles.metricSubtext}>المقاول جاب العربيات لشغل أحمد</span>
        </div>

        {/* Metric 4: Closing Balance */}
        <div
          className={styles.metricBox}
          style={{
            borderColor:
              statement.beneficiary === "AHMED"
                ? "var(--color-success)"
                : statement.beneficiary === "COUNTERPARTY"
                ? "var(--color-warning)"
                : "var(--border-color)",
          }}
        >
          <span className={styles.metricLabel}>الرصيد الختامي الصافي</span>
          <span className={styles.metricValue}>{closingAmount} ج.م</span>
          <span className={styles.metricSubtext}>
            {statement.beneficiary === "AHMED" && "مستحق لأحمد عند المقاول"}
            {statement.beneficiary === "COUNTERPARTY" && "مستحق للمقاول عند أحمد"}
            {statement.beneficiary === "BALANCED" && "لا توجد مستحقات معلقة"}
          </span>
        </div>
      </div>
    </div>
  );
}
