/** Trust the configured public site, never a proxy's internal URL or forwarded host. */
export function isAllowedLedgerOrigin(headers: Headers, siteUrl: string): boolean {
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = headers.get("origin");
  // Non-browser callers remain subject to JWT + owner + RLS authorization.
  if (origin === null) return true;
  try {
    const site = new URL(siteUrl);
    return (site.protocol === "https:" || site.protocol === "http:")
      && origin === site.origin;
  } catch {
    return false;
  }
}
