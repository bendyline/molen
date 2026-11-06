/** Original receiver identities; exterior and range-constrained positions remain estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => 'sha256:' + createHash('sha256').update(b).digest('hex'),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function inspectMroReceiverPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const safe = (p) =>
        typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..'),
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s]));
    for (const s of [...proof.primarySources, proof.nativeIdentity])
      if (!safe(s.path) || hash(fs.readFileSync(path.join(dir, s.path))) !== s.sha256)
        return fail('mro-receiver-original-source-hash-unbound');
    if (
      sources['engineering-pdf']?.url !== 'https://arxiv.org/pdf/1206.6945' ||
      sources['engineering-pdf'].sha256 !==
        'sha256:fcc8db40185c0204f8b0473ae89d4b3fa1746a40db8f1a1590e11243b86a049d' ||
      sources.configuration?.url !==
        'https://ws.mwatelescope.org/metadata/con?obs_id=1072483216&pretty=0' ||
      sources.configuration.sha256 !==
        'sha256:6a3128bdd7af717e5ee3919e00d0be7ac56f1eeea69856bc8eeaa38e041d1a6f'
    )
      return fail('mro-receiver-original-engineering-or-configuration-unbound');
    const text = fs
        .readFileSync(path.join(dir, sources['engineering-text'].path), 'utf8')
        .replace(/\s+/g, ' '),
      j = JSON.parse(fs.readFileSync(path.join(dir, sources.configuration.path))),
      regions = JSON.parse(fs.readFileSync(path.join(dir, sources['conditional-positions'].path))),
      control = JSON.parse(fs.readFileSync(path.join(dir, proof.nativeIdentity.path)));
    if (
      !['weather-tight', 'RF shielded enclosure', 'integrated refrigeration unit'].every((t) =>
        text.includes(t),
      ) ||
      Object.keys(j).length !== 128 ||
      regions.regions.length !== 16 ||
      control.sourceFacts.originalReceivers !== 16 ||
      !control.sourceFacts.rackInWeatherTightRFShieldedEnclosure ||
      !control.sourceFacts.integratedRefrigeration
    )
      return fail('mro-receiver-whole-written-equipment-scope-missing');
    if (
      P.model !== 'murchison_widefield_array_receiver' ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.kind !== 'whole-original-MWA-receiver-with-integrated-refrigeration' ||
      proof.case !==
        'mro-primary-whole-weather-tight-receiver-integrated-refrigeration-16inferred-instances-2013' ||
      P.nativeReceiverPointVerified !== false ||
      proof.nativeIdentity.nativeReceiverPointVerified !== false ||
      P.conditionalRegionIsSurveyErrorBound !== false ||
      control.conditionalRadiusIsActualSurveyErrorBound !== false ||
      control.nativeReceiverCoordinateProvided !== false ||
      P.estimatedSectionUncertaintyMeters < 1 ||
      P.estimatedComponentUncertaintyMeters < 0.5 ||
      P.integratedRefrigeration !== true
    )
      return fail('mro-receiver-estimated-identity-or-form-overclaimed');
    if (
      P.allReceiverInstances?.length !== 16 ||
      P.feet?.length !== 4 ||
      new Set(P.feet.map((p) => p.join(','))).size !== 4 ||
      P.foundationBottom >= P.padTop ||
      P.padTop >= P.floor ||
      ![P.cabinetWidth, P.cabinetDepth, P.cabinetHeight, P.padWidth].every(
        (v) => Number.isFinite(v) && v > 0,
      ) ||
      P.representedDate !== '2013-12-31'
    )
      return fail('mro-receiver-whole-instance-or-support-scope-incomplete');
    for (let r = 1; r <= 16; r++) {
      const rows = Object.values(j).filter((t) => t.receiver === r),
        a = P.allReceiverInstances.find((p) => p.receiver === r),
        b = regions.regions.find((p) => p.receiver === r);
      if (
        rows.length !== 8 ||
        !a ||
        !b ||
        a.nativeReceiverCoordinateProvided !== false ||
        !same(
          a.tiles,
          rows.map((t) => t.id),
        ) ||
        !same(a.anchor, b.candidateCoordinate) ||
        !same(a.eastNorthMeters, b.candidateEastNorthMeters) ||
        a.conditionalFeasibleRegionMaxRadiusMeters !== b.conditionalFeasibleRegionMaxRadiusMeters ||
        b.nativeReceiverCoordinateProvided !== false
      )
        return fail('mro-receiver-original-connectivity-or-inferred-position-changed');
      if (
        rows.some(
          (t) =>
            Math.hypot(t.pos[0] - a.eastNorthMeters[0], t.pos[1] - a.eastNorthMeters[1]) >
            Math.min(t.eleclength, 500) + 1e-6,
        )
      )
        return fail('mro-receiver-author-position-contradicts-conservative-range-constraints');
    }
    const ref = P.allReceiverInstances.find((p) => p.receiver === 11),
      tile = j[control.representativeSourceTile],
      vector = [tile.pos[0] - ref.eastNorthMeters[0], -(tile.pos[1] - ref.eastNorthMeters[1])];
    if (
      P.representativeReceiver !== 11 ||
      f.heading !== 0 ||
      !same(f.anchor, ref.anchor) ||
      !same(control.derivedReceiverCoordinate, ref.anchor) ||
      !same(f.geometry.centerlines, [[[0, 0], vector]])
    )
      return fail('mro-receiver-fixed-derived-frame-changed');
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Whole original receiver weatherhousing/rack/integratedrefrigeration, four supports and16explicit2013receiverIDs/eighttiles each. Exteriorsections/finish/facing estimated. All16locations are conditionalrange-feasibleauthorchoices, not operatorreceivercoordinates or trueerrorbounds. No appearanceimagery used; wholeobservatoryseparate.',
    };
  } catch {
    return fail('mro-receiver-evidence-unreadable');
  }
}
