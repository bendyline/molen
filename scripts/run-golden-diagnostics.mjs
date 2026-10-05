import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, availableParallelism, freemem, platform, totalmem } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const command = args.shift();
if (!command)
  throw new Error('Usage: node scripts/run-golden-diagnostics.mjs -- <command> [args...]');
const out = resolve(process.env.MOLEN_GOLDEN_DIAGNOSTICS_DIR ?? '.artifacts/golden-ci');
mkdirSync(out, { recursive: true });
const resources = join(out, 'resources.log');
const tests = join(out, 'tests.log');
writeFileSync(resources, '');
writeFileSync(tests, '');
function persist(path, data) {
  try {
    appendFileSync(path, data);
  } catch (error) {
    // A full disk must not hide the test's exit code or stop live log output.
    process.stderr.write(`[golden:diagnostics] Cannot save ${path}: ${error.code}\n`);
  }
}
const read = (path) => {
  try {
    return readFileSync(path, 'utf8').trim();
  } catch {
    return 'unavailable';
  }
};
const probe = (command, args) => {
  try {
    return execFileSync(command, args, {
      encoding: 'utf8',
      timeout: 3000,
      maxBuffer: 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    return `unavailable: ${error.message.split('\n')[0]}`;
  }
};
const log = (text) => {
  persist(resources, `${text}\n`);
  // Mirror every sample into the Actions log: artifacts cannot upload after a hard host loss.
  process.stdout.write(`${text}\n`);
};
function sample(reason) {
  log(
    `[golden:resources] ${JSON.stringify({ at: new Date().toISOString(), reason, node: process.version, platform: platform(), arch: arch(), cpus: availableParallelism(), totalMiB: Math.round(totalmem() / 1048576), freeMiB: Math.round(freemem() / 1048576) })}`,
  );
  if (platform() !== 'linux') return;
  log(`[golden:memory]\n${read('/proc/meminfo')}`);
  for (const kind of ['cpu', 'memory', 'io'])
    log(`[golden:pressure:${kind}] ${read(`/proc/pressure/${kind}`)}`);
  const group = read('/proc/self/cgroup')
    .split('\n')
    .find((line) => line.startsWith('0::'))
    ?.slice(3);
  const cgroup = join('/sys/fs/cgroup', group ?? '');
  for (const name of [
    'memory.current',
    'memory.peak',
    'memory.max',
    'memory.events',
    'pids.current',
    'pids.max',
  ])
    log(`[golden:cgroup:${name}] ${read(join(cgroup, name))}`);
  log(`[golden:disk]\n${probe('df', ['-h', '.'])}`);
  log(
    `[golden:processes] PID PPID CPU% RSS(KiB) STATE COMMAND\n${probe('ps', ['-eo', 'pid,ppid,pcpu,rss,stat,comm', '--sort=-rss']).split('\n').slice(1, 16).join('\n')}`,
  );
}

sample('start');
const child = spawn(command, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: platform() !== 'win32',
});
for (const [stream, target] of [
  [child.stdout, process.stdout],
  [child.stderr, process.stderr],
]) {
  stream.on('data', (chunk) => {
    persist(tests, chunk);
    target.write(chunk);
  });
}
const interval = setInterval(() => sample('running'), 15_000);
let interrupted;
const forward = (signal) => {
  interrupted = signal;
  log(`[golden:signal] ${new Date().toISOString()} ${signal}`);
  sample(signal);
  try {
    // Stop pnpm and its test workers together rather than leaving the recursive run alive.
    if (platform() === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
};
const onInt = () => forward('SIGINT');
const onTerm = () => forward('SIGTERM');
process.on('SIGINT', onInt);
process.on('SIGTERM', onTerm);
let result;
try {
  result = await new Promise((done, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => done({ code, signal }));
  });
} finally {
  clearInterval(interval);
  process.off('SIGINT', onInt);
  process.off('SIGTERM', onTerm);
  sample('end');
  if (platform() === 'linux')
    log(
      `[golden:kernel]\n${probe('sudo', ['-n', 'dmesg', '--ctime']).split('\n').slice(-80).join('\n')}`,
    );
}
const exitCode =
  interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : (result.code ?? 1);
log(`[golden:exit] ${JSON.stringify({ ...result, exitCode })}`);
process.exitCode = exitCode;
