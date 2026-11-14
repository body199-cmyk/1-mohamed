import { expect, it } from "vitest";
import { calculateTripAmounts, formatEgpFromPiastres } from "../src/index";

it.each([
  ["1.499", "149900"],
  ["1.500", "150000"],
  ["1.501", "150100"],
])("rounds an exact %s-tonne trip at EGP 1,000 to whole pounds", (weightTonnes, expected) => {
  const result = calculateTripAmounts({weightTonnes, contractorRateEgp:"1000",vehicleRateEgp:"1000",expenseEgp:"0"});
  expect(result).toMatchObject({ok:true,contractorTotalPiastres:expected,vehicleTotalPiastres:expected});
});

it.each([
  ["0.499", "0"], ["0.500", "100"], ["0.501", "100"],
])("rounds EGP %s once at the per-trip boundary", (weightTonnes, expected) => {
  expect(calculateTripAmounts({weightTonnes,contractorRateEgp:"1",vehicleRateEgp:"1",expenseEgp:"0"}))
    .toMatchObject({ok:true,contractorTotalPiastres:expected,vehicleTotalPiastres:expected});
});

it("adds expenses before whole-pound rounding and keeps independent rates", () => {
  expect(calculateTripAmounts({weightTonnes:"0.499",contractorRateEgp:"1",vehicleRateEgp:"2",expenseEgp:"1"}))
    .toMatchObject({ok:true,contractorTotalPiastres:"100",vehicleTotalPiastres:"200"});
});

it("normalizes monetary input to whole pounds before multiplying, without changing tonne precision", () => {
  expect(calculateTripAmounts({weightTonnes:"1.500",contractorRateEgp:"100.49",vehicleRateEgp:"100.50",expenseEgp:"0.49"}))
    .toMatchObject({ok:true,contractorTotalPiastres:"15000",vehicleTotalPiastres:"15200"});
});

it.each([
  ["0","0"], ["49","0"], ["50","1"], ["-49","0"], ["-50","-1"],
  ["125000000","1,250,000"], ["900719925474099950","9,007,199,254,741,000"],
])("formats scaled amount %s as readable whole pounds", (value, expected) => {
  expect(formatEgpFromPiastres(value)).toEqual({ok:true,amount:expected,currencyCode:"EGP"});
});
