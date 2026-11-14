/** Isolated browser fixture: bundles actual private-workspace components.
 * Never imported by Next.js and never changes its auth boundary. HTTP APIs are
 * intercepted by Playwright; this is NOT live Supabase evidence. */
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=process.cwd();
const result=await build({stdin:{contents:`import React from 'react';
import {createRoot} from 'react-dom/client';
import {RealWorkspace} from './apps/web/src/features/ledger/real-workspace';
import {SiteShell} from './apps/web/src/components/site-shell';
import './apps/web/src/styles/variables.css';
import './apps/web/src/styles/globals.css';
createRoot(document.getElementById('root')).render(<SiteShell><RealWorkspace/></SiteShell>);`,
  resolveDir:root,loader:'tsx'},bundle:true,write:false,outdir:'fixture',jsx:'automatic',
  define:{'process.env.NODE_ENV':'"test"','process.env.APP_ENABLE_REAL_DATA':'"false"','process.env.NEXT_PUBLIC_SUPABASE_URL':'"https://fixture.invalid"',
    'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'"fixture-only"',
    'process.env.NEXT_PUBLIC_SITE_URL':'"http://127.0.0.1:39126"','process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':'""'},
  plugins:[{name:'fixture-navigation',setup(b){
    b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
    b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));
    b.onLoad({filter:/.*/,namespace:'fixture'},args=>args.path==='navigation'
      ? {contents:'export const usePathname=()=>\'/app\';export const useRouter=()=>({replace(){},refresh(){},push(){}});'}
      : {contents:'import React from \'react\';export default function Link({children,...props}){return React.createElement(\'a\',props,children)}',resolveDir:root});
  }}]});
const js=result.outputFiles.find(x=>x.path.endsWith('.js')).contents;
const css=result.outputFiles.find(x=>x.path.endsWith('.css'))?.contents??'';
const html=`<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts/cairo.css"><link rel="stylesheet" href="/app.css"><style>body{font-family:Cairo,sans-serif;background:var(--bg-page);color:var(--text-main);margin:12px}button,input,select{font:inherit}button{padding:8px 14px}td,th{padding:8px;border-bottom:1px solid var(--border-color)}*{box-sizing:border-box}[hidden]{display:none!important}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');return res.end(html);}
 if(url.pathname==='/app.js'){res.setHeader('content-type','application/javascript');return res.end(js);}
 if(url.pathname==='/app.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(url.pathname.startsWith('/fonts/')){
   const base=resolve(root,'apps/web/public/fonts'),file=resolve(base,'.'+url.pathname.slice(6));
   if(file.startsWith(base+'/'))try{res.setHeader('content-type',extname(file)==='.css'?'text/css':'font/woff2');return res.end(await readFile(file));}catch{}
 }
 res.statusCode=404;res.end('Fixture route not found');
}).listen(39126,'127.0.0.1',()=>console.log('Isolated workspace fixture ready'));

