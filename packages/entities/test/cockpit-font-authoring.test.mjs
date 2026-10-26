import { Group, MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import {
  cockpitFontProfiles,
  textureCockpitLettering,
} from '../scripts/aircraft/cockpit-lettering.mjs';
import { detailKit } from '../scripts/vehicle-detail.mjs';

it('replaces shared text inside the selected cabin, retaining solid ticks and animated parents', () => {
  const model = new Group(),
    cabin = new Group(),
    outside = new Group();
  model.add(cabin, outside);
  const ink = new MeshStandardMaterial({ color: '#ffffff' });
  const movingCard = new Group();
  movingCard.name = 'moving-card';
  movingCard.rotation.z = 0.2;
  cabin.add(movingCard);
  const d = detailKit(movingCard, 'scale');
  d.text('120', [0.02, 0.03, -0.01], 0.01, Math.PI, ink, 'dial');
  d.text('COM 123.45', [0, -0.03, -0.01], 0.01, Math.PI, ink, 'display');
  d.box([0.002, 0.01, 0.001], [0, 0.05, -0.01], ink);
  const before = d.finish();
  const ticksAndText = before.children[0].geometry.attributes.position.count;
  const exterior = detailKit(outside, 'exterior');
  exterior.text('RESCUE', [0, 0, 0], 0.02);
  const exteriorBatch = exterior.finish().children[0];
  const exteriorGeometry = exteriorBatch.geometry;
  textureCockpitLettering(cabin, cockpitFontProfiles['dc-3']);
  const fonts = [],
    solids = [];
  cabin.traverse((node) => {
    if (node.material?.userData.molenCockpitLettering) fonts.push(node);
    else if (node.isMesh) solids.push(node);
  });
  expect(fonts.map((n) => n.material.userData.molenCockpitLettering).sort()).toEqual([
    'display',
    'period',
  ]);
  expect(solids).toHaveLength(1);
  expect(solids[0].geometry.attributes.position.count).toBe(36);
  expect(ticksAndText).toBeGreaterThan(36);
  for (const mesh of fonts) {
    expect(mesh.geometry.attributes.uv.count).toBe(mesh.geometry.attributes.position.count);
    // Pilot-facing after composing the legacy +Z text convention with its authored yaw.
    expect(mesh.geometry.attributes.normal.getZ(0)).toBeCloseTo(-1);
    expect(mesh.parent.parent.parent).toBe(movingCard);
  }
  expect(exteriorBatch.geometry).toBe(exteriorGeometry);
  expect(exteriorBatch.material.userData.molenCockpitLettering).toBeUndefined();
  textureCockpitLettering(cabin, cockpitFontProfiles['dc-3']);
  expect(cabin.getObjectByName(fonts[0].name)).toBe(fonts[0]);
});

it('keeps nested detail batches and arbitrary label mounting rotations readable', () => {
  const cabin = new Group(),
    outer = detailKit(cabin, 'outer'),
    inner = detailKit(outer.root, 'inner');
  inner.text('N', [0.1, 0, 0], 0.01, Math.PI / 2, inner.ivory, 'dial');
  inner.finish();
  outer.finish();
  textureCockpitLettering(cabin, cockpitFontProfiles['oh-6']);
  const text = [];
  cabin.traverse((n) => {
    if (n.material?.userData.molenCockpitLettering) text.push(n);
  });
  expect(text).toHaveLength(1);
  expect(text[0].geometry.attributes.normal.getX(0)).toBeCloseTo(1);
  text[0].geometry.computeBoundingBox();
  expect(text[0].geometry.boundingBox.min.x).toBeCloseTo(0.1);
});
