import {test,expect} from '@playwright/test';
for(const owner of [true,false])test(`invitation settings are owner-only: ${owner}`,async({page})=>{
 const members:{user_id:string;email:string;is_active:boolean;created_at:string}[]=[];const requests:Record<string,unknown>[]=[];
 await page.route('**/api/ledger/master?**',route=>route.fulfill({json:{ok:true,data:[],hasMore:false}}));
 await page.route('**/api/auth/members',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{isOwner:owner,members}});
  const body=route.request().postDataJSON();requests.push(body);
  if(!owner)return route.fulfill({status:403,json:{error:'Denied'}});
  if(body.action==='invite')members.push({user_id:'00000000-0000-0000-0000-000000000003',email:body.email,is_active:true,created_at:'2026-11-17'});
  if(body.action==='revoke')members[0].is_active=false;
  return route.fulfill({json:{ok:true,message:body.action==='invite'?'تم إرسال الدعوة.':'تم إلغاء الوصول.'}});
 });
 await page.goto('/');
 await Promise.all([page.waitForResponse(r=>r.url().endsWith('/api/auth/members')&&r.request().method()==='GET'),page.getByRole('button',{name:'الإعدادات',exact:true}).click()]);
 if(!owner){await expect(page.getByLabel('البريد الإلكتروني للمستخدم')).toHaveCount(0);expect(requests).toHaveLength(0);return;}
 await page.getByLabel('البريد الإلكتروني للمستخدم').fill('member@example.test');
 await page.getByRole('button',{name:'إرسال الدعوة',exact:true}).click();
 await expect(page.getByRole('region',{name:'إدارة المستخدمين'}).getByRole('status')).toContainText('تم إرسال الدعوة.');
 await expect(page.getByText('member@example.test',{exact:true})).toBeVisible();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'إلغاء الوصول',exact:true}).click();
 await expect(page.getByRole('button',{name:'إعادة الدعوة',exact:true})).toBeVisible();
 expect(requests.map(r=>r.action)).toEqual(['invite','revoke']);
});
