import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateByKind } from '@bendyline/molen-schema';
import '@bendyline/molen-figures/kernel';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  compileFilm,
  compileGame,
  filmPrimer,
  filmSchema,
  gamePrimer,
  gameSchema,
  scenePrimer,
} from '../src/index';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Every property name and enum value anywhere in a schema. */
function vocabulary(schema: z.ZodType): { names: Set<string>; values: Set<string> } {
  const names = new Set<string>();
  const values = new Set<string>();
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.properties !== undefined && typeof n.properties === 'object') {
      for (const k of Object.keys(n.properties as object)) names.add(k);
    }
    if (Array.isArray(n.enum)) for (const v of n.enum) if (typeof v === 'string') values.add(v);
    if (typeof n.const === 'string') values.add(n.const);
    for (const v of Object.values(n)) walk(v);
  };
  walk(z.toJSONSchema(schema, { io: 'input' }));
  return { names, values };
}

function examples(primer: string): unknown[] {
  return [...primer.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1] as string));
}

describe('primers', () => {
  for (const [label, primer, schema] of [
    ['film', filmPrimer, filmSchema],
    ['game', gamePrimer, gameSchema],
  ] as const) {
    it(`the ${label} primer names every field and value of its schema`, () => {
      const { names, values } = vocabulary(schema);
      const missing = [...names, ...values].filter((word) => !primer.includes(word));
      expect(missing).toEqual([]);
    });
  }

  it('every complete example in the primers compiles', () => {
    for (const doc of examples(filmPrimer)) {
      const r = compileFilm(doc);
      expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
    }
    for (const doc of examples(gamePrimer)) {
      const r = compileGame(doc);
      expect(r.ok, r.ok ? '' : r.formatted).toBe(true);
    }
    for (const doc of examples(scenePrimer).filter(
      (d) => (d as { format?: string }).format !== undefined,
    )) {
      const v = validateByKind('scene', doc);
      expect(v.ok, v.ok ? '' : v.formatted).toBe(true);
    }
  });

  it('the embedded primers and llms-mini.txt are up to date', () => {
    expect(() =>
      execFileSync(process.execPath, [join(root, 'scripts', 'build-primers.mjs'), '--check'], {
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
