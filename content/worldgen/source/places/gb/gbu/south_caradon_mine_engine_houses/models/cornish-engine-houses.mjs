import { cornishMiningGeometry } from '../../../../../structure-catalog/cornish-mine-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildDistrict, buildStreet, buildCloseup, buildMaster } = cornishMiningGeometry(site);
export const { buildSkyline } = cornishMiningGeometry({ ...site, mines: site.skylineMines });
