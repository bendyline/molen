/** Whole original main and rear campus outlines; no photographic reference is approved. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const augerCampusCases = {
  'auger-primary-whole-campus-east-service-way313007097-2018':
    'malargue_campus_east_service_building',
  'auger-primary-whole-campus-southeast-service-way89717915-2018':
    'malargue_campus_southeast_service_building',
  'auger-primary-whole-campus-main-way88327479-2018': 'malargue_campus_main_building',
  'auger-primary-whole-campus-assembly-way88327481-2018': 'malargue_campus_assembly_building',
};
const cases = {
  malargue_campus_east_service_building: { id: 313007097, corners: 4, kind: 'campus-east-service' },
  malargue_campus_southeast_service_building: {
    id: 89717915,
    corners: 4,
    kind: 'campus-southeast-service',
  },
  malargue_campus_main_building: { id: 88327479, corners: 19, kind: 'campus-main' },
  malargue_campus_assembly_building: { id: 88327481, corners: 6, kind: 'campus-assembly' },
};
export function inspectAugerCampusPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const c = cases[P.model],
      s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    if (!c || P.parentModelIdentity !== 'pierre_auger_observatory' || P.kind !== c.kind)
      return fail('auger-campus-identity-disagrees');
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-campus-unsafe-path');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      j = JSON.parse(bytes),
      w = j.elements.find((e) => e.type === 'way' && e.id === c.id),
      ns = new Map(j.elements.filter((e) => e.type === 'node').map((e) => [e.id, e]));
    if (
      s.url !== 'https://arxiv.org/abs/1502.01323' ||
      s.use !== 'factual-text-only' ||
      s.sha256 !== hash(text) ||
      ![
        'central office and data acquisition building',
        'All photos, figures, diagrams, plans and image-derived descriptions unused',
        'Roof/height/facade/finish are estimates',
      ].every((v) => text.toString().includes(v))
    )
      return fail('auger-campus-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      j.sourceUrl !== 'https://www.openstreetmap.org/api/0.6/way/' + c.id + '/full.json' ||
      w?.tags?.building !== 'yes' ||
      w.nodes.length !== c.corners + 1 ||
      w.nodes[0] !== w.nodes.at(-1) ||
      n.featureId !== 'way/' + c.id ||
      P.nativeFeatureId !== n.featureId
    )
      return fail('auger-campus-native-outline-unbound');
    if (
      c.kind === 'campus-main' &&
      (w.tags['addr:housename'] !== 'Observatorio Pierre Auger' ||
        w.tags['addr:housenumber'] !== '304')
    )
      return fail('auger-campus-exact-main-address-unbound');
    if (
      P.estimatedHeightUncertaintyMeters < 2.5 ||
      P.estimatedComponentUncertaintyMeters < 2.5 ||
      f.heading !== 0 ||
      P.nativeRing.length !== c.corners ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0])
    )
      return fail('auger-campus-scope-or-estimates-disagree');
    const D = (6378137 * Math.PI) / 180,
      co = Math.cos((f.anchor[1] * Math.PI) / 180);
    for (const [i, id] of w.nodes.slice(0, -1).entries()) {
      const p = ns.get(id),
        q = [(p.lon - f.anchor[0]) * D * co, -(p.lat - f.anchor[1]) * D];
      if (q.some((v, k) => Math.abs(v - P.nativeRing[i][k]) > 1e-7))
        return fail('auger-campus-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independent original main/rear campus building. Main exact address binding; rear assembly role inferred from primary location facts. Exterior heights/roof/facade/finish explicit estimates; all imagery unused.',
    };
  } catch {
    return fail('auger-campus-evidence-unreadable');
  }
}
