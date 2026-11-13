export function normalizeDecimalInput(input: string): string {
  return input.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0)).replace(/٫/g,".");
}
/**
 * Egyptian pounds -> integer piastres without IEEE-754 money arithmetic.
 * Supports signed historical opening balances; transaction forms should
 * independently reject negative amounts when their business rules require.
 */
export function poundsToPiastres(input: string): string {
  const value = normalizeDecimalInput(input);
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/.exec(value);
  if (!match) throw new Error("اكتب مبلغًا صحيحًا بالجنيه، بحد أقصى خانتين بعد العلامة.");
  const integer = BigInt(match[2]);
  const fractional = BigInt((match[3] ?? "").padEnd(2, "0"));
  const signed = (integer * 100n + fractional) * (match[1] ? -1n : 1n);
  if (signed < -9223372036854775808n || signed > 9223372036854775807n) {
    throw new Error("المبلغ خارج النطاق المسموح.");
  }
  return signed.toString();
}

export function piastresToPounds(input: string): string {
  if (!/^-?(0|[1-9][0-9]*)$/.test(input)) throw new Error("مبلغ غير صالح.");
  const n = BigInt(input);
  const sign = n < 0n ? "-" : "";
  const abs = n < 0n ? -n : n;
  return sign + (abs / 100n).toString() + "." + (abs % 100n).toString().padStart(2, "0");
}

/** Validates exact nonnegative decimal strings for SQL weight/rate fields. */
export function assertDecimal(value: string, decimals: 2 | 3, positive: boolean): string {
  const text = normalizeDecimalInput(value);
  const re = decimals === 3 ? /^(0|[1-9][0-9]*)(?:[.]([0-9]{1,3}))?$/ :
    /^(0|[1-9][0-9]*)(?:[.]([0-9]{1,2}))?$/;
  if (!re.test(text)) throw new Error(`الرقم لازم يكون غير سالب وبحد أقصى ${decimals} خانات عشرية.`);
  const [whole, fractional = ""] = text.split(".");
  const scaled = BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fractional.padEnd(decimals, "0"));
  if (scaled > 9223372036854775807n || (positive && scaled <= 0n)) {
    throw new Error("القيمة صفر أو خارج المدى المسموح.");
  }
  return text;
}


/** Format an exact persisted scaled integer without Number precision loss. */
export function scaledIntegerToDecimal(input: string, decimals: 2 | 3): string {
  if (!/^-?(0|[1-9][0-9]*)$/.test(input)) throw new Error("رقم مخزن غير صالح.");
  const value = BigInt(input);
  const scale = 10n ** BigInt(decimals);
  const abs = value < 0n ? -value : value;
  return (value < 0n ? "-" : "") + (abs / scale).toString() + "." +
    (abs % scale).toString().padStart(decimals, "0");
}
