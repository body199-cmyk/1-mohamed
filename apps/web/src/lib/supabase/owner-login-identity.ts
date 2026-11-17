/** Match only the configured owner's login alias or exact verified email. */
export function matchesOwnerLoginIdentifier(
  identifier: string,
  configuredUsername: string,
  configuredEmail: string
): boolean {
  const candidate = identifier.trim();
  const username = configuredUsername.trim();
  const email = configuredEmail.trim().toLowerCase();
  if (!candidate) return false;
  return (!!username && candidate === username)
    || (!!email && candidate.toLowerCase() === email);
}
