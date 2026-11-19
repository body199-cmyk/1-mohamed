import {test,expect,type Page} from '@playwright/test';

async function fixture(page:Page){
 const contractors=[{id:'K_AHMED',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
  {id:'K1',name:'المقاول الأول',is_primary:false,is_archived:false,version:1}];
 const vehicles=[{id:'V1',plate_number:'عربية ١',is_archived:false,version:1}];
 await page.route('**/api/ledger/master?**',route=>route.fulfill({json:{ok:true,hasMore:false,
  data:new URL(route.request().url()).searchParams.get('type')==='contractors'?contractors:
   new URL(route.request().url()).searchParams.get('type')==='vehicles'?vehicles:
    [{vehicle_id:'V1',contractor_id:'K_AHMED'}]}}));
 const attempts:{operation:string;payload:Record<string,unknown>}[]=[];
 await page.route('**/api/ledger/read',route=>{
  const body=route.request().postDataJSON();attempts.push(body);
  return route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'1:1',rows:[],total_count:'0',next_cursor:null,
   date_from:body.payload.all_history?'2001-02-03':body.payload.date_from,
   date_to:body.payload.all_history?'2026-11-14':body.payload.date_to,
   counterparty_contractor_id:'K1',vehicle_id:'V1',responsible_contractor_id:'K_AHMED',
   opening_balance_piastres:'0',ahmed_work_piastres:'0',counterparty_work_piastres:'0',
   closing_balance_piastres:'0',balance_magnitude_piastres:'0',beneficiary:'BALANCED',
   period_opening_piastres:'0',period_closing_piastres:'0',current_cash_balance_piastres:'0',work_piastres:'0',paid_piastres:'0'}}});
 });
 await page.goto('/');await expect(page.getByTestId('workspace-title')).toHaveText('اليومية');
 return attempts;
}

test('whole-history pagination retains filters and blocks partial exports',async({page})=>{
 await fixture(page);
 const attempts:Record<string,unknown>[]=[];
 await page.route('**/api/ledger/read',route=>{
  const payload=route.request().postDataJSON().payload;attempts.push(payload);
  const more=!!payload.cursor;
  return route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'1:1',total_count:'2',
   date_from:'2001-02-03',date_to:'2026-11-14',next_cursor:more?null:{date:'2001-02-03',id:'OLD'},
   rows:[{id:more?'NEW':'OLD',trip_date:more?'2026-11-14':'2001-02-03',vehicle_id:'V1',
    counterparty_contractor_id:'K1',contractor_total_piastres:'10000',weight_milli_tonnes:'1000',
    notes:more?'نقلة من الصفحة التالية':'نقلة من الصفحة الأولى'}]}}});
 });
 await page.getByRole('navigation').getByRole('button',{name:'التقارير والكشوف',exact:true}).click();
 await page.locator('#report-trip-vehicle').selectOption('V1');
 await page.locator('#report-trip-contractor').selectOption('K1');
 await page.getByRole('checkbox',{name:'كل الحساب من البداية',exact:true}).check();
 await expect(page.getByRole('status').filter({hasText:'البيانات تتحدث تلقائيًا'})).toBeVisible();
 await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'تحميل 200 سجل إضافي',exact:true}).click();
 await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).toBeVisible();
 expect(attempts[1]).toMatchObject({all_history:true,vehicle_id:'V1',counterparty_contractor_id:'K1',
  cursor:{date:'2001-02-03',id:'OLD'},snapshot:'1:1'});
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل CSV',exact:true}).click();
 const fs=await import('node:fs/promises');const csv=await fs.readFile((await(await download).path())!,'utf8');
 const rows=csv.split(/\r?\n/).filter(line=>/^"[١٢]","/.test(line));
 expect(rows).toHaveLength(2);
 expect(rows[0]).toMatch(/^"١","2001-02-03",.*"نقلة من الصفحة الأولى"/);
 expect(rows[1]).toMatch(/^"٢","2026-11-14",.*"نقلة من الصفحة التالية"/);
 expect(csv).not.toMatch(/"(OLD|NEW)"/);
});

for(const kind of ['trips','payments','contractor','cash'] as const){
 test(`${kind}: whole history preserves identity, manual dates, and resolved export period`,async({page})=>{
  const attempts=await fixture(page);
  await page.getByRole('navigation').getByRole('button',{name:kind==='contractor'?'حساب شغل المقاولين':kind==='cash'?'حسابات العربيات والدفعات':'التقارير والكشوف',exact:true}).click();
  const prefix=kind==='contractor'?'real-statement':kind==='cash'?'cash':'report';
  if(kind==='contractor')await page.locator('#real-statement-contractor').selectOption('K1');
  else if(kind==='cash')await page.locator('#cash-account').selectOption('V1|K_AHMED');
  else if(kind==='payments'){
   await page.locator('#report-type').selectOption('payments.list');
   await page.locator('#report-account').selectOption('V1|K_AHMED');
  }else{
   await page.locator('#report-trip-vehicle').selectOption('V1');
   await page.locator('#report-trip-contractor').selectOption('K1');
  }
  await page.locator(`#${prefix}-from`).fill('2026-10-01');
  await page.locator(`#${prefix}-to`).fill('2026-10-31');
  const scope=page.getByRole('checkbox',{name:'كل الحساب من البداية',exact:true});
  await scope.check();await expect(page.locator(`#${prefix}-from`)).toBeDisabled();
  if(kind==='contractor'||kind==='cash') await page.getByRole('button',{name:kind==='contractor'?'عرض كشف الحساب':'عرض كشف النقدية',exact:true}).click();
  await expect.poll(()=>attempts.length).toBe(1);
  expect(attempts[0].payload.all_history).toBe(true);
  expect(attempts[0].payload.date_from).toBeUndefined();
  expect(attempts[0].payload).toMatchObject(kind==='contractor'?{counterparty_contractor_id:'K1'}:
   kind==='trips'?{vehicle_id:'V1',counterparty_contractor_id:'K1'}:{vehicle_id:'V1',responsible_contractor_id:'K_AHMED'});
  await expect(page.getByText('كل الحساب من البداية: 2001-02-03 — 2026-11-14')).toBeVisible();
  if(kind==='contractor'){
   const summary=page.getByLabel('ملخص حساب المقاول');
   await expect(summary).toContainText('رصيد آخر الفترة');
   await expect(summary).toContainText('رصيد أول الفترة');
   await expect(summary).toContainText('شغل أحمد');
   await expect(summary).toContainText('شغل المقاول');
  }
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل CSV',exact:true}).click();
  const fs=await import('node:fs/promises');
  expect(await fs.readFile((await (await download).path())!,'utf8')).toContain('2001-02-03');
  if(kind==='contractor'||kind==='cash')await page.getByText(kind==='cash'?'تغيير العربية أو فترة الكشف':'تغيير المقاول أو فترة الكشف',{exact:true}).click();
  await scope.uncheck();await expect(page.locator(`#${prefix}-from`)).toHaveValue('2026-10-01');
  await expect(page.locator(`#${prefix}-to`)).toHaveValue('2026-10-31');
  await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).toHaveCount(0);
 });
}
