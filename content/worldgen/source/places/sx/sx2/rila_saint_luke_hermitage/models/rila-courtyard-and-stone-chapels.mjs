import { rilaMonasteryGeometry } from '../../../../../structure-catalog/rila-monastery-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  rilaMonasteryGeometry(site);
