import { describe, expect, it } from "vitest";
import {
  calculateTripAmounts,
  type TripAmountsInput,
} from "../src/trip-amounts";

describe("calculateTripAmounts", () => {
  describe("calculation and rounding scenarios", () => {
    it.each([
      {
        label:
          "a) equal contractor and vehicle rates (weight 20, rates 45, expense 100)",
        input: {
          weightTonnes: "20",
          contractorRateEgp: "45",
          vehicleRateEgp: "45",
          expenseEgp: "100",
        },
        expectedContractor: "100000",
        expectedVehicle: "100000",
      },
      {
        label:
          "b) independent contractor and vehicle rates (weight 20, contractor 100, vehicle 90, expense 100)",
        input: {
          weightTonnes: "20",
          contractorRateEgp: "100",
          vehicleRateEgp: "90",
          expenseEgp: "100",
        },
        expectedContractor: "210000",
        expectedVehicle: "190000",
      },
      {
        label:
          "c) exact 14.5125 EGP rounds down to 1451 piastres (weight 1.250, rates 10.01, expense 2)",
        input: {
          weightTonnes: "1.250",
          contractorRateEgp: "10.01",
          vehicleRateEgp: "10.01",
          expenseEgp: "2",
        },
        expectedContractor: "1451",
        expectedVehicle: "1451",
      },
      {
        label:
          "d) exact half-piastre (0.5 piastre) rounds up to 1 piastre (weight 0.500, rates 0.01, expense 0)",
        input: {
          weightTonnes: "0.500",
          contractorRateEgp: "0.01",
          vehicleRateEgp: "0.01",
          expenseEgp: "0",
        },
        expectedContractor: "1",
        expectedVehicle: "1",
      },
      {
        label:
          "e) 0.499 piastre rounds down to 0 piastres (weight 0.499, rates 0.01, expense 0)",
        input: {
          weightTonnes: "0.499",
          contractorRateEgp: "0.01",
          vehicleRateEgp: "0.01",
          expenseEgp: "0",
        },
        expectedContractor: "0",
        expectedVehicle: "0",
      },
      {
        label:
          "f) 0.501 piastre rounds up to 1 piastre (weight 0.501, rates 0.01, expense 0)",
        input: {
          weightTonnes: "0.501",
          contractorRateEgp: "0.01",
          vehicleRateEgp: "0.01",
          expenseEgp: "0",
        },
        expectedContractor: "1",
        expectedVehicle: "1",
      },
      {
        label: "g) preserves full precision above Number.MAX_SAFE_INTEGER",
        input: {
          weightTonnes: "1",
          contractorRateEgp: "90071992547409.93",
          vehicleRateEgp: "90071992547409.93",
          expenseEgp: "0",
        },
        expectedContractor: "9007199254740993",
        expectedVehicle: "9007199254740993",
      },
      {
        label: "h) returns '0' for both totals when all inputs are zero",
        input: {
          weightTonnes: "0",
          contractorRateEgp: "0",
          vehicleRateEgp: "0",
          expenseEgp: "0",
        },
        expectedContractor: "0",
        expectedVehicle: "0",
      },
      {
        label:
          "i) accepts leading zeros in inputs and strips unnecessary leading zeros in output",
        input: {
          weightTonnes: "00020.500",
          contractorRateEgp: "0040.00",
          vehicleRateEgp: "0030.00",
          expenseEgp: "0000.50",
        },
        expectedContractor: "82050",
        expectedVehicle: "61550",
      },
    ])(
      "computes expected totals for $label",
      ({ input, expectedContractor, expectedVehicle }) => {
        expect(calculateTripAmounts(input)).toEqual({
          ok: true,
          contractorTotalPiastres: expectedContractor,
          vehicleTotalPiastres: expectedVehicle,
        });
      }
    );
  });

  describe("immutability and JSON serialization", () => {
    it("does not mutate the frozen input object", () => {
      const input: TripAmountsInput = Object.freeze({
        weightTonnes: "20.375",
        contractorRateEgp: "45.50",
        vehicleRateEgp: "40.25",
        expenseEgp: "100.00",
      });

      calculateTripAmounts(input);

      expect(input).toEqual({
        weightTonnes: "20.375",
        contractorRateEgp: "45.50",
        vehicleRateEgp: "40.25",
        expenseEgp: "100.00",
      });
    });

    it("produces a result that is directly serializable with JSON.stringify", () => {
      const result = calculateTripAmounts({
        weightTonnes: "20",
        contractorRateEgp: "45",
        vehicleRateEgp: "45",
        expenseEgp: "100",
      });

      expect(JSON.parse(JSON.stringify(result))).toEqual({
        ok: true,
        contractorTotalPiastres: "100000",
        vehicleTotalPiastres: "100000",
      });
    });
  });

  describe("precision validation (EXCESS_PRECISION)", () => {
    it.each([
      {
        name: "weight with 4 decimal places (trailing zeros)",
        override: { weightTonnes: "1.0000" },
        expectedField: "weightTonnes",
      },
      {
        name: "weight with 4 non-zero decimal places",
        override: { weightTonnes: "20.1234" },
        expectedField: "weightTonnes",
      },
      {
        name: "contractorRateEgp with 3 decimal places",
        override: { contractorRateEgp: "45.500" },
        expectedField: "contractorRateEgp",
      },
      {
        name: "vehicleRateEgp with 3 decimal places",
        override: { vehicleRateEgp: "45.125" },
        expectedField: "vehicleRateEgp",
      },
      {
        name: "expenseEgp with 3 decimal places",
        override: { expenseEgp: "10.000" },
        expectedField: "expenseEgp",
      },
    ])("rejects $name with EXCESS_PRECISION", ({ override, expectedField }) => {
      const baseInput: TripAmountsInput = {
        weightTonnes: "10.123",
        contractorRateEgp: "50.25",
        vehicleRateEgp: "45.10",
        expenseEgp: "100.00",
      };

      expect(calculateTripAmounts({ ...baseInput, ...override })).toEqual({
        ok: false,
        error: {
          field: expectedField,
          code: "EXCESS_PRECISION",
        },
      });
    });
  });

  describe("format validation (INVALID_FORMAT)", () => {
    it.each([
      { label: "empty string", value: "" },
      { label: "whitespace only", value: "   " },
      { label: "leading space", value: " 20" },
      { label: "trailing space", value: "20 " },
      { label: "negative sign", value: "-20" },
      { label: "positive sign", value: "+20" },
      { label: "thousands comma", value: "1,000" },
      { label: "decimal comma", value: "20,5" },
      { label: "scientific notation lowercase", value: "1e3" },
      { label: "scientific notation uppercase", value: "1E3" },
      { label: "leading decimal point", value: ".5" },
      { label: "trailing decimal point", value: "5." },
      { label: "multiple decimal points", value: "20.5.1" },
      { label: "Arabic-Indic digits", value: "٢٠" },
      { label: "alphabetic characters", value: "20abc" },
    ])("rejects $label ('$value') with INVALID_FORMAT", ({ value }) => {
      expect(
        calculateTripAmounts({
          weightTonnes: value,
          contractorRateEgp: "45",
          vehicleRateEgp: "45",
          expenseEgp: "100",
        })
      ).toEqual({
        ok: false,
        error: {
          field: "weightTonnes",
          code: "INVALID_FORMAT",
        },
      });
    });
  });

  describe("field check ordering and error precedence", () => {
    it.each([
      {
        label: "format check precedes precision check within the same field",
        input: {
          weightTonnes: "-1.0000",
          contractorRateEgp: "45",
          vehicleRateEgp: "45",
          expenseEgp: "100",
        },
        expectedError: { field: "weightTonnes", code: "INVALID_FORMAT" },
      },
      {
        label: "weightTonnes error returned first when all four fields are invalid",
        input: {
          weightTonnes: "1.0000",
          contractorRateEgp: "invalid",
          vehicleRateEgp: "-5",
          expenseEgp: "10.000",
        },
        expectedError: { field: "weightTonnes", code: "EXCESS_PRECISION" },
      },
      {
        label:
          "contractorRateEgp error returned when weightTonnes is valid and remaining three are invalid",
        input: {
          weightTonnes: "20.500",
          contractorRateEgp: "1e2",
          vehicleRateEgp: "45.123",
          expenseEgp: "",
        },
        expectedError: { field: "contractorRateEgp", code: "INVALID_FORMAT" },
      },
      {
        label:
          "vehicleRateEgp error returned when first two fields are valid and remaining two are invalid",
        input: {
          weightTonnes: "20.500",
          contractorRateEgp: "45.50",
          vehicleRateEgp: "45.500",
          expenseEgp: "-10",
        },
        expectedError: { field: "vehicleRateEgp", code: "EXCESS_PRECISION" },
      },
      {
        label: "expenseEgp error returned when only expenseEgp is invalid",
        input: {
          weightTonnes: "20.500",
          contractorRateEgp: "45.50",
          vehicleRateEgp: "40.00",
          expenseEgp: "100.",
        },
        expectedError: { field: "expenseEgp", code: "INVALID_FORMAT" },
      },
    ])("enforces $label", ({ input, expectedError }) => {
      expect(calculateTripAmounts(input)).toEqual({
        ok: false,
        error: expectedError,
      });
    });
  });
});