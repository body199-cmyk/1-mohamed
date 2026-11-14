import {test,expect,type Page} from '@playwright/test';

/** Fresh mutable fixture state per test so inline creations never leak across tests. */
async function fixture(page:Page){
 const contractors=[
  {id:'K_AHMED',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'K1',name:'المقاول الأول',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',notes:null,is_archived:false,version:1}];
 const accounts=[{vehicle_id:'V1',contractor_id:'K1'}];
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,
   data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});});
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',
  rows:[],total_count:'0',next_cursor:null,current_cash_balance_piastres:'0'}}}));
 await page.route('**/api/ledger/operations',route=>{
  const body=route.request().postDataJSON() as {operation:string;payload:Record<string,string>};
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
}
function entry(page:Page){return page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();}

test('adds a vehicle inline from the trip form and selects it',async({page})=>{
 await fixture(page);await entry(page);
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
