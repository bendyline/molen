/** Published station geometry with explicitly estimated anonymous positions and service details. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export const aeraAntennaCases = {
  'aera-lpda-Holt2018-whole-station-explicit-layout-estimates': 'aera_log_periodic_station',
  'aera-butterfly-Holt2018-whole-station-explicit-layout-estimates': 'aera_butterfly_station',
};
export function inspectAeraAntennaPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const bytes = (s) => {
        if (!s || path.isAbsolute(s.path) || s.path.split(/[\\/]/).includes('..'))
          throw Error('unsafe');
        const b = fs.readFileSync(path.join(dir, s.path));
        if (hash(b) !== s.sha256) throw Error('changed');
        return b;
      },
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      text = bytes(sources['station-design']).toString().replace(/\s+/g, ' '),
      facts = JSON.parse(bytes(sources.controls)),
      site = JSON.parse(bytes(proof.nativeIdentity)),
      layout = JSON.parse(fs.readFileSync(path.join(dir, 'estimated-array-layout.json')));
    if (
      sources['station-design'].url !==
        'https://publikationen.bibliothek.kit.edu/1000083318/14074653' ||
      ![
        '4 m × 4 m × 3.5 m',
        '2 m × 2 m × 1 m',
        '4.5 m',
        '1.6 m',
        '6 mm aluminum rods',
        '153 radio detector stations',
      ].every((s) => text.includes(s)) ||
      facts.facts.arrayStations !== 153 ||
      facts.imageryUsed !== false ||
      site.record.name !== 'AERAWS' ||
      site.record.serial !== 1061
    )
      return fail('aera-original-written-dimensions-unbound');
    const lpda = P.antennaFamily === 'lpda',
      expected = lpda ? [4, 4, 3.5] : [2, 2, 1];
    if (
      aeraAntennaCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.stationCoordinateSurveyed !== false ||
      P.actualStationIdentityClaimed !== false ||
      P.arrayLayoutEstimated !== true ||
      P.physicalHardwareLayoutEstimated !== true ||
      P.antennaDimensionsFromWrittenFacts !== true ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.feedY !== (lpda ? 4.5 : 1.6) ||
      P.antennaDimensions.some((v, i) => v !== expected[i]) ||
      P.butterflyPhysicalRodDiameter !== 0.006 ||
      P.visibleWireProfile !== 0.018 ||
      layout.stationCoordinatesSurveyed !== false ||
      layout.originalStationGpsNamesUsed !== false ||
      layout.placements.length !== (lpda ? 24 : 125) ||
      layout.placements.some((p) => p.positionSurveyed !== false) ||
      layout.placements[0].coordinate.some((v, i) => v !== f.anchor[i]) ||
      site.record.coordinate.some((v, i) => v !== layout.siteReference[i]) ||
      f.identityStatus !== 'real-antenna-family-estimated-station-location-not-surveyed-GPS'
    )
      return fail('aera-estimated-layout-or-hardware-scope-unbound');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Primary Holt2018station text supplies exact nominal antenna dimensions/feed heights and orthogonal polarization/hardware roles. Rod visibility sections, element count, service hardware, yaw, colors and anonymous phase-based layout are original estimates; no actual radio-stationGPS, WCD substitution, source image/plot tracing or complete experimental-type census claimed.',
    };
  } catch {
    return fail('aera-written-station-evidence-unreadable');
  }
}
