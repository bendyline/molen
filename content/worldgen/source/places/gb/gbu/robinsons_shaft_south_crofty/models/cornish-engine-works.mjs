import { cornishEngineWorks } from '../../../../../structure-catalog/cornish-engine-works.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  cornishEngineWorks(site);
