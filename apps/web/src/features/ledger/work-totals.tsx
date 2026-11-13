import { piastresToPounds, scaledIntegerToDecimal } from "../../lib/ledger/amounts";
export function WorkTotals({totals}:{totals:Record<string,string>}) {
  try {
    return <section aria-label="ملخص الشغل" className="ledgerMetrics">
      <p>النقلات النشطة <strong>{totals.active_count}</strong></p>
      <p>الوزن بالطن <strong>{scaledIntegerToDecimal(totals.weight_milli_tonnes,3)}</strong></p>
      <p>قيمة شغل المقاولين <strong>{piastresToPounds(totals.contractor_total_piastres)} ج.م</strong></p>
      <p>مستحقات العربيات <strong>{piastresToPounds(totals.vehicle_total_piastres)} ج.م</strong></p>
      <p>شغل أحمد <strong>{piastresToPounds(totals.ahmed_work_piastres)} ج.م</strong></p>
      <p>شغل المقاول <strong>{piastresToPounds(totals.counterparty_work_piastres)} ج.م</strong></p>
      <small>حجم الشغل في الفترة المحددة؛ ليس رصيد دين أو نقدية مدفوعة. الملغى مستبعد.</small>
    </section>;
  } catch {return <p role="alert">ملخص الشغل غير صالح. أعد تحميل التقرير.</p>;}
}
