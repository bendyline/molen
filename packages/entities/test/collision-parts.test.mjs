import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it.each([
  'aircraft',
  'vehicle',
])('all %s collision bindings match installed source geometry', (kind) => {
  const output = execFileSync(
    process.execPath,
    [fileURLToPath(new URL(`../scripts/update-${kind}-collision.mjs`, import.meta.url)), '--check'],
    { encoding: 'utf8' },
  );
  expect(output).toContain('geometry untouched');
}, 30_000);
