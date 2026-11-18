import { useEffect, useId, useState } from "react";
import type { OperationalReportDocument } from "@ledger/statement-export";
import styles from "./report-export-preview.module.css";

type Preview = {
  document: OperationalReportDocument;
  pageCount: number;
  renderPage: (index: number) => Promise<Blob>;
};

const previewError = "تعذر عرض معاينة التقرير. تفاصيله متاحة بالأسفل.";

export function ReportExportPreview({ document, id }: {
  readonly document: OperationalReportDocument;
  readonly id?: string;
}) {
  const headingId = useId();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [error, setError] = useState<OperationalReportDocument | null>(null);
  const [image, setImage] = useState<{ preview: Preview; page: number; url: string } | null>(null);
  const current = preview?.document === document ? preview : null;
  const url = image && image.preview === current && image.page === page ? image.url : null;

  useEffect(() => {
    let cancelled = false;
    async function prepare() {
      const renderer = await import("@ledger/statement-export");
      if (cancelled) return;
      let pageCount = 1;
      let renderPage: Preview["renderPage"];
      try {
        const layout = renderer.createOperationalReportImageLayout(document);
        renderPage = () => renderer.renderOperationalReportLayoutPng(layout);
      } catch {
        const pages = renderer.paginateOperationalReportForPdf(document, { maxPages: Infinity });
        pageCount = pages.length;
        renderPage = async index => renderer.renderOperationalReportLayoutPng(renderer.createOperationalReportImageLayout(pages[index]!, {
          fixedHeight: renderer.OPERATIONAL_REPORT_PAGE_HEIGHT,
          pageLabel: `صفحة ${index + 1} من ${pages.length}`,
        }));
      }
      setPage(0);
      setPreview({ document, pageCount, renderPage });
    }
    void prepare().catch(() => { if (!cancelled) setError(document); });
    return () => { cancelled = true; };
  }, [document]);

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    let objectUrl: string | undefined;
    void current.renderPage(page).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setImage({ preview: current, page, url: objectUrl });
    }).catch(() => { if (!cancelled) setError(document); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current, document, page]);

  function goToPage(index: number) {
    setError(null);
    setPage(index);
  }

  return <section id={id} tabIndex={id ? -1 : undefined} aria-labelledby={headingId} className={styles.preview}>
    <h3 id={headingId}>معاينة التقرير</h3>
    {current && current.pageCount > 1 && <div className={styles.pagination}>
      <button type="button" disabled={page === 0} onClick={() => goToPage(page - 1)}>الصفحة السابقة</button>
      <span aria-live="polite">صفحة {page + 1} من {current.pageCount}</span>
      <button type="button" disabled={page + 1 === current.pageCount} onClick={() => goToPage(page + 1)}>الصفحة التالية</button>
    </div>}
    {current && error !== document && <button type="button" className={styles.zoom} aria-pressed={zoomed}
      onClick={() => setZoomed(!zoomed)}>تكبير المعاينة</button>}
    {error === document ? <p role="status">{previewError}</p> : url ?
      <div className={styles.viewport} role="region" aria-label="صورة التقرير" tabIndex={zoomed ? 0 : undefined}>
        {/* The browser generates this image locally from the same document as the export. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={document.title} className={zoomed ? `${styles.image} ${styles.zoomed}` : styles.image}
          onError={() => setError(document)} />
      </div> : <p role="status">جارٍ تجهيز معاينة التقرير…</p>}
  </section>;
}
