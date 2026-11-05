"use client";

import { useRef, useState } from "react";
import type { ContractorStatement } from "@ledger/contractor-statements";
import { toStatementDocument } from "./statement-document";
import styles from "./statements.module.css";

export function StatementExportActions({ statement, name }: { statement: ContractorStatement; name: string }) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function exportStatement(kind: "csv" | "print" | "png") {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    // Open during the user gesture so mobile browsers do not block an async popup.
    const preview = kind === "print" ? window.open("", "_blank") : null;
    try {
      if (kind === "print" && !preview) throw new Error("اسمح بفتح نافذة الطباعة في المتصفح ثم حاول مجددًا.");
      const document = toStatementDocument(statement, name);
      const renderer = await import("@ledger/statement-export");
      if (kind === "png") {
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

  return <section aria-label="تصدير كشف الحساب" style={{ marginBlock: 16 }}>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <button className={styles.select} style={{ width: "auto" }} disabled={busy} onClick={() => exportStatement("print")}>طباعة / حفظ PDF</button>
      <button className={styles.select} style={{ width: "auto" }} disabled={busy} onClick={() => exportStatement("png")}>تنزيل صورة PNG</button>
      <button className={styles.select} style={{ width: "auto" }} disabled={busy} onClick={() => exportStatement("csv")}>تنزيل CSV</button>
    </div>
    <p>الملخص والتفاصيل لنفس المقاول والفترة المعروضين. صورة PNG للكشوف متوسطة الحجم؛ للكشوف الطويلة اختر فترة أصغر أو استخدم CSV/الطباعة. حفظ PDF من نافذة الطباعة.</p>
    {error && <p role="alert">{error}</p>}
  </section>;
}
