import { cairoDate } from '../offsite-backup.mjs';
import { verifyBusinessDrillOnDrive } from '../google-drive-rclone.mjs';
import { caCertificate } from './export.mjs';
import { sourceConnection } from './contract.mjs';
import { createBusinessFiles } from './business-files.mjs';

try{
 if(process.env.GITHUB_EVENT_NAME!=='workflow_dispatch'||process.env.PLAIN_BACKUP_DRILL!=='true')throw Error('Only an explicit manual drill may run this script');
 const config=sourceConnection(process.env.SUPABASE_DB_URL,await caCertificate());
 const backup=await createBusinessFiles(config,{date:cairoDate(new Date()),commit:process.env.GITHUB_SHA,tempRoot:process.env.RUNNER_TEMP});
 try{
  await verifyBusinessDrillOnDrive(process.env,backup);
  console.log(JSON.stringify({date:backup.cairoDate,verified:true,sha256:backup.sha256,tables:backup.tables,excel:backup.excelName}));
 }finally{backup.cleanup();}
}catch(err){console.error('Plain backup drill failed: '+(err.code||err.message));process.exitCode=1;}
