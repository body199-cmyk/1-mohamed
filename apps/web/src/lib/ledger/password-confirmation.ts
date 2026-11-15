import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {assertSupabaseConfigured} from '../supabase/config';
/** Ephemeral server-side password check; never changes the browser's session cookies. */
export function createPasswordConfirmationClient(){
 const {url,publishableKey}=assertSupabaseConfigured();
 return createClient(url,publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
