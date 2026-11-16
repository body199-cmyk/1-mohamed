import type {Page} from '@playwright/test';
export async function openTripExpense(page:Page){
 const details=page.locator('details').filter({has:page.locator('#real-trip-expense')});
 if(!await details.evaluate(el=>el.hasAttribute('open')))await details.locator('summary').click();
}
export async function restoreShared(page:Page){
 const applied=page.getByLabel('ملخص الشغل المعتمد').locator('details');
 const button=page.getByRole('button',{name:'استخدام بيانات آخر شغل',exact:true});
 if(!await button.isVisible()&&await applied.count())await applied.locator('summary').click();
 await button.click();
}
