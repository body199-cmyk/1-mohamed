import { createOperationRequest, type ReadOperation, type WriteOperation } from "./operation-contract";

export type LedgerResponse<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: string; readonly status: number };

async function parseResponse<T>(response: Response): Promise<LedgerResponse<T>> {
  let body: unknown;
  try { body = await response.json(); } catch { return {
    ok: false, status: response.status, error: "تعذّر قراءة رد الخادم."
  }; }
  if (!body || typeof body !== "object") return {
    ok: false, status: response.status, error: "رد غير صالح من الخادم."
  };
  const value = body as { ok?: unknown; data?: T; error?: unknown };
  if (!response.ok || value.ok !== true) return {
    ok: false, status: response.status,
    error: typeof value.error === "string" ? value.error : "فشلت العملية."
  };
  return { ok: true, data: value.data as T };
}

/**
 * A key belongs to a user action, NOT to a network attempt. Caller must keep
 * the same key when retrying after a timeout; otherwise money can double-post.
 */
export async function postLedgerWrite<T>(
  operation: WriteOperation, payload: Record<string, unknown>,
  requestKey: string, signal?: AbortSignal
): Promise<LedgerResponse<T>> {
  const body = createOperationRequest(operation, payload, requestKey);
  const response = await fetch("/api/ledger/operations", {
    method: "POST", headers: { "content-type": "application/json" },
    credentials: "same-origin", cache: "no-store",
    body: JSON.stringify(body), signal,
  });
  return parseResponse<T>(response);
}

export async function postLedgerRead<T>(
  operation: ReadOperation, payload: Record<string, unknown>,
  signal?: AbortSignal
): Promise<LedgerResponse<T>> {
  const response = await fetch("/api/ledger/read", {
    method: "POST", headers: { "content-type": "application/json" },
    credentials: "same-origin", cache: "no-store",
    body: JSON.stringify({ operation, payload }), signal,
  });
  return parseResponse<T>(response);
}
