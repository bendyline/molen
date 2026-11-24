// Timios Stavros, Pelendri
import { churchRecipe } from '../../../../../structure-catalog/troodos-church-geometry.mjs';
import plan from '../church-plan.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  churchRecipe(plan);
