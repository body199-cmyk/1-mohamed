import {test,expect,type Page} from '@playwright/test';
const contractors=[{id:'K_AHMED',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
 {id:'K1',name:'المقاول الأول',is_primary:false,is_archived:false,version:1}];
const vehicles=[{id:'V1',plate_number:'عربية ١',driver_name:'السائق',notes:null,is_archived:false,version:1}];
const accounts=[{vehicle_id:'V1',contractor_id:'K_AHMED'},{vehicle_id:'V1',contractor_id:'K1'}];
const row={id:'T1',trip_date:'2026-01-02',vehicle_id:'V1',counterparty_contractor_id:'K1',responsible_contractor_id:'K_AHMED',
 direction:'AHMED_SUPPLIES',weight_milli_tonnes:'1000',contractor_rate_piastres:'10000',vehicle_rate_piastres:'9000',
 expense_piastres:'0',contractor_total_piastres:'10000',vehicle_total_piastres:'9000',is_cancelled:false,version:1,
 same_rate:false,origin:'القاهرة',destination:'السويس',notes:'',cancel_reason:null};
async function fixture(page:Page){
 await page.route('**/api/ledger/master?**',route=>{const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});});
 await page.route('**/api/ledger/operations',route=>route.fulfill({json:{ok:true,data:{status:'OK'}}}));
 await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',
  rows:[],total_count:'0',next_cursor:null,current_cash_balance_piastres:'28000'}}}));
 await page.goto('/');await expect(page.getByText('ابدأ يومك',{exact:true})).toBeVisible();
}
async function nav(page:Page,label:string){await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();}
async function trip(page:Page){
 await nav(page,'تسجيل الشغل والدفعات');
 await page.locator('#real-trip-vehicle').selectOption('V1');await page.locator('#real-trip-counterparty').selectOption('K1');
 await page.locator('#real-trip-date').fill('2026-01-02');await page.locator('#real-trip-weight').fill('١٫٢٥٠');
 await page.locator('#real-trip-contractor-rate').fill('١٠٠');
}
test('mobile real workspace preserves draft, saves canonical Arabic input and exits',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);await trip(page);
 await nav(page,'الإعدادات');await nav(page,'تسجيل الشغل والدفعات');await expect(page.locator('#real-trip-weight')).toHaveValue('١٫٢٥٠');
 const saved=page.waitForRequest(r=>r.url().includes('/api/ledger/operations'));
 await page.getByRole('button',{name:'حفظ وخروج',exact:true}).click();const payload=(await saved).postDataJSON();
 expect(payload.operation).toBe('trip.create');expect(payload.payload.weight_tonnes).toBe('1.250');expect(payload.payload.contractor_rate_egp).toBe('100');
 await expect(page.getByText('ابدأ يومك',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'artifacts/closeout/workspace-mobile.png',fullPage:true});
});
test('retry reuses request identity; same-tick submits cannot duplicate a transaction',async({page})=>{
 await fixture(page);await trip(page);const requests:any[]=[];
 await page.route('**/api/ledger/operations',async route=>{requests.push(route.request().postDataJSON());
  if(requests.length===1)return route.abort('failed');return route.fulfill({json:{ok:true,data:{status:'OK'}}});});
 await page.getByRole('button',{name:'حفظ وإضافة نقلة جديدة',exact:true}).click();
 await expect(page.getByText('انقطع الاتصال ولم تتأكد نتيجة الحفظ. أعد المحاولة بنفس البيانات.')).toBeVisible();
 await page.getByRole('button',{name:'حفظ وإضافة نقلة جديدة',exact:true}).evaluate((b:HTMLButtonElement)=>{b.click();b.click();});
 await expect(page.getByText('تم حفظ النقلة بنجاح.',{exact:true})).toBeVisible();
 expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
});
test('payment preview is exact and invalid amount has no after value',async({page})=>{
 await fixture(page);await nav(page,'تسجيل الشغل والدفعات');
 await page.locator('#real-payment-account').selectOption('V1|K_AHMED');await page.locator('#real-payment-amount').fill('١٠٠');
 const preview=page.getByLabel('معاينة رصيد الدفعة');await expect(preview).toContainText('280.00');await expect(preview).toContainText('180.00');
 await page.locator('#real-payment-amount').fill('1.001');await expect(preview).not.toContainText('الرصيد المتوقع');
});
test('changed snapshot stops full export; complete daily report displays exact SQL totals',async({page})=>{
 await fixture(page);let more=false;
 await page.route('**/api/ledger/read',route=>{const p=route.request().postDataJSON();more=!!p.payload.cursor;
  return route.fulfill({json:{ok:true,data:{status:'OK',snapshot:more?'11:11':'10:10',total_count:'2',
   rows:[{...row,id:more?'T2':'T1'}],next_cursor:more?null:{date:'2026-01-02',id:'T1'},totals:{active_count:'2',weight_milli_tonnes:'2000',contractor_total_piastres:'20000',vehicle_total_piastres:'18000',ahmed_work_piastres:'20000',counterparty_work_piastres:'0'}}}});});
 await nav(page,'النقلات واليومية');await page.locator('#report-from').fill('2026-01-02');await page.locator('#report-to').fill('2026-01-02');
 await page.getByRole('button',{name:'تحميل التقرير',exact:true}).click();await expect(page.getByLabel('ملخص الشغل')).toContainText('200.00');
 await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).not.toBeVisible();
 await page.getByRole('button',{name:'تحميل 200 سجل إضافي',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('تغيرت البيانات');await expect(page.getByRole('button',{name:'تنزيل CSV',exact:true})).not.toBeVisible();
 expect(more).toBe(true);
});
test('cash statement shows both sources and exports exact complete CSV',async({page})=>{
 await fixture(page);await page.route('**/api/ledger/read',route=>route.fulfill({json:{ok:true,data:{status:'OK',snapshot:'10:10',total_count:'2',next_cursor:null,
 date_from:'2026-01-02',date_to:'2026-01-02',vehicle_id:'V1',responsible_contractor_id:'K_AHMED',period_opening_piastres:'10000',work_piastres:'9000',paid_piastres:'4000',period_closing_piastres:'15000',current_cash_balance_piastres:'15000',
 rows:[{id:'T1',date:'2026-01-02',movement_type:'WORK',signed_delta_piastres:'9000',running_balance_piastres:'19000',origin:'القاهرة',destination:'السويس'},
 {id:'P1',date:'2026-01-02',movement_type:'PAYMENT',signed_delta_piastres:'-4000',running_balance_piastres:'15000'}]}}}));
 await nav(page,'نقدية العربية');await page.locator('#cash-account').selectOption('V1|K_AHMED');
 await page.locator('#cash-from').fill('2026-01-02');await page.locator('#cash-to').fill('2026-01-02');
 await page.getByRole('button',{name:'عرض كشف النقدية',exact:true}).click();await expect(page.getByLabel('كشف نقدية العربية')).toContainText('150.00');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل CSV',exact:true}).click();
 const fs=await import('node:fs/promises');const text=await fs.readFile((await (await download).path())!,'utf8');
 expect(text).toContain('T1');expect(text).toContain('P1');expect(text).toContain('السويس');expect(text).toContain('150.00');
});
