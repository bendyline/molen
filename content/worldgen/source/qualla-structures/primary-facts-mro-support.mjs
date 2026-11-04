/** Whole separate mapped MRO support building; numerical facts and estimated exterior. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`,
  safe = (d, p) =>
    typeof p === 'string' && !path.isAbsolute(p) && !p.split(/[\\/]/).includes('..')
      ? path.join(d, p)
      : null;
export const mroSupportCases = {
  'mro-primary-support-building-way618004254-2013': 'murchison_western_experiment_service_building',
  'mro-primary-support-building-way629792393-2013': 'murchison_south_field_service_building',
  'mro-primary-support-building-way629792389-2013': 'murchison_mwa_east_service_building_south',
  'mro-primary-support-building-way629792390-2013': 'murchison_mwa_east_service_building_west',
  'mro-primary-support-building-way1012949919-2013': 'murchison_mwa_west_service_building_centre',
  'mro-primary-support-building-way629792388-2013': 'murchison_mwa_west_service_building_south',
  'mro-primary-support-building-way629792387-2013': 'murchison_mwa_west_service_building_north',
  'mro-primary-support-building-way629792386-2013': 'murchison_mwa_central_service_building',
  'mro-primary-support-building-way629781192-2013': 'murchison_west_service_building_north',
  'mro-primary-support-building-way629781191-2013': 'murchison_west_service_building_south',
  'mro-primary-support-building-way629781190-2013': 'murchison_southwest_service_building',
  'mro-primary-support-building-way629781188-2013': 'murchison_southeast_service_building',
  'mro-primary-support-building-way629781189-2013': 'murchison_south_service_building',
  'mro-primary-support-building-way629781185-2013': 'murchison_east_service_building_north',
  'mro-primary-support-building-way629781186-2013': 'murchison_east_service_building_centre',
  'mro-primary-support-building-way629781187-2013': 'murchison_east_service_building_south',
};
const nativeIds = {
  murchison_western_experiment_service_building: '618004254',
  murchison_south_field_service_building: '629792393',
  murchison_mwa_east_service_building_south: '629792389',
  murchison_mwa_east_service_building_west: '629792390',
  murchison_mwa_west_service_building_centre: '1012949919',
  murchison_mwa_west_service_building_south: '629792388',
  murchison_mwa_west_service_building_north: '629792387',
  murchison_mwa_central_service_building: '629792386',
  murchison_west_service_building_north: '629781192',
  murchison_west_service_building_south: '629781191',
  murchison_southwest_service_building: '629781190',
  murchison_southeast_service_building: '629781188',
  murchison_south_service_building: '629781189',
  murchison_east_service_building_north: '629781185',
  murchison_east_service_building_centre: '629781186',
  murchison_east_service_building_south: '629781187',
};
export function inspectMroSupportPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const id = nativeIds[P.model];
    if (!id || mroSupportCases[proof.case] !== P.model)
      return fail('mro-support-exact-case-identity-unbound');
    const source = proof.primarySources?.find((s) => s.key === 'building'),
      sp = safe(dir, source?.path),
      sb = sp && fs.readFileSync(sp);
    if (
      !sb ||
      source.url !== `https://www.openstreetmap.org/way/${id}` ||
      source.use !== 'factual-text-only' ||
      hash(sb) !== source.sha256 ||
      ![
        'Original numerical provider record',
        `way${id}`,
        'four unique corners',
        'explicit estimates',
        'All imagery unused',
      ].every((t) => sb.toString().includes(t))
    )
      return fail('mro-support-primary-numeric-facts-unbound');
    const n = proof.nativeIdentity,
      p = safe(dir, n?.path),
      b = p && fs.readFileSync(p);
    if (!b || hash(b) !== n.sha256 || n.featureId !== `way/${id}`)
      return fail('mro-support-original-numeric-whole-building-unbound');
    const data = JSON.parse(b),
      w = data.feature;
    if (
      w.id !== id ||
      w.type !== 'way' ||
      w.tags.building !== 'yes' ||
      w.coordinates.length !== 5 ||
      P.parentModelIdentity !== 'murchison_radio_astronomy_observatory' ||
      P.wholeScope !== `whole-independent-native-support-building-way${id}-2013` ||
      P.nativeRing.length !== 4 ||
      P.building.storeys !== 1 ||
      P.building.closedDoor !== true ||
      P.building.externalVents !== true ||
      P.building.estimatedExternalForm !== true ||
      P.estimatedHeightUncertaintyMeters < 1.5 ||
      P.estimatedComponentUncertaintyMeters < 2
    )
      return fail('mro-support-whole-independent-building-scope-or-estimates-disagree');
    const r = w.coordinates.slice(0, -1),
      anchor = [0, 1].map((k) => r.reduce((s, p) => s + p[k] / r.length, 0)),
      R = 6378137,
      rad = Math.PI / 180,
      co = Math.cos(anchor[1] * rad),
      c = Math.cos(f.heading),
      s = Math.sin(f.heading);
    if (anchor.some((v, i) => Math.abs(v - f.anchor[i]) > 1e-10))
      return fail('mro-support-building-moved-to-observatory-centroid');
    for (const [i, p] of r.entries()) {
      const x = (p[0] - anchor[0]) * R * rad * co,
        z = -R * (Math.asinh(Math.tan(p[1] * rad)) - Math.asinh(Math.tan(anchor[1] * rad))) * co,
        q = [c * x - s * z, s * x + c * z];
      if (
        q.some(
          (v, a) =>
            Math.abs(v - f.geometry.polygons[0][i][a]) > 1e-7 ||
            Math.abs(v - P.nativeRing[i][a]) > 1e-7,
        )
      )
        return fail('mro-support-full-original-fourcorners-changed');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes: `Whole independent original support buildingway${id}: complete four-corner plan/buildingtype, all imagery unused. External height, roof, storeys, facade, exterior ventilation, finish,2013 appearance and grade estimates explicit. Parent observatory remains unfinished; no centroid/composite/onebuilding proxy.`,
    };
  } catch {
    return fail('mro-support-factual-evidence-unreadable');
  }
}
