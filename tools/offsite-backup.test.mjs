import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EXPECTED_PROJECT_REF, EXPECTED_PUBLIC_TABLES, EXCLUDED_TABLE_DATA,
  ARCHIVED_DATA_TABLES, buildBackupObjectKey, buildBackupManifest,
  validateBackupEnvironment, verifyArchiveToc, verifyS3BucketProtection, verifyR2BucketProtection,
} from "./offsite-backup.mjs";

const counts = Object.fromEntries(EXPECTED_PUBLIC_TABLES.map((name) => [name, 0]));
const goodManifestInput = {
  createdAt: "2026-11-17T12:13:14.000Z",
  projectRef: EXPECTED_PROJECT_REF,
  sourceCommit: "a".repeat(40),
  serverVersion: "17.11.0",
  pgDumpVersion: "pg_dump (PostgreSQL) 17.11",
  databaseBytes: 16447155,
  dumpSha256: "b".repeat(64),
  tableCounts: counts,
  storageBucketCount: 0,
  storageObjectCount: 0,
};

test("T10 offsite manifest covers all current public tables and states identity exclusions", () => {
  const manifest = buildBackupManifest(goodManifestInput);
  assert.deepEqual(Object.keys(manifest.public_table_counts_at_snapshot).sort(), [...EXPECTED_PUBLIC_TABLES].sort());
  assert.deepEqual(manifest.archived_table_data, [...ARCHIVED_DATA_TABLES]);
  assert.deepEqual(manifest.schema_only_identity_tables, ["public.app_owner", "public.app_members"]);
  assert.equal(manifest.auth_user_data_included, false);
  assert.equal(manifest.storage_objects_included, false);
  assert.equal(manifest.dump_sha256, "b".repeat(64));
});

test("T10 refuses any Supabase Storage objects or buckets instead of silently omitting them", () => {
  assert.throws(() => buildBackupManifest({ ...goodManifestInput, storageBucketCount: 1 }), /Storage buckets exist/);
  assert.throws(() => buildBackupManifest({ ...goodManifestInput, storageObjectCount: 1 }), /Storage objects exist/);
});

test("T10 refuses missing, extra or invalid public table counts", () => {
  const missing = { ...counts }; delete missing.payments;
  assert.throws(() => buildBackupManifest({ ...goodManifestInput, tableCounts: missing }), /keys do not match/);
  assert.throws(() => buildBackupManifest({ ...goodManifestInput, tableCounts: { ...counts, unknown: 1 } }), /keys do not match/);
  assert.throws(() => buildBackupManifest({ ...goodManifestInput, tableCounts: { ...counts, trips: -1 } }), /Invalid row count/);
});

test("T10 archive TOC must contain every public table and only approved table data", () => {
  const lines = EXPECTED_PUBLIC_TABLES.flatMap((table, index) => [
    (100 + index) + "; 1259 9000 TABLE public " + table + " postgres",
    ...(EXCLUDED_TABLE_DATA.includes(table) ? [] : [(200 + index) + "; 0 0 TABLE DATA public " + table + " postgres"]),
  ]);
  assert.equal(verifyArchiveToc(lines.join("\n")), true);
  assert.throws(() => verifyArchiveToc(lines.filter((line) => !line.includes("TABLE DATA public payments")).join("\n")), /Archive table-data scope/);
  assert.throws(() => verifyArchiveToc(lines.filter((line) => !line.includes("TABLE public vehicles")).join("\n")), /missing public table definition/);
  assert.throws(() => verifyArchiveToc(lines.concat("999; 0 0 TABLE DATA public app_owner postgres").join("\n")), /Archive table-data scope/);
});

test("T10 object keys are UTC-partitioned and retain millisecond uniqueness", () => {
  assert.equal(
    buildBackupObjectKey("2026-11-17T12:13:14.123Z"),
    "1-mohamed/daily/2026/11/17/backup-20261117T121314123Z.tar.age",
  );
  assert.notEqual(
    buildBackupObjectKey("2026-11-17T12:13:14.123Z"),
    buildBackupObjectKey("2026-11-17T12:13:14.456Z"),
  );
  assert.throws(() => buildBackupObjectKey("not-a-date"), /timestamp is invalid/);
});

test("T10 requires S3 versioning and a 30-day non-bypass Governance lock", () => {
  assert.equal(verifyS3BucketProtection(
    { Status: "Enabled" },
    { ObjectLockEnabled: "Enabled", Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 30 } } },
  ), true);
  assert.throws(() => verifyS3BucketProtection({ Status: "Suspended" },
    { ObjectLockEnabled: "Enabled", Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 30 } } }), /versioning/);
  assert.throws(() => verifyS3BucketProtection({ Status: "Enabled" },
    { ObjectLockEnabled: "Enabled", Rule: { DefaultRetention: { Mode: "GOVERNANCE", Days: 7 } } }), /30 days/);
  assert.throws(() => verifyS3BucketProtection({ Status: "Enabled" },
    { ObjectLockEnabled: "Enabled", Rule: { DefaultRetention: { Mode: "COMPLIANCE", Days: 30 } } }), /Governance/);
});

test("T10 requires an enabled R2 bucket-lock rule covering the backup prefix for 30 days", () => {
  assert.equal(verifyR2BucketProtection({ rules: [
    { enabled: true, prefix: "1-mohamed/daily/", condition: { type: "Age", maxAgeSeconds: 2592000 } },
  ] }), true);
  assert.equal(verifyR2BucketProtection({ rules: [
    { enabled: true, prefix: "", condition: { type: "Age", maxAgeSeconds: 31536000 } },
  ] }), true);
  assert.throws(() => verifyR2BucketProtection({ rules: [
    { enabled: false, prefix: "1-mohamed/daily/", condition: { type: "Age", maxAgeSeconds: 31536000 } },
  ] }), /Bucket Lock rule/);
  assert.throws(() => verifyR2BucketProtection({ rules: [
    { enabled: true, prefix: "other-prefix/", condition: { type: "Age", maxAgeSeconds: 31536000 } },
  ] }), /Bucket Lock rule/);
  assert.throws(() => verifyR2BucketProtection({ rules: [
    { enabled: true, prefix: "1-mohamed/daily/", condition: { type: "Age", maxAgeSeconds: 86400 } },
  ] }), /30 days/);
});

test("T10 environment validation rejects wrong project, private age key and invalid R2 account", () => {
  const env = {
    SUPABASE_DB_URL: "postgresql://postgres." + EXPECTED_PROJECT_REF + ":password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require",
    AGE_RECIPIENT: "age1" + "a".repeat(40),
    AWS_BACKUP_BUCKET: "mohamed-backups",
    AWS_BACKUP_REGION: "eu-central-1",
    R2_ACCOUNT_ID: "a".repeat(32),
    R2_BACKUP_BUCKET: "mohamed-backups-copy",
    R2_ACCESS_KEY_ID: "test-access",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_LOCK_API_TOKEN: "read-only-token",
  };
  assert.equal(validateBackupEnvironment(env), true);
  assert.throws(() => validateBackupEnvironment({ ...env, SUPABASE_DB_URL: env.SUPABASE_DB_URL.replace(EXPECTED_PROJECT_REF, "wrongproject") }), /does not identify/);
  assert.throws(() => validateBackupEnvironment({ ...env, AGE_RECIPIENT: "AGE-SECRET-KEY-1TEST" }), /public recipient/);
  assert.throws(() => validateBackupEnvironment({ ...env, R2_ACCOUNT_ID: "not-an-account" }), /R2_ACCOUNT_ID/);
});
