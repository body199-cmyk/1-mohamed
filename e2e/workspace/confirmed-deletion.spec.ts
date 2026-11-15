import {test,expect,type Page} from '@playwright/test';
const challenge='10000000-0000-0000-0000-000000000001';
const counts={trips:10,payments:5,openings:1,vehicles:1,contractors:0,accounts:2};
async function prepare(page:Page,{wrongPassword=false,stale=false,blocked=false}={}){
 const requests:Record<string,unknown>[]=[];
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,hasMore:false,data:type==='contractors'?[{id:'OWNER',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1}]:type==='vehicles'?[{id:'V1',plate_number:'ج س ر 7777',is_archived:false,version:1}]:[]}});
 });
 await page.route('**/api/ledger/purge',async route=>{
  const body=route.request().postDataJSON();requests.push(body);
  if(body.action==='preview')return route.fulfill({json:{ok:true,data:{status:'OK',challenge_id:blocked?null:challenge,expires_at:new Date(Date.now()+600000).toISOString(),counts,blocked:blocked?'NEGATIVE_BALANCE':null,
   confirmation:body.scope.mode==='ALL'?'احذف كل البيانات':body.scope.mode==='VEHICLE'?'احذف بيانات العربية':'احذف بيانات الفترة'}}});
  if(wrongPassword&&body.password==='wrong-password')return route.fulfill({status:401,json:{error:'كلمة المرور غير صحيحة. لم يتم الحذف.'}});
  if(stale)return route.fulfill({status:409,json:{error:'البيانات اتغيّرت. اعمل معاينة جديدة.',refreshPreview:true}});
  await new Promise(resolve=>setTimeout(resolve,150));
  return route.fulfill({json:{ok:true,data:{status:'OK',challenge_id:challenge,counts}}});
 });
 await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'الإعدادات',exact:true}).click();
 return requests;
}
async function preview(page:Page,mode='ALL'){
 await page.locator('#deletion-mode').selectOption(mode);
 if(mode==='VEHICLE')await page.locator('#deletion-vehicle').selectOption('V1');
 if(mode==='PERIOD'){await page.locator('#deletion-from').fill('2026-07-16');await page.locator('#deletion-to').fill('2026-11-14');}
 await page.getByRole('button',{name:'معاينة البيانات قبل الحذف',exact:true}).click();
 await expect(page.getByLabel('معاينة نطاق الحذف')).toBeVisible();
}
async function confirm(page:Page,password='fixture-password'){
 await page.getByRole('button',{name:'متابعة إلى التأكيد النهائي',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'تأكيد الحذف النهائي'});
 await expect(dialog.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true})).toBeDisabled();
 await page.locator('#deletion-phrase').fill('احذف كل البيانات');
 await page.getByLabel('كلمة المرور الحالية',{exact:true}).fill(password);
 await dialog.getByRole('checkbox').check();return dialog;
}
for(const mode of ['ALL','VEHICLE','PERIOD'])test(`${mode}: only explicit preview is requested; selecting scope never deletes`,async({page})=>{
 const requests=await prepare(page);expect(requests).toHaveLength(0);
 await preview(page,mode);expect(requests).toHaveLength(1);
 expect(requests[0]).toMatchObject({action:'preview',scope:mode==='ALL'?{mode}:mode==='VEHICLE'?{mode,vehicle_id:'V1'}:{mode,from:'2026-07-16',to:'2026-11-14'}});
 await page.locator('#deletion-mode').selectOption(mode==='ALL'?'VEHICLE':'ALL');
 await expect(page.getByLabel('معاينة نطاق الحذف')).toHaveCount(0);expect(requests).toHaveLength(1);
});
test('cancel clears password, preserves preview and sends no destructive request',async({page})=>{
 const requests=await prepare(page);await preview(page);
 await page.screenshot({path:'artifacts/deletion-settings/desktop-preview.png',fullPage:true});
 const dialog=await confirm(page);
 await dialog.getByRole('button',{name:'إلغاء',exact:true}).click();await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'متابعة إلى التأكيد النهائي',exact:true}).click();
 await expect(page.getByLabel('كلمة المرور الحالية',{exact:true})).toHaveValue('');
 await expect(page.locator('#deletion-phrase')).toHaveValue('');expect(requests.filter(r=>r.action==='execute')).toHaveLength(0);
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});
test('wrong password does not claim success; retry uses the same challenge and double click submits once',async({page})=>{
 const requests=await prepare(page,{wrongPassword:true});
 await page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();
 await page.locator('#real-trip-weight').fill('25');
 await page.getByRole('navigation').getByRole('button',{name:'الإعدادات',exact:true}).click();
 await preview(page);const dialog=await confirm(page,'wrong-password');
 await dialog.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).click();
 await expect(dialog.getByRole('alert')).toContainText('لم يتم الحذف');
 await expect(page.getByLabel('كلمة المرور الحالية',{exact:true})).toHaveValue('');
 await page.getByLabel('كلمة المرور الحالية',{exact:true}).fill('fixture-password');
 await dialog.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();});
 await expect(dialog).toHaveCount(0);await expect(page.getByRole('status')).toContainText('تم حذف البيانات المحددة');
 const execute=requests.filter(r=>r.action==='execute');expect(execute).toHaveLength(2);
 expect(execute.map(r=>r.challenge_id)).toEqual([challenge,challenge]);
 await page.getByRole('navigation').getByRole('button',{name:'تسجيل الشغل والدفعات',exact:true}).click();
 await expect(page.locator('#real-trip-weight')).toHaveValue('');
});
test('changed data discards the old challenge and requires another preview',async({page})=>{
 const requests=await prepare(page,{stale:true});await preview(page);const dialog=await confirm(page);
 await dialog.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(page.getByLabel('معاينة نطاق الحذف')).toHaveCount(0);
 await expect(page.getByRole('status')).toContainText('معاينة جديدة');expect(requests.filter(r=>r.action==='execute')).toHaveLength(1);
});
test('financially unsafe periods cannot proceed to password or deletion',async({page})=>{
 const requests=await prepare(page,{blocked:true});await preview(page,'PERIOD');
 await expect(page.getByRole('status')).toContainText('من غير رصيد');
 await expect(page.getByRole('button',{name:'متابعة إلى التأكيد النهائي',exact:true})).toHaveCount(0);
 expect(requests.filter(r=>r.action==='execute')).toHaveLength(0);
});
test('mobile confirmation fits the viewport and separates destructive and cancel actions',async({page})=>{
 await page.setViewportSize({width:390,height:844});await prepare(page);await preview(page);const dialog=await confirm(page);
 const save=(await dialog.getByRole('button',{name:'تأكيد الحذف النهائي',exact:true}).boundingBox())!;
 const cancel=(await dialog.getByRole('button',{name:'إلغاء',exact:true}).boundingBox())!;
 expect(Math.max(save.x,cancel.x)-Math.min(save.x+save.width,cancel.x+cancel.width)).toBeGreaterThanOrEqual(11);
 const check=(await dialog.getByRole('checkbox').boundingBox())!;
 const text=(await dialog.locator('label span').boundingBox())!;
 expect(Math.max(check.x,text.x)-Math.min(check.x+check.width,text.x+text.width)).toBeGreaterThanOrEqual(8);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/deletion-settings/mobile-confirmation.png'});
});
