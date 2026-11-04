/** Whole CRS housing from written ISO class and an original measured roof point. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;

export function inspectAugerCrsPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const documents = new Map();
    for (const source of [...(proof.primarySources ?? []), proof.nativeIdentity]) {
      if (
        typeof source?.path !== 'string' ||
        path.isAbsolute(source.path) ||
        source.path.split(/[\\/]/).includes('..')
      )
        return fail('auger-crs-unsafe-source');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (hash(bytes) !== source.sha256) return fail('auger-crs-source-bytes-changed');
      documents.set(source.path, JSON.parse(bytes));
    }
    const housing = documents.get('primary-source/crs-container-written-facts.json');
    const sensor = documents.get('primary-source/roof-electric-field-sensor-written-facts.json');
    const manufacturer = documents.get('primary-source/manufacturer-written-dimensions.json');
    const native = documents.get('native-map/original-roof-reference-survey.json');
    if (
      housing?.url !== 'https://publikationen.bibliothek.kit.edu/1000030957/2370396' ||
      housing?.originalPdfSha256 !==
        'sha256:d0433eba8aac8a74ea531dfe67e2dd5036c16708560f6d833f411e52d3eac1b0' ||
      housing?.facts.housingClass !== '40 ft ISO container' ||
      housing?.facts.nominalLengthMeters !== 12.192 ||
      sensor?.url !== 'https://publikationen.bibliothek.kit.edu/1000180290/158121542' ||
      sensor?.record.serial !== 1181 ||
      sensor?.record.sensorHeightAboveGroundMeters !== 3.62 ||
      manufacturer?.imageryUsed !== false ||
      JSON.stringify(manufacturer?.dimensionsMeters) !== JSON.stringify([0.152, 0.152, 0.432]) ||
      native?.url !== 'https://publikationen.bibliothek.kit.edu/1000083318/14074653' ||
      native?.record.datum !== 'WGS84' ||
      native?.record.zone !== '19H' ||
      native?.record.easting !== 451401.053 ||
      native?.record.northing !== 6114803.35 ||
      native?.coordinate.some((v, i) => v !== f.anchor[i]) ||
      [housing, sensor, native].some((s) => s.imageryUsed !== false)
    )
      return fail('auger-crs-original-class-point-or-sensor-unbound');
    const r = P.outlineRing;
    if (
      P.model !== 'aera_central_radio_station' ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.nominalLengthMeters !== 12.192 ||
      P.assumedWidthMeters !== 2.438 ||
      P.assumedHeightMeters !== 2.591 ||
      P.bodyCenterX !== 5.866 ||
      P.sensorFaceHeight !== 3.62 ||
      P.estimatedAnchorUncertaintyMeters < 15 ||
      f.orientationControl.uncertaintyDegrees !== 180 ||
      !f.geometryLabel.includes('NOT a surveyed') ||
      JSON.stringify(r) !== JSON.stringify(f.geometry.polygons[0]) ||
      r.length !== 4 ||
      Math.abs(Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0])) - 12.192) > 1e-9 ||
      Math.abs(Math.max(...r.map((p) => p[1])) - Math.min(...r.map((p) => p[1])) - 2.438) > 1e-9 ||
      !P.limitations.some((s) => s.includes('14.144m') && s.includes('separate observations'))
    )
      return fail('auger-crs-whole-container-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole nominal40ft ISO housing anchored to the original measured roof reference. Standard width/height, body offset, facing, modified shell continuity and roof sensor pose explicitly estimated. Separate2025sensor position remains separate; no averaging/fitting, solar-array or whole-observatory proxy.',
    };
  } catch {
    return fail('auger-crs-evidence-unreadable');
  }
}
