import {test,expect,type Page} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';

// Actual workspace components, isolated HTTP fixtures only. Never calls Supabase.
const contractors=[
 {id:'OWNER',name:'أحمد أبو علي',is_primary:true,is_archived:false,version:1},
 {id:'C1',name:'شركة النور للمقاولات',is_primary:false,is_archived:false,version:1}
];
const vehicles=[{id:'V1',plate_number:'د هـ و 5678',driver_name:'محمود حسن',is_archived:false,version:1}];
const accounts=[{vehicle_id:'V1',contractor_id:'OWNER'},{vehicle_id:'V1',contractor_id:'C1'}];
const base={status:'OK',snapshot:'10:10',total_count:'1',next_cursor:null,
 date_from:'2026-11-01',date_to:'2026-11-16'};
const trip={id:'TR-101',trip_date:'2026-11-16',vehicle_id:'V1',counterparty_contractor_id:'C1',
 responsible_contractor_id:'OWNER',direction:'AHMED_SUPPLIES',weight_milli_tonnes:'25000',
 contractor_rate_piastres:'120000',vehicle_rate_piastres:'110000',expense_piastres:'50000',
 contractor_total_piastres:'3050000',vehicle_total_piastres:'2800000',is_cancelled:false,version:1,
 same_rate:false,origin:'بني سويف',destination:'القاهرة',notes:'بيانات تجريبية للمعاينة',cancel_reason:null};
const statement={...base,counterparty_contractor_id:'C1',opening_balance_piastres:'500000',
 ahmed_work_piastres:'3050000',counterparty_work_piastres:'1000000',closing_balance_piastres:'2550000',
 balance_magnitude_piastres:'2550000',beneficiary:'AHMED',total_count:'2',rows:[
  {...trip,signed_delta_piastres:'3050000',running_balance_piastres:'3550000'},
  {...trip,id:'TR-102',trip_date:'2026-11-16',direction:'OTHER_SUPPLIES',responsible_contractor_id:'C1',
   weight_milli_tonnes:'10000',contractor_rate_piastres:'100000',vehicle_rate_piastres:'100000',
   expense_piastres:'0',same_rate:true,contractor_total_piastres:'1000000',vehicle_total_piastres:'1000000',
   signed_delta_piastres:'-1000000',running_balance_piastres:'2550000'}
 ]};
const cash={...base,vehicle_id:'V1',responsible_contractor_id:'OWNER',period_opening_piastres:'500000',
 work_piastres:'2800000',paid_piastres:'1200000',period_closing_piastres:'2100000',
 current_cash_balance_piastres:'2100000',total_count:'2',rows:[
  {id:'TR-101',date:'2026-11-16',movement_type:'WORK',signed_delta_piastres:'2800000',
   running_balance_piastres:'3300000',origin:'بني سويف',destination:'القاهرة'},
  {id:'PAY-101',date:'2026-11-16',movement_type:'PAYMENT',signed_delta_piastres:'-1200000',
   running_balance_piastres:'2100000',notes:'دفعة تجريبية'}
 ]};
const report={...base,rows:[trip],totals:{active_count:'1',weight_milli_tonnes:'25000',
 contractor_total_piastres:'3050000',vehicle_total_piastres:'2800000',
 ahmed_work_piastres:'3050000',counterparty_work_piastres:'0'}};

async function prepare(page:Page){
 let writes=0;
 await page.route('**/api/ledger/master?**',route=>{
  const type=new URL(route.request().url()).searchParams.get('type');
  return route.fulfill({json:{ok:true,data:type==='contractors'?contractors:type==='vehicles'?vehicles:accounts,hasMore:false}});
 });
 await page.route('**/api/ledger/read',route=>{
  const operation=route.request().postDataJSON().operation;
  const data=operation==='contractor.statement'?statement:operation==='cash.statement'?cash:
   operation==='trips.list'?report:{current_cash_balance_piastres:'2100000'};
  return route.fulfill({json:{ok:true,data}});
 });
 await page.route('**/api/ledger/operations',route=>{writes++;return route.abort();});
 await page.goto('/');
 await expect(page.getByTestId('workspace-title')).toHaveText('اليومية');
 await expect(page.locator('#real-trip-vehicle option[value="V1"]')).toHaveCount(1);
 await page.evaluate(()=>document.fonts.ready);
 return ()=>writes;
}

for(const mobile of [true,false])for(const dark of [false,true]){
 test(`review evidence / ${mobile?'mobile':'desktop'} / ${dark?'dark':'light'}`,async({page})=>{
  await page.setViewportSize(mobile?{width:390,height:844}:{width:1440,height:1000});
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
  const writes=await prepare(page);
  if(dark)await page.getByRole('button',{name:'تبديل الوضع الفاتح/الداكن'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme',dark?'dark':'light');
  const folder=`artifacts/ui-review-87/${mobile?'mobile':'desktop'}-${dark?'dark':'light'}`;
  await mkdir(folder,{recursive:true});
  const geometry:Record<string,unknown>[]=[];
  async function capture(name:string){
   const sizes=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,
    height:innerHeight,scrollY,theme:document.documentElement.dataset.theme}));
   expect(sizes.document,name).toBeLessThanOrEqual(sizes.viewport);
   expect(await page.getByRole('alert').count(),name).toBe(0);
   geometry.push({name,...sizes});
   await page.screenshot({path:`${folder}/${name}.png`});
  }
  async function nav(title:string){
   await page.getByRole('navigation').getByRole('button',{name:title,exact:true}).click();
   await expect(page.getByTestId('workspace-title')).toHaveText(title);
   await page.evaluate(()=>scrollTo(0,0));
  }
  await page.locator('#shared-contractor').selectOption('C1');
  await page.locator('#shared-date').fill('2026-11-16');
  await page.locator('#shared-contractor-rate').fill('1200');
  await page.locator('#shared-origin').fill('بني سويف');
  await page.locator('#shared-destination').fill('القاهرة');
  await page.evaluate(()=>scrollTo(0,0));await capture('00-shared-setup');
  await page.getByRole('button',{name:'اعتماد بيانات الشغل',exact:true}).click();
  await expect(page.getByLabel('ملخص الشغل المعتمد')).toBeVisible();
  await page.locator('#real-trip-vehicle').selectOption('V1');
  await page.locator('#real-trip-weight').fill('25');
  await page.locator('#real-trip-expense').fill('500');
  await page.evaluate(()=>scrollTo(0,0));
  await capture('01-daily');
  await page.screenshot({path:`${folder}/01-daily-full.png`,fullPage:true});
  await page.getByRole('button',{name:'حفظ وإضافة نقلة جديدة',exact:true}).scrollIntoViewIfNeeded();
  await capture('02-trip-preview');
  await page.locator('#real-payment-account').selectOption('V1|OWNER');
  await page.locator('#real-payment-amount').fill('12000');
  await page.getByLabel('معاينة رصيد الدفعة').scrollIntoViewIfNeeded();
  await expect(page.getByLabel('معاينة رصيد الدفعة')).toContainText('9,000');
  await capture('03-payment');
  await page.evaluate(()=>scrollTo(0,0));
  if(mobile){
   await page.locator('[data-testid="mobile-more"] summary').click();
   await capture('04-more');
   await page.keyboard.press('Escape');
   await expect(page.locator('[data-testid="mobile-more"]')).not.toHaveAttribute('open','');
  }
  await nav('حساب شغل المقاولين');
  await page.locator('#real-statement-contractor').selectOption('C1');
  await page.locator('#real-statement-from').fill('2026-11-01');
  await page.locator('#real-statement-to').fill('2026-11-16');
  await page.getByRole('button',{name:'عرض كشف الحساب',exact:true}).click();
  await expect(page.getByLabel('ملخص حساب المقاول')).toContainText('25,500');
  await page.evaluate(()=>scrollTo(0,0));await capture('05-contractor-filters');
  await page.getByLabel('ملخص حساب المقاول').scrollIntoViewIfNeeded();
  await capture('06-contractor-summary');
  await page.screenshot({path:`${folder}/06-contractor-full.png`,fullPage:true});
  await nav('حسابات العربيات والدفعات');
  await page.locator('#cash-account').selectOption('V1|OWNER');
  await page.locator('#cash-from').fill('2026-11-01');
  await page.locator('#cash-to').fill('2026-11-16');
  await page.getByRole('button',{name:'عرض كشف النقدية',exact:true}).click();
  await expect(page.getByLabel('ملخص نقدية العربية')).toContainText('21,000');
  await page.evaluate(()=>scrollTo(0,0));await capture('07-cash-filters');
  await page.getByLabel('ملخص نقدية العربية').scrollIntoViewIfNeeded();
  await capture('08-cash-summary');
  await page.screenshot({path:`${folder}/08-cash-full.png`,fullPage:true});
  await nav('التقارير والكشوف');
  await page.locator('#report-from').fill('2026-11-01');
  await page.locator('#report-to').fill('2026-11-16');
  await page.getByRole('button',{name:'تحميل التقرير',exact:true}).click();
  await expect(page.getByLabel('ملخص الشغل',{exact:true})).toContainText('30,500');
  await page.evaluate(()=>scrollTo(0,0));await capture('09-reports-filters');
  await page.getByLabel('ملخص الشغل',{exact:true}).scrollIntoViewIfNeeded();
  await capture('10-reports-summary');
  await page.screenshot({path:`${folder}/10-reports-full.png`,fullPage:true});
  await nav('اليومية');
  const recorded=page.getByLabel('النقلات المسجلة في اليومية');
  await expect(recorded).toContainText('TR-101');
  await recorded.scrollIntoViewIfNeeded();await capture('11-daily-recorded');
  expect(writes()).toBe(0);
  await writeFile(`${folder}/capture-context.json`,JSON.stringify({
   synthetic:true,liveSupabase:false,writes:writes(),source:'actual private-workspace components',geometry
  },null,2));
 });
}
