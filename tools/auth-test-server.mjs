/** Isolated real Auth components + SDK. Browser tests intercept every Auth HTTP request. */
import {build} from 'esbuild';
import {createServer} from 'node:http';
const root=process.cwd();
const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';
import{LoginForm}from'./apps/web/src/features/auth/login-form';
import{ResetPasswordForm}from'./apps/web/src/features/auth/reset-password-form';
createRoot(document.getElementById('root')).render(location.pathname==='/auth/reset'?<ResetPasswordForm/>:<LoginForm enabled={true}/>);`,
resolveDir:root,loader:'tsx'},bundle:true,write:false,jsx:'automatic',define:{
 'process.env.NODE_ENV':'"test"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://fixture.supabase.co"',
 'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'"public-fixture"','process.env.NEXT_PUBLIC_SITE_URL':'"https://1-mohamed.vercel.app"'},
 plugins:[{name:'navigation',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useRouter=()=>({replace(path){location.assign(path)},refresh(){}});'}));}}]});
const html='<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial;background:#f4f7fb;color:#162d4b}*{box-sizing:border-box}button,input{font:inherit}button{padding:10px;cursor:pointer}</style><div id="root"></div><script src="/app.js"></script></html>';
createServer((req,res)=>{
 if(req.url==='/api/auth/login'&&req.method==='POST'){
  let raw='';req.on('data',chunk=>{raw+=chunk;});
  req.on('end',()=>{
   let body={};try{body=JSON.parse(raw);}catch{}
   const valid=(body.identifier==='1234'||body.identifier==='owner@example.test')&&typeof body.password==='string'&&body.password.length>0;
   if(!valid){res.writeHead(401,{'content-type':'application/json','cache-control':'no-store'});return res.end('{"error":"بيانات الدخول غير صحيحة."}');}
   const remember=(req.headers.cookie??'').split(';').some(value=>value.trim()==='ledger-remember=1');
   const cookie='sb-fixture-auth-token=fixture-token; Path=/; SameSite=Lax'+(remember?'; Max-Age=2592000':'');
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store','set-cookie':cookie});
   res.end('{"ok":true}');
  });
  return;
 }
 if(req.url==='/auth/callback?flow=recovery'){res.writeHead(303,{location:'/auth/reset','cache-control':'no-store'});return res.end();}
 if(req.url==='/app.js'){res.setHeader('content-type','application/javascript');return res.end(result.outputFiles[0].contents);}
 res.setHeader('content-type','text/html;charset=utf-8');res.end(html);
}).listen(39131,'127.0.0.1');
