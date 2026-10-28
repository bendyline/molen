/** Inventory segmented frame construction across every source generator, without executing it.
 * Run: node packages/worldgen/scripts/audit-frame-joints.mjs [--out=path]
 * Candidates require review: trusses, separate structural members and variable radii are legitimate.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const excluded = new Set([
  'node_modules',
  'dist',
  'dist-types',
  '.git',
  '.artifacts',
  'shots',
  'medium-fi',
]);
const files = [];
const pythonFiles = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isDirectory() && !excluded.has(entry.name)) await walk(resolve(path, entry.name));
    else if (entry.isFile() && /\.(mjs|js|ts)$/.test(entry.name))
      files.push(resolve(path, entry.name));
    else if (entry.isFile() && entry.name.endsWith('.py'))
      pythonFiles.push(resolve(path, entry.name));
  }
}
for (const folder of ['packages', 'content', 'assets', 'examples'])
  await walk(resolve(root, folder));
const candidates = [],
  joined = [],
  counts = { files: files.length, segmentCalls: 0 };
const pythonCandidates = [];
for (const path of pythonFiles.sort()) {
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
  for (const [i, line] of lines.entries())
    if (/(?:\.(?:rod|tube|beam|cylinder|curve)|def (?:curve|torus))\s*\(/.test(line))
      pythonCandidates.push({
        file: relative(root, path).replaceAll('\\', '/'),
        line: i + 1,
        call: line.trim(),
      });
}
for (const path of files.sort()) {
  const source = await readFile(path, 'utf8');
  if (!/\b(?:rod|tube|beam|cylinder|tubePath|beamPath|joinedPath)\b/.test(source)) continue;
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const name = relative(root, path).replaceAll('\\', '/');
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(file);
      if (/(?:^|\.)(?:tubePath|joinedPath|beamPath)$/.test(callee))
        joined.push({
          file: name,
          line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        });
      if (/(?:^|\.)(?:rod|tube|beam|cylinder)$/.test(callee)) {
        counts.segmentCalls++;
        let loop = node.parent;
        while (
          loop &&
          !ts.isForStatement(loop) &&
          !ts.isForOfStatement(loop) &&
          !ts.isFunctionLike(loop)
        )
          loop = loop.parent;
        if (loop && (ts.isForStatement(loop) || ts.isForOfStatement(loop))) {
          const text = node.getText(file),
            header = source.slice(loop.getStart(), loop.statement.getStart()).trim();
          // Adjacent-index paths and calculated end points are both surfaced. The latter are
          // reviewed separately; a static scan cannot distinguish a rail from repeated uprights.
          const accesses = new Map();
          function indexes(n) {
            if (ts.isElementAccessExpression(n)) {
              const base = n.expression.getText(file),
                index = n.argumentExpression.getText(file).replaceAll(/\s/g, '');
              const set = accesses.get(base) ?? new Set();
              set.add(index);
              accesses.set(base, set);
            }
            ts.forEachChild(n, indexes);
          }
          indexes(node);
          const indexed = [...accesses.values()].some(
            (set) => set.size > 1 && [...set].some((s) => /[+-]1|%/.test(s)),
          );
          const pointLoop = /\b(?:points|pts|path|line|ring|brow|hood|outline|contour)\b/.test(
            header,
          );
          candidates.push({
            file: name,
            line: file.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            priority: indexed || pointLoop ? 'adjacent-path' : 'review-loop',
            loop: header,
            call: text,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
const report = {
  scope: ['packages', 'content', 'assets', 'examples'],
  method:
    'Parse every JS/TS source; inventory rod/tube/beam/cylinder calls inside loops. Separately inventory Python geometry call sites for manual review. Candidate lists are not a visual acceptance claim.',
  counts: {
    ...counts,
    pythonFiles: pythonFiles.length,
    pythonCandidates: pythonCandidates.length,
    candidates: candidates.length,
    adjacentPaths: candidates.filter((c) => c.priority === 'adjacent-path').length,
    joinedPaths: joined.length,
  },
  candidates,
  joined,
  pythonCandidates,
};
const out = resolve(
  root,
  process.argv.find((a) => a.startsWith('--out='))?.slice(6) ??
    '.artifacts/frame-joints/source-audit.json',
);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report.counts, out }));
