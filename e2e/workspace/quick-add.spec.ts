import {test,expect,type Page} from '@playwright/test';

/** Fresh mutable fixture state per test so inline creations never leak across tests. */
async function fixture(page:Page){
 const contractors=[
  {id:'K_AHMED',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'K1',name:'المقاول الأول',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',notes:null,is_archived:false,version:1}];
 const accounts=[{vehicle_id:'V1',contractor_id:'K1'}];
 /** Recorded write attempts so tests can prove request counts, not just results. */
 const attempts:{operation:string;payload:Record<string,string>}[]=[];
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,
   data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});});
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',
  rows:[],total_count:'0',next_cursor:null,current_cash_balance_piastres:'0'}}}));
 await page.route('**/api/ledger/operations',route=>{
  const body=route.request().postDataJSON() as {operation:string;payload:Record<string,string>};
  attempts.push(body);
  if(body.operation==='vehicle.create')
   vehicles.push({id:body.payload.id,plate_number:body.payload.plate_number,
    driver_name:body.payload.driver_name||null,notes:null,is_archived:false,version:1});
  if(body.operation==='contractor.create')
   contractors.push({id:body.payload.id,name:body.payload.name,is_primary:false,is_archived:false,version:1});
  if(body.operation==='vehicle.account.ensure')
   accounts.push({vehicle_id:body.payload.vehicle_id,contractor_id:body.payload.contractor_id});
  return route.fulfill({json:{ok:true,data:{status:'OK'}}});});
 await page.goto('/');
 await expect(page.getByText('أهلًا بك في إدارة الشغل',{exact:true})).toBeVisible();
 return attempts;
}
function entry(page:Page){return page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();}

test('adds a vehicle inline from the trip form and selects it',async({page})=>{
 await fixture(page);await entry(page);
 // The trip draft must survive inline creation untouched.
 await page.locator('#real-trip-date').fill('2026-11-14');
 await page.locator('#real-trip-weight').fill('15');
 // A filled search is cleared once the new record is selected programmatically.
 await page.locator('#real-trip-vehicle-search').fill('عربية');
 await page.locator('#real-trip-vehicle-add').click();
 const created=page.waitForRequest(r=>r.url().includes('/api/ledger/operations'));
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await page.locator('#quick-driver').fill('سائق تجربة');
 await page.getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 const request=(await created).postDataJSON();
 expect(request.operation).toBe('vehicle.create');
 expect(request.payload.plate_number).toBe('د هـ و 1234');
 expect(request.payload.driver_name).toBe('سائق تجربة');
 await expect(page.locator('#real-trip-vehicle')).toHaveValue(request.payload.id);
 await expect(page.locator('#real-trip-vehicle-search')).toHaveValue('');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('#real-trip-date')).toHaveValue('2026-11-14');
 await expect(page.locator('#real-trip-weight')).toHaveValue('15');
});

test('adds a contractor inline from the trip form and selects it',async({page})=>{
 await fixture(page);await entry(page);
 await page.locator('#real-trip-counterparty-add').click();
 const created=page.waitForRequest(r=>r.url().includes('/api/ledger/operations'));
 await page.locator('#quick-name').fill('مقاول تجربة');
 await page.getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 const request=(await created).postDataJSON();
 expect(request.operation).toBe('contractor.create');
 expect(request.payload.name).toBe('مقاول تجربة');
 await expect(page.locator('#real-trip-counterparty')).toHaveValue(request.payload.id);
});

test('keeps the modal open with an alert when the server rejects the save',async({page})=>{
 await fixture(page);await entry(page);
 await page.locator('#real-trip-vehicle-add').click();
 await page.route('**/api/ledger/operations',route=>route.fulfill({status:409,json:{error:'تم تعديل البيانات من جلسة أخرى.'}}));
 await page.locator('#quick-plate').fill('د هـ و 1234');
 await page.getByRole('button',{name:'حفظ وإضافة',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('لم تتم الإضافة');
 await expect(page.locator('#real-trip-vehicle')).toHaveValue('');
});

test('opens a new payment account from new vehicle and contractor, then selects the pair',async({page})=>{
 await fixture(page);await entry(page);
 await page.locator('#real-payment-account-add').click();
 const created=page.waitForRequest(r=>r.url().includes('/api/ledger/operations'));
 await page.locator('#quick-account-plate').fill('ج س ر 7777');
 await page.locator('#quick-account-name').fill('مقاول الدفعة');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).click();
 const first=await created;
 const requests=[first.postDataJSON()];
 let guard=0;
 while(requests.at(-1)?.operation!=='vehicle.account.ensure'&&guard++<5){
  const next=await page.waitForRequest(r=>r.url().includes('/api/ledger/operations'),{timeout:5000});
  requests.push(next.postDataJSON());}
 expect(requests.map(r=>r.operation)).toEqual(['vehicle.create','contractor.create','vehicle.account.ensure']);
 expect(requests[0].payload.plate_number).toBe('ج س ر 7777');
 expect(requests[1].payload.name).toBe('مقاول الدفعة');
 await expect(page.locator('#real-payment-account'))
  .toHaveValue(requests[0].payload.id+'|'+requests[1].payload.id);
});

test('ensures an existing pair once without creating records',async({page})=>{
 const attempts=await fixture(page);await entry(page);
 await page.locator('#real-payment-account-add').click();
 const created=page.waitForRequest(r=>r.url().includes('/api/ledger/operations'));
 await page.locator('#quick-account-vehicle').selectOption('V1');
 await page.locator('#quick-account-contractor').selectOption('K1');
 await page.getByRole('button',{name:'فتح الحساب',exact:true}).evaluate((button:HTMLButtonElement)=>{
  button.form!.requestSubmit();
  button.form!.requestSubmit();
 });
 const request=(await created).postDataJSON();
 expect(request.operation).toBe('vehicle.account.ensure');
 await expect(page.locator('#real-payment-account')).toHaveValue('V1|K1');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(attempts.map(request=>request.operation)).toEqual(['vehicle.account.ensure']);
});

test('Escape closes the payment account modal without any request',async({page})=>{
 await fixture(page);await entry(page);
 await page.locator('#real-payment-account-add').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
