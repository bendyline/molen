import { buildHalicComponent } from '../../halic_bridge/models/bridge-kit.mjs';

const id = 'halic_bridge_main_deck';
export const buildBridgeLevel = (out, level) => buildHalicComponent(out, level, id);
export const buildBridgeSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildBridgeDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildBridgeStreet = (out) => buildBridgeLevel(out, 'street');
export const buildBridgeCloseup = (out) => buildBridgeLevel(out, 'closeup');
