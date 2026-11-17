import {test,expect} from '@playwright/test';
test.use({timezoneId:'Africa/Cairo'});
for(const width of [390,1440])for(const theme of ['light','dark'])test(`login layout ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:940});
 await page.goto('/login');
 await page.getByRole('button',{name:theme==='dark'?'داكن':'فاتح',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
 await expect(page.getByRole('heading',{name:'تسجيل الدخول',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const input of await page.locator('input:not([type=checkbox]),button').all()){
  if(await input.isVisible())expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 }
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`artifacts/login-theme/login-${width}-${theme}.png`,fullPage:true});
 await page.getByRole('button',{name:'نسيت كلمة المرور؟',exact:true}).click();
 await expect(page.getByLabel('البريد الإلكتروني',{exact:true})).toBeVisible();
 await page.screenshot({path:`artifacts/login-theme/recovery-${width}-${theme}.png`,fullPage:true});
});
test('auto follows the local clock while manual selection persists across time and reload',async({page})=>{
 await page.clock.install({time:new Date('2026-11-17T17:59:00+02:00')});
 await page.goto('/login');
 await page.getByRole('button',{name:'تلقائي',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.clock.runFor(61000);
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await expect(page.locator('html')).toHaveAttribute('data-theme-mode','auto');
 await page.getByRole('button',{name:'فاتح',exact:true}).click();
 await page.clock.runFor(61000);
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme-mode','light');
 await expect(page.getByRole('button',{name:'فاتح',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.clock.setSystemTime(new Date('2026-11-18T05:59:00+02:00'));
 await page.getByRole('button',{name:'تلقائي',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.clock.runFor(61000);
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-theme-mode','auto');
});
test('320px login supports stored preferences and unavailable local storage',async({page})=>{
 await page.setViewportSize({width:320,height:740});
 await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('Storage disabled');}});});
 await page.goto('/login');await page.getByRole('button',{name:'داكن',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
