import { omanBronzeAgeGeometry } from '../../../../../structure-catalog/oman-bronze-age-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  omanBronzeAgeGeometry(site);
