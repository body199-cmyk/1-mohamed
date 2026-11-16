import {test,expect,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
type Body={operation:string;payload:Record<string,unknown>;requestKey:string};
async function fixture(page:Page,failOpening=false){
 const contractors=[{id:'OWNER',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},{id:'C1',name:'شركة النور',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',is_archived:false,version:1}];
 const accounts:{vehicle_id:string;contractor_id:string}[]=[];const writes:Body[]=[];
 let failed=false;
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});
 });
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'1:1',rows:[],total_count:'0',next_cursor:null}}}));
 await page.route('**/api/ledger/operations',route=>{
  const body=route.request().postDataJSON() as Body;writes.push(body);
  if(body.operation==='opening.create'&&failOpening&&!failed){failed=true;return route.abort();}
  if(body.operation==='vehicle.create'){
   vehicles.push({id:String(body.payload.id),plate_number:String(body.payload.plate_number),driver_name:'',is_archived:false,version:1});
   if(body.payload.contractor_id)accounts.push({vehicle_id:String(body.payload.id),contractor_id:String(body.payload.contractor_id)});
  }
  if(body.operation==='contractor.create')contractors.push({id:String(body.payload.id),name:String(body.payload.name),is_primary:false,is_archived:false,version:1});
  return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 await page.goto('/');await expect(page.locator('#real-trip-vehicle option[value="V1"]')).toHaveCount(1);
 return writes;
}
async function opening(page:Page){
 await page.getByRole('dialog').getByRole('checkbox',{name:'إضافة رصيد قديم (اختياري)',exact:true}).check();
 await page.locator('#quick-opening-amount').fill('10000');await page.locator('#quick-opening-date').fill('2026-11-01');
}
test('vehicle opening retries only the unfinished opening with stable identity and preserves daily draft',async({page})=>{
 const writes=await fixture(page,true);
 await page.locator('#real-trip-weight').fill('25');await page.locator('#real-trip-vehicle-add').click();
 await page.locator('#quick-plate').fill('س د 9999');await opening(page);await page.locator('#quick-opening-contractor').selectOption('OWNER');
 const save=page.getByRole('dialog').getByRole('button',{name:/^(حفظ وإضافة|استكمال الرصيد القديم)$/});await save.click();
 await expect(page.getByRole('dialog')).toContainText('لكن حفظ الرصيد القديم لم يتأكد');
 await expect(page.locator('#quick-plate')).toBeDisabled();await expect(page.locator('#real-trip-vehicle')).toHaveValue('');
 await save.click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(writes.map(x=>x.operation)).toEqual(['vehicle.create','opening.create','opening.create']);
 expect(writes[1]).toEqual(writes[2]);expect(writes[0].payload.contractor_id).toBe('OWNER');
 expect(writes[1].payload).toMatchObject({balance_type:'VEHICLE_CASH',contractor_id:'OWNER',vehicle_id:writes[0].payload.id,signed_piastres:1000000,start_date:'2026-11-01'});
 await expect(page.locator('#real-trip-weight')).toHaveValue('25');await expect(page.locator('#real-trip-vehicle')).toHaveValue(String(writes[0].payload.id));
});
for(const side of ['OWED_TO_CONTRACTOR','OWED_TO_AHMED'])test('contractor create includes atomic old work balance '+side,async({page})=>{
 const writes=await fixture(page);await page.locator('#real-trip-counterparty-add').click();
 await page.locator('#quick-name').fill('مقاول برصيد قديم');await opening(page);await page.locator('#quick-opening-direction').selectOption(side);
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(writes).toHaveLength(1);expect(writes[0].payload).toMatchObject({start_mode:'TOTAL',opening:{start_date:'2026-11-01',signed_piastres:side==='OWED_TO_CONTRACTOR'?-1000000:1000000}});
});
test('negative vehicle opening creates no vehicle or balance',async({page})=>{
 const writes=await fixture(page);await page.locator('#real-trip-vehicle-add').click();await page.locator('#quick-plate').fill('س د 9999');await opening(page);
 await page.locator('#quick-opening-contractor').selectOption('OWNER');await page.locator('#quick-opening-amount').fill('-500');
 await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();expect(writes).toHaveLength(0);
});
for(const mobile of [true,false])for(const dark of [false,true])test(`opening preview / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});const writes=await fixture(page);
 await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
 if(dark)await page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'}).click();
 await page.evaluate(()=>document.fonts.ready);const folder='artifacts/ui-review-87/openings';await mkdir(folder,{recursive:true});
 for(const kind of ['vehicle','contractor']){
  await page.locator(kind==='vehicle'?'#real-trip-vehicle-add':'#real-trip-counterparty-add').click();
  await page.locator(kind==='vehicle'?'#quick-plate':'#quick-name').fill(kind==='vehicle'?'س د 9999':'المقاول الجديد');
  await opening(page);
  if(kind==='vehicle')await page.locator('#quick-opening-contractor').selectOption('OWNER');else await page.locator('#quick-opening-direction').selectOption('OWED_TO_CONTRACTOR');
  await page.getByRole('dialog').getByRole('button',{name:'حفظ وإضافة',exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`${folder}/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}-${kind}.png`});
  await page.keyboard.press('Escape');
 }
 expect(writes).toHaveLength(0);
});
