/** Original station census and equipment dimensions; every source image is unused. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const augerEfmCases = {
  'auger-ground-electric-field-station-guanaCO-2023': 'coihueco_electric_field_station',
  'auger-ground-electric-field-station-armadiLLo-2023': 'los_leones_electric_field_station',
  'auger-ground-electric-field-station-CaLaFate-2023': 'auger_central_electric_field_station',
  'auger-ground-electric-field-station-LaMara-2023': 'los_morados_electric_field_station',
  'auger-ground-electric-field-station-LasvAcas-2023': 'loma_amarilla_electric_field_station',
};
const records = {
  coihueco_electric_field_station: [1625, -69.55023, -35.11638, 'earth-nails-and-small-cairns'],
  los_leones_electric_field_station: [1626, -69.45119, -35.4681, 'concrete'],
  auger_central_electric_field_station: [1663, -69.337, -35.28088, 'concrete'],
  los_morados_electric_field_station: [1661, -69.08364, -35.30785, 'concrete'],
  loma_amarilla_electric_field_station: [1662, -69.24595, -34.95902, 'concrete'],
};

export function inspectAugerEfmPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const documents = [...(proof.primarySources ?? []), proof.nativeIdentity];
    const decoded = new Map();
    for (const source of documents) {
      if (
        typeof source?.path !== 'string' ||
        path.isAbsolute(source.path) ||
        source.path.split(/[\\/]/).includes('..')
      )
        return fail('auger-efm-unsafe-source');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (hash(bytes) !== source.sha256) return fail('auger-efm-source-bytes-changed');
      decoded.set(source.path, JSON.parse(bytes));
    }
    const facts = decoded.get('primary-source/electric-field-network-written-facts.json');
    const manufacturer = decoded.get('primary-source/manufacturer-written-dimensions.json');
    const native = decoded.get(proof.nativeIdentity.path);
    const expected = records[P.model];
    const station = facts?.stations.find((s) => s.model === P.model);
    if (
      !expected ||
      facts?.originalPdfUrl !== 'https://publikationen.bibliothek.kit.edu/1000180290/158121542' ||
      facts?.originalPdfSha256 !==
        'sha256:697ad1af95ccf75654cd1c43692afb1c4a3cc85be1431ab63dd409d4f146ee99' ||
      facts?.allPhotographsFiguresPlansAndImageDerivedDescriptionsUnused !== true ||
      manufacturer?.url !== 'https://www.campbellsci.co.uk/cs110' ||
      JSON.stringify(manufacturer?.dimensionsMeters) !== JSON.stringify([0.152, 0.152, 0.432]) ||
      manufacturer?.imageryUsed !== false ||
      JSON.stringify(native?.station) !== JSON.stringify(station) ||
      station.serial !== expected[0] ||
      station.coordinate.some((v, i) => v !== expected[i + 1] || v !== f.anchor[i]) ||
      station.height !== 2 ||
      station.feet !== expected[3]
    )
      return fail('auger-efm-original-station-record-unbound');
    if (
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.sensorFaceHeight !== 2 ||
      P.floor !== 0 ||
      P.footType !== station.feet ||
      P.hasRadioDish !== !station.fiber ||
      P.lightningRod !== false ||
      P.guyWires !== false ||
      JSON.stringify(P.boxSize) !== JSON.stringify([0.8, 0.6, 0.41]) ||
      P.estimatedAnchorUncertaintyMeters < 10 ||
      f.orientationControl.uncertaintyDegrees !== 180 ||
      !f.geometryLabel.includes('NOT a surveyed') ||
      JSON.stringify(P.outlineRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      !P.limitations.some((s) => s.includes('Original schematic estimates'))
    )
      return fail('auger-efm-dimensions-or-explicit-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole independent ground instrument assembly at the researcher’s published station point. Two-metre sensor height and electronics-box dimensions retained; other geometry and component positions explicitly estimated. No imagery, fence boundary, older rooftop installation or whole-observatory proxy.',
    };
  } catch {
    return fail('auger-efm-evidence-unreadable');
  }
}
