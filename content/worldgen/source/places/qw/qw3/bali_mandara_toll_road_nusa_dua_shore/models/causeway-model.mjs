import { buildCausewaySection } from '../../bali_mandara_toll_road/models/causeway-model.mjs';

const id = 'bali_mandara_toll_road_nusa_dua_shore';
export const buildMaster = (out) => buildCausewaySection(out, 'master', id);
export const buildSkyline = (out) => buildCausewaySection(out, 'skyline', id);
export const buildDistrict = (out) => buildCausewaySection(out, 'district', id);
export const buildStreet = (out) => buildCausewaySection(out, 'street', id);
export const buildCloseup = (out) => buildCausewaySection(out, 'closeup', id);
