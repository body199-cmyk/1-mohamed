import {test,expect,type Page} from '@playwright/test';
import {calculateTripAmounts} from '../../packages/accounting/src/trip-amounts';

type Request={operation:string;payload:Record<string,string>;requestKey:string};
async function fixture(page:Page){
 const contractors=[{id:'OWNER',name:'أحمد',is_primary:true,is_archived:false,version:1},
  {id:'C1',name:'شركة النور',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',is_archived:false,version:1}];
 const attempts:Request[]=[];const rows:Record<string,unknown>[]=[];
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:type==='contractors'?contractors:type==='vehicles'?vehicles:[],hasMore:false}});
 });
 await page.route('**/api/ledger/read',route=>{
  const q=route.request().postDataJSON().payload;
  const selected=rows.filter(row=>String(row.trip_date)>=q.date_from&&String(row.trip_date)<=q.date_to);
  return route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',rows:selected,total_count:String(selected.length),next_cursor:null}}});
 });
 await page.route('**/api/ledger/operations',route=>{
  const body=route.request().postDataJSON() as Request;attempts.push(body);
  if(body.operation==='contractor.create')contractors.push({id:body.payload.id,name:body.payload.name,is_primary:false,is_archived:false,version:1});
  if(body.operation==='trip.create'){
   const p=body.payload;
   const totals=calculateTripAmounts({weightTonnes:p.weight_tonnes,contractorRateEgp:p.contractor_rate_egp,vehicleRateEgp:p.vehicle_rate_egp,expenseEgp:p.expense_egp});
   if(!totals.ok)throw new Error('Invalid fixture trip');
   rows.push({...p,trip_date:p.trip_date,weight_milli_tonnes:String(BigInt(p.weight_tonnes)*1000n),
    contractor_rate_piastres:String(BigInt(p.contractor_rate_egp)*100n),vehicle_rate_piastres:String(BigInt(p.vehicle_rate_egp)*100n),
    expense_piastres:String(BigInt(p.expense_egp)*100n),contractor_total_piastres:totals.contractorTotalPiastres,
    vehicle_total_piastres:totals.vehicleTotalPiastres,responsible_contractor_id:p.direction==='AHMED_SUPPLIES'?'OWNER':p.counterparty_contractor_id,is_cancelled:false});
  }
  return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 await page.goto('/');await expect(page.locator('#shared-contractor option[value="C1"]')).toHaveCount(1);
 return {attempts,rows,contractors,vehicles};
}
async function shared(page:Page,rate='100',expectApplied=true){
 await page.locator('#shared-contractor').selectOption('C1');
 await page.locator('#shared-date').fill('2026-11-16');
 await page.locator('#shared-contractor-rate').fill(rate);
 await page.locator('#shared-origin').fill('بني سويف');await page.locator('#shared-destination').fill('القاهرة');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();
 if(expectApplied)await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('شركة النور');
}
async function nextTrip(page:Page){
 await page.locator('#real-trip-vehicle').selectOption('V1');await page.locator('#real-trip-weight').fill('2');
}
const save=(page:Page)=>page.getByRole('button',{name:'حفظ وإضافة نقلة جديدة',exact:true});
const overrides=(page:Page)=>page.locator('summary').filter({hasText:'تفاصيل وأسعار مختلفة لهذه النقلة فقط'}).click();

test('ten independent trips reuse common data, accept one override, and reset private fields',async({page})=>{
 const {attempts,rows}=await fixture(page);await shared(page);
 for(let i=0;i<10;i++){
  await nextTrip(page);
  if(i===3){await overrides(page);await page.locator('#real-trip-contractor-rate').fill('150');await page.locator('#real-trip-expense').fill('10');}
  await save(page).click();await expect.poll(()=>attempts.length).toBe(i+1);
  await expect(page.locator('#real-trip-vehicle')).toHaveValue('');await expect(page.locator('#real-trip-weight')).toHaveValue('');
  await expect(page.locator('#real-trip-expense')).toHaveValue('0');await expect(page.locator('#real-trip-contractor-rate')).toHaveValue('100');
  await expect(page.locator('#real-trip-vehicle')).toBeFocused();
 }
 expect(new Set(attempts.map(r=>r.payload.id)).size).toBe(10);
 expect(new Set(attempts.map(r=>r.requestKey)).size).toBe(10);
 expect(attempts[3].payload).toMatchObject({vehicle_id:'V1',weight_tonnes:'2',contractor_rate_egp:'150',expense_egp:'10',origin:'بني سويف'});
 expect(attempts[4].payload.contractor_rate_egp).toBe('100');expect(rows).toHaveLength(10);
 const recorded=page.getByLabel('النقلات المسجلة في اليومية');await expect(recorded).toContainText('10 نقلة');await expect(recorded).toContainText('20.000 طن');
 await expect(page.getByLabel('تسجيل نقلة',{exact:true})).toContainText('المسجّل في التاريخ المختار: 10 نقلة');
});

test('editing shared draft cannot mutate active trip; cancel and explicit replacement preserve history',async({page})=>{
 const {attempts,rows}=await fixture(page);await shared(page);await nextTrip(page);await save(page).click();
 await expect.poll(()=>rows.length).toBe(1);await nextTrip(page);
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();
 await page.locator('#shared-contractor-rate').fill('200');
 await expect(page.locator('#real-trip-contractor-rate')).toHaveValue('100');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();
 await expect(page.getByRole('button',{name:'تأكيد استبدال المسودة'})).toBeFocused();
 await page.getByRole('button',{name:'الاحتفاظ بالمسودة'}).click();
 await expect(page.locator('#real-trip-weight')).toHaveValue('2');
 await page.getByRole('button',{name:'إلغاء تعديل المشترك'}).click();
 await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('100');
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();
 await page.locator('#shared-contractor-rate').fill('200');await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();
 await page.getByRole('button',{name:'تأكيد استبدال المسودة'}).click();
 await expect(page.locator('#real-trip-weight')).toHaveValue('');await nextTrip(page);await save(page).click();
 await expect.poll(()=>attempts.length).toBe(2);expect(attempts[0].payload.contractor_rate_egp).toBe('100');expect(attempts[1].payload.contractor_rate_egp).toBe('200');
});

test('manual date-only draft is protected; a new context requires confirmation and does not write',async({page})=>{
 const {attempts}=await fixture(page);await page.locator('#real-trip-date').fill('2026-11-15');
 await shared(page,'100',false);
 await expect(page.getByRole('button',{name:'تأكيد استبدال المسودة'})).toBeVisible();
 await page.getByRole('button',{name:'الاحتفاظ بالمسودة'}).click();await expect(page.locator('#real-trip-date')).toHaveValue('2026-11-15');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();await page.getByRole('button',{name:'تأكيد استبدال المسودة'}).click();
 await nextTrip(page);await page.getByRole('button',{name:'بدء شغل ببيانات مختلفة',exact:true}).click();
 await page.getByRole('button',{name:'الاحتفاظ بالمسودة'}).click();await expect(page.locator('#real-trip-weight')).toHaveValue('2');
 await page.getByRole('button',{name:'بدء شغل ببيانات مختلفة',exact:true}).click();await page.getByRole('button',{name:'تأكيد استبدال المسودة'}).click();
 await expect(page.locator('#shared-contractor')).toHaveValue('');await expect(page.locator('#real-trip-weight')).toHaveValue('');expect(attempts).toHaveLength(0);
});

test('failed and unauthorized writes retain shared/private drafts and retry identity',async({page})=>{
 await fixture(page);await shared(page);await nextTrip(page);const writes:Request[]=[];
 await page.route('**/api/ledger/operations',route=>{writes.push(route.request().postDataJSON());
  return route.fulfill(writes.length===1?{status:401,json:{ok:false,error:'غير مصرح بالدخول.'}}:{json:{ok:true,data:{status:'OK'}}});});
 await save(page).click();await expect(page.getByText('غير مصرح بالدخول.',{exact:true})).toBeVisible();
 await expect(page.locator('#real-trip-weight')).toHaveValue('2');await expect(page.getByLabel('ملخص الشغل المعتمد')).toBeVisible();
 await save(page).click();await expect.poll(()=>writes.length).toBe(2);expect(writes[1]).toEqual(writes[0]);
 await expect(page.locator('#real-trip-weight')).toHaveValue('');
});

test('shared contractor quick-add does not affect trip until apply; cancelled context cannot leak',async({page})=>{
 await fixture(page);await shared(page);await nextTrip(page);
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();
 await page.getByRole('button',{name:'+ مقاول جديد للمشترك',exact:true}).click();
 await page.locator('#quick-name').fill('شركة جديدة');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 await expect(page.locator('#shared-contractor')).not.toHaveValue('C1');await expect(page.locator('#real-trip-counterparty')).toHaveValue('C1');
 await page.getByRole('button',{name:'إلغاء تعديل المشترك'}).click();
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();
 await page.getByRole('button',{name:'+ مقاول جديد للمشترك',exact:true}).click();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'إلغاء تعديل المشترك'}).click();await overrides(page);
 await page.locator('#real-trip-counterparty-add').click();await page.locator('#quick-name').fill('شركة منفردة');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 await expect(page.locator('#real-trip-counterparty')).not.toHaveValue('C1');
 await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('شركة النور');
 await expect(page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true})).toBeVisible();
});

test('save and exit retains common context and daily history opens the same date in reports',async({page})=>{
 await fixture(page);await shared(page);await nextTrip(page);
 await page.getByRole('button',{name:'حفظ وخروج',exact:true}).click();
 await expect(page.getByRole('button',{name:'تسجيل شغل أو دفعة',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'تسجيل شغل أو دفعة',exact:true}).click();await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('شركة النور');
 await page.getByRole('button',{name:'فتح هذا اليوم في التقارير للتعديل أو الإلغاء'}).click();
 await expect(page.getByTestId('workspace-title')).toHaveText('التقارير والكشوف');
 await expect(page.locator('#report-from')).toHaveValue('2026-11-16');await expect(page.locator('#report-to')).toHaveValue('2026-11-16');
});


test('confirmed shared creation with failed refresh cannot retarget a trip after pending modal cancellation',async({page})=>{
 const {contractors,vehicles}=await fixture(page);await shared(page);await nextTrip(page);let fail=false;
 await page.route('**/api/ledger/master?**',route=>{
  if(fail)return route.fulfill({status:500,json:{ok:false,error:'تعذر التحديث التجريبي'}});
  const kind=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:kind==='contractors'?contractors:kind==='vehicles'?vehicles:[],hasMore:false}});
 });
 await page.route('**/api/ledger/operations',route=>{
  const body=route.request().postDataJSON();
  contractors.push({id:body.payload.id,name:body.payload.name,is_primary:false,is_archived:false,version:1});
  fail=true;return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();
 await page.getByRole('button',{name:'+ مقاول جديد للمشترك',exact:true}).click();
 await page.locator('#quick-name').fill('شركة تأخر تحديثها');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('في انتظار تحديث القوائم');
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 fail=false;await page.getByRole('button',{name:'تحديث البيانات',exact:true}).click();
 await expect(page.locator('#shared-contractor option')).toHaveCount(3);
 await expect(page.locator('#real-trip-counterparty')).toHaveValue('C1');
 await expect(page.locator('#real-trip-weight')).toHaveValue('2');
 await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('شركة النور');
});
