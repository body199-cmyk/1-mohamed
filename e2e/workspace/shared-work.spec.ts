import {openTripExpense,restoreShared} from './support/entry-controls';
import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
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
  if(i===3){await overrides(page);await page.locator('#real-trip-contractor-rate').fill('150');await openTripExpense(page);await page.locator('#real-trip-expense').fill('10');}
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


test('same vehicle on same day with different contractors remains two report records and one vehicle',async({page})=>{
 const {contractors,attempts}=await fixture(page);
 contractors.push({id:'C2',name:'شركة ثانية',is_primary:false,is_archived:false,version:1});
 await page.getByRole('button',{name:'تحديث البيانات',exact:true}).click();
 await shared(page);await nextTrip(page);await save(page).click();await expect(page.locator('#real-trip-weight')).toHaveValue('');
 await page.getByRole('button',{name:'تغيير بيانات الشغل',exact:true}).click();await page.locator('#shared-contractor').selectOption('C2');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();await nextTrip(page);await save(page).click();
 await expect(page.locator('#real-trip-weight')).toHaveValue('');
 expect(attempts.map(r=>r.payload.counterparty_contractor_id)).toEqual(['C1','C2']);
 expect(attempts[0].payload.id).not.toBe(attempts[1].payload.id);
 const recorded=page.getByLabel('النقلات المسجلة في اليومية');await expect(recorded).toContainText('2 نقلة');await expect(recorded).toContainText('1 عربية ظاهرة');
 await page.getByRole('button',{name:'فتح هذا اليوم في التقارير للتعديل أو الإلغاء'}).click();
 await page.getByRole('button',{name:'تحميل التقرير',exact:true}).click();
 await expect(page.getByLabel('ملخص سجلات التقرير').locator('li')).toHaveCount(2);
 await expect(page.getByLabel('ملخص سجلات التقرير')).toContainText('شركة النور');await expect(page.getByLabel('ملخص سجلات التقرير')).toContainText('شركة ثانية');
});

test('shared date defaults to Cairo today even before UTC midnight and stays editable',async({page})=>{
 await page.clock.install({time:new Date('2026-11-16T23:30:00Z')});await fixture(page);
 await expect(page.locator('#shared-date')).toHaveValue('2026-11-17');
 await page.locator('#shared-date').fill('2026-11-10');await expect(page.locator('#shared-date')).toHaveValue('2026-11-10');
});

async function optionalDefaults(page:Page,expense='20',notes='شغل موقع النور'){
 await page.getByText('مصاريف وملاحظة مشتركة — اختياري',{exact:true}).click();
 await page.locator('#shared-expense').fill(expense);await page.locator('#shared-notes').fill(notes);
}
test('shared expense and note apply per trip, allow overrides and restore defaults only after success',async({page})=>{
 const {attempts}=await fixture(page);await optionalDefaults(page);await shared(page);
 await expect(page.getByLabel('ملخص الشغل المعتمد')).toContainText('مصاريف كل نقلة: 20');
 await nextTrip(page);await openTripExpense(page);await page.locator('#real-trip-expense').fill('35');await overrides(page);await page.locator('#real-trip-notes').fill('استثناء للعربية');
 await save(page).click();await expect(page.locator('#real-trip-weight')).toHaveValue('');
 await expect(page.locator('#real-trip-expense')).toHaveValue('20');await expect(page.locator('#real-trip-notes')).toHaveValue('شغل موقع النور');
 await nextTrip(page);await save(page).click();await expect.poll(()=>attempts.length).toBe(2);
 expect(attempts[0].payload).toMatchObject({expense_egp:'35',notes:'استثناء للعربية'});
 expect(attempts[1].payload).toMatchObject({expense_egp:'20',notes:'شغل موقع النور'});
});
test('invalid shared expense never applies or writes; failed trip retains expense/note and retry identity',async({page})=>{
 const {attempts}=await fixture(page);await optionalDefaults(page,'-5');await shared(page,'100',false);
 await expect(page.getByRole('alert')).toBeVisible();expect(attempts).toHaveLength(0);
 await page.locator('#shared-expense').fill('20');await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();await nextTrip(page);
 await overrides(page);await page.locator('#real-trip-notes').fill('ملاحظة خاصة');const writes:Request[]=[];
 await page.route('**/api/ledger/operations',route=>{writes.push(route.request().postDataJSON());return route.fulfill(writes.length===1?{status:401,json:{ok:false,error:'غير مصرح بالدخول.'}}:{json:{ok:true,data:{status:'OK'}}});});
 await save(page).click();await expect(page.getByText('غير مصرح بالدخول.',{exact:true})).toBeVisible();
 await expect(page.locator('#real-trip-expense')).toHaveValue('20');await expect(page.locator('#real-trip-notes')).toHaveValue('ملاحظة خاصة');
 await save(page).click();await expect.poll(()=>writes.length).toBe(2);expect(writes[0]).toEqual(writes[1]);
 await expect(page.locator('#real-trip-notes')).toHaveValue('شغل موقع النور');
});
test('last approved work restores as a guarded draft with today date and no vehicle/weight/write',async({page})=>{
 await page.clock.install({time:new Date('2026-11-20T12:00:00Z')});const {attempts}=await fixture(page);
 await optionalDefaults(page);await shared(page);await nextTrip(page);
 await restoreShared(page);
 await page.getByRole('button',{name:'الاحتفاظ بالمسودة'}).click();await expect(page.locator('#real-trip-weight')).toHaveValue('2');
 await restoreShared(page);await page.getByRole('button',{name:'تأكيد استبدال المسودة'}).click();
 await expect(page.locator('#shared-date')).toHaveValue('2026-11-20');await expect(page.locator('#real-trip-date')).toHaveValue('2026-11-16');
 await expect(page.locator('#real-trip-weight')).toHaveValue('2');expect(attempts).toHaveLength(0);
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();await page.getByRole('button',{name:'تأكيد استبدال المسودة'}).click();
 await expect(page.locator('#real-trip-weight')).toHaveValue('');await expect(page.locator('#real-trip-vehicle')).toHaveValue('');
 await expect(page.locator('#real-trip-date')).toHaveValue('2026-11-20');await expect(page.locator('#real-trip-expense')).toHaveValue('20');
 await page.getByRole('button',{name:'بدء شغل ببيانات مختلفة',exact:true}).click();
 await expect(page.locator('#real-trip-expense')).toHaveValue('0');await expect(page.locator('#real-trip-notes')).toHaveValue('');
 await restoreShared(page);
 await expect(page.locator('#shared-contractor')).toHaveValue('C1');expect(attempts).toHaveLength(0);
});
test('restoring archived last contractor requires choosing an active contractor before approval',async({page})=>{
 const {contractors,attempts}=await fixture(page);await shared(page);
 contractors.find(c=>c.id==='C1')!.is_archived=true;
 await page.getByRole('button',{name:'تحديث البيانات',exact:true}).click();
 await restoreShared(page);
 await expect(page.locator('#shared-contractor')).toHaveValue('');await expect(page.getByRole('alert')).toContainText('لم يعد متاحًا');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();expect(attempts).toHaveLength(0);
});

for(const mobile of [true,false])for(const dark of [false,true])test(`shared defaults review / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
 const {attempts}=await fixture(page);if(dark)await page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'}).click();
 await optionalDefaults(page);await shared(page);
 await restoreShared(page);
 await page.getByText('مصاريف وملاحظة مشتركة — اختياري',{exact:true}).click();
 const folder='artifacts/ui-review-87/shared-defaults';await mkdir(folder,{recursive:true});
 await page.evaluate(()=>document.fonts.ready);
 await expect(page.locator('#shared-expense')).toHaveValue('20');await expect(page.locator('#shared-notes')).toHaveValue('شغل موقع النور');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('بيانات الشغل المشتركة',{exact:true}).screenshot({path:`${folder}/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}.png`});
 expect(attempts).toHaveLength(0);
});
