"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import styles from "./nav-header.module.css";

export function NavHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isTrips = pathname.startsWith("/demo/trips");
  const isContractors = pathname.startsWith("/demo/contractors");

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span>أحمد أبو علي — حسابات النقل</span>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "normal" }}>
            (معاينة تفاعلية)
          </span>
        </div>

        <nav className={styles.nav} aria-label="التنقل الرئيسي">
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
