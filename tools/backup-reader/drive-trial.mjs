import {spawnSync} from 'node:child_process';
import {createReadStream,readFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
async function sha(path){const h=createHash('sha256');for await(const c of createReadStream(path))h.update(c);return h.digest('hex');}
function command(args){
 const env={...process.env,RCLONE_CONFIG:'/dev/null',RCLONE_CONFIG_DRIVE_TYPE:'drive',RCLONE_CONFIG_DRIVE_SCOPE:'drive.file',RCLONE_CONFIG_DRIVE_SKIP_SHORTCUTS:'true'};
 const r=spawnSync('rclone',[...args,'--tpslimit','1','--contimeout','15s','--timeout','60s','--retries','2','--retries-sleep','15s','--low-level-retries','2'],{env,encoding:'utf8',maxBuffer:1024*1024});
 if(r.error||r.status!==0){const quota=/rateLimitExceeded|RATE_LIMIT_EXCEEDED|Quota exceeded/.test(r.stderr||'');throw Error(quota?'Shared Drive client quota blocked this step':'Drive transfer failed; private diagnostics withheld');}
}
async function main(){
 const file=process.env.ENCRYPTED_ARCHIVE;
 if(!file||!/^\d+$/.test(process.env.GITHUB_RUN_ID||'')||!/^1-mohamed-\d{4}-\d{2}-\d{2}\.tar\.gz\.age$/.test(basename(file))||!readFileSync(file).subarray(0,24).toString().startsWith('age-encryption.org/v1'))throw Error('Refusing to upload an unexpected or unencrypted file');
 const remote=`drive:1-mohamed-backups/_restore-drill/${process.env.GITHUB_RUN_ID}/${basename(file)}`;
 const downloaded=file+'.roundtrip';
 try{command(['copyto',file,remote]);command(['copyto',remote,downloaded]);if(await sha(file)!==await sha(downloaded))throw Error('Downloaded encrypted archive checksum mismatch');console.log('Real encrypted Drive upload/download SHA-256 verification passed.');}
 finally{rmSync(downloaded,{force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
