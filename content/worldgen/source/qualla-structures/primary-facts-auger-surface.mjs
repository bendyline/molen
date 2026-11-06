/** Bind the written detector construction facts and unchanged operator station records. */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex');
export function inspectAugerSurfacePrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const s = proof.primarySources?.find((s) => s.key === 'detector'),
      n = proof.nativeIdentity;
    for (const p of [s?.path, n?.path])
      if (typeof p !== 'string' || path.isAbsolute(p) || p.split(/[\\/]/).includes('..'))
        return fail('auger-unsafe-source');
    const text = fs.readFileSync(path.join(dir, s.path)),
      bytes = fs.readFileSync(path.join(dir, n.path)),
      native = JSON.parse(bytes),
      csv = fs.readFileSync(path.join(dir, 'native-map/original-sdMap.csv'));
    if (
      s.url !== 'https://arxiv.org/abs/1502.01323' ||
      s.use !== 'factual-text-only' ||
      hash(text) !== s.sha256 ||
      ![
        '3.6m diameter',
        'Three raised service hatches',
        'Two55Wp solar panels',
        'Six lifting lugs',
        'All photos, figures, diagrams and plans unused',
      ].every((t) => text.toString().includes(t))
    )
      return fail('auger-written-facts-unbound');
    if (
      hash(bytes) !== n.sha256 ||
      hash(csv) !== native.originalCsvSha256 ||
      native.sourceUrl !== 'https://opendata.auger.org/releases/3/auxiliary/sdMap.csv' ||
      native.coordinateSystem !== 'WGS84 / UTM zone19 South (EPSG32719)' ||
      native.representedDate !== '2018-08-31' ||
      native.referenceStation !== 101 ||
      native.imageryUsed !== false
    )
      return fail('auger-original-station-data-unbound');
    const rows = csv.toString().trim().split(/\r?\n/),
      columns = rows.shift().split(','),
      original = rows.map((line) =>
        Object.fromEntries(line.split(',').map((v, i) => [columns[i], Number(v)])),
      );
    if (
      original.length !== 1689 ||
      JSON.stringify(original) !== JSON.stringify(native.allOriginalRecords)
    )
      return fail('auger-original-census-changed');
    const active = original.filter(
      (r) => r.start <= native.gpsTime && (r.stop === 1 || r.stop >= native.gpsTime),
    );
    if (
      native.gpsTime !== 1219795217 ||
      active.length !== 1638 ||
      native.stations.length !== 1638 ||
      n.instanceCount !== 1638 ||
      P.instanceCount !== 1638
    )
      return fail('auger-event-census-changed');
    for (const [i, r] of active.entries()) {
      const v = native.stations[i];
      if (Object.entries(r).some(([k, x]) => v[k] !== x) || !v.coordinate?.every(Number.isFinite))
        return fail('auger-native-instance-changed');
    }
    const ref = native.stations.find((r) => r.id === 101);
    if (
      P.model !== 'auger_surface_detector' ||
      P.parentModelIdentity !== 'pierre_auger_observatory' ||
      P.referenceStation !== 101 ||
      P.diameter !== 3.6 ||
      P.exteriorHeight !== 1.55 ||
      P.waterDepth !== 1.2 ||
      P.estimatedHeightUncertaintyMeters < 0.6 ||
      P.estimatedComponentUncertaintyMeters < 0.5 ||
      !ref.coordinate.every((v, i) => v === f.anchor[i]) ||
      !f.mappedIdentity.featureIds.includes('auger-sd/101') ||
      f.geometry.polygons[0].length !== 32
    )
      return fail('auger-whole-equipment-or-estimates-changed');
    for (const [i, p] of f.geometry.polygons[0].entries())
      if (
        p.some(
          (v, k) => Math.abs(v - 1.8 * (k === 0 ? Math.cos : Math.sin)((i * Math.PI) / 16)) > 1e-8,
        )
      )
        return fail('auger-diameter-envelope-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole pre-upgrade detector assembly and1638 dated event-active operator instances. Not exhaustive physical census; whole observatory remains unfinished. All imagery unused; component dimensions/orientation/grade estimates explicit.',
    };
  } catch {
    return fail('auger-factual-evidence-unreadable');
  }
}
