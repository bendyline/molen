import {
  buildGizaPyramid,
  pyramidSurfaces,
} from '../../../../../../../../packages/worldgen/scripts/structure-giza-pyramid-courses.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = pyramidSurfaces;
export const buildSkyline = (out) => buildGizaPyramid(out, site, 0);
export const buildDistrict = (out) => buildGizaPyramid(out, site, 1);
export const buildStreet = (out) => buildGizaPyramid(out, site, 2);
export const buildCloseup = (out) => buildGizaPyramid(out, site, 3);
export const buildMaster = buildCloseup;
