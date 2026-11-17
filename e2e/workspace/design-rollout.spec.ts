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
 await page.goto('/');
 await expect(page.getByTestId('workspace-title')).toHaveText('اليومية');
 await page.waitForFunction(()=>document.documentElement.dataset.theme==='light'||document.documentElement.dataset.theme==='dark');
 await expect(page.locator('#real-trip-vehicle option[value="V1"]')).toHaveCount(1);
 await expect(page.locator('#real-trip-counterparty option[value="C1"]')).toHaveCount(1);
 await page.evaluate(()=>document.fonts.ready);
}
const screens=[
 {title:'اليومية',primary:true},
 {title:'حساب شغل المقاولين',primary:true},
 {title:'حسابات العربيات والدفعات',primary:true},
 {title:'التقارير والكشوف',primary:true},
 {title:'إدارة البيانات',primary:false},
 {title:'الإعدادات',primary:false},
];
async function selectScreen(page:Page,title:string,mobile:boolean){
 const secondary=title==='إدارة البيانات'||title==='الإعدادات';
 if(secondary&&mobile) await page.locator('[data-testid="mobile-more"] summary').click();
 const target=secondary?page.getByRole('button',{name:title,exact:true}):
  page.getByRole('navigation').getByRole('button',{name:title,exact:true});
 await target.click();
 await expect(page.getByTestId('workspace-title')).toHaveText(title);
}
for(const mobile of [false,true])for(const dark of [false,true])test('all workspace destinations fit / '+(mobile?'mobile':'desktop')+' / '+(dark?'dark':'light'),async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1500,height:1000});
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);
 await page.evaluate(value=>document.documentElement.dataset.theme=value,dark?'dark':'light');
 for(let i=0;i<screens.length;i++){
  await selectScreen(page,screens[i].title,mobile);
  await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),screens[i].title).toBe(true);
  const geometry=await page.locator('main input:not([type=checkbox]), main select, main button').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width>0).map(n=>({height:n.getBoundingClientRect().height,text:(n.textContent??'').slice(0,40)})));
  expect(geometry.filter(n=>n.height<43),screens[i].title).toEqual([]);
  await page.screenshot({path:'artifacts/design-rollout/'+(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'-'+i+'.png'});
 }
 await selectScreen(page,'اليومية',mobile);
 await page.locator('#real-payment-account-add').click();
 const dialog=page.getByRole('dialog',{name:'فتح حساب عربية جديد'});
 await expect(dialog).toBeVisible();await expect(page.locator('#quick-account-plate')).toBeFocused();
 await dialog.getByRole('button',{name:'فتح الحساب',exact:true}).scrollIntoViewIfNeeded();
 const save=(await dialog.getByRole('button',{name:'فتح الحساب',exact:true}).boundingBox())!;
 const cancel=(await dialog.getByRole('button',{name:'إلغاء',exact:true}).boundingBox())!;
 expect(save.height).toBeGreaterThanOrEqual(48);expect(cancel.height).toBeGreaterThanOrEqual(48);
 expect(Math.max(save.x,cancel.x)-Math.min(save.x+save.width,cancel.x+cancel.width)).toBeGreaterThanOrEqual(11);
 await page.screenshot({path:'artifacts/design-rollout/'+(mobile?'mobile':'desktop')+'-'+(dark?'dark':'light')+'-account.png'});
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('header theme toggle is accessible and mobile navigation exposes four destinations',async({page})=>{
 await page.setViewportSize({width:390,height:844});await prepare(page);
 const theme=page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'});
 await expect(theme).toBeVisible();
 const before=await page.locator('html').getAttribute('data-theme');
 await theme.click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',before==='dark'?'light':'dark');
 await expect(theme).toHaveAttribute('aria-pressed',before==='dark'?'false':'true');
 await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(4);
 const more=page.locator('[data-testid="mobile-more"]');
 await expect(more).toBeVisible();
 await more.locator('summary').click();
 await expect(more.getByRole('button',{name:'إدارة البيانات',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(more.getByRole('button',{name:'إدارة البيانات',exact:true})).not.toBeVisible();
 await expect(more.locator('summary')).toBeFocused();
 expect(await page.getByRole('navigation').evaluate(el=>getComputedStyle(el).position)).toBe('fixed');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});



test('workspace navigation fits required phone, tablet and desktop widths',async({page})=>{
 await page.setViewportSize({width:390,height:844});await prepare(page);
 for(const width of [360,390,412,768,1280]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'width '+width).toBe(true);
  const mobile=width<=767;
  expect(await page.getByRole('navigation').evaluate(el=>getComputedStyle(el).position),'nav position '+width).toBe(mobile?'fixed':'sticky');
  await expect(page.getByRole('navigation').getByRole('button')).toHaveCount(mobile?4:6);
  if(mobile){
   await page.locator('[data-testid="mobile-more"] summary').click();
   await expect(page.getByRole('button',{name:'إدارة البيانات',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'إدارة البيانات',exact:true}).click();
  }else{
   await expect(page.getByRole('navigation').getByRole('button',{name:'إدارة البيانات',exact:true})).toBeVisible();
  }
  await expect(page.getByTestId('workspace-title')).toHaveText('إدارة البيانات');
 }
});

test('save and exit returns to the daily landing after a confirmed trip write',async({page})=>{
 await prepare(page);
 const writes:{operation:string;payload:Record<string,unknown>}[]=[];
 await page.route('**/api/ledger/operations',route=>{
  writes.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 await page.locator('#real-trip-vehicle').selectOption('V1');
 await page.locator('#real-trip-counterparty').selectOption('C1');
 await page.locator('#real-trip-date').fill('2026-11-15');
 await page.locator('#real-trip-weight').fill('10');
 await page.locator('#real-trip-contractor-rate').fill('100');
 await page.locator('#real-trip-expense').fill('0');
 await page.getByRole('button',{name:'حفظ وخروج',exact:true}).click();
 await expect(page.getByText('تم حفظ النقلة والخروج من نموذج الإدخال.',{exact:true})).toBeVisible();
 expect(writes).toHaveLength(1);
 expect(writes[0].operation).toBe('trip.create');
 expect(writes[0].payload).toMatchObject({
  vehicle_id:'V1',counterparty_contractor_id:'C1',direction:'AHMED_SUPPLIES',
  trip_date:'2026-11-15',weight_tonnes:'10',contractor_rate_egp:'100',
  vehicle_rate_egp:'100',same_rate:true,expense_egp:'0'
 });
 await page.getByRole('button',{name:'تسجيل شغل أو دفعة',exact:true}).click();
 await expect(page.locator('#real-trip-vehicle')).toBeVisible();
});


test('failed trip write keeps the daily entry open',async({page})=>{
 await prepare(page);
 await page.route('**/api/ledger/operations',route=>
  route.fulfill({status:500,json:{ok:false,error:'رفض تجريبي'}}));
 await page.locator('#real-trip-vehicle').selectOption('V1');
 await page.locator('#real-trip-counterparty').selectOption('C1');
 await page.locator('#real-trip-date').fill('2026-11-15');
 await page.locator('#real-trip-weight').fill('10');
 await page.locator('#real-trip-contractor-rate').fill('100');
 await page.locator('#real-trip-expense').fill('0');
 await page.getByRole('button',{name:'حفظ وخروج',exact:true}).click();
 await expect(page.locator('#real-trip-vehicle')).toBeVisible();
 await expect(page.getByText('تم حفظ النقلة والخروج من نموذج الإدخال.',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'حفظ وخروج',exact:true})).toBeVisible();
});

test('restyled master and payment forms retain their write payloads',async({page})=>{
 await prepare(page);
 const writes:{operation:string;payload:Record<string,unknown>}[]=[];
 await page.route('**/api/ledger/operations',route=>{
  writes.push(route.request().postDataJSON());return route.fulfill({json:{ok:true,data:{status:'OK'}}});
 });
 await selectScreen(page,'إدارة البيانات',false);
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
 await selectScreen(page,'اليومية',false);
 await page.locator('#real-payment-account').selectOption('V1|C1');
 await page.locator('#real-payment-date').fill('2026-11-15');await page.locator('#real-payment-amount').fill('100');
 await page.getByRole('button',{name:'حفظ الدفعة',exact:true}).click();
 await expect(page.locator('#real-payment-amount')).toHaveValue('');
 expect(writes).toHaveLength(4);expect(writes[3]).toMatchObject({operation:'payment.create',payload:{vehicle_id:'V1',responsible_contractor_id:'C1',payment_date:'2026-11-15',amount_egp:'100'}});
});


test('daily quick access stays sticky and each entry area is a warm, theme-aware section card',async({page})=>{
 await page.setViewportSize({width:390,height:844});await prepare(page);
 const quick=page.getByRole('navigation',{name:'وصول سريع لتسجيل اليومية'});
 await expect(quick).toBeVisible();
 await expect(quick.getByRole('link')).toHaveCount(4);
 expect(await quick.evaluate(el=>getComputedStyle(el).position)).toBe('sticky');
 const targets=['shared-work-panel','trip-entry-section','real-payment-form','daily-trip-list'];
 for(const id of targets){
  const card=page.locator('#'+id);
  await expect(card).toBeVisible();
  const visual=await card.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow};});
  expect(visual.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(visual.radius).not.toBe('0px');
  expect(visual.shadow).not.toBe('none');
 }
 const light=await page.locator('#shared-work-panel').evaluate(el=>getComputedStyle(el).backgroundColor);
 await page.locator('html').evaluate(el=>el.setAttribute('data-theme','dark'));
 const dark=await page.locator('#shared-work-panel').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(dark).not.toBe(light);
 await page.screenshot({path:'artifacts/design-rollout/daily-quick-access-mobile-dark.png'});
 await quick.getByRole('link',{name:'تسجيل العربيات'}).click();
 await expect(page).toHaveURL(/#trip-entry-section$/);
 await quick.getByRole('link',{name:'دفعات العربيات'}).click();
 await expect(page).toHaveURL(/#real-payment-form$/);
});
