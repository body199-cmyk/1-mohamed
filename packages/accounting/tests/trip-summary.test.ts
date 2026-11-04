import { describe, expect, it } from "vitest";
import type { TripAmountsInput } from "../src/trip-amounts";
import { summarizeTrips } from "../src/trip-summary";

describe("summarizeTrips", () => {
  describe("aggregation and rounding scenarios", () => {
    it.each([
      {
        label: "1) returns zeroed summary for an empty list",
        trips: [],
        expected: {
          ok: true,
          tripCount: 0,
          totalWeightTonnes: "0.000",
          contractorTotalPiastres: "0",
          vehicleTotalPiastres: "0",
        },
      },
      {
        label:
          "2) summarizes a single trip accurately without combining contractor and vehicle totals",
        trips: [
          {
            weightTonnes: "20",
            contractorRateEgp: "100",
            vehicleRateEgp: "90",
            expenseEgp: "100",
          },
        ],
        expected: {
          ok: true,
          tripCount: 1,
          totalWeightTonnes: "20.000",
          contractorTotalPiastres: "210000",
          vehicleTotalPiastres: "190000",
        },
      },
      {
        label:
          "3) aggregates two distinct trips accurately without duplicating expenses",
        trips: [
          {
            weightTonnes: "20",
            contractorRateEgp: "100",
            vehicleRateEgp: "90",
            expenseEgp: "100",
          },
          {
            weightTonnes: "1.250",
            contractorRateEgp: "10.01",
            vehicleRateEgp: "10.01",
            expenseEgp: "2",
          },
        ],
        expected: {
          ok: true,
          tripCount: 2,
          totalWeightTonnes: "21.250",
          contractorTotalPiastres: "211451",
          vehicleTotalPiastres: "191451",
        },
      },
      {
        label:
          "4) sums already-rounded per-trip totals rather than rounding the raw sum (two 0.5-piastre trips yield 2 piastres, not 1)",
        trips: [
          {
            weightTonnes: "0.500",
            contractorRateEgp: "0.01",
            vehicleRateEgp: "0.01",
            expenseEgp: "0",
          },
          {
            weightTonnes: "0.500",
            contractorRateEgp: "0.01",
            vehicleRateEgp: "0.01",
            expenseEgp: "0",
          },
        ],
        expected: {
          ok: true,
          tripCount: 2,
          totalWeightTonnes: "1.000",
          contractorTotalPiastres: "2",
          vehicleTotalPiastres: "2",
        },
      },
      {
        label:
          "5) preserves full integer precision beyond Number.MAX_SAFE_INTEGER",
        trips: [
          {
            weightTonnes: "1",
            contractorRateEgp: "90071992547409.93",
            vehicleRateEgp: "90071992547409.93",
            expenseEgp: "0",
          },
          {
            weightTonnes: "1",
            contractorRateEgp: "90071992547409.93",
            vehicleRateEgp: "90071992547409.93",
            expenseEgp: "0",
          },
        ],
        expected: {
          ok: true,
          tripCount: 2,
          totalWeightTonnes: "2.000",
          contractorTotalPiastres: "18014398509481986",
          vehicleTotalPiastres: "18014398509481986",
        },
      },
      {
        label: "6) does not deduplicate identical trips; counts and sums both",
        trips: [
          {
            weightTonnes: "10.500",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "10",
          },
          {
            weightTonnes: "10.500",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "10",
          },
        ],
        expected: {
          ok: true,
          tripCount: 2,
          totalWeightTonnes: "21.000",
          contractorTotalPiastres: "107000",
          vehicleTotalPiastres: "86000",
        },
      },
      {
        label:
          "8) normalizes and sums weights with leading zeros into fixed 3-decimal output",
        trips: [
          {
            weightTonnes: "00020.500",
            contractorRateEgp: "10",
            vehicleRateEgp: "10",
            expenseEgp: "0",
          },
          {
            weightTonnes: "0.125",
            contractorRateEgp: "10",
            vehicleRateEgp: "10",
            expenseEgp: "0",
          },
        ],
        expected: {
          ok: true,
          tripCount: 2,
          totalWeightTonnes: "20.625",
          contractorTotalPiastres: "20625",
          vehicleTotalPiastres: "20625",
        },
      },
    ])("computes summary: $label", ({ trips, expected }) => {
      expect(summarizeTrips(trips)).toEqual(expected);
    });
  });

  describe("error handling and index reporting", () => {
    it.each([
      {
        label:
          "7) stops at first invalid trip (index 1, weightTonnes EXCESS_PRECISION) without partial totals",
        trips: [
          {
            weightTonnes: "20",
            contractorRateEgp: "100",
            vehicleRateEgp: "90",
            expenseEgp: "100",
          },
          {
            weightTonnes: "1.0000",
            contractorRateEgp: "50",
            vehicleRateEgp: "45",
            expenseEgp: "10",
          },
          {
            weightTonnes: "10",
            contractorRateEgp: "invalid",
            vehicleRateEgp: "45",
            expenseEgp: "10",
          },
        ],
        expectedError: {
          index: 1,
          field: "weightTonnes",
          code: "EXCESS_PRECISION",
        },
      },
      {
        label: "invalid first trip (index 0, contractorRateEgp INVALID_FORMAT)",
        trips: [
          {
            weightTonnes: "10",
            contractorRateEgp: "-50",
            vehicleRateEgp: "40",
            expenseEgp: "0",
          },
          {
            weightTonnes: "10",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "0",
          },
        ],
        expectedError: {
          index: 0,
          field: "contractorRateEgp",
          code: "INVALID_FORMAT",
        },
      },
      {
        label: "invalid third trip (index 2, expenseEgp EXCESS_PRECISION)",
        trips: [
          {
            weightTonnes: "10",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "0",
          },
          {
            weightTonnes: "5.25",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "10",
          },
          {
            weightTonnes: "8",
            contractorRateEgp: "50",
            vehicleRateEgp: "40",
            expenseEgp: "10.125",
          },
        ],
        expectedError: {
          index: 2,
          field: "expenseEgp",
          code: "EXCESS_PRECISION",
        },
      },
    ])("reports $label accurately", ({ trips, expectedError }) => {
      expect(summarizeTrips(trips)).toEqual({
        ok: false,
        error: expectedError,
      });
    });
  });

  describe("immutability and JSON serialization", () => {
    it("9) does not mutate the frozen trips array or its frozen trip objects", () => {
      const trip1: TripAmountsInput = Object.freeze({
        weightTonnes: "20.375",
        contractorRateEgp: "45.50",
        vehicleRateEgp: "40.25",
        expenseEgp: "100.00",
      });
      const trip2: TripAmountsInput = Object.freeze({
        weightTonnes: "10.125",
        contractorRateEgp: "50.00",
        vehicleRateEgp: "45.00",
        expenseEgp: "50.00",
      });
      const trips: readonly TripAmountsInput[] = Object.freeze([trip1, trip2]);

      const result = summarizeTrips(trips);

      expect(result).toEqual({
        ok: true,
        tripCount: 2,
        totalWeightTonnes: "30.500",
        contractorTotalPiastres: "158331",
        vehicleTotalPiastres: "142572",
      });
      expect(trips).toEqual([
        {
          weightTonnes: "20.375",
          contractorRateEgp: "45.50",
          vehicleRateEgp: "40.25",
          expenseEgp: "100.00",
        },
        {
          weightTonnes: "10.125",
          contractorRateEgp: "50.00",
          vehicleRateEgp: "45.00",
          expenseEgp: "50.00",
        },
      ]);
    });

    it("10) produces a success result that is directly serializable with JSON.stringify", () => {
      const result = summarizeTrips([
        {
          weightTonnes: "20",
          contractorRateEgp: "100",
          vehicleRateEgp: "90",
          expenseEgp: "100",
        },
      ]);

      expect(JSON.parse(JSON.stringify(result))).toEqual({
        ok: true,
        tripCount: 1,
        totalWeightTonnes: "20.000",
        contractorTotalPiastres: "210000",
        vehicleTotalPiastres: "190000",
      });
    });
  });
});