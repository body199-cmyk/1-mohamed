"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import styles from "./nav-header.module.css";

const groups = [
  { label: "الرئيسية", links: [{ href: "/demo/home", label: "جميع الوظائف" }, { href: "/demo/dashboard", label: "لوحة المؤشرات" }] },
  { label: "العمليات اليومية", links: [
    { href: "/demo/trips", label: "تسجيل النقلات" },
    { href: "/demo/payments", label: "دفعات العربيات" },
  ] },
  { label: "الحسابات والتقارير", links: [
    { href: "/demo/contractors", label: "كشف حساب المقاول" },
    { href: "/demo/reports/daily", label: "تقرير الشغل اليومي" },
    { href: "/demo/reports/vehicle-cash", label: "نقدية العربية" },
  ] },
  { label: "الإعدادات والبيانات", links: [
    { href: "/demo/master-data", label: "المقاولون والعربيات" },
  ] },
] as const;

export function NavHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">ن</span>
          <span className={styles.brandText}>
            <span className={styles.brandName}>أحمد أبو علي</span>
            <span className={styles.brandTag}>إدارة حسابات النقل</span>
          </span>
        </div>
        <nav className={styles.nav} aria-label="التنقل الرئيسي">
          {groups.map(group => (
            <div className={styles.navGroup} key={group.label}>
              <span className={styles.groupTitle}>{group.label}</span>
              {group.links.map(link => {
                const active = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link key={link.href} href={link.href}
                    className={`${styles.navLink} ${active ? styles.active : ""}`}
                    aria-current={active ? "page" : undefined}>{link.label}</Link>
                );
              })}
            </div>
          ))}
          <button type="button" onClick={toggleTheme} className={styles.themeBtn}
            aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>
            <span aria-hidden="true">{theme === "light" ? "🌙" : "☀️"}</span>
            <span>{theme === "light" ? "الوضع الداكن" : "الوضع الفاتح"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
