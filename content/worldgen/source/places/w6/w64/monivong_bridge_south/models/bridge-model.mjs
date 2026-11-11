import { buildMonivongComponent, surfaces } from '../../monivong_bridge/models/bridge-model.mjs';
export const componentId = 'monivong_bridge_south';
export { surfaces };
export const buildBridgeLevel = (out, level = 'master') =>
  buildMonivongComponent(out, level, componentId);
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
