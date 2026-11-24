import { nikkoShrine } from '../../../../../structure-catalog/nikko-shrine-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  nikkoShrine(site.parts);
