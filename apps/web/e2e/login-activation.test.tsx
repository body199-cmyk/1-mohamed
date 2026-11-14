import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import LoginPage from "../src/app/login/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.test");
});
afterEach(() => vi.unstubAllEnvs());

it.each([undefined, "false", "TRUE"])("explains disabled activation (%s) before asking for a password", flag => {
  vi.stubEnv("APP_ENABLE_REAL_DATA", flag);
  const html = renderToStaticMarkup(<LoginPage />);
  expect(html).toContain("الحسابات الدائمة غير مفعّلة على النسخة دي");
  expect(html).toMatch(/id="owner-password"[^>]*disabled=""/);
  expect(html).toMatch(/type="submit"[^>]*disabled=""/);
});

it("allows the configured active owner login form", () => {
  vi.stubEnv("APP_ENABLE_REAL_DATA", "true");
  const html = renderToStaticMarkup(<LoginPage />);
  expect(html).not.toContain("الحسابات الدائمة غير مفعّلة على النسخة دي");
  expect(html).not.toMatch(/id="owner-password"[^>]*disabled=""/);
});

it("keeps login disabled when activation is on but configuration is incomplete", () => {
  vi.stubEnv("APP_ENABLE_REAL_DATA", "true");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  const html = renderToStaticMarkup(<LoginPage />);
  expect(html).toContain("الربط الآمن لم يُفعّل بعد");
  expect(html).toMatch(/id="owner-password"[^>]*disabled=""/);
});
