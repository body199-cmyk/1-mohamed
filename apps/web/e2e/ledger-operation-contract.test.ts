import { describe, expect, it } from "vitest";
import { createOperationRequest, isJsonRecord, isReadOperation,
  isWriteOperation, validRequestKey, WRITE_OPERATIONS, READ_OPERATIONS } from "../src/lib/ledger/operation-contract";

describe("prepared permanent ledger API contracts", () => {
  it("allows only explicitly audited owner RPCs", () => {
    expect(isWriteOperation("trip.create")).toBe(true);
    expect(isWriteOperation("payment.cancel")).toBe(true);
    expect(isWriteOperation("app_set_initial_owner")).toBe(false);
    expect(isWriteOperation("sql.execute")).toBe(false);
    expect(isWriteOperation("__proto__")).toBe(false);
    expect(isReadOperation("trips.list")).toBe(true);
    expect(isReadOperation("payments.list")).toBe(true);
    expect(isReadOperation("app_get_owner_id")).toBe(false);
    expect(Object.values(WRITE_OPERATIONS).every(name => name.startsWith("app_op_"))).toBe(true);
    expect(Object.values(READ_OPERATIONS).every(name => name.startsWith("app_op_"))).toBe(true);
  });
  it("requires a stable idempotency key and a JSON object payload", () => {
    expect(validRequestKey("retry-20261112-001")).toBe(true);
    expect(validRequestKey("x")).toBe(false);
    expect(validRequestKey("abc defgh")).toBe(false);
    expect(isJsonRecord({ id: "T1" })).toBe(true);
    expect(isJsonRecord([])).toBe(false);
    expect(isJsonRecord(null)).toBe(false);
    const request = createOperationRequest("payment.create", { id: "P1" }, "retry-20261112-001");
    expect(request.requestKey).toBe("retry-20261112-001");
    expect(request.payload).toEqual({ id: "P1" });
    expect(() => createOperationRequest("trip.create", {}, "bad")).toThrow();
  });
});
