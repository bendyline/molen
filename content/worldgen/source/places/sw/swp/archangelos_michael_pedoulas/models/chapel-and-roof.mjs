// Archangelos Michael, Pedoulas
import { churchRecipe } from '../../../../../structure-catalog/troodos-church-geometry.mjs';
import { churchTerrace } from '../../../../../structure-catalog/troodos-church-terrace.mjs';
import plan from '../church-plan.json' with { type: 'json' };

export const { surfaces, buildSkyline, buildDistrict, buildStreet, buildCloseup, buildMaster } =
  churchTerrace(churchRecipe(plan), plan.terrace);
