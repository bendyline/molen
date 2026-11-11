import { buildBridgeSection } from '../../mumbai_trans_harbour_link/models/bridge-model.mjs';

const id = 'mumbai_trans_harbour_link_nhava_west';
export const buildSkyline = (out) => buildBridgeSection(out, 'skyline', id);
export const buildDistrict = (out) => buildBridgeSection(out, 'district', id);
export const buildStreet = (out) => buildBridgeSection(out, 'street', id);
export const buildCloseup = (out) => buildBridgeSection(out, 'closeup', id);
export const buildMaster = (out) => buildBridgeSection(out, 'master', id);
