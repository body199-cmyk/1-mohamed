import { normalizeArabicNumbers } from "../trips/arabic-number-normalizer";

export function normalizeMasterKey(value: string): string {
  return normalizeArabicNumbers(value).trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}

const MAX_DB_BIGINT = 9223372036854775807n;

/** Exact integer math: never use Number/float for financial values. */
export function parseOpeningEgp(raw: string, direction: "VEHICLE" | "CONTRACTOR" | "ZERO"): string | null {
  if (direction === "ZERO") return "0";
  const value = normalizeArabicNumbers(raw.trim());
  if (value.length > 20 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const piastres = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  // Signed SQL BIGINT permits one additional unit on the negative side.
  if (piastres > (direction === "CONTRACTOR" ? MAX_DB_BIGINT + 1n : MAX_DB_BIGINT)) return null;
  const signed = direction === "CONTRACTOR" ? -piastres : piastres;
  return signed.toString();
}

export function validOpeningPiastres(raw: string): boolean {
  if (raw.length > 20 || !/^(0|[1-9][0-9]*|-[1-9][0-9]*)$/.test(raw)) return false;
  const value = BigInt(raw);
  return value <= MAX_DB_BIGINT && value >= -(MAX_DB_BIGINT + 1n);
}

/** Calendar date with no timezone conversion (business dates are local dates). */
export function validOpeningDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999 || month < 1 || month > 12) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= days;
}
