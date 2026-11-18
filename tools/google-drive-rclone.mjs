import { createHash } from "node:crypto";
import { createReadStream, statSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

export const ROOT_FOLDER = "1-mohamed-backups";
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const BACKUP_NAME = /^1-mohamed-(\d{4}-\d{2}-\d{2})\.tar\.gz\.age$/;

function assert(value, message) { if (!value) throw new Error("BACKUP_INVALID: " + message); }

export function backupFolderParts(today) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(today), "Invalid Cairo date.");
  const month = Number(today.slice(5,7));
  assert(month >= 1 && month <= 12 && !Number.isNaN(Date.parse(today+"T00:00:00Z")) && new Date(today+"T00:00:00Z").toISOString().slice(0,10) === today, "Invalid backup month/date.");
  return [ROOT_FOLDER, today.slice(0,4), String(month).padStart(2,"0") + " - " + MONTHS[month-1]];
}

export function isManagedBackupPath(path, name) {
  const match = BACKUP_NAME.exec(name || "");
  if (!match || typeof path !== "string") return false;
  try { return path === backupFolderParts(match[1]).slice(1).join("/") + "/" + name; }
  catch { return false; }
}

export function verifyRcloneFile(file, name, bytes, md5) {
  assert(file && file.Name === name && file.IsDir === false, "Drive file metadata did not match.");
  assert(file.Size === bytes, "Drive file size did not match.");
  const reportedHash=file.Hashes?.md5 ?? file.Hashes?.MD5;
  assert(typeof reportedHash === "string" && reportedHash.toLowerCase() === md5.toLowerCase(), "Drive MD5 did not match.");
  assert(typeof file.ID === "string" && file.ID.length > 0, "Drive file ID was missing.");
  return true;
}

function command(env, args) {
  const childEnv = {
    ...env,
    RCLONE_CONFIG_DRIVE_TYPE: "drive",
    RCLONE_CONFIG_DRIVE_SCOPE: "drive.file",
    RCLONE_CONFIG_DRIVE_SKIP_SHORTCUTS: "true",
    RCLONE_CONFIG_DRIVE_TOKEN: env.RCLONE_CONFIG_DRIVE_TOKEN
  };
  const result = spawnSync("rclone", args, { env: childEnv, encoding: "utf8", maxBuffer: 12*1024*1024, stdio: ["ignore","pipe","pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("rclone " + args[0] + " failed (exit " + result.status + "); output withheld to protect credentials.");
  return (result.stdout || "").trim();
}

function list(env) {
  const raw = command(env, ["lsjson", "drive:" + ROOT_FOLDER, "--recursive", "--files-only", "--hash"]);
  const files = JSON.parse(raw);
  assert(Array.isArray(files), "Drive listing is not an array.");
  return files.filter(file => BACKUP_NAME.test(file.Name || "") && typeof file.Path === "string");
}

async function digest(path, algorithm = "md5") {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function prepareRcloneBackup(env, encryptedPath, name, today, filesToPrune) {
  assert(typeof env.RCLONE_CONFIG_DRIVE_TOKEN === "string" && env.RCLONE_CONFIG_DRIVE_TOKEN.length > 0, "Missing rclone Drive token.");
  let token;
  try { token = JSON.parse(env.RCLONE_CONFIG_DRIVE_TOKEN); } catch { throw new Error("BACKUP_INVALID: Invalid rclone token JSON."); }
  assert(token.refresh_token && token.access_token, "rclone token must contain refresh_token and access_token.");
  assert(name === "1-mohamed-" + today + ".tar.gz.age", "Backup filename/date mismatch.");
  command(env, ["mkdir", "drive:" + ROOT_FOLDER]);
  const before = list(env);
  assert(!before.some(file => file.Name === name && isManagedBackupPath(file.Path,file.Name)), "A backup for " + today + " already exists; refusing a duplicate.");
  const folder = backupFolderParts(today).join("/");
  command(env, ["mkdir", "drive:" + folder]);
  command(env, ["copyto", encryptedPath, "drive:" + folder + "/" + name, "--immutable"]);
  const files = list(env);
  const file = files.find(f => f.Name === name && f.Path === backupFolderParts(today).slice(1).join("/") + "/" + name);
  verifyRcloneFile(file, name, statSync(encryptedPath).size, await digest(encryptedPath));
  const downloaded = encryptedPath + ".download";
  try {
    command(env, ["copyto", "drive:" + folder + "/" + name, downloaded]);
    assert(await digest(downloaded, "sha256") === await digest(encryptedPath, "sha256"), "Downloaded archive SHA-256 did not match.");
  } finally { rmSync(downloaded, {force:true}); }
  // Never call "rclone link": on Google Drive it can enable public sharing.
  const webViewLink = "https://drive.google.com/file/d/" + encodeURIComponent(file.ID) + "/view";
  return {
    file: { id: file.ID, name, size: String(file.Size), md5Checksum: file.Hashes.md5 ?? file.Hashes.MD5, webViewLink },
    prune: async () => {
      const all = list(env);
      assert(env.BACKUP_RESTORE_VERIFIED === "true" && env.BACKUP_RETENTION_ENABLED === "true", "Drive deletion is disabled pending restore approval.");
      const expired = filesToPrune(all.filter(f => isManagedBackupPath(f.Path, f.Name)).map(f => ({ ...f, name: f.Name })), today);
      for (const item of expired) {
        assert(isManagedBackupPath(item.Path, item.Name), "Refusing to delete an unrecognized Drive path.");
        command(env, ["deletefile", "drive:" + ROOT_FOLDER + "/" + item.Path, "--drive-use-trash=false"]);
      }
      return { retained: all.length - expired.length, deleted: expired.length };
    }
  };
}
