import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {createSqlLedger} from './support/sql-ledger';
import {openTripExpense,restoreShared} from './support/entry-controls';

type Sql=Awaited<ReturnType<typeof createSqlLedger>>;
let sql:Sql;
test.beforeEach(async()=>{test.setTimeout(120000);sql=await createSqlLedger();});
test.afterEach(async()=>{await sql?.db.close();});
async function enter(page:Page){const state=await sql.connect(page);await page.goto('/');await expect(page.locator('#shared-contractor option[value="C1"]')).toHaveCount(1);return state;}
async function common(page:Page){
 await page.locator('#shared-contractor').selectOption('C1');await page.locator('#shared-direction').selectOption('AHMED_SUPPLIES');
 await page.locator('#shared-date').fill('2026-11-16');await page.locator('#shared-contractor-rate').fill('100');
 await page.getByLabel('نفس سعر المقاول والعربية في المشترك',{exact:true}).uncheck();await page.locator('#shared-vehicle-rate').fill('80');
 await page.locator('#shared-origin').fill('بني سويف');await page.locator('#shared-destination').fill('القاهرة');
 await expect(page.locator('#shared-expense')).toBeVisible();await expect(page.locator('#shared-notes')).toBeVisible();
 await page.locator('#shared-expense').fill('20');await page.locator('#shared-notes').fill('شغل موقع النور');
 await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();
}
async function trip(page:Page,weight='2.5'){await page.locator('#real-trip-vehicle').selectOption('V1');await page.locator('#real-trip-weight').fill(weight);}
const save=(page:Page)=>page.getByRole('button',{name:'حفظ وإضافة نقلة جديدة',exact:true});
const details=(page:Page)=>page.locator('summary').filter({hasText:'تفاصيل وأسعار مختلفة لهذه النقلة فقط'});
async function saved(count:number){await expect.poll(async()=>Number((await sql.rows('select count(*)::text as n from trips'))[0].n)).toBe(count);}

test('SQL: every shared field and individual override persists, repeated vehicle remains independent after reload',async({page})=>{
 await enter(page);
 await page.locator('#real-payment-account-add').click();await page.locator('#quick-account-vehicle').selectOption('V1');await page.locator('#quick-account-contractor').selectOption('C2');
 await page.getByRole('dialog').getByRole('button',{name:'فتح الحساب',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 await common(page);
 const applied=page.getByLabel('ملخص الشغل المعتمد');await expect(applied.locator('details')).not.toHaveAttribute('open','');
 await expect(page.locator('#real-trip-expense')).toBeHidden();await trip(page);await save(page).click();await saved(1);
 await expect(page.locator('#real-trip-weight')).toHaveValue('');
 expect((await sql.rows(`select trip_date::text,vehicle_id,counterparty_contractor_id,responsible_contractor_id,direction,
  weight_milli_tonnes::text,contractor_rate_piastres::text,vehicle_rate_piastres::text,expense_piastres::text,notes,origin,destination from trips`))[0]).toMatchObject({trip_date:'2026-11-16',vehicle_id:'V1',counterparty_contractor_id:'C1',responsible_contractor_id:'K_AHMED',direction:'AHMED_SUPPLIES',weight_milli_tonnes:'2500',contractor_rate_piastres:'10000',vehicle_rate_piastres:'8000',expense_piastres:'2000',notes:'شغل موقع النور',origin:'بني سويف',destination:'القاهرة'});
 await trip(page,'3');await expect(page.getByLabel('نقلات العربية في اليوم المختار')).toContainText('1 نقلة');
 await openTripExpense(page);await page.locator('#real-trip-expense').fill('35');await details(page).click();
 await page.locator('#real-trip-counterparty-search').fill('ثانية');await page.locator('#real-trip-counterparty').selectOption('C2');
 await page.locator('#real-trip-direction').selectOption('OTHER_SUPPLIES');
 await page.locator('#real-trip-contractor-rate').fill('120');await page.locator('#real-trip-vehicle-rate').fill('90');
 await page.locator('#real-trip-origin').fill('المنيا');await page.locator('#real-trip-destination').fill('الجيزة');await page.locator('#real-trip-notes').fill('نقلة خاصة');
 await save(page).click();await saved(2);await expect(page.locator('#real-trip-weight')).toHaveValue('');
 expect((await sql.rows("select * from trips where counterparty_contractor_id='C2'"))[0]).toMatchObject({responsible_contractor_id:'C2',notes:'نقلة خاصة',origin:'المنيا',destination:'الجيزة',expense_piastres:3500});
 await expect(page.locator('#real-trip-expense')).toHaveValue('20');await expect(page.locator('#real-trip-notes')).toHaveValue('شغل موقع النور');
 await expect(page.locator('#real-trip-expense')).toBeHidden();
 await trip(page);await expect(page.getByLabel('نقلات العربية في اليوم المختار')).toContainText('2 نقلة');
 await page.locator('#real-trip-vehicle').selectOption('V2');await expect(page.getByLabel('نقلات العربية في اليوم المختار')).toContainText('لا توجد نقلات');
 await page.reload();await expect(page.locator('#shared-contractor option[value="C1"]')).toHaveCount(1);
 await page.locator('#daily-recorded-date').fill('2026-11-16');await page.getByRole('button',{name:'عرض المسجّل لهذا اليوم',exact:true}).click();
 const recorded=page.getByLabel('النقلات المسجلة في اليومية');await expect(recorded).toContainText('2 نقلة');await expect(recorded).toContainText('1 عربية ظاهرة');
 await page.getByRole('button',{name:'إدخال نقلة منفردة',exact:true}).click();
 await page.locator('#real-trip-vehicle-search').fill('١');await page.locator('#real-trip-vehicle').selectOption('V1');await page.locator('#real-trip-weight').fill('1');
 await page.locator('#real-trip-counterparty').selectOption('C1');await page.locator('#real-trip-date').fill('2026-11-15');
 await page.locator('#real-trip-contractor-rate').fill('50');await page.getByLabel('نفس سعر المقاول والعربية',{exact:true}).check();
 await page.locator('#real-trip-origin').fill('أسيوط');await page.locator('#real-trip-destination').fill('سوهاج');
 await page.getByLabel('استخدام نفس بيانات اليوم للنقلة التالية (اختياري)',{exact:true}).check();
 await save(page).click();await saved(3);await expect(page.locator('#real-trip-weight')).toHaveValue('');
 await expect(page.locator('#real-trip-origin')).toHaveValue('أسيوط');await expect(page.locator('#real-trip-vehicle')).toHaveValue('V1');
 await page.locator('#real-trip-weight').fill('1');await page.getByRole('button',{name:'حفظ وخروج',exact:true}).click();await saved(4);
 expect((await sql.rows("select trip_date::text,contractor_rate_piastres::text,vehicle_rate_piastres::text,origin,destination from trips where trip_date='2026-11-15'"))[0]).toMatchObject({trip_date:'2026-11-15',contractor_rate_piastres:'5000',vehicle_rate_piastres:'5000',origin:'أسيوط',destination:'سوهاج'});
 await expect(page.getByRole('button',{name:'تسجيل شغل أو دفعة',exact:true})).toBeVisible();
});

test('SQL: quick contractor old balances both signs and vehicle driver/account/old balance persist from dialogs',async({page})=>{
 await enter(page);
 for(const [side,name,amount] of [['OWED_TO_CONTRACTOR','مقاول له رصيد',-100000],['OWED_TO_AHMED','مقاول عليه رصيد',100000]] as const){
  await page.getByRole('button',{name:'+ مقاول جديد للمشترك',exact:true}).click();await page.locator('#quick-name').fill(name);
  await page.getByLabel('إضافة رصيد قديم (اختياري)',{exact:true}).check();await page.locator('#quick-opening-direction').selectOption(side);
  await page.locator('#quick-opening-amount').fill('1000');await page.locator('#quick-opening-date').fill('2026-11-01');
  await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await sql.rows('select o.signed_piastres::text as amount from opening_balances o join contractors c on c.id=o.contractor_id where c.name=$1',[name]))[0].amount).toBe(String(amount));
 }
 await page.locator('#real-trip-vehicle-add').click();await page.locator('#quick-plate').fill('س ر 9999');await page.locator('#quick-driver').fill('محمود التجريبي');
 await page.getByLabel('إضافة رصيد قديم (اختياري)',{exact:true}).check();await page.locator('#quick-opening-contractor').selectOption('K_AHMED');
 await page.locator('#quick-opening-amount').fill('2000');await page.locator('#quick-opening-date').fill('2026-11-01');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 const vehicle=(await sql.rows("select id,driver_name from vehicles where plate_number='س ر 9999'"))[0];expect(vehicle.driver_name).toBe('محمود التجريبي');
 expect((await sql.rows('select signed_piastres::text as amount,start_date::text from opening_balances where vehicle_id=$1',[vehicle.id]))[0]).toMatchObject({amount:'200000',start_date:'2026-11-01'});
 expect(await sql.rows('select * from vehicle_accounts where vehicle_id=$1 and contractor_id=$2',[vehicle.id,'K_AHMED'])).toHaveLength(1);
 await page.locator('#real-trip-vehicle-add').click();await page.locator('#quick-plate').fill('بدون رصيد 12');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await sql.rows("select * from opening_balances where vehicle_id=(select id from vehicles where plate_number='بدون رصيد 12')")).toHaveLength(0);
});

test('SQL: payment account creation and dated amount/note save, preview and balance readback are real',async({page})=>{
 await enter(page);await page.locator('#real-payment-account').selectOption('V1|K_AHMED');
 await page.locator('#real-payment-date').fill('2026-11-16');await page.locator('#real-payment-amount').fill('100');await page.locator('#real-payment-notes').fill('دفعة تجريبية');
 await expect(page.getByLabel('معاينة رصيد الدفعة')).toContainText('900');
 await page.getByRole('button',{name:'حفظ الدفعة',exact:true}).click();
 await expect.poll(async()=>await sql.rows('select * from payments')).toHaveLength(1);
 expect((await sql.rows('select vehicle_id,responsible_contractor_id,payment_date::text,amount_piastres::text,notes from payments'))[0]).toMatchObject({vehicle_id:'V1',responsible_contractor_id:'K_AHMED',payment_date:'2026-11-16',amount_piastres:'10000',notes:'دفعة تجريبية'});
 expect((await sql.read('payments.list',{vehicle_id:'V1',responsible_contractor_id:'K_AHMED',limit:1})).current_cash_balance_piastres).toBe('90000');
 await page.locator('#real-payment-account-add').click();
 await page.locator('#quick-account-plate').fill('حساب جديد 77');await page.locator('#quick-account-driver').fill('سائق الحساب');await page.locator('#quick-account-name').fill('مقاول حساب جديد');
 await page.getByRole('dialog').getByRole('button',{name:'فتح الحساب',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await sql.rows("select a.* from vehicle_accounts a join vehicles v on v.id=a.vehicle_id join contractors c on c.id=a.contractor_id where v.plate_number='حساب جديد 77' and c.name='مقاول حساب جديد'")).toHaveLength(1);
 await page.locator('#real-payment-date').fill('2026-11-16');await page.locator('#real-payment-amount').fill('50');
 const denied=page.waitForResponse(r=>r.url().includes('/api/ledger/operations'));await page.getByRole('button',{name:'حفظ الدفعة',exact:true}).click();await denied;
 await expect(page.getByRole('button',{name:'حفظ الدفعة',exact:true})).toBeEnabled();expect(await sql.rows('select * from payments')).toHaveLength(1);
});

test('SQL: invalid/unauthorized writes cannot persist; committed response loss retries same identity without duplicate',async({page})=>{
 const state=await enter(page);await common(page);await trip(page,'-1');await save(page).click();expect(await sql.rows('select * from trips')).toHaveLength(0);
 await page.locator('#real-trip-weight').fill('2');state.user='00000000-0000-0000-0000-000000000002';await save(page).click();
 await expect(page.getByText('تعذر حفظ العملية. راجع المدخلات ثم حاول مرة أخرى بنفس مفتاح الطلب.',{exact:true})).toBeVisible();
 expect(await sql.rows('select * from trips')).toHaveLength(0);await expect(page.locator('#real-trip-weight')).toHaveValue('2');
 state.user='00000000-0000-0000-0000-000000000001';state.loseNextTripResponse=true;await save(page).click();await saved(1);
 await expect(page.getByText('انقطع الاتصال ولم تتأكد نتيجة الحفظ. أعد المحاولة بنفس البيانات.',{exact:true})).toBeVisible();
 await save(page).click();await expect(page.locator('#real-trip-weight')).toHaveValue('');expect(await sql.rows('select * from trips')).toHaveLength(1);
 const attempts=state.attempts.filter(a=>a.operation==='trip.create');expect(attempts).toHaveLength(3);expect(attempts[0]).toEqual(attempts[1]);expect(attempts[1]).toEqual(attempts[2]);
 expect(await sql.rows("select * from audit_log where entity_type='TRIP'" )).toHaveLength(1);
});

for(const mobile of [true,false])for(const dark of [false,true])test(`SQL compact daily evidence / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await enter(page);
 if(dark)await page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'}).click();await common(page);await trip(page);await save(page).click();await saved(1);await expect(page.locator('#real-trip-weight')).toHaveValue('');await trip(page);
 await expect(page.getByLabel('نقلات العربية في اليوم المختار')).toContainText('1 نقلة');
 const folder=`artifacts/ui-review-87/daily-final/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}`;await mkdir(folder,{recursive:true});
 await page.getByLabel('بيانات الشغل المشتركة',{exact:true}).evaluate(el=>el.scrollIntoView({block:'start'}));await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:folder+'/01-compact.png'});
 await page.getByLabel('نقلات العربية في اليوم المختار').evaluate(el=>el.scrollIntoView({block:'center'}));await page.screenshot({path:folder+'/01b-entry.png'});
 await openTripExpense(page);await page.locator('#real-trip-expense').fill('30');await expect(page.locator('#real-trip-expense')).toHaveValue('30');
 for(const height of mobile?[844,520]:[1000]){
  if(mobile)await page.setViewportSize({width:390,height});await page.locator('#real-trip-weight').focus();
  await save(page).evaluate(el=>el.scrollIntoView({block:'center'}));await page.evaluate(()=>new Promise(requestAnimationFrame));
  const geometry=await save(page).evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight,visible:el===document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)};});
  expect(geometry.visible,JSON.stringify(geometry)).toBe(true);expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.bottom).toBeLessThanOrEqual(geometry.height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:folder+`/02-save-${height}.png`});
 }
 await save(page).click();await saved(2);
 await writeFile(folder+'/sql-proof.json',JSON.stringify({source:'actual workspace UI bridged to existing PostgreSQL RPCs',hosted:false,nativeKeyboard:false,trips:await sql.rows('select id,trip_date::text,expense_piastres::text,notes from trips order by id')},null,2));
});
