import {describe,it,expect} from "vitest";
import {PORTABLE_BACKUP_TABLES,createPortableBackup,serializeTableCsv} from "../src/lib/backup/export";
const empty=()=>Object.fromEntries(PORTABLE_BACKUP_TABLES.map(table=>[table,[]]));
describe("portable backup export",()=>{
 it("requires every public table and records counts plus SHA-256",()=>{const tables=empty();tables.trips=[{id:"TR-1",weight_milli_tonnes:"1000"}];const b=createPortableBackup(tables,"2026-11-17T12:00:00.000Z");expect(b.tables_included).toHaveLength(12);expect(b.row_counts.trips).toBe(1);expect(b.sha256).toMatch(/^[a-f0-9]{64}$/);expect(b.auth_passwords_included).toBe(false);});
 it("rejects missing tables and unsafe numeric precision",()=>{const t=empty();delete t.payments;expect(()=>createPortableBackup(t as never)).toThrow(/All 12/);const u=empty();u.payments=[{amount_piastres:Number.MAX_SAFE_INTEGER+1}];expect(()=>createPortableBackup(u)).toThrow(/Unsafe numeric value/);const decimals=empty();decimals.audit_log=[{financial_impact:{ratio:12.5}}];expect(()=>createPortableBackup(decimals)).not.toThrow();});
 it("creates UTF-8 BOM CSV with safe quoting and stable headers",()=>{const csv=serializeTableCsv("trips",[{id:"TR-1",origin:"محجر, شرق",destination:'"موقع"'}]);expect(csv.charCodeAt(0)).toBe(0xfeff);expect(csv).toContain('"محجر, شرق"');expect(csv).toContain('"""موقع"""');});
});
