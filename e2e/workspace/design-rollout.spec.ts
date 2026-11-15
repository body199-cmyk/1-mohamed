import {test,expect,type Page} from '@playwright/test';

async function prepare(page:Page){
 const contractors=[{id:'OWNER',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'C1',name:'شركة النور للمقاولات',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'د هـ و 5678',driver_name:'محمود حسن',is_archived:false,version:1}];
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:type==='contractors'?contractors:type==='vehicles'?vehicles:[{vehicle_id:'V1',contractor_id:'C1'}],hasMore:false}});
 });
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',rows:[],total_count:'0',next_cursor:null,current_cash_balance_piastres:'100000'}}}));
 await page.route('**/api/ledger/operations',route=>route.abort());
 await page.goto('/');await expect(page.getByText('أهلًا بك في إدارة الشغل',{exact:true})).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
}
const screens=['الرئيسية','تسجيل الشغل والدفعات','النقلات واليومية','كشف المقاول','كشف حساب عربية','البيانات الأساسية','الإعدادات'];
for(const mobile of [false,true])for(const dark of [false,true])test(`all screens fit and use consistent controls / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1500,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);
 await page.evaluate(value=>document.documentElement.dataset.theme=value,dark?'dark':'light');
 for(let i=0;i<screens.length;i++){
  await page.getByRole('navigation').getByRole('button',{name:screens[i],exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),screens[i]).toBe(true);
  const geometry=await page.locator('main input:not([type=checkbox]), main select, main button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>({height:n.getBoundingClientRect().height,text:(n.textContent??'').slice(0,40)})));
  expect(geometry.filter(n=>n.height<43),screens[i]).toEqual([]);
  await page.screenshot({path:`artifacts/design-rollout/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}-${i}.png`});
 }
 await page.getByRole('navigation').getByRole('button',{name:screens[1],exact:true}).click();
 await page.locator('#real-payment-account-add').click();
 const dialog=page.getByRole('dialog',{name:'فتح حساب عربية جديد'});
 await expect(dialog).toBeVisible();await expect(page.locator('#quick-account-plate')).toBeFocused();
 await dialog.getByRole('button',{name:'فتح الحساب',exact:true}).scrollIntoViewIfNeeded();
 const save=(await dialog.getByRole('button',{name:'فتح الحساب',exact:true}).boundingBox())!;
 const cancel=(await dialog.getByRole('button',{name:'إلغاء',exact:true}).boundingBox())!;
 expect(save.height).toBeGreaterThanOrEqual(48);expect(cancel.height).toBeGreaterThanOrEqual(48);
 expect(Math.max(save.x,cancel.x)-Math.min(save.x+save.width,cancel.x+cancel.width)).toBeGreaterThanOrEqual(11);
 await page.screenshot({path:`artifacts/design-rollout/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}-account.png`});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('restyled master and payment forms retain their write payloads',async({page})=>{
 await prepare(page);
 const writes:{operation:string;payload:Record<string,unknown>}[]=[];
 await page.route('**/api/ledger/operations',route=>{
  writes.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 const nav=page.getByRole('navigation');
 await nav.getByRole('button',{name:'البيانات الأساسية',exact:true}).click();
 await page.locator('#contractor-name').fill('مقاول تجربة الواجهة');
 await page.getByRole('button',{name:'حفظ المقاول',exact:true}).click();
 await expect(page.locator('#contractor-name')).toHaveValue('');
 expect(writes[0].operation).toBe('contractor.create');expect(writes[0].payload.name).toBe('مقاول تجربة الواجهة');
 await page.locator('#vehicle-plate').fill('ج س ر 7777');await page.locator('#vehicle-driver').fill('سائق تجربة');
 await page.locator('#vehicle-contractor').selectOption('C1');
 await page.getByRole('button',{name:'حفظ العربية',exact:true}).click();
 await expect(page.locator('#vehicle-plate')).toHaveValue('');
 expect(writes[1].operation).toBe('vehicle.create');expect(writes[1].payload).toMatchObject({plate_number:'ج س ر 7777',driver_name:'سائق تجربة',contractor_id:'C1'});
 await page.locator('#account-vehicle').selectOption('V1');await page.locator('#account-contractor').selectOption('C1');
 await page.getByRole('button',{name:'تأكيد ربط الحساب',exact:true}).click();
 await expect.poll(()=>writes.length).toBe(3);
 expect(writes[2]).toMatchObject({operation:'vehicle.account.ensure',payload:{vehicle_id:'V1',contractor_id:'C1'}});
 await nav.getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();
 await page.locator('#real-payment-account').selectOption('V1|C1');
 await page.locator('#real-payment-date').fill('2026-11-15');await page.locator('#real-payment-amount').fill('100');
 await page.getByRole('button',{name:'حفظ الدفعة',exact:true}).click();
 await expect(page.locator('#real-payment-amount')).toHaveValue('');
 expect(writes).toHaveLength(4);expect(writes[3]).toMatchObject({operation:'payment.create',payload:{vehicle_id:'V1',responsible_contractor_id:'C1',payment_date:'2026-11-15',amount_egp:'100'}});
});
