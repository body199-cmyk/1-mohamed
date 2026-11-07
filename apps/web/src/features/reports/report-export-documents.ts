import { formatEgpFromPiastres } from "@ledger/accounting";
import type { DemoTripRecord } from "../../demo/demo-types";
import type { DailyWorkReport } from "./daily-work-report";
import type { VehicleCashReport } from "./vehicle-cash-report";
import type { OperationalReportDocument } from "@ledger/statement-export";

type DailyWorkSuccess = Extract<DailyWorkReport, { readonly ok: true }>;
const BUSINESS_NAME = "أحمد أبو علي — بيانات تجريبية، ليست كشفًا فعليًا";

function money(piastres: string): string {
  const result = formatEgpFromPiastres(piastres);
  if (!result.ok) throw new Error("قيمة مالية غير صالحة؛ تم إيقاف التصدير.");
  return result.amount + " ج.م";
}

function generatedAtCairo(): string {
  return new Intl.DateTimeFormat("ar-EG", {
    timeZone: "Africa/Cairo", dateStyle: "medium", timeStyle: "short",
  }).format(new Date());
}

export function toDailyWorkOperationalReport(
  report: DailyWorkSuccess,
  filters: {
    readonly workDate: string;
    readonly contractorLabel: string;
    readonly vehicleLabel: string;
    readonly contractorNames: ReadonlyMap<string, string>;
    readonly vehiclePlates: ReadonlyMap<string, string>;
  },
): OperationalReportDocument {
  const totals = (label: string, value: DailyWorkSuccess["totals"]) => ({
    title: label,
    metrics: [
      { label: "عدد النقلات", value: String(value.tripCount), direction: "ltr" as const },
      { label: "إجمالي الوزن", value: value.totalWeightTonnes + " طن", direction: "ltr" as const },
      { label: "قيمة شغل المقاول", value: money(value.contractorTotalPiastres), direction: "ltr" as const },
      { label: "مستحق العربيات", value: money(value.vehicleTotalPiastres), direction: "ltr" as const },
    ],
  });
  return {
    businessName: BUSINESS_NAME,
    title: "تقرير الشغل اليومي",
    subtitle: "حجم شغل واستحقاقات النقلات فقط؛ لا يمثل رصيد فرق الشغل أو النقد بعد الدفعات.",
    generatedAtLabel: generatedAtCairo(),
    metadata: [
      { label: "تاريخ التقرير", value: filters.workDate, direction: "ltr" },
      { label: "المقاول", value: filters.contractorLabel },
      { label: "العربية", value: filters.vehicleLabel },
    ],
    summarySections: [
      totals("إجمالي اليوم المحدد", report.totals),
      totals("شغل أحمد للطرف الآخر", report.ahmedSupplies),
      totals("شغل الطرف الآخر لأحمد", report.otherSupplies),
    ],
    columns: [
      { label: "رقم النقلة", direction: "ltr", widthWeight: 1.05 },
      { label: "المقاول", widthWeight: 1.25 },
      { label: "العربية", widthWeight: 1.05 },
      { label: "الاتجاه", widthWeight: 1.1 },
      { label: "من / إلى", widthWeight: 1.5 },
      { label: "الوزن (طن)", direction: "ltr", widthWeight: 0.8 },
      { label: "قيمة شغل المقاول", direction: "ltr", widthWeight: 1.25 },
      { label: "مستحق العربية", direction: "ltr", widthWeight: 1.2 },
      { label: "رقم الإيصال", direction: "ltr", widthWeight: 0.8 },
    ],
    rows: report.rows.map(trip => [
      trip.id,
      filters.contractorNames.get(trip.counterpartyId) ?? trip.counterpartyId,
      filters.vehiclePlates.get(trip.vehicleId) ?? trip.vehicleId,
      trip.direction === "AHMED_SUPPLIES" ? "شغل أحمد" : "شغل المقاول",
      (trip.origin || "—") + " / " + (trip.destination || "—"),
      trip.weightTonnes,
      money(trip.contractorTotalPiastres),
      money(trip.vehicleTotalPiastres),
      trip.receiptNumber || "—",
    ]),
    emptyMessage: "لا توجد نقلات في اليوم والفلاتر المحددة.",
    footerNotes: [
      "كل نقلة تظهر مرة واحدة. لا تُضاف افتتاحيات النقد ولا تُخصم دفعات في هذا التقرير.",
      "التقرير من معاينة DemoStore في الجلسة الحالية؛ لا يمثل بيانات محفوظة دائمًا.",
    ],
  };
}

export function toVehicleCashOperationalReport(
  report: VehicleCashReport,
  labels: {
    readonly vehicleLabel: string;
    readonly responsibleName: string;
    readonly tripLookup: ReadonlyMap<string, DemoTripRecord>;
  },
): OperationalReportDocument {
  return {
    businessName: BUSINESS_NAME,
    title: "كشف حساب نقد العربية",
    subtitle: "المستحق والمدفوع والمتبقي للعربية عند المقاول المسؤول عن النقد؛ منفصل عن فرق شغل المقاولين.",
    generatedAtLabel: generatedAtCairo(),
    metadata: [
      { label: "المقاول المسؤول", value: labels.responsibleName },
      { label: "العربية", value: labels.vehicleLabel },
      { label: "من تاريخ", value: report.from, direction: "ltr" },
      { label: "إلى تاريخ", value: report.to, direction: "ltr" },
    ],
    summarySections: [{
      title: "ملخص كشف نقد العربية",
      metrics: [
        { label: "الرصيد السابق للفترة", value: money(report.openingPiastres), direction: "ltr" },
        { label: "مستحق شغل العربية", value: money(report.workPiastres), direction: "ltr" },
        { label: "الدفعات خلال الفترة", value: money(report.paidPiastres), direction: "ltr" },
        { label: "المتبقي آخر الفترة", value: money(report.closingPiastres), direction: "ltr", emphasis: true },
        { label: "عدد النقلات", value: String(report.tripCount), direction: "ltr" },
        { label: "عدد الدفعات السارية", value: String(report.paymentCount), direction: "ltr" },
      ],
    }],
    columns: [
      { label: "تاريخ الحركة", direction: "ltr", widthWeight: 1.1 },
      { label: "النوع", widthWeight: 1.15 },
      { label: "البيان / الإيصال", widthWeight: 1.8 },
      { label: "خط السير", widthWeight: 1.55 },
      { label: "اتجاه الشغل", widthWeight: 1.7 },
      { label: "حركة (+ مستحق / - دفعة)", direction: "ltr", widthWeight: 1.4 },
      { label: "الرصيد بعد الحركة", direction: "ltr", widthWeight: 1.3 },
    ],
    rows: report.rows.map(row => {
      const trip = row.type === "WORK" ? labels.tripLookup.get(row.id) : undefined;
      return [
        row.date,
        row.type === "WORK" ? "مستحق نقلة" : "دفعة نقدية",
        row.label,
        trip ? (trip.origin || "—") + " ← " + (trip.destination || "—") : "—",
        trip ? (trip.direction === "AHMED_SUPPLIES" ? "أحمد جاب العربية" : "المقاول جاب العربية") : "—",
        money(row.amountPiastres),
        money(row.balancePiastres),
      ];
    }),
    emptyMessage: "لا توجد حركات في الفترة المحددة؛ يظل الرصيد السابق والختامي ظاهرين في الملخص.",
    footerNotes: [
      "الدفعة تُحسب بتاريخ دفعها الحقيقي؛ الدفعات الملغاة لا تُخصم مرتين. الرصيد السابق ليس افتتاحيًا جديدًا.",
      "التقرير من معاينة DemoStore في الجلسة الحالية؛ لا يمثل بيانات محفوظة دائمًا.",
    ],
  };
}
