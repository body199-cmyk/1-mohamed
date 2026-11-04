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

export type TripAmountsErrorCode = "INVALID_FORMAT" | "EXCESS_PRECISION";

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
const HALF_WEIGHT_DIVISOR = 500n;

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

  return {
    ok: true,
    scaledValue: BigInt(combinedDigits),
  };
}

function computeTotalPiastres(
  weightMilliTonnes: bigint,
  ratePiastres: bigint,
  expensePiastres: bigint
): string {
  const unroundedProductMilliPiastres = weightMilliTonnes * ratePiastres;
  const roundedProductPiastres =
    (unroundedProductMilliPiastres + HALF_WEIGHT_DIVISOR) / WEIGHT_DIVISOR;
  const totalPiastres = roundedProductPiastres + expensePiastres;
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

  return {
    ok: true,
    contractorTotalPiastres,
    vehicleTotalPiastres,
  };
}