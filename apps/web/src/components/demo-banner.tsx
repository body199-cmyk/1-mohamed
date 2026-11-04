"use client";

import React from "react";
import styles from "./demo-banner.module.css";

export function DemoBanner() {
  return (
    <div className={styles.banner} role="status" aria-label="تنبيه النسخة التجريبية">
      <span className={styles.icon} aria-hidden="true">⚠️</span>
      <span>نسخة تجريبية — البيانات مؤقتة وتُمسح عند إعادة تحميل الصفحة</span>
    </div>
  );
}
