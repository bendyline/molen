import { cornishViaductGeometry } from '../../../../../structure-catalog/cornish-viaduct-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  cornishViaductGeometry(site.bridge);
