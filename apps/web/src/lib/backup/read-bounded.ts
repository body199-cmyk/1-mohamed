import { MAX_LOCAL_PREVIEW_BYTES } from "./inspect-local";

/**
 * A bounded, browser-only read of the existing owner-only export endpoint.
 * Never persists, logs, caches, uploads or sends the received JSON anywhere.
 */
export async function readBoundedPortableResponse(
  response: Response,
  maxBytes = MAX_LOCAL_PREVIEW_BYTES,
): Promise<string> {
  if (!response.ok) throw new Error("تعذّر قراءة النسخة الحالية؛ تأكد من تسجيل الدخول بصلاحية صاحب المشروع.");
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new Error("الخادم لم يُرجع نسخة JSON صالحة.");
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    throw new Error("النسخة الحالية كبيرة جدًا للمعاينة داخل المتصفح.");
  }
  if (!response.body) throw new Error("لا يمكن قراءة بيانات النسخة الحالية.");
  const reader = response.body.getReader();
  const pieces: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error("النسخة الحالية تجاوزت الحد الآمن للمعاينة (32 ميجابايت).");
      }
      pieces.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(total);
  let offset = 0;
  for (const piece of pieces) { all.set(piece, offset); offset += piece.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(all); }
  catch { throw new Error("النسخة الحالية تحتوي نصًا غير صالح."); }
}
