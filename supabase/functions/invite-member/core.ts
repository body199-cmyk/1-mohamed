export type InvitationDependencies={
 isOwner:()=>Promise<boolean>;
 findTarget:(email:string)=>Promise<string|null>;
 isActive:(id:string)=>Promise<boolean>;
 invite:(email:string)=>Promise<string>;
 grant:(id:string,email:string)=>Promise<void>;
 recovery:(email:string)=>Promise<void>;
 generate:(email:string,existing:boolean)=>Promise<{id:string;url:string}>;
};
/** All privileged actions are downstream of a fresh, strict owner check. */
export async function inviteMember(request:Request,deps:InvitationDependencies):Promise<Response>{
 const reply=(body:object,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  if(!await deps.isOwner())return reply({error:'غير مصرح بإدارة المستخدمين.'},403);
  const raw=await request.text();if(raw.length>1024)return reply({error:'الطلب أكبر من المسموح.'},413);
  const data=JSON.parse(raw);
  const email=typeof data?.email==='string'?data.email.trim().toLowerCase():'';
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'اكتب بريدًا إلكترونيًا صحيحًا.'},400);
  const existing=await deps.findTarget(email);
  if(data.mode==='link'){
   const link=await deps.generate(email,!!existing);
   await deps.grant(link.id,email);
   return reply({ok:true,inviteUrl:link.url,message:'تم إنشاء رابط الدعوة. انسخه وأرسله لصاحب الإيميل فقط؛ لم يتم إرسال رسالة بريد.'});
  }
  if(existing&&await deps.isActive(existing)){
   if(data.resend!==true)return reply({error:'الحساب مضاف بالفعل.'},409);
   await deps.recovery(email);return reply({ok:true,message:'تم إرسال رابط جديد لتعيين كلمة المرور.'});
  }
  if(existing){
   // Auth owns the password and email delivery; no temporary password is generated.
   await deps.recovery(email);
   await deps.grant(existing,email);
   return reply({ok:true,message:'تمت إتاحة الحساب وإرسال رابط لتعيين كلمة المرور.'});
  }
  const id=await deps.invite(email);
  await deps.grant(id,email);
  return reply({ok:true,message:'تم إرسال الدعوة. يختار المستخدم كلمة مروره من الرسالة.'});
 }catch{return reply({error:'تعذّر إكمال الدعوة. تأكد من إعداد إرسال البريد ثم أعد المحاولة؛ يمكنك تحديث قائمة المستخدمين لمعرفة الحالة.'},502);}
}
