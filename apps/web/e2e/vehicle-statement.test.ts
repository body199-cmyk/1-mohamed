import {describe,it,expect,vi,afterEach} from 'vitest';
import {matchVehicleTrips,loadVehicleTrips} from '../src/features/ledger/vehicle-statement-data';
import {vehicleStatementDocument} from '../src/features/ledger/vehicle-statement-document';
import type {CashReport} from '../src/features/ledger/cash-statement-document';
const trip={id:'T1',trip_date:'2026-11-10',vehicle_id:'V1',responsible_contractor_id:'OWNER',counterparty_contractor_id:'C1',weight_milli_tonnes:'12500',vehicle_rate_piastres:'10000',expense_piastres:'5000',vehicle_total_piastres:'130000',is_cancelled:false,origin:'بني سويف',destination:'القاهرة',notes:'نقلة أولى'};
const cash:CashReport={status:'OK',snapshot:'10:10',total_count:'2',next_cursor:null,vehicle_id:'V1',responsible_contractor_id:'OWNER',date_from:'2026-11-01',date_to:'2026-11-16',period_opening_piastres:'10000',work_piastres:'130000',paid_piastres:'40000',period_closing_piastres:'100000',current_cash_balance_piastres:'80000',rows:[{id:'T1',date:'2026-11-10',movement_type:'WORK',signed_delta_piastres:'130000',running_balance_piastres:'140000',origin:'بني سويف',destination:'القاهرة'},{id:'P1',date:'2026-11-11',movement_type:'PAYMENT',signed_delta_piastres:'-40000',running_balance_piastres:'100000'}]};
afterEach(()=>vi.unstubAllGlobals());
describe('vehicle report details preserve account and snapshot',()=>{
 it('uses cash movement IDs and responsible identity, not contractor party or all rows for one vehicle',()=>{
  const result=matchVehicleTrips(cash,[{...trip,id:'OTHER',responsible_contractor_id:'C1'},trip]);expect([...result.keys()]).toEqual(['T1']);
  const doc=vehicleStatementDocument(cash,'عربية1','أحمد',result);expect(doc.rows).toHaveLength(1);expect(doc.rows[0]).toContain('12.500');expect(doc.rows[0]).toContain('100 ج.م');expect(doc.rows[0]).toContain('50 ج.م');expect(doc.rows[0]).toContain('1,300 ج.م');expect(doc.summarySections[1].metrics.find(m=>m.label==='الرصيد الحالي (كل الحساب)')?.value).toBe('800 ج.م');expect(doc.footerNotes).toEqual([]);expect(doc.columns.map(c=>c.label)).toEqual(['تاريخ النقلة','من','إلى','الأطنان','سعر الطن','المصاريف','إجمالي النقلة']);expect(JSON.stringify(doc)).not.toContain('T1');expect(JSON.stringify(doc)).not.toContain('نقلة أولى');expect(doc.summarySections[0].metrics.find(m=>m.label==='الباقي للعربية')?.value).toBe('1,000 ج.م');
 });
 for(const [key,value] of [['responsible_contractor_id','C1'],['vehicle_id','V2'],['trip_date','2026-11-12'],['is_cancelled',true],['vehicle_total_piastres','120000'],['weight_milli_tonnes','1.2']] as const)it('rejects mismatching '+key,()=>expect(()=>matchVehicleTrips(cash,[{...trip,[key]:value}])).toThrow());
 it('keeps payment fields empty when a payment and trip share the same ID',()=>{const sameId={...cash,rows:cash.rows.map(r=>r.movement_type==='PAYMENT'?{...r,id:'T1'}:r)};const doc=vehicleStatementDocument(sameId,'عربية','أحمد',matchVehicleTrips(sameId,[trip]));expect(doc.rows).toHaveLength(1);expect(doc.detailSections![0].rows).toEqual([['2026-11-11','400 ج.م']]);expect(doc.summarySections[1].metrics.find(m=>m.label==='إجمالي الأطنان')?.value).toBe('12.500 طن');expect(JSON.stringify(doc.rows)).not.toContain('نقلة أولى');});
 it('does not export a row with missing work details',()=>expect(()=>matchVehicleTrips(cash,[])).toThrow());
 it('paginates with original vehicle/date/snapshot and never substitutes responsible for party',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ok:true,data:{status:'OK',snapshot:'10:10',total_count:'2',rows:[{...trip,id:'OTHER',responsible_contractor_id:'C1'}],next_cursor:{date:'2026-11-10',id:'OTHER'}}}))).mockResolvedValueOnce(new Response(JSON.stringify({ok:true,data:{status:'OK',snapshot:'10:10',total_count:'2',rows:[trip],next_cursor:null}})));vi.stubGlobal('fetch',fetch);
  expect((await loadVehicleTrips(cash)).get('T1')).toMatchObject(trip);const requests=fetch.mock.calls.map(c=>JSON.parse(c[1].body));expect(requests[0].payload).toMatchObject({vehicle_id:'V1',snapshot:'10:10',include_cancelled:false});expect(requests[0].payload.counterparty_contractor_id).toBeUndefined();expect(requests[1].payload.cursor.id).toBe('OTHER');
 });
 it('rejects changed global snapshots instead of mixing financial and trip details',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,data:{status:'OK',snapshot:'11:11',rows:[trip],total_count:'1',next_cursor:null}}))));await expect(loadVehicleTrips(cash)).rejects.toThrow('تغيرت البيانات');
 });
 it('empty cash ledger needs no supplementary history reads',async()=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);expect((await loadVehicleTrips({...cash,rows:[]})).size).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
});
