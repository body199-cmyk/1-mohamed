export type FormatEgpErrorCode = "INVALID_INTEGER";

export interface FormatEgpError {
  readonly code: FormatEgpErrorCode;
}

export type FormatEgpResult =
  | {
      readonly ok: true;
      readonly amount: string;
      readonly currencyCode: "EGP";
    }
  | {
      readonly ok: false;
      readonly error: FormatEgpError;
    };

const PIASTRES_PER_EGP = 100n;
const PIASTRE_DIGITS = 2;

function isValidSignedIntegerString(raw: string): boolean {
  if (raw.length === 0) {
    return false;
  }

  let startIndex = 0;
  if (raw.charCodeAt(0) === 45) {
    // '-'
    if (raw.length === 1) {
      return false;
    }
    startIndex = 1;
  }

  for (let i = startIndex; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code < 48 || code > 57) {
      return false;
    }
  }

  return true;
}

export function formatEgpFromPiastres(piastres: string): FormatEgpResult {
  if (!isValidSignedIntegerString(piastres)) {
    return {
      ok: false,
      error: { code: "INVALID_INTEGER" },
    };
  }

  const signedPiastres = BigInt(piastres);

  if (signedPiastres === 0n) {
    return {
      ok: true,
      amount: "0.00",
      currencyCode: "EGP",
    };
  }

  const isNegative = signedPiastres < 0n;
  const absPiastres = isNegative ? -signedPiastres : signedPiastres;

  const wholeEgp = absPiastres / PIASTRES_PER_EGP;
  const remainderPiastres = absPiastres % PIASTRES_PER_EGP;
  const fractionStr = remainderPiastres
    .toString()
    .padStart(PIASTRE_DIGITS, "0");
  const signPrefix = isNegative ? "-" : "";

  return {
    ok: true,
    amount: `${signPrefix}${wholeEgp.toString()}.${fractionStr}`,
    currencyCode: "EGP",
  };
}