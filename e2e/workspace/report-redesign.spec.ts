import {test,expect,type Page} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createSqlLedger} from './support/sql-ledger';
let sql:Awaited<ReturnType<typeof createSqlLedger>>;
test.beforeEach(async()=>{test.setTimeout(120000);sql=await createSqlLedger();
 await sql.write('vehicle.account.ensure',{vehicle_id:'V1',contractor_id:'C1'});
 const base={vehicle_id:'V1',counterparty_contractor_id:'C1',trip_date:'2026-11-10',direction:'AHMED_SUPPLIES',same_rate:false,origin:'بني سويف',destination:'القاهرة',notes:'توريد موقع النور',contractor_rate_egp:'100',vehicle_rate_egp:'80',expense_egp:'0'};
 await sql.write('trip.create',{...base,id:'R1',weight_tonnes:'25',expense_egp:'50'});
 await sql.write('trip.create',{...base,id:'R2',weight_tonnes:'12.5'});
 await sql.write('trip.create',{...base,id:'R3',direction:'OTHER_SUPPLIES',trip_date:'2026-11-11',weight_tonnes:'10',contractor_rate_egp:'200',vehicle_rate_egp:'150',origin:'المنيا',destination:'الجيزة'});
});
test.afterEach(async()=>{await sql?.db.close();});
async function enter(page:Page){await sql.connect(page);await page.goto('/');await expect(page.locator('#shared-contractor option[value="C1"]')).toHaveCount(1);}
async function cash(page:Page){await page.getByRole('navigation').getByRole('button',{name:'حسابات العربيات والدفعات',exact:true}).click();if(!await page.locator('#cash-account').isVisible())await page.getByText('تغيير العربية أو فترة الكشف',{exact:true}).click();await page.locator('#cash-account').selectOption('V1|K_AHMED');await page.locator('#cash-from').fill('2026-11-01');await page.locator('#cash-to').fill('2026-11-16');await page.getByRole('button',{name:'عرض كشف النقدية',exact:true}).click();await expect(page.getByLabel('ملخص نقدية العربية')).toBeVisible();}
async function contractor(page:Page,id='C1'){await page.getByRole('navigation').getByRole('button',{name:'حساب شغل المقاولين',exact:true}).click();if(!await page.locator('#real-statement-contractor').isVisible())await page.getByText('تغيير المقاول أو فترة الكشف',{exact:true}).click();await page.locator('#real-statement-contractor').selectOption(id);await page.locator('#real-statement-from').fill('2026-11-01');await page.locator('#real-statement-to').fill('2026-11-16');await page.getByRole('button',{name:'عرض كشف الحساب',exact:true}).click();await expect(page.getByLabel('ملخص حساب المقاول')).toBeVisible();}
async function payment(amount='1200'){await sql.write('payment.create',{id:'PAY-'+amount,vehicle_id:'V1',responsible_contractor_id:'K_AHMED',payment_date:'2026-11-12',amount_egp:amount,notes:'دفعة مستلمة بتاريخها'});}

test('SQL: payment changes only vehicle cash, both work directions and complete filtered details remain truthful',async({page})=>{
 const before=await sql.read('contractor.statement',{counterparty_contractor_id:'C1',date_from:'2026-11-01',date_to:'2026-11-16'});await payment();
 const after=await sql.read('contractor.statement',{counterparty_contractor_id:'C1',date_from:'2026-11-01',date_to:'2026-11-16'});
 expect(after.closing_balance_piastres).toBe(before.closing_balance_piastres);expect(after.closing_balance_piastres).toBe('180000');
 await enter(page);await cash(page);await expect(page.getByLabel('ملخص نقدية العربية')).toContainText('2,850');
 const trips=page.getByLabel('تفاصيل نقلات العربية');await expect(trips.locator('li')).toHaveCount(2);await expect(trips).toContainText('25.000');await expect(trips).toContainText('12.500');await expect(trips).toContainText('80');await expect(trips).toContainText('50');await expect(trips).not.toContainText('المنيا');
 await expect(page.getByLabel('إجمالي كشف العربية')).toContainText('37.500');await expect(page.getByLabel('إجمالي كشف العربية')).toContainText('3,050');
 await contractor(page);await expect(page.getByLabel('ملخص حساب المقاول')).toContainText('لأحمد أبو علي عند شركة النور');
 await expect(page.locator('article[data-tone="credit"]')).toHaveCount(2);await expect(page.locator('article[data-tone="debit"]')).toHaveCount(1);
 await page.getByText('فلترة تفاصيل الشغل — العربية والطريق والاتجاه',{exact:true}).click();await page.getByLabel('فلتر اتجاه الشغل',{exact:true}).selectOption('OTHER_SUPPLIES');await expect(page.locator('article[data-tone="debit"]')).toHaveCount(1);await expect(page.locator('article[data-tone="credit"]')).toHaveCount(0);
 await expect(page.getByLabel('ملخص حساب المقاول')).toContainText('1,800');await expect(page.getByText('إجمالي الشغل المطابق',{exact:true}).locator('..')).toContainText('10.000');
 await page.getByRole('navigation').getByRole('button',{name:'التقارير والكشوف',exact:true}).click();await page.getByRole('button',{name:'فتح كشف العربية',exact:true}).click();await expect(page.getByTestId('workspace-title')).toHaveText('حسابات العربيات والدفعات');
});

for(const mobile of [true,false])for(const dark of [false,true])test(`report redesign SQL evidence / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
 await payment();await page.clock.setFixedTime(new Date('2026-11-16T12:00:00Z'));await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await enter(page);if(dark)await page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'}).click();
 const dir=`artifacts/ui-review-87/reports-redesign/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}`;await mkdir(dir,{recursive:true});
 async function capture(name:string,target:ReturnType<Page['locator']>){await target.evaluate(el=>el.scrollIntoView({block:'start'}));await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:dir+'/'+name+'.png'});}
 await cash(page);await capture('01-vehicle-summary',page.getByLabel('ملخص نقدية العربية'));
 await capture('02-vehicle-trips',page.getByText('نقلات العربية',{exact:true}));await capture('03-vehicle-total',page.getByLabel('إجمالي كشف العربية'));
 {for(const [label,ext] of [['تنزيل CSV','csv'],['تنزيل Excel XLSX','xlsx'],['تنزيل صورة PNG','png'],['تنزيل PDF مباشر','pdf']] as const){const d=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const file=await d;await file.saveAs(dir+'/vehicle.'+ext);expect(await file.failure()).toBeNull();}}
 const vehicleCsv=await readFile(dir+'/vehicle.csv','utf8');for(const field of ['رقم العربية','المقاول المسؤول','من تاريخ','إلى تاريخ','تاريخ النقلة','من','إلى','الأطنان','سعر الطن','المصاريف','إجمالي النقلة','الدفعات المستلمة'])expect(vehicleCsv).toContain(field);expect(vehicleCsv).not.toContain('TRIP-');expect(vehicleCsv).not.toContain('R1');expect(vehicleCsv).not.toContain('ملاحظة');expect(vehicleCsv).not.toContain('توريد موقع النور');
 await contractor(page);await capture('04-contractor-summary',page.getByLabel('ملخص حساب المقاول'));await capture('05-contractor-work',page.locator('article[data-tone="credit"]').first());
 {
  for(const [label,ext] of [['تنزيل CSV','csv'],['تنزيل Excel XLSX','xlsx'],['تنزيل صورة PNG','png'],['تنزيل PDF مباشر','pdf']] as const){const d=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const download=await d;await download.saveAs(dir+'/contractor.'+ext);expect(await download.failure()).toBeNull();}
  const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'طباعة / حفظ PDF',exact:true}).click();const print=await popup;await expect(print.locator('body')).toContainText('دفعات العربيات');await writeFile(dir+'/contractor-print.html',await print.content());await print.close();
  const text=await (await import('node:fs/promises')).readFile(dir+'/contractor.csv','utf8');expect(text).toContain('شغل على أحمد أبو علي');expect(text).toContain('شغل لأحمد أبو علي');for(const field of ['اسم المقاول','من تاريخ','إلى تاريخ','رقم العربية','اتجاه الشغل'])expect(text).toContain(field);
 }
 await writeFile(dir+'/sql-proof.json',JSON.stringify({hosted:false,source:'actual report components + original PostgreSQL RPCs',contractor:await sql.read('contractor.statement',{counterparty_contractor_id:'C1',date_from:'2026-11-01',date_to:'2026-11-16'}),cash:await sql.read('cash.statement',{vehicle_id:'V1',responsible_contractor_id:'K_AHMED',date_from:'2026-11-01',date_to:'2026-11-16'})},null,2));
});

for(const state of ['zero','negative'] as const)test(`SQL report balance state ${state} remains explicit`,async({page})=>{
 await payment('4050');if(state==='negative')await sql.write('trip.update',{id:'R1',expected_version:1,reason:'تصحيح قيمة الشغل في الاختبار',vehicle_id:'V1',counterparty_contractor_id:'C1',trip_date:'2026-11-10',direction:'AHMED_SUPPLIES',weight_tonnes:'25',contractor_rate_egp:'0',vehicle_rate_egp:'0',same_rate:false,expense_egp:'50',notes:'تصحيح مع الاحتفاظ بالدفعة',origin:'بني سويف',destination:'القاهرة'});
 await page.setViewportSize({width:390,height:844});await enter(page);await cash(page);await expect(page.getByLabel('ملخص نقدية العربية')).toContainText(state==='zero'?'الحساب متعادل':'على العربية');const dir='artifacts/ui-review-87/reports-redesign/balance-states';await mkdir(dir,{recursive:true});await page.getByLabel('ملخص نقدية العربية').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:dir+'/vehicle-'+state+'.png'});
 await contractor(page,state==='zero'?'C2':'C1');await expect(page.getByLabel('ملخص حساب المقاول')).toContainText(state==='zero'?'الحساب متعادل':'على أحمد أبو علي');await page.getByLabel('ملخص حساب المقاول').evaluate(el=>el.scrollIntoView({block:'start'}));await page.screenshot({path:dir+'/contractor-'+state+'.png'});
});

test('snapshot mismatch in supplementary trip read blocks mixed report and exports',async({page})=>{
 await enter(page);await page.route('**/api/ledger/read',async route=>{const b=route.request().postDataJSON();if(b.operation==='trips.list'&&b.payload.snapshot)return route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'999:999',total_count:'0',rows:[],next_cursor:null}}});return route.fallback();});
 await page.getByRole('navigation').getByRole('button',{name:'حسابات العربيات والدفعات',exact:true}).click();await page.locator('#cash-account').selectOption('V1|K_AHMED');await page.locator('#cash-from').fill('2026-11-01');await page.locator('#cash-to').fill('2026-11-16');await page.getByRole('button',{name:'عرض كشف النقدية',exact:true}).click();await expect(page.getByRole('alert')).toContainText('تغيرت البيانات');await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).toHaveCount(0);
});


test('export PNG and PDF bytes stay identical across mobile/desktop and light/dark',async({page})=>{
 await payment();await page.clock.setFixedTime(new Date('2026-11-16T12:00:00Z'));await enter(page);
 const fs=await import('node:fs/promises');const crypto=await import('node:crypto');const evidence:Record<string,unknown>[]=[];
 const expected=new Map<string,string>();
 for(const device of ['mobile','desktop'])for(const theme of ['light','dark']){
  await page.setViewportSize(device==='mobile'?{width:390,height:844}:{width:1440,height:1000});
  await page.evaluate(value=>document.documentElement.setAttribute('data-theme',value),theme);
  for(const report of ['vehicle','contractor']){
   if(report==='vehicle')await cash(page);else await contractor(page);
   for(const [label,ext] of [['تنزيل صورة PNG','png'],['تنزيل PDF مباشر','pdf']] as const){
    const event=page.waitForEvent('download');await page.getByRole('button',{name:label,exact:true}).click();const d=await event;expect(await d.failure()).toBeNull();const bytes=await fs.readFile((await d.path())!);const hash=crypto.createHash('sha256').update(bytes).digest('hex');const key=report+'.'+ext;
    if(expected.has(key))expect(hash,key+' must not reflow by viewport/theme').toBe(expected.get(key));else expected.set(key,hash);
    if(ext==='png'){
     const image=page.getByRole('region',{name:'معاينة التقرير',exact:true}).getByRole('img');
     await expect(image).toBeVisible();
     const previewHash=await image.evaluate(async el=>{
      const bytes=await (await fetch((el as HTMLImageElement).src)).arrayBuffer();
      return Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
     });
     expect(previewHash,report+' preview must match PNG export').toBe(hash);
    }
    evidence.push({device,theme,report,ext,bytes:bytes.length,sha256:hash});
   }
  }
 }
 await fs.mkdir('artifacts/ui-review-87/reports-redesign',{recursive:true});await fs.writeFile('artifacts/ui-review-87/reports-redesign/export-device-invariance.json',JSON.stringify(evidence,null,2));
});
