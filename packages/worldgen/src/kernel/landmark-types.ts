import type { Vec3 } from './types';
export interface SignDesign {
  text: string;
  background: string;
  foreground: string;
  mark: string;
  symbol:
    | 'arches'
    | 'spark'
    | 'disc'
    | 'target'
    | 'cross'
    | 'letters'
    | 'cup'
    | 'tag'
    | 'roofline'
    | 'star'
    | 'burger'
    | 'bell'
    | 'bucket'
    | 'domino';
  letters?: string;
}
interface LandmarkBase {
  format: 'molen/landmark@1';
  id: string;
  version: number;
  title: string;
}
export interface SignLandmarkDoc extends LandmarkBase {
  generator: 'sign';
  sign: SignDesign;
  appearance: { wall: string; accent: string };
  storefront: { width: number; sharedWidth: number; style?: string };
}
export interface LandmarkBoxPart {
  center: Vec3;
  size: Vec3;
  color: string;
  yaw?: number;
  tiers?: Array<0 | 1 | 2>;
}
export interface BoxLandmarkDoc extends LandmarkBase {
  generator: 'boxes';
  parts: LandmarkBoxPart[];
}
export type LandmarkDoc = SignLandmarkDoc | BoxLandmarkDoc;
export type LandmarkDefinitions = Readonly<Record<string, LandmarkDoc>>;
export interface LandmarkCatalogDoc {
  format: 'molen/landmark-catalog@1';
  version: number;
  models: Record<string, string>;
}
