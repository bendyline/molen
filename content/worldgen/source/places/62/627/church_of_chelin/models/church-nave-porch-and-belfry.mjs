import { chileanTimberChurch } from '../../../../../structure-catalog/chiloe-church-geometry.mjs';
import plan from '../church-plan.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  chileanTimberChurch(plan);
