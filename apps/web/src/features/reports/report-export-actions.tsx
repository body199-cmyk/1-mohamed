"use client";

import { useRef, useState } from "react";
import type { OperationalReportDocument } from "@ledger/statement-export";
import styles from "../contractor-statements/statements.module.css";

type ExportKind = "print" | "pdf" | "png" | "csv" | "xlsx";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    window.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

/** All five outputs consume the same immutable presentation snapshot. */
export function ReportExportActions(props: {
  readonly document: OperationalReportDocument;
  readonly fileNameBase: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  async function shareImage(): Promise<void> {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const renderer = await import("@ledger/statement-export");
      const blob = await renderer.renderOperationalReportPng(props.document);
      const file = new File([blob], props.fileNameBase + ".png", { type: "image/png" });
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: props.document.title });
      } else {
        setError("المشاركة المباشرة غير مدعومة على هذا الجهاز. استخدم تنزيل صورة PNG ثم شاركها.");
      }
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) {
        setError(cause instanceof Error ? cause.message : "تعذرت المشاركة؛ جرّب تنزيل الصورة.");
      }
    } finally { lock.current = false; setBusy(false); }
  }

  async function exportReport(kind: ExportKind): Promise<void> {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const preview = kind === "print" ? window.open("", "_blank") : null;
    try {
      if (kind === "print" && !preview) {
        throw new Error("اسمح بفتح نافذة الطباعة في المتصفح ثم حاول مجددًا.");
      }
      // Keep the relatively large PDF/PNG/XLSX renderers out of the initial report-screen chunk.
      const renderer = await import("@ledger/statement-export");
      if (kind === "print" && preview) {
        preview.document.open();
        preview.document.write(renderer.renderOperationalReportHtml(props.document));
        preview.document.close();
        const fontStyles = preview.document.createElement("link");
        fontStyles.rel = "stylesheet";
        fontStyles.href = new URL("/fonts/cairo.css", window.location.origin).href;
        await new Promise<void>((resolve, reject) => {
          fontStyles.onload = () => resolve();
          fontStyles.onerror = () => reject(new Error("تعذر تحميل خط الطباعة. أعد المحاولة."));
          preview.document.head.append(fontStyles);
        });
        await preview.document.fonts.load("400 16px Cairo");
        await preview.document.fonts.ready;
        preview.opener = null;
        preview.focus();
        preview.print();
      } else if (kind === "csv") {
        const content = renderer.renderOperationalReportCsv(props.document);
        downloadBlob(new Blob([content], { type: "text/csv;charset=utf-8" }), props.fileNameBase + ".csv");
      } else if (kind === "xlsx") {
        downloadBlob(renderer.renderOperationalReportXlsx(props.document), props.fileNameBase + ".xlsx");
      } else if (kind === "png") {
        downloadBlob(await renderer.renderOperationalReportPng(props.document), props.fileNameBase + ".png");
      } else if (kind === "pdf") {
        downloadBlob(await renderer.renderOperationalReportPdf(props.document), props.fileNameBase + ".pdf");
      }
    } catch (cause) {
      preview?.close();
      setError(cause instanceof Error ? cause.message : "تعذر التصدير. حاول مرة أخرى.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return <section aria-label="تصدير التقرير" className={styles.exportPanel}>
    <div className={styles.exportActions}>
      <button className={[styles.exportButton, styles.exportButtonPrimary].join(" ")} disabled={busy} onClick={() => void shareImage()}>مشاركة صورة التقرير مباشرة</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => void exportReport("print")}>طباعة / حفظ PDF</button>
      <button className={[styles.exportButton, styles.exportButtonPrimary].join(" ")} disabled={busy} onClick={() => void exportReport("pdf")}>تنزيل PDF مباشر</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => void exportReport("png")}>تنزيل صورة PNG</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => void exportReport("csv")}>تنزيل CSV</button>
      <button className={styles.exportButton} disabled={busy} onClick={() => void exportReport("xlsx")}>تنزيل Excel XLSX</button>
    </div>
    <p className={styles.exportDescription}>كل الصيغ تصدر نفس التقرير والفلاتر والملخص والتفاصيل دون إعادة حساب. تخطيط الطباعة وPDF A4 وصورة PNG ثابت ولا يتغير حسب عرض الشاشة أو الثيم. القيم المالية والمراجع تحفظ كنص دقيق في CSV وExcel.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
