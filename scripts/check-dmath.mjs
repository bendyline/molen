// Fails if kernel simulation code calls transcendental Math.* directly.
// Kernel/sim code must use the dmath module instead (docs/04-kernel-design.md §5.3).
// Math.sqrt is IEEE-754-exact and allowed.
//
// Takes one or more roots, each a directory to walk or a single file, so a package can guard just
// the modules whose output reaches the state hash rather than its whole src tree.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BANNED =
  /\bMath\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|pow|log|log2|log10|log1p|random)\b/g;

const roots = process.argv.slice(2);
if (roots.length === 0) roots.push('src');
const failures = [];

// Prose is not code: a comment that names Math.random (often to say it is never used) must not
// fail the build, and a banned call hidden behind `//` is not a call.
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(
      /(^|[^:])\/\/.*$/gm,
      (line, prefix) => prefix + ' '.repeat(line.length - prefix.length),
    );
}

function walk(dir) {
  if (!statSync(dir).isDirectory()) {
    check(dir);
    return;
  }
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(ts|js|mts|mjs)$/.test(name)) continue;
    // dmath.ts is the indirection itself; scripting.ts builds the tamed Math endowment passed
    // to script Compartments (infrastructure, not deterministic sim math). Both may reference Math.
    if (/(dmath|scripting)\.(ts|js)$/.test(name)) continue;
    check(p);
  }
}

function check(p) {
  if (/(dmath|scripting)\.(ts|js)$/.test(p)) return;
  const lines = stripComments(readFileSync(p, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    BANNED.lastIndex = 0;
    const m = BANNED.exec(line);
    if (m) failures.push(`${p}:${i + 1}  ${m[0]} — use dmath instead`);
  });
}

for (const root of roots) walk(root);

if (failures.length > 0) {
  console.error('Transcendental Math.* calls are banned in kernel code (use dmath):');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
