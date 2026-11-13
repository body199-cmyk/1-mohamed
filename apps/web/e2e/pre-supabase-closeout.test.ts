import {describe,it,expect} from 'vitest';
import {assertReportPage,mergeReportPage} from '../src/features/ledger/report-snapshot';
import {verifyCashReport,cashStatementDocument,type CashReport} from '../src/features/ledger/cash-statement-document';
import {assertDecimal,poundsToPiastres} from '../src/lib/ledger/amounts';
import {buildDetailedContractorDocument,emptyStatementFilters} from '../src/features/ledger/contractor-detail-document';
import type {LiveStatementReport} from '../src/features/ledger/contractor-statement-document';
const page={status:'OK',snapshot:'1:1',total_count:'2',rows:[{id:'a'}],next_cursor:{id:'a',date:'2026-01-01'}};
describe('report snapshot integrity',()=>{
 it('rejects metadata-only edits, repeated IDs, omitted rows and unsafe counts',()=>{
  expect(()=>mergeReportPage(page,{...page,snapshot:'2:2',rows:[{id:'b'}],next_cursor:null})).toThrow(/تغيرت/);
  expect(()=>mergeReportPage(page,{...page,rows:[{id:'a'}],next_cursor:null})).toThrow(/مكررة/);
  expect(()=>assertReportPage({...page,total_count:'3',next_cursor:null})).toThrow();
  expect(()=>assertReportPage({...page,total_count:9007199254740992})).toThrow();
 });
 it('preserves 201 rows without truncation across pages',()=>{
  const first={...page,total_count:'201',rows:Array.from({length:200},(_,i)=>({id:'T'+i}))};
  const result=mergeReportPage(first,{...first,rows:[{id:'T200'}],next_cursor:null});
  expect(result.rows).toHaveLength(201);expect(result.next_cursor).toBeNull();
 });
});
const cash:CashReport={status:'OK',snapshot:'1:1',total_count:'2',next_cursor:null,date_from:'2026-01-01',date_to:'2026-01-02',
 vehicle_id:'V',responsible_contractor_id:'K',period_opening_piastres:'-5000',work_piastres:'10000',paid_piastres:'2000',
 period_closing_piastres:'3000',current_cash_balance_piastres:'9007199254740993123',rows:[
 {id:'same',date:'2026-01-01',movement_type:'WORK',signed_delta_piastres:'10000',running_balance_piastres:'5000'},
 {id:'same',date:'2026-01-02',movement_type:'PAYMENT',signed_delta_piastres:'-2000',running_balance_piastres:'3000'}]};
describe('cash statement document',()=>{
 it('keeps negative correction, separate source IDs and exact amounts',()=>{
  expect(()=>verifyCashReport(cash)).not.toThrow();const doc=cashStatementDocument(cash,'عربية','المقاول');
  expect(doc.rows).toHaveLength(2);expect(doc.rows[1]).toContain('-20.00');
  expect(doc.summarySections[0].metrics.at(-1)?.value).toBe('90071992547409931.23 ج.م');
 });
 it('fails closed on broken running balances and partial exports',()=>{
  expect(()=>verifyCashReport({...cash,rows:[cash.rows[0],{...cash.rows[1],running_balance_piastres:'3001'}]})).toThrow();
  expect(()=>cashStatementDocument({...cash,next_cursor:{id:'same'}},'V','K')).toThrow();
 });
});
describe('Arabic canonical input',()=>{
 it('accepts Arabic/Persian digits without losing precision',()=>{
  expect(assertDecimal('١٢٫٥٠٠',3,true)).toBe('12.500');expect(poundsToPiastres('-۱۲٫۵۰')).toBe('-1250');
  expect(()=>assertDecimal('١٫٠٠١',2,true)).toThrow();expect(()=>poundsToPiastres('٩٢٢٣٣٧٢٠٣٦٨٥٤٧٧٥٨٫٠٨')).toThrow();
 });
});
const statement:LiveStatementReport={status:'OK',snapshot:'1:1',counterparty_contractor_id:'K',date_from:'2026-01-01',date_to:'2026-01-31',opening_balance_piastres:'10000',ahmed_work_piastres:'20000',counterparty_work_piastres:'5000',closing_balance_piastres:'25000',beneficiary:'AHMED',balance_magnitude_piastres:'25000',total_count:'2',next_cursor:null,rows:[
 {id:'T1',trip_date:'2026-01-02',vehicle_id:'V1',origin:'القاهرة',destination:'السويس',notes:null,direction:'AHMED_SUPPLIES',weight_milli_tonnes:'1000',contractor_total_piastres:'20000',signed_delta_piastres:'20000',running_balance_piastres:'30000'},
 {id:'T2',trip_date:'2026-01-03',vehicle_id:'V2',origin:'الجيزة',destination:'الفيوم',notes:'مراجعة',direction:'OTHER_SUPPLIES',weight_milli_tonnes:'1000',contractor_total_piastres:'5000',signed_delta_piastres:'-5000',running_balance_piastres:'25000'}]};
describe('contractor filtered statement',()=>{
 it('separates filtered subtotal from full debt and exports every detail',()=>{
  const doc=buildDetailedContractorDocument(statement,'المقاول',new Map([['V2','عربية ٢']]),{...emptyStatementFilters,vehicle:'V2'});
  expect(doc.rows).toHaveLength(1);expect(doc.rows[0]).toContain('عربية ٢');expect(doc.rows[0]).toContain('الفيوم');expect(doc.rows[0]).toContain('مراجعة');
  expect(doc.summarySections[0].metrics.find(m=>m.label==='آخر الفترة')?.value).toBe('+250.00 ج.م');
  expect(doc.summarySections[1].metrics.at(-1)?.value).toBe('-50.00 ج.م');
 });
 it('never filters an incomplete history into a seemingly complete statement',()=>{
  expect(()=>buildDetailedContractorDocument({...statement,rows:[statement.rows[0]],next_cursor:{id:'T1',date:'2026-01-02'}},'K',new Map(),emptyStatementFilters)).toThrow();
 });
});
