import {test,expect,type Page} from '@playwright/test';

type OperationBody={operation:string;payload:Record<string,string>;requestKey:string};
type FixtureOptions={
  failMasterAfterCreate?:number;
  failFirst?:Record<string,number>;
  abortFirst?:string[];
  slowFirst?:string[];
};

/** Fresh per-test fixture; mutations apply only on accepted writes, before the next master read. */
async function fixture(page:Page, options:FixtureOptions={}){
 const contractors=[
  {id:'K_AHMED',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'K1',name:'المقاول الأول',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',notes:null,is_archived:false,version:1}];
 const accounts=[{vehicle_id:'V1',contractor_id:'K1'}];
 const attempts:OperationBody[]=[];
 const remaining={...options};
 let masterFailsAfterCreate=0;
 await page.route('**/api/ledger/master?**',route=>{
  if(masterFailsAfterCreate>0){
   masterFailsAfterCreate--;return route.fulfill({status:500,json:{error:'تعذر تحميل البيانات.'}});}
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,
   data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});});
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',
  rows:[],total_count:'0',next_cursor:null,current_cash_balance_piastres:'0'}}}));
 await page.route('**/api/ledger/operations',async route=>{
  const body=route.request().postDataJSON() as OperationBody;
  attempts.push(body);
  if(remaining.abortFirst?.includes(body.operation)){
   remaining.abortFirst=remaining.abortFirst.filter(o=>o!==body.operation);
   return route.abort('failed');}
  if(remaining.slowFirst?.includes(body.operation)){
   remaining.slowFirst=remaining.slowFirst.filter(o=>o!==body.operation);
   await new Promise(resolve=>setTimeout(resolve,800));}
  if(remaining.failFirst&&remaining.failFirst[body.operation]){
   const status=remaining.failFirst[body.operation];delete remaining.failFirst[body.operation];
   return route.fulfill({status,json:{error:'تم تعديل البيانات من جلسة أخرى.'}});}
  if(body.operation==='vehicle.create'&&!vehicles.some(v=>v.plate_number===body.payload.plate_number)){
   vehicles.push({id:body.payload.id,plate_number:body.payload.plate_number,
    driver_name:body.payload.driver_name||null,notes:null,is_archived:false,version:1});
   if(remaining.failMasterAfterCreate) masterFailsAfterCreate=remaining.failMasterAfterCreate;}
  if(body.operation==='contractor.create'&&!contractors.some(c=>c.name===body.payload.name))
   contractors.push({id:body.payload.id,name:body.payload.name,is_primary:false,is_archived:false,version:1});
  if(body.operation==='vehicle.account.ensure'
   &&!accounts.some(a=>a.vehicle_id===body.payload.vehicle_id&&a.contractor_id===body.payload.contractor_id))
   accounts.push({vehicle_id:body.payload.vehicle_id,contractor_id:body.payload.contractor_id});
  return route.fulfill({json:{ok:true,data:{status:'OK'}}});});
 await page.goto('/');
 await expect(page.getByText('أهلًا بك في إدارة الشغل',{exact:true})).toBeVisible();
 return {attempts,vehicles,contractors,accounts};
}
function entry(page:Page){return page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();}
function saveVehicle(page:Page){
 return page.getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
}

test('aborted save then retry reuses the same request identity and creates one record',async({page})=>{
 const state=await fixture(page,{abortFirst:['vehicle.create']});
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await saveVehicle(page);
 await expect(page.getByText('انقطع الاتصال ولم تتأكد نتيجة الحفظ. أعد المحاولة بنفس البيانات.')).toBeVisible();
 await saveVehicle(page);
 const vehicleAttempts=state.attempts.filter(a=>a.operation==='vehicle.create');
 expect(vehicleAttempts).toHaveLength(2);
 expect(vehicleAttempts[0].requestKey).toBe(vehicleAttempts[1].requestKey);
 expect(vehicleAttempts[0].payload).toEqual(vehicleAttempts[1].payload);
 expect(state.vehicles.filter(v=>v.plate_number==='د هـ و 1234')).toHaveLength(1);
 await expect(page.locator('#real-trip-vehicle')).toHaveValue(vehicleAttempts[0].payload.id);
});

test('confirmed save with failing refresh waits and retries without re-creating',async({page})=>{
 const state=await fixture(page,{failMasterAfterCreate:1});
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await saveVehicle(page);
 await expect(page.getByRole('status').last()).toContainText('في انتظار تحديث القوائم');
 await page.getByRole('button',{name:'تحديث القوائم',exact:true}).click();
 const vehicleAttempts=state.attempts.filter(a=>a.operation==='vehicle.create');
 expect(vehicleAttempts).toHaveLength(1);
 await expect(page.locator('#real-trip-vehicle')).toHaveValue(vehicleAttempts[0].payload.id);
 await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('double submit in the same tick with a slow response sends one request',async({page})=>{
 const state=await fixture(page,{slowFirst:['vehicle.create']});
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await page.getByRole('button',{name:'حفظ وإضافة',exact:true})
  .evaluate((button)=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
 await expect(page.locator('#real-trip-vehicle')).toHaveValue(/VEH-/, {timeout:10000});
 expect(state.attempts.filter(a=>a.operation==='vehicle.create')).toHaveLength(1);
 expect(state.vehicles.filter(v=>v.plate_number==='د هـ و 1234')).toHaveLength(1);
});

test('unauthorized write keeps the dialog with no success claim and no selection',async({page})=>{
 const state=await fixture(page,{failFirst:{'vehicle.create':401}});
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await saveVehicle(page);
 await expect(page.getByRole('alert')).toContainText('لم تتم الإضافة');
 await expect(page.locator('#real-trip-vehicle')).toHaveValue('');
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(state.vehicles.filter(v=>v.plate_number==='د هـ و 1234')).toHaveLength(0);
});

test('Escape before saving closes with zero requests and returns focus to the opener',async({page})=>{
 const state=await fixture(page);
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(state.attempts).toHaveLength(0);
 await expect(page.evaluate(()=>document.activeElement?.id)).resolves.toBe('real-trip-vehicle-add');
});

test('Escape cannot close while a save is in flight',async({page})=>{
 const state=await fixture(page,{slowFirst:['vehicle.create']});
 await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await page.getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.locator('#real-trip-vehicle')).toHaveValue(/VEH-/, {timeout:10000});
 expect(state.attempts.filter(a=>a.operation==='vehicle.create')).toHaveLength(1);
});

test('existing vehicle with new contractor creates only the contractor then ensures',async({page})=>{
 const state=await fixture(page);
 await entry(page);
 await page.locator('#real-payment-account-add').click();
 await page.locator('#quick-account-vehicle').selectOption('V1');
 await page.locator('#quick-account-name').fill('مقاول الدفعة');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 await expect(page.locator('#real-payment-account')).toHaveValue('V1|'+state.attempts[0].payload.id);
 expect(state.attempts.map(a=>a.operation)).toEqual(['contractor.create','vehicle.account.ensure']);
});

test('new vehicle created, contractor rejected: retry resumes without re-creating the vehicle',async({page})=>{
 const state=await fixture(page,{failFirst:{'contractor.create':422}});
 await entry(page);
 await page.locator('#real-payment-account-add').click();
 await page.locator('#quick-account-plate').fill('ج س ر 7777');
 await page.locator('#quick-account-name').fill('مقاول الدفعة');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('أُنشئت العربية');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 await expect(page.locator('#real-payment-account'))
  .toHaveValue(state.attempts[0].payload.id+'|'+state.attempts[1].payload.id);
 expect(state.attempts.filter(a=>a.operation==='vehicle.create')).toHaveLength(1);
 expect(state.attempts.filter(a=>a.operation==='contractor.create')).toHaveLength(2);
 expect(state.attempts.filter(a=>a.operation==='vehicle.account.ensure')).toHaveLength(1);
});

test('ensure rejected: retry does not re-create vehicle or contractor',async({page})=>{
 const state=await fixture(page,{failFirst:{'vehicle.account.ensure':500}});
 await entry(page);
 await page.locator('#real-payment-account-add').click();
 await page.locator('#quick-account-plate').fill('ج س ر 7777');
 await page.locator('#quick-account-name').fill('مقاول الدفعة');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('لم يتم فتح الحساب');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 await expect(page.locator('#real-payment-account'))
  .toHaveValue(state.attempts[0].payload.id+'|'+state.attempts[1].payload.id);
 expect(state.attempts.filter(a=>a.operation==='vehicle.create')).toHaveLength(1);
 expect(state.attempts.filter(a=>a.operation==='contractor.create')).toHaveLength(1);
 expect(state.attempts.filter(a=>a.operation==='vehicle.account.ensure')).toHaveLength(2);
});

test('ahmed the primary contractor may own a payment account',async({page})=>{
 const state=await fixture(page);
 await entry(page);
 await page.locator('#real-payment-account-add').click();
 await page.locator('#quick-account-vehicle').selectOption('V1');
 await page.locator('#quick-account-contractor').selectOption('K_AHMED');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 const ensure=state.attempts.find(a=>a.operation==='vehicle.account.ensure');
 expect(ensure?.payload.contractor_id).toBe('K_AHMED');
 await expect(page.locator('#real-payment-account')).toHaveValue('V1|K_AHMED');
});

test('report screens expose no visible inline add buttons',async({page})=>{
 await fixture(page);
 // All screens stay mounted behind `hidden`; only visible buttons count here.
 await page.getByRole('navigation').getByRole('button',{name:'النقلات واليومية',exact:true}).click();
 await expect(page.locator('[id$="-add"]:visible')).toHaveCount(0);
 await page.getByRole('navigation').getByRole('button',{name:'كشف حساب عربية',exact:true}).click();
 await expect(page.locator('[id$="-add"]:visible')).toHaveCount(0);
});

test('the vehicle dialog fits a mobile viewport without horizontal overflow',async({page})=>{
 await fixture(page);await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
