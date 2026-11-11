import { expect, it } from "vitest";
import { contractorTone } from "../src/contractor-tone";

it.each([
  ["+9007199254740999.99 ج.م", "#116744", "لأحمد"],
  ["-600.00 ج.م", "#b42318", "على أحمد"],
  ["0.00 ج.م", "#475569", "متعادل"],
  ["-0.00 ج.م", "#475569", "متعادل"],
  ["<script>1.00</script>", "#475569", ""],
  ["2026-11-11", "#475569", ""],
])("classifies %s without numeric coercion", (text, color, label) => {
  expect(contractorTone(text)).toEqual({ color, label });
});
