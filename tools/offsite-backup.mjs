import { createHash } from "node:crypto";
import { appendFileSync, createReadStream, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const EXPECTED_PROJECT_REF = "sskkuniskphlawivzudw";
export const EXPECTED_PUBLIC_TABLES = Object.freeze([
  "app_members", "app_owner", "audit_log", "business_settings",
  "contractors", "idempotency_keys", "opening_balances", "payments",
  "trips", "vehicle_accounts", "vehicles",
]);
export const EXCLUDED_TABLE_DATA = Object.freeze(["app_owner", "app_members"]);
export const ARCHIVED_DATA_TABLES = Object.freeze(
  EXPECTED_PUBLIC_TABLES.filter((name) => !EXCLUDED_TABLE_DATA.includes(name)),
);

function assert(condition, message) {
  if (!condition) throw new Error("OFFSITE_BACKUP_INVALID: " + message);
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), label + " must be an object.");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    label + " keys do not match the expected schema.");
}

export function validateBackupEnvironment(env) {
  const required = [
    "SUPABASE_DB_URL", "AGE_RECIPIENT", "AWS_BACKUP_BUCKET", "AWS_BACKUP_REGION",
    "R2_ACCOUNT_ID", "R2_BACKUP_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_LOCK_API_TOKEN",
  ];
  for (const name of required) {
    assert(typeof env[name] === "string" && env[name].trim().length > 0,
      "Missing required environment setting: " + name);
  }
  assert(/^age1[0-9a-z]+$/.test(env.AGE_RECIPIENT),
    "AGE_RECIPIENT must be an age public recipient, never a private identity.");
  assert(/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID), "R2_ACCOUNT_ID is invalid.");
  assert(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(env.AWS_BACKUP_BUCKET), "AWS bucket name is invalid.");
  assert(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BACKUP_BUCKET), "R2 bucket name is invalid.");

  let connection;
  try { connection = new URL(env.SUPABASE_DB_URL); }
  catch { throw new Error("OFFSITE_BACKUP_INVALID: SUPABASE_DB_URL is not a valid PostgreSQL URL."); }
  assert(["postgres:", "postgresql:"].includes(connection.protocol), "SUPABASE_DB_URL must use PostgreSQL.");
  const username = decodeURIComponent(connection.username);
  const correctProject = connection.hostname.includes(EXPECTED_PROJECT_REF) ||
    username.includes(EXPECTED_PROJECT_REF);
  assert(correctProject, "Database URL does not identify the expected 1-mohamed Supabase project.");
  return true;
}

export function verifyS3BucketProtection(versioning, lockConfiguration) {
  assert(versioning && versioning.Status === "Enabled", "S3 bucket versioning must be enabled.");
  const retention = lockConfiguration?.Rule?.DefaultRetention;
  assert(lockConfiguration?.ObjectLockEnabled === "Enabled", "S3 Object Lock must be enabled.");
  assert(retention?.Mode === "GOVERNANCE" && Number(retention.Days) >= 30,
    "S3 bucket must enforce at least 30 days of Governance retention.");
  return true;
}

export function verifyR2BucketProtection(lockConfiguration) {
  const rules = lockConfiguration?.rules;
  assert(Array.isArray(rules), "Cloudflare R2 lock rules could not be read.");
  const requiredPrefix = "1-mohamed/daily/";
  const protectedPrefix = rules.some((rule) => {
    const prefix = typeof rule.prefix === "string" ? rule.prefix : "";
    return rule.enabled === true &&
      requiredPrefix.startsWith(prefix) &&
      rule.condition?.type === "Age" &&
      Number(rule.condition.maxAgeSeconds) >= 30 * 24 * 60 * 60;
  });
  assert(protectedPrefix, "R2 must have an enabled Bucket Lock rule covering 1-mohamed/daily/ for at least 30 days.");
  return true;
}

async function verifyR2BucketProtectionFromApi(env) {
  const url = "https://api.cloudflare.com/client/v4/accounts/" + env.R2_ACCOUNT_ID +
    "/r2/buckets/" + encodeURIComponent(env.R2_BACKUP_BUCKET) + "/lock";
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: "Bearer " + env.R2_LOCK_API_TOKEN },
  });
  assert(response.ok, "Cloudflare R2 lock configuration request failed with HTTP " + response.status + ".");
  const payload = await response.json();
  assert(payload.success === true, "Cloudflare R2 did not confirm the bucket lock configuration.");
  return verifyR2BucketProtection(payload.result);
}

export function verifyArchiveToc(tocText) {
  assert(typeof tocText === "string" && tocText.length > 0, "pg_restore produced an empty archive index.");
  const lines = tocText.split(/\r?\n/);
  for (const table of EXPECTED_PUBLIC_TABLES) {
    assert(lines.some((line) => new RegExp("\\bTABLE public " + table + "\\b").test(line)),
      "Archive is missing public table definition: " + table);
    const hasData = lines.some((line) => new RegExp("\\bTABLE DATA public " + table + "\\b").test(line));
    const shouldHaveData = !EXCLUDED_TABLE_DATA.includes(table);
    assert(hasData === shouldHaveData, "Archive table-data scope is incorrect for public." + table);
  }
  return true;
}

export function buildBackupObjectKey(createdAt) {
  const date = new Date(createdAt);
  assert(!Number.isNaN(date.getTime()), "Backup timestamp is invalid.");
  const iso = date.toISOString();
  const day = iso.slice(0, 10);
  const compact = iso.replace(/[-:.]/g, "");
  return "1-mohamed/daily/" + day.slice(0, 4) + "/" + day.slice(5, 7) + "/" +
    day.slice(8, 10) + "/backup-" + compact + ".tar.age";
}

export function buildBackupManifest({
  createdAt, projectRef, sourceCommit, serverVersion, pgDumpVersion,
  databaseBytes, dumpSha256, tableCounts, storageBucketCount, storageObjectCount,
}) {
  assert(projectRef === EXPECTED_PROJECT_REF, "Unexpected Supabase project reference.");
  assert(typeof createdAt === "string" && !Number.isNaN(Date.parse(createdAt)), "Backup timestamp is invalid.");
  assert(typeof sourceCommit === "string" && /^[a-f0-9]{7,64}$/i.test(sourceCommit),
    "Source commit is invalid.");
  assert(typeof serverVersion === "string" && serverVersion.length > 0, "PostgreSQL server version is missing.");
  assert(typeof pgDumpVersion === "string" && pgDumpVersion.includes("pg_dump"), "pg_dump version is missing.");
  assert(Number.isSafeInteger(databaseBytes) && databaseBytes > 0, "Database size is invalid.");
  assert(typeof dumpSha256 === "string" && /^[a-f0-9]{64}$/.test(dumpSha256), "Dump SHA-256 is invalid.");
  assert(Number.isSafeInteger(storageBucketCount) && storageBucketCount === 0,
    "Supabase Storage buckets exist; object backup must be implemented before continuing.");
  assert(Number.isSafeInteger(storageObjectCount) && storageObjectCount === 0,
    "Supabase Storage objects exist; object backup must be implemented before continuing.");
  exactKeys(tableCounts, EXPECTED_PUBLIC_TABLES, "Public table counts");
  for (const [table, count] of Object.entries(tableCounts)) {
    assert(Number.isSafeInteger(count) && count >= 0, "Invalid row count for public." + table);
  }

  return {
    format: "1-mohamed-offsite-postgres-backup",
    format_version: 1,
    created_at: new Date(createdAt).toISOString(),
    project_ref: projectRef,
    source_commit: sourceCommit,
    postgres_server_version: serverVersion,
    pg_dump_version: pgDumpVersion,
    database_size_bytes: databaseBytes,
    schema: "public",
    public_table_counts_at_snapshot: tableCounts,
    archived_table_data: [...ARCHIVED_DATA_TABLES],
    schema_only_identity_tables: EXCLUDED_TABLE_DATA.map((table) => "public." + table),
    excluded_managed_schemas: ["auth", "storage", "extensions"],
    auth_user_data_included: false,
    storage_bucket_count: storageBucketCount,
    storage_object_count: storageObjectCount,
    storage_objects_included: false,
    dump_sha256: dumpSha256,
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: options.env ?? process.env,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "no command output").slice(-5000);
    throw new Error(command + " failed with exit " + result.status + ": " + detail);
  }
  return result.stdout ?? "";
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function uploadAndVerify({ file, bucket, key, region, endpoint, env, sha256 }) {
  const destination = "s3://" + bucket + "/" + key;
  const uploadArgs = ["s3", "cp", file, destination, "--region", region, "--only-show-errors",
    "--metadata", "sha256=" + sha256];
  if (!endpoint) uploadArgs.push("--sse", "AES256");
  else uploadArgs.push("--endpoint-url", endpoint);
  run("aws", uploadArgs, { env });

  const headArgs = ["s3api", "head-object", "--bucket", bucket, "--key", key,
    "--region", region, "--output", "json"];
  if (endpoint) headArgs.push("--endpoint-url", endpoint);
  const head = JSON.parse(run("aws", headArgs, { env }));
  assert(Number(head.ContentLength) === statSync(file).size,
    "Uploaded object size does not match at " + bucket + ".");
  assert(head.Metadata?.sha256 === sha256,
    "Uploaded object checksum metadata does not match at " + bucket + ".");
  return destination;
}

function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", "utf8");
  }
}

export async function runOffsiteBackup(env = process.env) {
  validateBackupEnvironment(env);
  const s3Versioning = JSON.parse(run("aws", [
    "s3api", "get-bucket-versioning", "--bucket", env.AWS_BACKUP_BUCKET,
    "--region", env.AWS_BACKUP_REGION, "--output", "json",
  ]));
  const s3Lock = JSON.parse(run("aws", [
    "s3api", "get-object-lock-configuration", "--bucket", env.AWS_BACKUP_BUCKET,
    "--region", env.AWS_BACKUP_REGION, "--output", "json",
  ]));
  verifyS3BucketProtection(s3Versioning, s3Lock.ObjectLockConfiguration);
  await verifyR2BucketProtectionFromApi(env);

  const work = mkdtempSync(join(env.RUNNER_TEMP || tmpdir(), "mohamed-backup-"));
  try {
    const containerScript = [
      "set -eu",
      "pg_dump --version > /backup/pg_dump_version.txt",
      "pg_dump --dbname=\"$SUPABASE_DB_URL\" --schema=public --exclude-table-data=public.app_owner --exclude-table-data=public.app_members --format=custom --no-owner --no-acl --file=/backup/public.dump",
      "test -s /backup/public.dump",
      "pg_restore --list /backup/public.dump > /backup/toc.list",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select jsonb_build_object('app_members',(select count(*) from public.app_members),'app_owner',(select count(*) from public.app_owner),'audit_log',(select count(*) from public.audit_log),'business_settings',(select count(*) from public.business_settings),'contractors',(select count(*) from public.contractors),'idempotency_keys',(select count(*) from public.idempotency_keys),'opening_balances',(select count(*) from public.opening_balances),'payments',(select count(*) from public.payments),'trips',(select count(*) from public.trips),'vehicle_accounts',(select count(*) from public.vehicle_accounts),'vehicles',(select count(*) from public.vehicles))::text\" > /backup/table-counts.json",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select (select count(*) from storage.buckets)::text || '|' || (select count(*) from storage.objects)::text\" > /backup/storage-counts.txt",
      "psql \"$SUPABASE_DB_URL\" -XAt -v ON_ERROR_STOP=1 -c \"select pg_database_size(current_database())::text || '|' || current_setting('server_version')\" > /backup/database-info.txt",
    ].join("\n");

    run("docker", [
      "run", "--rm", "--network", "host", "-e", "SUPABASE_DB_URL",
      "-v", work + ":/backup", "postgres:17.11-bookworm", "sh", "-ceu", containerScript,
    ], { env });

    verifyArchiveToc(readFileSync(join(work, "toc.list"), "utf8"));
    const tableCounts = JSON.parse(readFileSync(join(work, "table-counts.json"), "utf8").trim());
    const [storageBucketCount, storageObjectCount] = readFileSync(join(work, "storage-counts.txt"), "utf8")
      .trim().split("|").map(Number);
    const [databaseBytes, serverVersion] = readFileSync(join(work, "database-info.txt"), "utf8")
      .trim().split("|");
    const dumpPath = join(work, "public.dump");
    const createdAt = new Date().toISOString();
    const manifest = buildBackupManifest({
      createdAt,
      projectRef: EXPECTED_PROJECT_REF,
      sourceCommit: env.GITHUB_SHA || "0000000",
      serverVersion,
      pgDumpVersion: readFileSync(join(work, "pg_dump_version.txt"), "utf8").trim(),
      databaseBytes: Number(databaseBytes),
      dumpSha256: await sha256File(dumpPath),
      tableCounts,
      storageBucketCount,
      storageObjectCount,
    });
    writeFileSync(join(work, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", {
      encoding: "utf8", mode: 0o600,
    });

    const bundlePath = join(work, "1-mohamed.tar");
    run("tar", ["-cf", bundlePath, "-C", work, "public.dump", "manifest.json"]);
    const encryptedPath = join(work, "1-mohamed.tar.age");
    run("age", ["-r", env.AGE_RECIPIENT, "-o", encryptedPath, bundlePath]);
    const encryptedSha = await sha256File(encryptedPath);
    const checksumPath = encryptedPath + ".sha256";
    writeFileSync(checksumPath, encryptedSha + "  1-mohamed.tar.age\n", {
      encoding: "utf8", mode: 0o600,
    });

    const objectKey = buildBackupObjectKey(createdAt);
    const region = env.AWS_BACKUP_REGION;
    const s3Object = uploadAndVerify({
      file: encryptedPath, bucket: env.AWS_BACKUP_BUCKET, key: objectKey,
      region, env, sha256: encryptedSha,
    });
    const s3Checksum = uploadAndVerify({
      file: checksumPath, bucket: env.AWS_BACKUP_BUCKET, key: objectKey + ".sha256",
      region, env, sha256: await sha256File(checksumPath),
    });

    const endpoint = "https://" + env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com";
    const r2Env = {
      ...env,
      AWS_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
      AWS_DEFAULT_REGION: "auto",
      AWS_EC2_METADATA_DISABLED: "true",
    };
    delete r2Env.AWS_SESSION_TOKEN;
    delete r2Env.AWS_PROFILE;
    delete r2Env.AWS_WEB_IDENTITY_TOKEN_FILE;
    const r2Object = uploadAndVerify({
      file: encryptedPath, bucket: env.R2_BACKUP_BUCKET, key: objectKey,
      region: "auto", endpoint, env: r2Env, sha256: encryptedSha,
    });
    const r2Checksum = uploadAndVerify({
      file: checksumPath, bucket: env.R2_BACKUP_BUCKET, key: objectKey + ".sha256",
      region: "auto", endpoint, env: r2Env, sha256: await sha256File(checksumPath),
    });

    const size = statSync(encryptedPath).size;
    appendSummary([
      "## Offsite backup completed",
      "- Project: 1-mohamed",
      "- Snapshot (UTC): " + manifest.created_at,
      "- PostgreSQL: " + manifest.postgres_server_version,
      "- Encrypted archive: " + size + " bytes",
      "- SHA-256: " + encryptedSha,
      "- S3: verified upload and HEAD — " + s3Object,
      "- R2: verified upload and HEAD — " + r2Object,
      "- Checksum sidecars: verified in both destinations",
      "- Storage objects: 0 (backup job fails closed if any appear)",
      "- Auth users and owner/member mappings are not exported; see recovery runbook.",
      "",
    ]);
    return { createdAt: manifest.created_at, objectKey, encryptedSha, size, s3Object, r2Object, s3Checksum, r2Checksum };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOffsiteBackup().catch((error) => {
    console.error("Offsite backup failed: " + (error?.message || String(error)));
    process.exitCode = 1;
  });
}
