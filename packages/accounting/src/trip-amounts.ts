export interface TripAmountsInput {
  readonly weightTonnes: string;
  readonly contractorRateEgp: string;
  readonly vehicleRateEgp: string;
  readonly expenseEgp: string;
}

export type TripAmountsField =
  | "weightTonnes"
  | "contractorRateEgp"
  | "vehicleRateEgp"
  | "expenseEgp";

export type TripAmountsErrorCode = "INVALID_FORMAT" | "EXCESS_PRECISION" | "OUT_OF_RANGE";

export interface TripAmountsError {
  readonly field: TripAmountsField;
  readonly code: TripAmountsErrorCode;
}

export type TripAmountsResult =
  | {
      readonly ok: true;
      readonly contractorTotalPiastres: string;
      readonly vehicleTotalPiastres: string;
    }
  | {
      readonly ok: false;
      readonly error: TripAmountsError;
    };

const DECIMAL_FORMAT_REGEX = /^[0-9]+(?:\.[0-9]+)?$/;

const WEIGHT_SCALE = 3;
const MONEY_SCALE = 2;
const WEIGHT_DIVISOR = 1000n;
const PIASTRES_PER_EGP = 100n;
const WHOLE_POUND_DIVISOR = WEIGHT_DIVISOR * PIASTRES_PER_EGP;
const MAX_SQL_BIGINT = 9223372036854775807n;

type ParseScaleResult =
  | { readonly ok: true; readonly scaledValue: bigint }
  | { readonly ok: false; readonly code: TripAmountsErrorCode };

function parseScaledUnsignedDecimal(
  raw: string,
  maxFractionDigits: number
): ParseScaleResult {
  if (!DECIMAL_FORMAT_REGEX.test(raw)) {
    return { ok: false, code: "INVALID_FORMAT" };
  }

  const dotIndex = raw.indexOf(".");
  let integerPart = raw;
  let fractionPart = "";

  if (dotIndex !== -1) {
    integerPart = raw.slice(0, dotIndex);
    fractionPart = raw.slice(dotIndex + 1);
    if (fractionPart.length > maxFractionDigits) {
      return { ok: false, code: "EXCESS_PRECISION" };
    }
  }

  const paddedFraction = fractionPart.padEnd(maxFractionDigits, "0");
  const combinedDigits = integerPart + paddedFraction;

  // SQL persists each scaled input as BIGINT; reject before conversion of huge strings.
  if (combinedDigits.length > 256) return { ok:false, code:"OUT_OF_RANGE" };
  const scaledValue = BigInt(combinedDigits);
  if (scaledValue > MAX_SQL_BIGINT) return { ok:false, code:"OUT_OF_RANGE" };
  const rounded = maxFractionDigits === MONEY_SCALE
    ? ((scaledValue + 50n) / 100n) * 100n : scaledValue;
  return {ok:true,scaledValue:rounded};
}

function computeTotalPiastres(
  weightMilliTonnes: bigint,
  ratePiastres: bigint,
  expensePiastres: bigint
): string {
  // Round once, after expenses, to the nearest whole pound (half upward).
  // Keep exact scaled storage/API units without floating point or schema rewrites.
  const exactMilliPiastres = weightMilliTonnes * ratePiastres
    + expensePiastres * WEIGHT_DIVISOR;
  const totalPiastres = ((exactMilliPiastres + WHOLE_POUND_DIVISOR / 2n)
    / WHOLE_POUND_DIVISOR) * PIASTRES_PER_EGP;
  return totalPiastres.toString();
}

export function calculateTripAmounts(
  input: TripAmountsInput
): TripAmountsResult {
  const weightParsed = parseScaledUnsignedDecimal(
    input.weightTonnes,
    WEIGHT_SCALE
  );
  if (!weightParsed.ok) {
    return {
      ok: false,
      error: { field: "weightTonnes", code: weightParsed.code },
    };
  }

  const contractorRateParsed = parseScaledUnsignedDecimal(
    input.contractorRateEgp,
    MONEY_SCALE
  );
  if (!contractorRateParsed.ok) {
    return {
      ok: false,
      error: { field: "contractorRateEgp", code: contractorRateParsed.code },
    };
  }

  const vehicleRateParsed = parseScaledUnsignedDecimal(
    input.vehicleRateEgp,
    MONEY_SCALE
  );
  if (!vehicleRateParsed.ok) {
    return {
      ok: false,
      error: { field: "vehicleRateEgp", code: vehicleRateParsed.code },
    };
  }

  const expenseParsed = parseScaledUnsignedDecimal(
    input.expenseEgp,
    MONEY_SCALE
  );
  if (!expenseParsed.ok) {
    return {
      ok: false,
      error: { field: "expenseEgp", code: expenseParsed.code },
    };
  }

  const contractorTotalPiastres = computeTotalPiastres(
    weightParsed.scaledValue,
    contractorRateParsed.scaledValue,
    expenseParsed.scaledValue
  );

  const vehicleTotalPiastres = computeTotalPiastres(
    weightParsed.scaledValue,
    vehicleRateParsed.scaledValue,
    expenseParsed.scaledValue
  );

  // SQL app_trip_totals rejects out-of-range *single-trip* stored totals.
  if (BigInt(contractorTotalPiastres) > MAX_SQL_BIGINT) {
    return {ok:false,error:{field:"contractorRateEgp",code:"OUT_OF_RANGE"}};
  }
  if (BigInt(vehicleTotalPiastres) > MAX_SQL_BIGINT) {
    return {ok:false,error:{field:"vehicleRateEgp",code:"OUT_OF_RANGE"}};
  }
  return { ok: true, contractorTotalPiastres, vehicleTotalPiastres };
}
