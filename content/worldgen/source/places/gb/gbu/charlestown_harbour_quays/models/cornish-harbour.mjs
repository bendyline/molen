import { cornishHarbourGeometry } from '../../../../../structure-catalog/cornish-harbour-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  cornishHarbourGeometry(site.harbour);
