/** Exact original named outlines and bounded six-telescope building reconstruction. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const augerFdCases = {
  'auger-primary-whole-FD-building-way118753321-2018': 'los_leones_fluorescence_building',
  'auger-primary-whole-FD-building-way120426728-2018': 'los_morados_fluorescence_building',
  'auger-primary-whole-FD-building-way120426727-2018': 'loma_amarilla_fluorescence_building',
  'auger-primary-whole-FD-building-way119495363-2018': 'coihueco_fluorescence_building',
};
const identities = {
  los_leones_fluorescence_building: [118753321, 'Los Leones'],
  los_morados_fluorescence_building: [120426728, 'Los Morados'],
  loma_amarilla_fluorescence_building: [120426727, 'Loma Amarilla'],
  coihueco_fluorescence_building: [119495363, 'Coihueco'],
};
export function inspectAugerFdPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const identity = identities[P.model],
      s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    if (!identity || augerFdCases[proof.case] !== P.model) return fail('auger-fd-identity-unbound');
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-fd-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      j = JSON.parse(bytes),
      w = j.elements.find((e) => e.type === 'way' && e.id === identity[0]),
      nodes = new Map(j.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      s.url !== 'https://arxiv.org/abs/1502.01323' ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        '6independent telescopes',
        '180deg azimuth',
        'diaphragm1.1m radius',
        'shutters closed during daylight',
        'All photos, figures, diagrams and plans unused',
      ].every((v) => text.toString().includes(v))
    )
      return fail('auger-fd-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      !j.sourceUrl?.endsWith('/way/' + identity[0] + '/full.json') ||
      w?.tags?.name !== identity[1] ||
      w.tags.building !== 'yes' ||
      w.nodes.length !== 12 ||
      w.nodes[0] !== w.nodes.at(-1) ||
      n.featureId !== 'way/' + identity[0]
    )
      return fail('auger-fd-original-native-outline-unbound');
    if (
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.nativeFeatureId !== n.featureId ||
      P.nativeName !== identity[1] ||
      P.telescopeBays !== 6 ||
      P.opticalApertureRadius !== 1.1 ||
      P.closedDaylightShutters !== true ||
      P.estimatedHeightUncertaintyMeters < 2 ||
      P.estimatedComponentUncertaintyMeters < 2 ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      f.geometry.polygons[0].length !== 11
    )
      return fail('auger-fd-whole-building-or-estimates-disagree');
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
        return fail('auger-fd-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Exact named original eleven-corner building and six telescope bays with daytime closed shutters. All imagery unused; height/roof/facade/finish/grade are estimates. Whole observatory and adjacent independent structures remain unfinished.',
    };
  } catch {
    return fail('auger-fd-evidence-unreadable');
  }
}
