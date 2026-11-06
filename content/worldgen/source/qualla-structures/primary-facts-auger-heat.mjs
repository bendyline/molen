/** Bind the original independent HEAT outlines and operator-described parked construction. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const augerHeatCases = {
  'auger-primary-whole-HEAT-way213400124-2018': 'coihueco_heat_telescope_1',
  'auger-primary-whole-HEAT-way213400126-2018': 'coihueco_heat_telescope_2',
  'auger-primary-whole-HEAT-way213400127-2018': 'coihueco_heat_telescope_3',
  'auger-primary-whole-HEAT-way213400128-2018': 'coihueco_heat_service_container',
};
const identities = {
  coihueco_heat_telescope_1: [213400124, 'HEAT 1'],
  coihueco_heat_telescope_2: [213400126, 'HEAT 2'],
  coihueco_heat_telescope_3: [213400127, 'HEAT 3'],
  coihueco_heat_service_container: [213400128, null],
};
export function inspectAugerHeatPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const identity = identities[P.model],
      s = proof.primarySources?.find((s) => s.key === 'building'),
      n = proof.nativeIdentity;
    if (!identity || augerHeatCases[proof.case] !== P.model)
      return fail('auger-heat-identity-unbound');
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-heat-unsafe-source');
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
        '3independent telescope enclosures and1container',
        'concrete foundation',
        'hydraulic tilting mechanism',
        'heavy steel baseplate',
        'parked horizontally',
        'All photos, figures, diagrams and plans unused',
      ].every((v) => text.toString().includes(v))
    )
      return fail('auger-heat-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      !j.sourceUrl?.startsWith('https://www.openstreetmap.org/api/0.6/map.json?bbox=') ||
      w?.tags?.building !== 'yes' ||
      (w.tags.name ?? null) !== identity[1] ||
      w.nodes.length !== 5 ||
      w.nodes[0] !== w.nodes.at(-1) ||
      n.featureId !== 'way/' + identity[0]
    )
      return fail('auger-heat-original-native-outline-unbound');
    if (
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.nativeFeatureId !== n.featureId ||
      P.nativeName !== identity[1] ||
      P.stowedTiltDegrees !== 0 ||
      P.observingTiltDegrees !== 29 ||
      P.closedDaylightShutters !== true ||
      P.estimatedHeightUncertaintyMeters < 1.5 ||
      P.estimatedComponentUncertaintyMeters < 1.5 ||
      P.kind !== (identity[1] ? 'tiltable-telescope' : 'service-container') ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      f.geometry.polygons[0].length !== 4
    )
      return fail('auger-heat-whole-enclosure-or-estimates-disagree');
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
        return fail('auger-heat-original-corner-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independently located native four-corner enclosure. Telescope level parked pose and hydraulic/heavy-base/steel-housing construction from operator text; adjacent unnamed service function descriptive. Height/mechanics/finish/facing/grade estimates explicit; all imagery unused, parent still unfinished.',
    };
  } catch {
    return fail('auger-heat-evidence-unreadable');
  }
}
