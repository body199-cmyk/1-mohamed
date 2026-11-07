"use client";

import { useRef, useState } from "react";
import type { ContractorStatement } from "@ledger/contractor-statements";
import { toStatementDocument } from "./statement-document";
import styles from "./statements.module.css";

export function StatementExportActions({ statement, name, receiptByTripId }: {
  statement: ContractorStatement;
  name: string;
  receiptByTripId: ReadonlyMap<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function shareStatementImage() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const document = toStatementDocument(statement, name, receiptByTripId);
      const renderer = await import("@ledger/statement-export");
      const blob = await renderer.renderContractorStatementPng(document);
      const file = new File([blob], `statement-${statement.period.from}-${statement.period.to}.png`, { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `كشف حساب ${name}` });
      } else {
        setError("المشاركة المباشرة للصورة غير مدعومة في هذا المتصفح. استخدم زر تنزيل صورة PNG ثم شاركها من جهازك.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "تعذرت مشاركة الصورة. جرّب تنزيلها.");
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function exportStatement(kind: "csv" | "print" | "png" | "pdf" | "xlsx") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    // Open during the user gesture so mobile browsers do not block an async popup.
    const preview = kind === "print" ? window.open("", "_blank") : null;
    try {
      if (kind === "print" && !preview) throw new Error("اسمح بفتح نافذة الطباعة في المتصفح ثم حاول مجددًا.");
      const document = toStatementDocument(statement, name, receiptByTripId);
      const renderer = await import("@ledger/statement-export");
      if (kind === "xlsx") {
        const blob = renderer.renderContractorStatementXlsx(document);
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        try {
          link.href = url;
          link.download = "demo-statement-" + statement.period.from + "-" + statement.period.to + ".xlsx";
          window.document.body.append(link);
          link.click();
        } finally {
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } else if (kind === "pdf") {
        const blob = await renderer.renderContractorStatementPdf(document);
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        try {
          link.href = url;
          link.download = "demo-statement-" + statement.period.from + "-" + statement.period.to + ".pdf";
          window.document.body.append(link);
          link.click();
        } finally {
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } else if (kind === "png") {
        const blob = await renderer.renderContractorStatementPng(document);
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        try {
          link.href = url;
          link.download = "demo-statement-" + statement.period.from + "-" + statement.period.to + ".png";
          window.document.body.append(link);
          link.click();
        } finally {
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
      } else if (kind === "csv") {
        const blob = new Blob([renderer.renderContractorStatementCsv(document)], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = url;
        link.download = `demo-statement-${statement.period.from}-${statement.period.to}.csv`;
        window.document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else if (preview) {
        preview.document.open();
        preview.document.write(renderer.renderContractorStatementHtml(document));
        preview.document.close();
        const fontStyles = preview.document.createElement("link");
        fontStyles.rel = "stylesheet";
        fontStyles.href = new URL("/fonts/cairo.css", window.location.origin).href;
        await new Promise<void>((resolve, reject) => {
          fontStyles.onload = () => resolve();
          fontStyles.onerror = () => reject(new Error("تعذر تحميل خط الطباعة. أعد المحاولة."));
          preview.document.head.append(fontStyles);
        });
        await preview.document.fonts.load('400 16px Cairo');
        await preview.document.fonts.ready;
        preview.opener = null;
        preview.focus();
        preview.print();
      }
    } catch (cause) {
      preview?.close();
      setError(cause instanceof Error ? cause.message : "تعذر التصدير. حاول مرة أخرى.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <section aria-label="تصدير كشف الحساب" className={styles.exportPanel}>
    <div className={styles.exportActions}>
      <button className={[styles.exportButton, styles.exportButtonPrimary].join(" ")} disabled={busy} onClick={shareStatementImage}>مشاركة صورة الكشف مباشرة</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => exportStatement("print")}>طباعة / حفظ PDF</button>
      <button className={[styles.exportButton, styles.exportButtonPrimary].join(" ")} disabled={busy} onClick={() => exportStatement("pdf")}>تنزيل PDF مباشر</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => exportStatement("png")}>تنزيل صورة PNG</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => exportStatement("csv")}>تنزيل CSV</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => exportStatement("xlsx")}>تنزيل Excel XLSX</button>
    </div>
    <p className={styles.exportDescription}>الملخص والتفاصيل لنفس المقاول والفترة المعروضين. صورة PNG للكشوف متوسطة الحجم. تنزيل PDF المباشر يصل إلى ٦٠ صفحة، بصور Cairo واضحة مرقّمة (نصه غير قابل للتحديد/البحث). لو عايز PDF بنص قابل للتحديد والبحث استخدم طباعة / حفظ PDF. ملف Excel فيه ملخص وتفاصيل RTL؛ المبالغ والمراجع كنص للحفاظ على الدقة والأصفار البادئة. لا تُحذف حركات بصمت.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
