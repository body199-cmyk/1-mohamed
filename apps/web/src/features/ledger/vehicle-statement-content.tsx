import {formatPoundsForDisplay as money,scaledIntegerToDecimal as decimal} from '../../lib/ledger/amounts';
import type {CashReport} from './cash-statement-document';
import type {VehicleTrip} from './vehicle-statement-data';
import styles from './statement-design.module.css';
export function VehicleStatementContent({report,trips,vehicle,contractor}:{report:CashReport;trips:ReadonlyMap<string,VehicleTrip>;vehicle:string;contractor:string}){
 const closing=BigInt(report.period_closing_piastres),absolute=closing<0n?-closing:closing;
 const complete=!report.next_cursor;const values=[...trips.values()];
 const tonnes=decimal(values.reduce((n,r)=>n+BigInt(r.weight_milli_tonnes),0n).toString(),3);
 const payments=report.rows.filter(r=>r.movement_type==='PAYMENT');
 return <>
  <header className={styles.identity}><div><h3 id="vehicle-statement-heading" tabIndex={-1}>{vehicle}</h3><p>حساب العربية عند <strong>{contractor}</strong></p></div><p className={styles.period}>{report.date_from} — {report.date_to}</p></header>
  <div aria-label="ملخص نقدية العربية">
   <div className={styles.balance} data-tone={closing<0n?'debit':'neutral'}><span>{closing>0n?'الباقي للعربية آخر الفترة':closing<0n?'المبلغ على العربية آخر الفترة':'الحساب متعادل آخر الفترة'}</span><strong><bdi>{money(absolute.toString())}</bdi> جنيه</strong></div>
   <dl className={styles.metrics}><div><dt>رصيد أول الفترة</dt><dd>{money(report.period_opening_piastres)} ج.م</dd></div><div><dt>مستحق الشغل خلال الفترة</dt><dd>{money(report.work_piastres)} ج.م</dd></div><div><dt>المدفوع خلال الفترة</dt><dd>{money(report.paid_piastres)} ج.م</dd></div></dl>
   <p className={styles.note}>الباقي = السابق + مستحق الشغل − المدفوع. المصاريف المسجلة داخلة في مستحق النقلة.</p>
   <p className={styles.note}>المتبقي الحالي: <strong>{money(report.current_cash_balance_piastres)} جنيه</strong> — {BigInt(report.current_cash_balance_piastres)<0n?'على العربية':BigInt(report.current_cash_balance_piastres)>0n?'للعربية':'متعادل'}. يشمل الحركات خارج الفترة المختارة.</p>
  </div>
  <div className={styles.counts}><span><b>{values.length}</b> {complete?'نقلة في الفترة':'نقلة محمّلة'}</span><span><b>{tonnes}</b> {complete?'طن إجمالي':'طن محمّل'}</span><span><b>{payments.length}</b> {complete?'دفعة':'دفعة محمّلة'}</span></div>
  <h3>نقلات العربية</h3>
  {!values.length&&<p className={styles.empty}>لا توجد نقلات {complete?'في الفترة المختارة.':'ضمن الحركات المحمّلة حتى الآن.'}</p>}
  <ol className={styles.records} aria-label="تفاصيل نقلات العربية">{values.map(t=><li className={styles.record} key={t.id}>
   <div className={styles.recordHead}><h4>{t.trip_date}</h4><strong className={styles.amount}>{money(t.vehicle_total_piastres)} ج.م</strong></div>
   <p className={styles.route}>{t.origin||'غير محدد'} ← {t.destination||'غير محدد'}</p>
   <div className={styles.facts}><span>الوزن: <bdi>{decimal(t.weight_milli_tonnes,3)}</bdi> طن</span><span>سعر الطن: {money(t.vehicle_rate_piastres)} ج.م</span><span>المصاريف: {money(t.expense_piastres)} ج.م</span></div>
   <details><summary>ملاحظات ومرجع النقلة</summary><p>{t.notes||'لا توجد ملاحظات.'}</p><small>{t.id}</small></details>
  </li>)}</ol>
  {complete&&<section className={styles.endTotals} aria-label="إجمالي كشف العربية"><h3>إجمالي كشف العربية</h3><div className={styles.counts}><span>{values.length} نقلة</span><span>{tonnes} طن</span></div><dl className={styles.metrics}><div><dt>إجمالي مستحق الشغل</dt><dd>{money(report.work_piastres)} ج.م</dd></div><div><dt>إجمالي المدفوع</dt><dd>{money(report.paid_piastres)} ج.م</dd></div><div><dt>{closing<0n?'على العربية':'الباقي للعربية'}</dt><dd>{money(absolute.toString())} ج.م</dd></div></dl></section>}
  <h3>الدفعات المستلمة</h3><p className={styles.note}>كل دفعة بتاريخ استلامها؛ لا تُخصم مرة ثانية من قيمة نقلة معينة.</p>
  {!payments.length&&<p className={styles.empty}>لا توجد دفعات في الحركات المعروضة.</p>}
  <ul className={styles.records}>{payments.map(p=><li className={styles.record} key={String(p.id)}><div className={styles.recordHead}><h4>{String(p.date)}</h4><strong className={styles.amount}>{money((-BigInt(String(p.signed_delta_piastres))).toString())} ج.م</strong></div><p>{String(p.notes||'دفعة للعربية')}</p><small>{String(p.id)}</small></li>)}</ul>
  <details className={styles.advanced}><summary>السجل الزمني الكامل — الشغل والدفعات والأرصدة</summary><div className={styles.tableWrap}><table><thead><tr>{['التاريخ','الحركة','المبلغ','الرصيد','خط السير'].map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{report.rows.map(r=><tr key={String(r.movement_type)+r.id}><td>{String(r.date)}</td><td>{r.movement_type==='WORK'?'نقلة':'دفعة'}</td><td>{money(String(r.signed_delta_piastres))}</td><td>{money(String(r.running_balance_piastres))}</td><td>{[r.origin,r.destination].filter(Boolean).join(' ← ')}</td></tr>)}</tbody></table></div></details>
 </>;
}
