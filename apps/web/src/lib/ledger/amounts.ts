/**
 * Egyptian pounds -> integer piastres without IEEE-754 money arithmetic.
 * Supports signed historical opening balances; transaction forms should
 * independently reject negative amounts when their business rules require.
 */
export function poundsToPiastres(input: string): string {
  const value = input.trim();
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
