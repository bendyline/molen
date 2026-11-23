// Byte stability of existing bodies: descriptors written before a generator change must keep
// generating the same geometry, so a look saved by a player, a pinned scene or a cached body
// never changes under them. The fixture holds a digest per descriptor and tier, recorded on the
// Node major in .node-version (dmath's fractional powers follow V8). Record it again only for an
// intended change to existing bodies: MOLEN_RECORD_DIGESTS=1 npx vitest run test/stability.test.ts

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { hashBytes } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import {
  FIGURE_HAIR_STYLES,
  FIGURE_PRESET_IDS,
  type FigureBody,
  type FigureDescriptor,
  generateFigureBody,
  resolveFigureDescriptor,
} from '../src/kernel';

const FIXTURE = new URL('./fixtures/body-digests.json', import.meta.url);

function digest(body: FigureBody): string {
  const parts = [
    body.buffers.positions,
    body.buffers.normals,
    body.buffers.colors,
    body.buffers.indices,
  ];
  if (body.buffers.joints !== undefined) parts.push(body.buffers.joints);
  if (body.buffers.weights !== undefined) parts.push(body.buffers.weights);
  const total = parts.reduce((n, a) => n + a.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const a of parts) {
    bytes.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), offset);
    offset += a.byteLength;
  }
  return hashBytes(bytes);
}

/** The descriptors whose bodies must not move: every preset and the human feature space. */
const CASES: Record<string, FigureDescriptor> = {};
for (const preset of FIGURE_PRESET_IDS) CASES[`preset:${preset}`] = { preset };
for (const [i, hair] of FIGURE_HAIR_STYLES.entries()) {
  for (const form of ['neutral', 'masculine', 'feminine'] as const) {
    CASES[`hair:${hair}:${form}`] = {
      preset: 'human.adult',
      features: {
        hair,
        form,
        facialHair: (['none', 'stubble', 'mustache', 'beard'] as const)[i % 4],
        sleeves: (['none', 'short', 'long'] as const)[i % 3],
        legs: (['shorts', 'long', 'skirt'] as const)[(i + 1) % 3],
      },
      palette: { skin: '#9d6742', hair: '#3a281d', top: '#2f5a3b', bottom: '#2f3b52' },
    };
  }
}
for (const build of [-1, -0.5, 0.5, 1])
  CASES[`build:${build}`] = { preset: 'human.adult', build, height: 1.5 + 0.1 * (build + 1) };
for (const preset of ['human.child', 'human.elder'] as const)
  CASES[`styled:${preset}`] = {
    preset,
    features: { hair: 'bob', legs: 'skirt', sleeves: 'short' },
    proportions: { shoulderWidth: 1.05, hipWidth: 0.95 },
  };

function current(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, descriptor] of Object.entries(CASES)) {
    const resolved = resolveFigureDescriptor(descriptor);
    for (const tier of [0, 1, 2] as const)
      out[`${name}@${tier}`] = digest(generateFigureBody(resolved, tier));
  }
  return out;
}

describe('existing bodies are byte-stable', () => {
  it('generates the recorded geometry for every recorded descriptor', () => {
    const now = current();
    if (process.env.MOLEN_RECORD_DIGESTS === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, `${JSON.stringify(now, null, 2)}\n`);
      return;
    }
    const recorded = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
    const moved = Object.keys(recorded).filter((key) => recorded[key] !== now[key]);
    expect(moved, 'bodies that changed').toEqual([]);
  });
});
