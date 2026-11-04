import { describe, expect, it } from "vitest";
import { formatEgpFromPiastres } from "../src/format-egp";
import { summarizeTrips } from "../src/trip-summary";

describe("formatEgpFromPiastres", () => {
  describe("valid integer piastre formatting", () => {
    it.each([
      { input: "0", expectedAmount: "0.00" },
      { input: "-000", expectedAmount: "0.00" },
      { input: "1", expectedAmount: "0.01" },
      { input: "-1", expectedAmount: "-0.01" },
      { input: "99", expectedAmount: "0.99" },
      { input: "100", expectedAmount: "1.00" },
      { input: "-101", expectedAmount: "-1.01" },
      { input: "00012345", expectedAmount: "123.45" },
      { input: "9007199254740993", expectedAmount: "90071992547409.93" },
      { input: "-9007199254740993", expectedAmount: "-90071992547409.93" },
    ])(
      "formats '$input' piastres as '$expectedAmount' EGP",
      ({ input, expectedAmount }) => {
        expect(formatEgpFromPiastres(input)).toEqual({
          ok: true,
          amount: expectedAmount,
          currencyCode: "EGP",
        });
      }
    );
  });

  describe("invalid integer input rejection (INVALID_INTEGER)", () => {
    it.each([
      { label: "empty string", input: "" },
      { label: "space only", input: " " },
      { label: "leading space", input: " 1" },
      { label: "trailing space", input: "1 " },
      { label: "explicit plus sign", input: "+1" },
      { label: "decimal fraction", input: "1.0" },
      { label: "scientific notation", input: "1e3" },
      { label: "thousands comma", input: "1,000" },
      { label: "Arabic-Indic digits", input: "١٠٠" },
      { label: "double negative sign", input: "--1" },
      { label: "lone negative sign", input: "-" },
      { label: "trailing LF newline (\\n)", input: "100\n" },
      { label: "trailing CRLF newline (\\r\\n)", input: "100\r\n" },
      { label: "leading LF newline (\\n)", input: "\n100" },
    ])("rejects $label with INVALID_INTEGER", ({ input }) => {
      expect(formatEgpFromPiastres(input)).toEqual({
        ok: false,
        error: { code: "INVALID_INTEGER" },
      });
    });
  });

  describe("cross-module integration (trip-amounts -> trip-summary -> format-egp)", () => {
    it("summarizes two 0.5-piastre trips into 2 piastres and formats contractor total as 0.02 EGP", () => {
      const summary = summarizeTrips([
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
      ]);

      expect(summary).toEqual({
        ok: true,
        tripCount: 2,
        totalWeightTonnes: "1.000",
        contractorTotalPiastres: "2",
        vehicleTotalPiastres: "2",
      });

      if (summary.ok) {
        const formatted = formatEgpFromPiastres(
          summary.contractorTotalPiastres
        );
        expect(formatted).toEqual({
          ok: true,
          amount: "0.02",
          currencyCode: "EGP",
        });
      }
    });
  });
});