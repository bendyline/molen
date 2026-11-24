import { dacianFortressGeometry } from '../../../../../structure-catalog/dacian-fortress-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  dacianFortressGeometry(site);
