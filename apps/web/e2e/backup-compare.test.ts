import { describe, it, expect } from "vitest";
import { createPortableBackup, PORTABLE_BACKUP_TABLES } from "../src/lib/backup/export";
import { compareVerifiedPortableBackups } from "../src/lib/backup/compare-local";

const empty = () => Object.fromEntries(PORTABLE_BACKUP_TABLES.map(name => [name, [] as Record<string, unknown>[]]));
const signed = (tables: ReturnType<typeof empty>) =>
  JSON.stringify(createPortableBackup(tables, "2026-11-19T12:00:00.000Z"));

describe("safe comparison of local and current snapshots", () => {
  it("classifies unchanged, backup-only, current-only and modified entries without summing financial balances", async () => {
    const old = empty(), now = empty();
    old.vehicles = [{ id: "V1", plate_number: "abc" }];
    now.vehicles = [{ plate_number: "abc", id: "V1" }]; // order should not affect equality
    old.contractors = [{ id: "C1", name: "الأول" }];
    now.contractors = [{ id: "C1", name: "الجديد" }];
    old.trips = [
      { id: "TR1", vehicle_id: "V1", counterparty_contractor_id: "C1",
        responsible_contractor_id: "C1", contractor_total_piastres: "9007199254741000" },
      { id: "TR2", vehicle_id: "V1", responsible_contractor_id: "C2", trip_date: "2026-11-18" },
    ];
    now.trips = [
      { id: "TR1", vehicle_id: "V1", counterparty_contractor_id: "C1",
        responsible_contractor_id: "C2", contractor_total_piastres: "1" },
      { id: "TR3", vehicle_id: "V1", responsible_contractor_id: "C1" },
    ];
    const diff = await compareVerifiedPortableBackups(signed(old), signed(now));
    expect(diff.totalModified).toBe(2);
    expect(diff.totalBackupOnly).toBe(1);
    expect(diff.totalCurrentOnly).toBe(1);
    expect(diff.totalUnchanged).toBe(1);
    expect(diff.financialEntriesDiffer).toBe(3);
    expect(diff.affectedCashAccountCount).toBe(2);
    expect(diff.affectedContractorCount).toBe(2);
    expect(diff.financialReconciliationPerformed).toBe(false);
    expect(diff.selectableRestore).toBe(false);
    expect(diff.identityMismatch).toBe(false);
    expect(diff.tables.find(row => row.table === "trips")?.backupOnly).toBe(1);
  });

  it("rejects duplicate composite IDs and duplicate numeric IDs rather than losing rows", async () => {
    const t = empty();
    t.vehicle_accounts = [
      { vehicle_id: "v1", contractor_id: "c1" },
      { contractor_id: "c1", vehicle_id: "v1" },
    ];
    await expect(compareVerifiedPortableBackups(signed(t), signed(empty()))).rejects.toThrow(/مكرر/);
    const u = empty();
    u.audit_log = [{ id: 5 }, { id: 5 }];
    await expect(compareVerifiedPortableBackups(signed(u), signed(empty()))).rejects.toThrow(/مكرر/);
  });

  it("refuses missing IDs, tampering, and unsafe amounts", async () => {
    const t = empty();
    t.trips = [{ notes: "no id" }];
    await expect(compareVerifiedPortableBackups(signed(t), signed(empty()))).rejects.toThrow(/معرّف/);
    const bad = JSON.parse(signed(empty()));
    bad.tables.trips.push({ id: "FORGED" });
    await expect(compareVerifiedPortableBackups(JSON.stringify(bad), signed(empty())))
      .rejects.toThrow(/عدد سجلات/);
  });

  it("detects mismatched owner/member identities and does not authorize merge", async () => {
    const old = empty(), live = empty();
    old.app_owner = [{ id: "default", owner_user_id: "owner-old" }];
    live.app_owner = [{ id: "default", owner_user_id: "owner-new" }];
    const diff = await compareVerifiedPortableBackups(signed(old), signed(live));
    expect(diff.identityMismatch).toBe(true);
    expect(diff.selectableRestore).toBe(false);
  });

  it("caps example disclosures to 8 per table", async () => {
    const old = empty();
    old.trips = Array.from({ length: 20 }, (_, id) => ({ id: "T" + id }));
    const diff = await compareVerifiedPortableBackups(signed(old), signed(empty()));
    expect(diff.tables.find(row => row.table === "trips")?.examples).toHaveLength(8);
    expect(diff.totalBackupOnly).toBe(20);
  });
});
