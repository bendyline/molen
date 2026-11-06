/** November 2013 EDGES fourpoint equipment; numerical and written operator facts only. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectMroEdgesPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const sources = {
      site: [
        'https://loco.lab.asu.edu/loco-memos/edges_reports/report_20131113.pdf',
        ['November 13, 2013', '5.8 m × 5 m', 'east of due north'],
      ],
      dimensions: [
        'https://loco.lab.asu.edu/loco-memos/edges_reports/tom_20131120.pdf',
        [
          'Diagonal 0.685',
          'Gap 0.0089',
          '0.0015875',
          'Side Length 0.375',
          'Height above ground plane 0.525',
        ],
      ],
      operator: [
        'https://loco.lab.asu.edu/edges/',
        ['four diamond-shaped', '116.6044', '-26.7148', 'July2015'],
      ],
    };
    const safe = (relative) =>
      typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.split(/[\\/]/).includes('..');
    for (const [key, [url, terms]] of Object.entries(sources)) {
      const source = proof.primarySources?.find((s) => s.key === key);
      if (!safe(source?.path)) return fail('edges-source-path-invalid');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (
        source.url !== url ||
        source.use !== 'factual-text-only' ||
        hash(bytes) !== source.sha256 ||
        !terms.every((term) => bytes.toString().includes(term))
      )
        return fail('edges-primary-2013-facts-unbound');
    }
    const native = proof.nativeIdentity;
    if (!safe(native?.path)) return fail('edges-context-path-invalid');
    const bytes = fs.readFileSync(path.join(dir, native.path));
    const context = JSON.parse(bytes);
    if (
      hash(bytes) !== native.sha256 ||
      context.feature.id !== '618004254' ||
      context.feature.type !== 'way' ||
      context.feature.tags.building !== 'yes' ||
      context.feature.coordinates.length !== 5 ||
      context.estimatedRegistrationUncertaintyMeters !== 30 ||
      native.featureId !== 'asu/edges-report23-2013'
    )
      return fail('edges-native-context-or-estimated-registration-unbound');
    if (
      P.model !== 'murchison_edges_fourpoint_antenna' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.kind !== 'edges-fourpoint-2013' ||
      proof.case !== 'mro-primary-whole-EDGES-fourpoint-ASU-November2013' ||
      P.panels !== 4 ||
      P.screenWidth !== 5.8 ||
      P.screenDepth !== 5 ||
      P.panelHeightAboveScreen !== 0.525 ||
      P.panelDiagonal !== 0.685 ||
      P.panelSide !== 0.375 ||
      P.panelGap !== 0.0089 ||
      P.panelThickness !== 0.0015875 ||
      P.activePanelBearingDegrees !== 7 ||
      P.estimatedRegistrationUncertaintyMeters < 30 ||
      P.estimatedComponentUncertaintyMeters < 0.2
    )
      return fail('edges-whole-instrument-dimensions-or-estimates-disagree');
    const expectedRing = [
      [-2.9, -2.5],
      [2.9, -2.5],
      [2.9, 2.5],
      [-2.9, 2.5],
    ];
    if (
      JSON.stringify(f.geometry.polygons[0]) !== JSON.stringify(expectedRing) ||
      JSON.stringify(P.nativeRing) !== JSON.stringify(expectedRing) ||
      Math.abs(f.heading + (7 * Math.PI) / 180) > 1e-12
    )
      return fail('edges-envelope-or-facing-changed');
    const hutAnchor = [0, 1].map((k) =>
      context.feature.coordinates.slice(0, -1).reduce((s, p) => s + p[k] / 4, 0),
    );
    const D = (6378137 * Math.PI) / 180,
      angle = (7 * Math.PI) / 180;
    const expected = [
      hutAnchor[0] - (Math.sin(angle) * 20) / (D * Math.cos((hutAnchor[1] * Math.PI) / 180)),
      hutAnchor[1] - (Math.cos(angle) * 20) / D,
    ];
    if (
      context.estimatedHutSeparationMeters !== 20 ||
      expected.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-10) ||
      context.anchor.some((v, i) => v !== f.anchor[i])
    )
      return fail('edges-estimated-registration-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole November2013fourpoint instrument and5.8x5mgroundplane; original written field dimensions/facing and dimensional Table1 retained. Diamond symmetry, small supports/finish and historical geographic registration explicitly approximate30m, including unverified nearby hut identity and estimated20moffset. All source photographs/figures/diagrams unused. No later blade or ASKAP dish substituted; parent observatory remains unfinished.',
    };
  } catch {
    return fail('edges-factual-evidence-unreadable');
  }
}
