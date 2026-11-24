import { portreathRailwayFormation } from '../../../../../structure-catalog/portreath-railway-formation.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  portreathRailwayFormation(site.formation.sections);
