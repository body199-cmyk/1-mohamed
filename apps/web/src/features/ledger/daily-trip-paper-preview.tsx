"use client";

import { useEffect, useMemo, useState } from "react";
import { postLedgerRead } from "../../lib/ledger/transport";
import { ReportExportPreview } from "../reports/report-export-preview";
import {
  buildRealOperationalDocument, isFullOperationalReport, styleRealOperationalExport,
} from "./real-operational-document";
import { mergeReportPage, type ReportPage } from "./report-snapshot";

/**
 * The daily list stays paginated for its familiar controls. Its decorative paper
 * preview must instead represent the *whole* selected day and one SQL snapshot.
 * Never paint a partial/failed snapshot as a complete report.
 */
export function DailyTripPaperPreview({ day, firstPage, vehicles, contractors }: {
  readonly day: string;
  readonly firstPage: ReportPage;
  readonly vehicles: { id: string; plate_number: string }[];
  readonly contractors: { id: string; name: string }[];
}) {
  const [complete, setComplete] = useState<ReportPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setComplete(null);
    setLoading(true);
    setError("");
    async function collectDay() {
      try {
        let collected = firstPage;
        while (collected.next_cursor) {
          const response = await postLedgerRead<ReportPage>("trips.list", {
            date_from: day, date_to: day, include_cancelled: false, limit: 200,
            cursor: collected.next_cursor, snapshot: collected.snapshot,
          }, controller.signal);
          if (!response.ok) throw new Error(response.error);
          collected = mergeReportPage(collected, response.data);
        }
        if (!isFullOperationalReport(collected)) {
          throw new Error("لم تكتمل بيانات اليوم، لذلك لن تظهر معاينة ناقصة.");
        }
        if (active) setComplete(collected);
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "تعذر تجهيز معاينة نقلات اليوم.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void collectDay();
    return () => { active = false; controller.abort(); };
  }, [day, firstPage]);

  const paper = useMemo(() => {
    if (!complete) return null;
    try {
      const fullDocument = buildRealOperationalDocument("trips.list", complete, {
        vehicles: new Map(vehicles.map(vehicle => [vehicle.id, vehicle.plate_number])),
        contractors: new Map(contractors.map(contractor => [contractor.id, contractor.name])),
      }, day, day, new Intl.DateTimeFormat("ar-EG", {
        timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short",
      }).format(new Date()));
      return styleRealOperationalExport(fullDocument, "trips.list");
    } catch {
      return null;
    }
  }, [complete, vehicles, contractors, day]);

  return <section aria-label="المعاينة المنسقة لنقلات اليوم">
    <h3>التقرير المنسّق لنقلات اليوم</h3>
    {loading && <p role="status">جارٍ تجهيز معاينة جميع نقلات اليوم…</p>}
    {error && <p role="status">تعذر عرض المعاينة المنسقة: {error} يمكنك متابعة السجلات بالعرض المعتاد بالأسفل.</p>}
    {!loading && !error && !paper && <p role="status">تعذر تجهيز معاينة مكتملة لهذا اليوم. العرض المعتاد متاح بالأسفل.</p>}
    {!loading && paper && <ReportExportPreview document={paper} />}
  </section>;
}
