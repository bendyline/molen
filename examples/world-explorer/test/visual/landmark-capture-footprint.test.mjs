import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { sourceLocalFootprint } from './landmark-capture-footprint.mjs';

test('source-local signed frame overrides unrelated global footprint without moving its anchor', () => {
  const frame = {
    sourceUrl: 'https://www.openstreetmap.org/way/64891750',
    anchor: [139.631476944, 35.454596638],
    heading: Math.PI / 2,
    geometry: {
      outline: [
        [0, 0],
        [10, 0],
        [10, 20],
        [0, 20],
      ],
    },
  };
  const bytes = Buffer.from(JSON.stringify(frame));
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const spec = {
    id: 'N0189',
    geographicProposal: { mapGeometrySource: 'map-frame.json', mapGeometryHash: hash },
  };
  const result = sourceLocalFootprint(spec, bytes);
  assert.equal(result.hash, hash);
  assert.deepEqual(result.footprint[0], frame.anchor);
  assert.deepEqual(result.footprint.at(-1), frame.anchor);
  assert(Math.abs(result.footprint[1][0] - frame.anchor[0]) < 1e-10);
  assert(result.footprint[1][1] > frame.anchor[1], '+X points north at heading pi/2');
  assert(result.footprint[2][0] > frame.anchor[0], '+Z points east at heading pi/2');
  assert.throws(() => sourceLocalFootprint(spec, Buffer.from('{}')), /map frame changed/);
  assert.throws(() => sourceLocalFootprint(spec, undefined), /evidence is missing/);
});

test('global evidence capture path remains unchanged for ordinary placements', () => {
  assert.equal(sourceLocalFootprint({ id: 'N0188' }, undefined), undefined);
  assert.equal(
    sourceLocalFootprint(
      { geographicProposal: { mapGeometrySource: 'content/earth/structures/georeferencing.json' } },
      Buffer.from('{}'),
    ),
    undefined,
  );
});

test('parallel bridge centerlines remain open and disconnected', () => {
  const frame = {
    sourceUrl: 'https://www.openstreetmap.org/way/28736579',
    anchor: [85.21, 25.63],
    heading: 0,
    geometry: {
      centerlines: [
        [
          [-100, -6],
          [0, -6],
          [100, -6],
        ],
        [
          [-100, 6],
          [100, 6],
        ],
      ],
    },
  };
  const bytes = Buffer.from(JSON.stringify(frame));
  const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const result = sourceLocalFootprint(
    { geographicProposal: { mapGeometrySource: 'map-frame.json', mapGeometryHash: hash } },
    bytes,
  );
  assert.equal(result.footprint, undefined);
  assert.deepEqual(
    result.lines.map((line) => line.length),
    [3, 2],
  );
  assert(result.lines[0][0][0] < frame.anchor[0]);
  assert(result.lines[0][2][0] > frame.anchor[0]);
  assert(result.lines[0][0][1] > result.lines[1][0][1]);
  assert.notDeepEqual(result.lines[0][0], result.lines[0].at(-1));
});

test('the established source field is accepted as attributed evidence', () => {
  const frame = {
    source: 'https://www.openstreetmap.org/way/123',
    anchor: [2.86, 51.03],
    heading: 0,
    geometry: {
      outline: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0],
      ],
    },
  };
  const check = (value) => {
    const bytes = Buffer.from(JSON.stringify(value));
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    return sourceLocalFootprint(
      { geographicProposal: { mapGeometrySource: 'map-frame.json', mapGeometryHash: hash } },
      bytes,
    );
  };
  assert.deepEqual(check(frame).footprint[0], frame.anchor);
  assert.throws(() => check({ ...frame, source: './unattributed' }), /absolute evidence URL/);
});
