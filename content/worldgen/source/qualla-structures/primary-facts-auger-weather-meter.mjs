/** AERAWS's independently identified CS110; its older mounting is estimated. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export function inspectAugerWeatherMeterPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const documents = new Map();
    for (const source of [...(proof.primarySources ?? []), proof.nativeIdentity]) {
      if (
        typeof source?.path !== 'string' ||
        path.isAbsolute(source.path) ||
        source.path.split(/[\\/]/).includes('..')
      )
        return fail('auger-weather-meter-unsafe-source');
      const bytes = fs.readFileSync(path.join(dir, source.path));
      if (hash(bytes) !== source.sha256) return fail('auger-weather-meter-source-bytes-changed');
      documents.set(source.path, JSON.parse(bytes));
    }
    const source = documents.get('primary-source/weather-meter-written-facts.json');
    const manufacturer = documents.get('primary-source/manufacturer-written-dimensions.json');
    const native = documents.get('native-map/original-station-record.json');
    const record = source?.record;
    if (
      source?.url !== 'https://publikationen.bibliothek.kit.edu/1000180290/158121542' ||
      source?.originalPdfSha256 !==
        'sha256:697ad1af95ccf75654cd1c43692afb1c4a3cc85be1431ab63dd409d4f146ee99' ||
      source?.imageryUsed !== false ||
      record?.name !== 'AERAWS' ||
      record.serial !== 1061 ||
      record.sensorFaceHeightMeters !== 1.75 ||
      JSON.stringify(record.coordinate) !== JSON.stringify([-69.54908, -35.10924]) ||
      JSON.stringify(record) !== JSON.stringify(native?.record) ||
      JSON.stringify(record.coordinate) !== JSON.stringify(f.anchor) ||
      manufacturer?.imageryUsed !== false ||
      JSON.stringify(manufacturer.dimensionsMeters) !== JSON.stringify([0.152, 0.152, 0.432])
    )
      return fail('auger-weather-meter-original-point-or-sensor-unbound');
    if (
      P.model !== 'aera_weather_site_electric_field_meter' ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.floor !== 0 ||
      P.sensorFaceHeight !== 1.75 ||
      P.stationSerial !== 1061 ||
      P.estimatedAnchorUncertaintyMeters < 10 ||
      f.orientationControl.uncertaintyDegrees !== 180 ||
      JSON.stringify(P.outlineRing) !== JSON.stringify(f.geometry.polygons[0]) ||
      !f.geometryLabel.includes('NOT a surveyed') ||
      !P.limitations.some((s) => s.includes('support is an original estimate')) ||
      !P.limitations.some((s) => s.includes('Other weather sensors'))
    )
      return fail('auger-weather-meter-scope-height-or-estimates-disagree');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Independently identified CS110 serial1061 at the published AERAWS point and1.75m sensor height. Older support is explicitly estimated; not a copy of the new CM106BE network and not the entire weather station or observatory.',
    };
  } catch {
    return fail('auger-weather-meter-evidence-unreadable');
  }
}
