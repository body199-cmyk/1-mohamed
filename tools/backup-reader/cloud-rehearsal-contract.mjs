import { backupFolderParts, ROOT_FOLDER } from '../google-drive-rclone.mjs';
import { BUSINESS_FORMAT } from './business-snapshot.mjs';

/**
 * Explicit selection of one existing Drive archive, NEVER latest-by-guess.
 * Pure checks used before any network transfer. No deletion/write possible.
 */
export function selectedCloudArchive(date, history, remoteFile) {
  const parts = backupFolderParts(date);
  const expectedName = `1-mohamed-${date}-restore.tar.gz`;
  const path = parts.slice(1).join('/') + '/' + expectedName;
  if (!history || history.backup_date !== date || history.format !== BUSINESS_FORMAT
    || history.file_name !== expectedName
    || typeof history.drive_file_id !== 'string' || !/^[a-zA-Z0-9_-]{8,256}$/.test(history.drive_file_id)
    || typeof history.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(history.sha256)
    || !Number.isSafeInteger(Number(history.size_bytes))
    || Number(history.size_bytes) < 1 || Number(history.size_bytes) > 256 * 1024 * 1024) {
    throw Error('Cloud restore rehearsal: unrecognized or unsupported backup_history entry');
  }
  if (!remoteFile || remoteFile.IsDir !== false || remoteFile.Name !== expectedName ||
    remoteFile.Path !== path || remoteFile.ID !== history.drive_file_id
    || Number(remoteFile.Size) !== Number(history.size_bytes)) {
    throw Error('Cloud restore rehearsal: Drive file identity/path/size mismatch');
  }
  return {
    date,
    filename: expectedName,
    size: Number(history.size_bytes),
    sha256: history.sha256,
    remote: 'drive:' + ROOT_FOLDER + '/' + path,
  };
}
