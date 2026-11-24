import { cornishHeritageGeometry } from '../../../../../structure-catalog/cornish-heritage-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  cornishHeritageGeometry(site);
