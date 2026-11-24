import { buildPeaceChurch } from '../../../../../../../../packages/worldgen/scripts/peace-church-geometry.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces } from '../../../../../../../../packages/worldgen/scripts/peace-church-geometry.mjs';
export const buildSkyline = (out) => buildPeaceChurch(out, site, 0);
export const buildDistrict = (out) => buildPeaceChurch(out, site, 1);
export const buildStreet = (out) => buildPeaceChurch(out, site, 2);
export const buildCloseup = (out) => buildPeaceChurch(out, site, 3);
export const buildMaster = buildCloseup;
