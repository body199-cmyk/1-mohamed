"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import styles from "./nav-header.module.css";

export function NavHeader() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/demo/dashboard");
  const { theme, toggleTheme } = useTheme();

  const isTrips = pathname.startsWith("/demo/trips");
  const isContractors = pathname.startsWith("/demo/contractors");
  const isMasterData = pathname.startsWith("/demo/master-data");
  const isDailyReport = pathname.startsWith("/demo/reports/daily");
  const isPayments = pathname.startsWith("/demo/payments");
  const isVehicleCash = pathname.startsWith("/demo/reports/vehicle-cash");

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">ن</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>أحمد أبو علي — حسابات النقل</span>
            <span className={styles.brandTag}>معاينة تفاعلية · نظام حسابات النقل</span>
          </span>
        </div>

        <nav className={styles.nav} aria-label="التنقل الرئيسي">
          <Link href="/demo/dashboard" className={`${styles.navLink} ${isDashboard ? styles.active : ""}`}
            aria-current={isDashboard ? "page" : undefined}>
            الرئيسية
          </Link>
          <Link
            href="/demo/trips"
            className={`${styles.navLink} ${isTrips ? styles.active : ""}`}
            aria-current={isTrips ? "page" : undefined}
          >
            تسجيل النقلات
          </Link>
          <Link
            href="/demo/contractors"
            className={`${styles.navLink} ${isContractors ? styles.active : ""}`}
            aria-current={isContractors ? "page" : undefined}
          >
            كشف حساب المقاول
          </Link>

          <Link
            href="/demo/master-data"
            className={`${styles.navLink} ${isMasterData ? styles.active : ""}`}
            aria-current={isMasterData ? "page" : undefined}
          >
            بيانات المقاولين والعربيات
          </Link>

          <Link href="/demo/reports/daily" className={`${styles.navLink} ${isDailyReport ? styles.active : ""}`}
            aria-current={isDailyReport ? "page" : undefined}>
            تقرير الشغل اليومي
          </Link>
          <Link href="/demo/reports/vehicle-cash"
            className={`${styles.navLink} ${isVehicleCash ? styles.active : ""}`}
            aria-current={isVehicleCash ? "page" : undefined}>
            كشف حساب نقد العربية
          </Link>
          <Link href="/demo/payments" className={`${styles.navLink} ${isPayments ? styles.active : ""}`}
            aria-current={isPayments ? "page" : undefined}>
            دفعات العربيات
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className={styles.themeBtn}
            aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
          >
            <span>{theme === "light" ? "🌙" : "☀️"}</span>
            <span>{theme === "light" ? "داكن" : "فاتح"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
