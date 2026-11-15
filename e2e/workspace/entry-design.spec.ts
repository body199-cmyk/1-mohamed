import {test,expect,type Page} from '@playwright/test';

async function prepare(page:Page){
 const contractors=[{id:'OWNER',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'C1',name:'شركة النور للمقاولات',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'د هـ و 5678',driver_name:'محمود حسن',is_archived:false,version:1}];
 await page.route('**/api/ledger/master?**',route=>{
  const kind=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:kind==='contractors'?contractors:kind==='vehicles'?vehicles:[],hasMore:false}});
 });
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',rows:[],total_count:'0',next_cursor:null}}}));
 await page.route('**/api/ledger/operations',route=>route.fulfill({json:{ok:true,data:{status:'OK'}}}));
 await page.goto('/');
 await page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();
 await page.evaluate(()=>document.fonts.ready);
 await page.locator('#real-trip-vehicle').selectOption('V1');
 await page.locator('#real-trip-counterparty').selectOption('C1');
 await page.locator('#real-trip-date').fill('2026-11-15');
 await page.locator('#real-trip-weight').fill('25');
 await page.locator('#real-trip-contractor-rate').fill('1200');
 await page.locator('#real-trip-expense').fill('500');
}

for(const mobile of [false,true])test(`entry preview and separated modal actions / ${mobile?'mobile':'desktop'}`,async({page})=>{
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1500,height:1050});
 await page.emulateMedia({reducedMotion:'reduce'});await prepare(page);
 const screen=page.getByRole('region',{name:'تسجيل نقلة',exact:true});
 // Existing accounting adds the 500 expense to each 25 × 1,200 total.
 await expect(screen).toContainText('+30,500 ج.م');
 await expect(screen.getByText('30,500 ج.م',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(mobile){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'artifacts/entry-design/mobile-entry.png'});}
 else await screen.screenshot({path:'artifacts/entry-design/desktop-entry.png'});
 await page.locator('#real-trip-vehicle-add').click();
 const dialog=page.getByRole('dialog');
 await expect(dialog).toBeVisible();await expect(page.locator('#quick-plate')).toBeFocused();
 const save=dialog.getByRole('button',{name:'حفظ وإضافة',exact:true});
 const cancel=dialog.getByRole('button',{name:'إلغاء',exact:true});
 const a=(await save.boundingBox())!,b=(await cancel.boundingBox())!;
 expect(a.height).toBeGreaterThanOrEqual(48);expect(b.height).toBeGreaterThanOrEqual(48);
 expect(Math.max(a.x,b.x)-Math.min(a.x+a.width,b.x+b.width)).toBeGreaterThanOrEqual(11);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/entry-design/${mobile?'mobile':'desktop'}-modal.png`,fullPage:false});
 await cancel.click();await expect(dialog).toHaveCount(0);
 await expect(page.locator('#real-trip-weight')).toHaveValue('25');
 await expect(page.locator('#real-trip-expense')).toHaveValue('500');
 if(!mobile){
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await screen.screenshot({path:'artifacts/entry-design/desktop-dark.png'});
 }
});
