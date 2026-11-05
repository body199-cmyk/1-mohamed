"use client";

/**
 * AUTH-01 / H041. Browser SDK ONLY; no service-role keys.
 * The app's demo remains independent and must not import this module.
 */
import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured } from "./config";

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = assertSupabaseConfigured();
  return createBrowserClient(url, publishableKey);
}
