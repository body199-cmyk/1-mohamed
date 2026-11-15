import type {CookieOptions} from '@supabase/ssr';
export const REMEMBER_COOKIE='ledger-remember';
export function remembersLogin(cookies:readonly {name:string;value?:string}[]):boolean{
 return cookies.some(c=>c.name===REMEMBER_COOKIE&&c.value==='1');
}
export function loginCookieOptions(options:CookieOptions,remember:boolean):CookieOptions{
 if(options.maxAge===0)return options;
 if(remember)return {...options,maxAge:30*24*60*60};
 const {maxAge,expires,...session}=options;
 return session;
}
