import { buildAhu, surfaces } from '../../ahu_akivi/models/ahu.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces };
export const buildSkyline = (out) => buildAhu(out, site, 0);
export const buildDistrict = (out) => buildAhu(out, site, 1);
export const buildStreet = (out) => buildAhu(out, site, 2);
export const buildCloseup = (out) => buildAhu(out, site, 3);
export const buildMaster = buildCloseup;
