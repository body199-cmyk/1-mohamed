"use client";

/**
 * AUTH-01 / H041. Browser SDK ONLY; no service-role keys.
 * The app's demo remains independent and must not import this module.
 */
import { createBrowserClient,parseCookieHeader,serializeCookieHeader } from "@supabase/ssr";
import {createClient} from '@supabase/supabase-js';
import {loginCookieOptions,remembersLogin} from './remember';
import { assertSupabaseConfigured } from "./config";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = assertSupabaseConfigured();
  return createBrowserClient(url, publishableKey,{cookies:{
    getAll:()=>parseCookieHeader(document.cookie),
    setAll:cookies=>{for(const {name,value,options} of cookies){
      document.cookie=serializeCookieHeader(name,value,loginCookieOptions(options,remembersLogin(parseCookieHeader(document.cookie))));
    }},
  }});
}

/** Default email templates work across browsers without a PKCE verifier cookie. */
export function createRecoveryRequestClient(){
 const {url,publishableKey}=assertSupabaseConfigured();
 return createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,
  detectSessionInUrl:false,flowType:'implicit'}});
}
