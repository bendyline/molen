import { fortressBuilders } from '../../../../../structure-catalog/diyarbakir-fortress-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces } from '../../../../../structure-catalog/diyarbakir-fortress-geometry.mjs';
export const { buildMaster, buildSkyline, buildDistrict, buildStreet, buildCloseup } =
  fortressBuilders(site);
