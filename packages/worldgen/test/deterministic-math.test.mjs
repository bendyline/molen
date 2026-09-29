import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';
import {
  acos,
  acosh,
  asin,
  asinh,
  atan,
  atan2,
  atanh,
  cbrt,
  cos,
  cosh,
  exp,
  expm1,
  log,
  log1p,
  log2,
  log10,
  sin,
  sinh,
  tan,
  tanh,
} from '../scripts/deterministic-math.mjs';
import { pow } from '../scripts/deterministic-pow.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const UNARY = {
  acos,
  acosh,
  asin,
  asinh,
  atan,
  atanh,
  cbrt,
  cos,
  cosh,
  exp,
  expm1,
  log,
  log10,
  log1p,
  log2,
  sin,
  sinh,
  tan,
  tanh,
};

/** Inputs from bit patterns and arithmetic only, so they are the same on every CPU. */
function inputs(count, seed) {
  const values = new Float64Array(count);
  const words = new Uint32Array(values.buffer);
  const next = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
  for (let i = 0; i < count; i++) {
    const r = next() / 4294967296;
    switch (i % 6) {
      case 0: // any finite or special double
        words[2 * i] = next();
        words[2 * i + 1] = next();
        break;
      case 1: // log-uniform over the normal range, either sign
        words[2 * i] = next();
        words[2 * i + 1] = (((next() % 2046) + 1) << 20) | (next() & 0x800fffff);
        break;
      case 2:
        values[i] = (r - 0.5) * 20;
        break;
      case 3:
        values[i] = (r - 0.5) * 2.2;
        break;
      case 4: // near multiples of pi/4, where trig reduces hardest
        values[i] = (((next() % 512) - 256) * Math.PI) / 4 + (r - 0.5) * 1e-9;
        break;
      default:
        values[i] = r * 1500;
    }
  }
  return values;
}

function digest(values) {
  for (let i = 0; i < values.length; i++) if (Number.isNaN(values[i])) values[i] = Number.NaN;
  return createHash('sha256').update(values).digest('hex').slice(0, 16);
}

// SHA-256 prefixes of the ports' results over `inputs(200_000, 1)` (and `inputs(200_000, 2)` as
// the second operand), identical on arm64 and x64.
const DIGESTS = {
  acos: 'e5887144b019ed25',
  acosh: 'd58fcf59731b8343',
  asin: 'c3b2d8a12666a39b',
  asinh: 'e928a269b2d71de1',
  atan: '7987ee13207cc2a0',
  atanh: '6ca37a3a7c8592c9',
  cbrt: 'eea4f225f5edf727',
  cos: '19abab98697824e3',
  cosh: 'cdcb336c652a788f',
  exp: 'b64243ea88ed18ee',
  expm1: 'f85fbf28fd3be013',
  log: '1a8ac06a77e8bbc9',
  log10: '1f7dee479189fc7b',
  log1p: '423c8ef51efc2932',
  log2: '85d04b34f36ecbe1',
  sin: 'a2cae06b003028f7',
  sinh: '73edcf81e994699c',
  tan: 'c4e73795c126afb7',
  tanh: 'e2bbca0d99c3e628',
  atan2: '675c85b0e8b8df90',
  pow: '2951a84339302e7c',
};

it('returns the same bits on every CPU', () => {
  const x = inputs(200_000, 1);
  const y = inputs(200_000, 2);
  const actual = {};
  for (const [name, port] of Object.entries(UNARY)) actual[name] = digest(x.map(port));
  actual.atan2 = digest(x.map((v, i) => atan2(v, y[i])));
  actual.pow = digest(x.map((v, i) => pow(v, y[i] / 64)));
  expect(actual).toEqual(DIGESTS);
}, 30_000); // 4.2M calls to the ports.

it.runIf(process.arch === 'x64')(
  'matches V8 on x64, whose fdlibm has no fused multiply-adds',
  () => {
    const x = inputs(200_000, 1);
    const y = inputs(200_000, 2);
    for (const [name, port] of Object.entries(UNARY))
      expect(digest(x.map(port)), name).toBe(digest(x.map(Math[name])));
    expect(digest(x.map((v, i) => atan2(v, y[i])))).toBe(
      digest(x.map((v, i) => Math.atan2(v, y[i]))),
    );
  },
  30_000, // 8M calls, half of them native.
);

it('installs the ports in this process and in the Node processes it starts', () => {
  const installer = pathToFileURL(
    join(root, 'packages/worldgen/scripts/install-deterministic-math.mjs'),
  ).href;
  const probe = "Math[Symbol.for('molen.deterministicMath')] === true";
  const script = `console.log(${probe}, require('node:child_process').execFileSync(process.execPath, ['-p', ${JSON.stringify(probe)}], { encoding: 'utf8' }).trim())`;
  const output = execFileSync(process.execPath, ['--import', installer, '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  expect(output.trim()).toBe('true true');
}, 30_000); // Starts two Node processes.

/** Asset generator sources: worldgen and entities scripts, aircraft models, structure scripts. */
function generatorSources() {
  const files = [];
  const walk = (directory, keep) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'test'].includes(entry.name)) walk(path, keep);
      } else if (/\.m?js$/.test(entry.name) && keep(relative(root, path).split(sep).join('/')))
        files.push(path);
    }
  };
  walk(join(root, 'packages/worldgen/scripts'), () => true);
  walk(join(root, 'packages/entities/scripts'), () => true);
  walk(join(root, 'content/entities/source'), (path) => path.includes('/models/'));
  walk(join(root, 'assets/structures'), (path) => path.includes('/scripts/'));
  return files;
}

it('keeps ** in generators to exponents V8 computes exactly (2 and 0.5)', () => {
  const found = [];
  for (const file of generatorSources()) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
    const visit = (node) => {
      if (
        ts.isBinaryExpression(node) &&
        (node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskToken ||
          node.operatorToken.kind === ts.SyntaxKind.AsteriskAsteriskEqualsToken) &&
        !['2', '0.5'].includes(node.right.getText(source))
      ) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        found.push(`${relative(root, file)}:${line + 1} ${node.getText(source)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(found, 'write Math.pow(a, b): ** bypasses deterministic-math.mjs').toEqual([]);
}, 30_000); // Parses every generator script, about 220 files.
