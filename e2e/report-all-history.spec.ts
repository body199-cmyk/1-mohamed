import {test,expect} from '@playwright/test';

test('demo report history preserves selected filters and restores the existing date view',async({page})=>{
 await page.goto('/demo/reports/daily');
 await page.getByLabel('تاريخ التقرير',{exact:true}).fill('2026-11-05');
 await page.getByLabel('فلتر المقاول',{exact:true}).selectOption('K1');
 const scope=page.getByRole('checkbox',{name:'كل الحساب من البداية',exact:true});
 await scope.check();await expect(page.getByRole('table',{name:'نقلات كل الحساب'}).locator('tbody tr')).toHaveCount(3);
 await expect(page.getByRole('region',{name:'إجمالي كل الحساب',exact:true})).toContainText('1,900 ج.م');
 await expect(page.getByRole('columnheader',{name:'التاريخ',exact:true})).toBeVisible();
 await page.getByLabel('فلتر العربية',{exact:true}).selectOption('V1');
 await expect(page.getByRole('table',{name:'نقلات كل الحساب'}).locator('tbody tr')).toHaveCount(1);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'تنزيل CSV',exact:true}).click();
 const fs=await import('node:fs/promises');const csv=await fs.readFile((await(await download).path())!,'utf8');
 expect(csv).toContain('كل الحساب من البداية');expect(csv).toContain('2026-11-02');expect(csv).toContain('التاريخ');
 await scope.uncheck();await expect(page.getByLabel('تاريخ التقرير',{exact:true})).toHaveValue('2026-11-05');
 await expect(page.getByRole('main').getByRole('status').filter({hasText:'لا توجد نقلات'})).toContainText('لا توجد نقلات');
 await page.goto('/demo/reports/vehicle-cash');
 await page.getByLabel('من تاريخ كشف العربية',{exact:true}).fill('2026-11-03');
 await page.getByRole('checkbox',{name:'كل الحساب من البداية',exact:true}).check();
 await expect(page.getByRole('region',{name:'ملخص كشف نقد العربية',exact:true})).toContainText('280 ج.م');
 await page.getByRole('checkbox',{name:'كل الحساب من البداية',exact:true}).uncheck();
 await expect(page.getByLabel('من تاريخ كشف العربية',{exact:true})).toHaveValue('2026-11-03');
 await page.goto('/demo/contractors');
 await page.getByLabel('نطاق كشف الحساب',{exact:true}).selectOption('history');
 await expect(page.getByRole('columnheader',{name:'رقم النقلة',exact:true})).toBeVisible();
 await expect(page.getByLabel('إلى تاريخ',{exact:true})).toBeDisabled();
});
