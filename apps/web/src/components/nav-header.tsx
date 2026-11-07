"use client";
import Link from "next/link";
import { useRef } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import styles from "./nav-header.module.css";

const items = [
  { href: "/demo/home", label: "الرئيسية", icon: "⌂" },
  { href: "/demo/trips", label: "تسجيل النقلات", icon: "🚚" },
  { href: "/demo/payments", label: "دفعات العربيات", icon: "💳" },
  { href: "/demo/contractors", label: "كشف المقاول", icon: "📋" },
  { href: "/demo/reports/vehicle-cash", label: "نقدية العربية", icon: "🚛" },
  { href: "/demo/reports/daily", label: "التقرير اليومي", icon: "📅" },
  { href: "/demo/master-data", label: "البيانات الأساسية", icon: "🗂️" },
  { href: "/demo/dashboard", label: "لوحة المؤشرات", icon: "📊" },
  { href: "/demo/settings", label: "الإعدادات", icon: "⚙️" },
];
export function NavHeader() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const scrollNav = (direction: "next" | "previous") => {
    const nav = navRef.current;
    if (!nav) return;
    const rtl = getComputedStyle(nav).direction === "rtl";
    nav.scrollBy({ left: (direction === "next" ? -1 : 1) * (rtl ? 1 : -1) * Math.max(220, nav.clientWidth * 0.7), behavior: "smooth" });
  };
  const { theme, toggleTheme } = useTheme();
  return <header className={styles.header}>
    <div className={styles.inner}>
      <Link href="/demo/home" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true">ن</span>
        <span className={styles.brandText}><span className={styles.brandName}>أحمد أبو علي</span><span className={styles.brandTag}>حسابات النقل والمقاولين</span></span>
      </Link>
      <div className={styles.navContainer}>
      <button className={styles.navScrollButton} type="button" aria-label="عرض عناصر التنقل التالية" onClick={() => scrollNav("next")}>‹</button>
      <nav ref={navRef} className={styles.nav} aria-label="التنقل الرئيسي">
        {items.map(item => {
          const active = pathname === item.href || (pathname.startsWith(item.href + "/"));
          return <Link key={item.href} href={item.href}
            className={`${styles.navLink} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}>
            <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </Link>;
        })}
        <button type="button" onClick={toggleTheme} className={styles.themeBtn}
          aria-label={theme === "light" ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}>
          <span aria-hidden="true">{theme === "light" ? "☾" : "☀"}</span><span>المظهر</span>
        </button>
      </nav>
      <button className={styles.navScrollButton} type="button" aria-label="عرض عناصر التنقل السابقة" onClick={() => scrollNav("previous")}>›</button>
      </div>
    </div>
  </header>;
}
