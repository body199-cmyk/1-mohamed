import{test,expect,type Page}from'@playwright/test';
const user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'owner@example.test',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:9999999999})).toString('base64url'),'fixture'].join('.');
async function network(page:Page,owner=true){
 const requests:{path:string;method:string;body:unknown}[]=[];
 await page.route('https://fixture.supabase.co/**',route=>{
  const r=route.request(),path=new URL(r.url()).pathname;requests.push({path,method:r.method(),body:r.postDataJSON()});
  if(path==='/auth/v1/user')return route.fulfill({json:user});
  if(path==='/rest/v1/rpc/app_is_owner')return route.fulfill({json:owner});
  if(path==='/auth/v1/recover')return route.fulfill({json:{}});
  if(path==='/auth/v1/token')return route.fulfill({json:{access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user}});
  if(path==='/auth/v1/logout')return route.fulfill({status:204});
  return route.abort();
 });return requests;
}
test('login reveals/hides password, offers remember choice and sends cross-browser recovery request',async({page})=>{
 const requests=await network(page);await page.goto('/login');
 await page.getByLabel('كلمة المرور',{exact:true}).fill('fixture-password');
 await page.getByRole('button',{name:'إظهار كلمة المرور',exact:true}).click();
 await expect(page.getByLabel('كلمة المرور',{exact:true})).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'إخفاء كلمة المرور',exact:true}).click();
 await expect(page.getByLabel('كلمة المرور',{exact:true})).toHaveAttribute('type','password');
 await page.getByRole('checkbox',{name:'تذكر دخولي على هذا المتصفح'}).check();
 await page.getByRole('button',{name:'نسيت كلمة المرور؟'}).click();
 await page.getByLabel('البريد الإلكتروني',{exact:true}).fill('owner@example.test');
 await page.getByRole('button',{name:'إرسال رابط الاسترجاع'}).click();
 await expect(page.getByRole('status')).toContainText('هتوصله تعليمات');
 const body=requests.find(r=>r.path==='/auth/v1/recover')!.body as Record<string,unknown>;
 expect(body.email).toBe('owner@example.test');expect(body.code_challenge??null).toBeNull();
});
for(const remember of [false,true])test(`remember=${remember}: authenticated cookie follows the selected persistence`,async({page,context})=>{
 await network(page);await page.goto('/login');
 await page.getByLabel('البريد الإلكتروني',{exact:true}).fill('owner@example.test');
 await page.getByLabel('كلمة المرور',{exact:true}).fill('fixture-password');
 await page.getByRole('checkbox',{name:'تذكر دخولي على هذا المتصفح'}).setChecked(remember);
 await page.getByRole('button',{name:'دخول',exact:true}).click();await expect(page).toHaveURL(/\/app$/);
 const cookie=(await context.cookies()).find(c=>c.name.includes('-auth-token'));
 expect(cookie).toBeDefined();
 if(remember)expect(cookie!.expires).toBeGreaterThan(Date.now()/1000);else expect(cookie!.expires).toBe(-1);
});
test('email fragment from another browser enables matching reset fields and is removed from URL',async({page})=>{
 const requests=await network(page);
 await page.goto('/auth/callback?flow=recovery#access_token='+token+'&refresh_token=fixture-refresh&type=recovery');
 const password=page.getByLabel('كلمة المرور الجديدة',{exact:true});
 await expect(password).toBeEnabled();expect(page.url()).not.toContain('#');
 await password.fill('fixture-password-strong');
 await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill('different-password');
 await page.getByRole('button',{name:'حفظ كلمة المرور',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('تتطابق');
 expect(requests.filter(r=>r.method==='PUT')).toHaveLength(0);
 await page.getByLabel('تأكيد كلمة المرور',{exact:true}).fill('fixture-password-strong');
 await page.getByRole('button',{name:'إظهار كلمة المرور الجديدة',exact:true}).click();
 await expect(password).toHaveAttribute('type','text');
 await page.getByRole('button',{name:'حفظ كلمة المرور',exact:true}).click();
 await expect(page).toHaveURL(/login\?reset=success/);
 expect(requests.filter(r=>r.method==='PUT')).toHaveLength(1);
});
test('missing session and unauthorized user never enable password reset',async({page})=>{
 await network(page,false);await page.goto('/auth/reset');
 await expect(page.getByRole('status')).toContainText('الرابط غير صالح');
 await expect(page.getByRole('button',{name:'حفظ كلمة المرور'})).toBeDisabled();
 await page.goto('/auth/reset#access_token='+token+'&refresh_token=fixture-refresh&type=recovery');
 await expect(page.getByRole('status')).toContainText('الرابط غير صالح');
 await expect(page.getByRole('button',{name:'حفظ كلمة المرور'})).toBeDisabled();
});
