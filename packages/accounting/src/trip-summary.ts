import {
  calculateTripAmounts,
  type TripAmountsErrorCode,
  type TripAmountsField,
  type TripAmountsInput,
} from "./trip-amounts";

export interface TripSummaryError {
  readonly index: number;
  readonly field: TripAmountsField;
  readonly code: TripAmountsErrorCode;
}

export type TripSummaryResult =
  | {
      readonly ok: true;
      readonly tripCount: number;
      readonly totalWeightTonnes: string;
      readonly contractorTotalPiastres: string;
      readonly vehicleTotalPiastres: string;
    }
  | {
      readonly ok: false;
      readonly error: TripSummaryError;
    };

const WEIGHT_FRACTION_DIGITS = 3;
const WEIGHT_UNIT_DIVISOR = 1000n;

function parseValidatedWeightMilliTonnes(rawWeight: string): bigint {
  const dotIndex = rawWeight.indexOf(".");
  if (dotIndex === -1) {
    return BigInt(rawWeight + "000");
  }

  const integerPart = rawWeight.slice(0, dotIndex);
  const fractionPart = rawWeight
    .slice(dotIndex + 1)
    .padEnd(WEIGHT_FRACTION_DIGITS, "0");

  return BigInt(integerPart + fractionPart);
}

function formatWeightMilliTonnes(totalMilliTonnes: bigint): string {
  const wholeTonnes = totalMilliTonnes / WEIGHT_UNIT_DIVISOR;
  const remainderMilliTonnes = totalMilliTonnes % WEIGHT_UNIT_DIVISOR;
  const fractionDigits = remainderMilliTonnes
    .toString()
    .padStart(WEIGHT_FRACTION_DIGITS, "0");

  return `${wholeTonnes.toString()}.${fractionDigits}`;
}

export function summarizeTrips(
  trips: readonly TripAmountsInput[]
): TripSummaryResult {
  let totalWeightMilliTonnes = 0n;
  let contractorTotalPiastres = 0n;
  let vehicleTotalPiastres = 0n;

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i];
    const tripResult = calculateTripAmounts(trip);

    if (!tripResult.ok) {
      return {
        ok: false,
        error: {
          index: i,
          field: tripResult.error.field,
          code: tripResult.error.code,
        },
      };
    }

    totalWeightMilliTonnes += parseValidatedWeightMilliTonnes(
      trip.weightTonnes
    );
    contractorTotalPiastres += BigInt(tripResult.contractorTotalPiastres);
    vehicleTotalPiastres += BigInt(tripResult.vehicleTotalPiastres);
  }

  return {
    ok: true,
    tripCount: trips.length,
    totalWeightTonnes: formatWeightMilliTonnes(totalWeightMilliTonnes),
    contractorTotalPiastres: contractorTotalPiastres.toString(),
    vehicleTotalPiastres: vehicleTotalPiastres.toString(),
  };
}