/** Whole native Los Leones LIDAR housing; instrument facts do not establish roof dimensions. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectAugerLidarPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-lidar-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      j = JSON.parse(bytes),
      w = j.elements.find((e) => e.type === 'way' && e.id === 120464910),
      nodes = new Map(j.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      s.url !== 'https://arxiv.org/abs/1502.01323' ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        'four elastic lidars',
        'three80cm mirrors and one20cm mirror',
        'NOT the building height or roof profile',
        'All photos, figures, diagrams and plans unused',
      ].every((v) => text.toString().includes(v))
    )
      return fail('auger-lidar-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      !j.sourceUrl?.startsWith('https://www.openstreetmap.org/api/0.6/map.json?bbox=') ||
      w?.tags?.building !== 'yes' ||
      w.tags.name !== 'Lidar' ||
      w.nodes.length !== 5 ||
      w.nodes[0] !== w.nodes.at(-1) ||
      n.featureId !== 'way/120464910'
    )
      return fail('auger-lidar-native-outline-unbound');
    if (
      P.model !== 'los_leones_lidar_building' ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.kind !== 'lidar-shelter' ||
      P.nativeFeatureId !== n.featureId ||
      P.nativeName !== 'Lidar' ||
      P.estimatedHeightUncertaintyMeters < 1.5 ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      f.geometry.polygons[0].length !== 4
    )
      return fail('auger-lidar-whole-building-or-estimates-disagree');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180),
      c = Math.cos(f.heading),
      sine = Math.sin(f.heading);
    for (const [i, id] of w.nodes.slice(0, -1).entries()) {
      const node = nodes.get(id),
        x = (node.lon - f.anchor[0]) * D * co,
        z = -(node.lat - f.anchor[1]) * D,
        local = [c * x - sine * z, sine * x + c * z];
      if (local.some((v, k) => Math.abs(v - f.geometry.polygons[0][i][k]) > 1e-7))
        return fail('auger-lidar-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independently named original Lidar housing. Height/roof/closed entry/vents/finish/grade estimates; hidden instrument mechanism not asserted. Every image unused; parent observatory unfinished.',
    };
  } catch {
    return fail('auger-lidar-evidence-unreadable');
  }
}
