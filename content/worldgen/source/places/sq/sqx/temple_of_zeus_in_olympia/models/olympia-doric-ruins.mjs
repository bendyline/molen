import {
  buildTempleRuin,
  surfaces,
} from '../../../../sw/swb/temple_of_apollo_in_delphi/models/doric-ruin.mjs';
import site from '../site-controls.json' with { type: 'json' };

export { surfaces };
export const buildSkyline = (out) => buildTempleRuin(out, site, 0);
export const buildDistrict = (out) => buildTempleRuin(out, site, 1);
export const buildStreet = (out) => buildTempleRuin(out, site, 2);
export const buildCloseup = (out) => buildTempleRuin(out, site, 3);
export const buildMaster = buildCloseup;
