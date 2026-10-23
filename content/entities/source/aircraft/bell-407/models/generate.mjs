// Profile snapshot: airframe.json; authoritative roster: source/aircraft-expansion.json; shared deterministic mesh builder.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const command=fileURLToPath(new URL('../../../../../../packages/entities/scripts/generate-aircraft.mjs',import.meta.url));
const result=spawnSync(process.execPath,[command,'--ids=bell-407',...process.argv.slice(2)],{stdio:'inherit'});
process.exitCode=result.status??1;
