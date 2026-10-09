/** Bounded procedural plant recipes. Presets live in content packs, not in the renderer. */
import { z } from 'zod';
import { COLOR_RE, DOTTED_ID_RE } from './schema-common';

export interface PlantPreset {
  id: string;
  version: number;
  title: string;
  family:
    | 'broadleaf'
    | 'conifer'
    | 'palm'
    | 'cactus'
    | 'succulent'
    | 'bamboo'
    | 'banana'
    | 'grass'
    | 'fern'
    | 'reed'
    | 'mangrove'
    | 'deadwood'
    | 'shrub'
    | 'thicket'
    | 'forb'
    | 'vine'
    | 'mat'
    | 'fallenwood'
    | 'crop';
  form: 'round' | 'columnar' | 'umbrella' | 'feather' | 'fan' | 'branching' | 'paddle';
  /** Mature silhouette bounds in meters; scatter supplies modest individual variation. */
  height: number;
  width: number;
  /** Fraction of height below the main canopy (ignored by ground cover and succulents). */
  crownBase: number;
  stemRadius: number;
  /** Horizontal trunk displacement as a fraction of height. */
  lean: number;
  foliage: string;
  bark: string;
  /** Stable branching/frond variation. Omitted or zero preserves the original shape. */
  shapeSeed?: number;
  /** Low vegetation assembled as a patch rather than one isolated stem. */
  patch?: boolean;
  /** Foliage on bounded vines supported by this broadleaf tree's own trunk and branches. */
  climber?: string;
  cropKind?: 'maize' | 'cereal' | 'rice' | 'broadleaf' | 'cotton' | 'cane' | 'sunflower' | 'roots';
  cropStage?: 'sown' | 'growing' | 'mature' | 'ripe' | 'stubble';
  /** Source species/genus names represented by this silhouette; exact case-insensitive matches. */
  taxa?: string[];
  /** Botanical leaf category when it differs from the procedural silhouette family. */
  leafType?: 'broadleaved' | 'needleleaved';
  /** Temperate deciduous cycle only; omitted means no inferred seasonal leaf change. */
  phenology?: { spring: string; autumn: string };
  /** Derived dormant geometry. Hosts normally obtain it through seasonalPlantPresets. */
  leafless?: boolean;
}

export const plantPresetSchema: z.ZodType<PlantPreset> = z.strictObject({
  id: z.string().regex(DOTTED_ID_RE),
  version: z.int().positive(),
  title: z.string().min(1),
  family: z.enum([
    'broadleaf',
    'conifer',
    'palm',
    'cactus',
    'succulent',
    'bamboo',
    'banana',
    'grass',
    'fern',
    'reed',
    'mangrove',
    'deadwood',
    'shrub',
    'thicket',
    'forb',
    'vine',
    'mat',
    'fallenwood',
    'crop',
  ]),
  form: z.enum(['round', 'columnar', 'umbrella', 'feather', 'fan', 'branching', 'paddle']),
  height: z.number().min(0.1).max(100),
  width: z.number().min(0.1).max(60),
  crownBase: z.number().min(0).max(0.95),
  stemRadius: z.number().min(0.01).max(6),
  lean: z.number().min(0).max(0.5),
  foliage: z.string().regex(COLOR_RE),
  bark: z.string().regex(COLOR_RE),
  shapeSeed: z.int().min(0).max(65535).optional(),
  patch: z.boolean().optional(),
  climber: z.string().regex(COLOR_RE).optional(),
  cropKind: z
    .enum(['maize', 'cereal', 'rice', 'broadleaf', 'cotton', 'cane', 'sunflower', 'roots'])
    .optional(),
  cropStage: z.enum(['sown', 'growing', 'mature', 'ripe', 'stubble']).optional(),
  taxa: z.array(z.string().min(1)).min(1).optional(),
  leafType: z.enum(['broadleaved', 'needleleaved']).optional(),
  phenology: z
    .strictObject({ spring: z.string().regex(COLOR_RE), autumn: z.string().regex(COLOR_RE) })
    .optional(),
  leafless: z.boolean().optional(),
});
