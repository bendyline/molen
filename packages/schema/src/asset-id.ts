import { z } from 'zod';

// Asset names can contain addresses, e.g. molen.worldgen.structure.30_st_mary_axe.
// Keep the leading namespace alphabetic and every segment nonempty and path-safe.
export const assetId: z.ZodString = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9][a-z0-9_]*)*$/, {
  error:
    'must be dotted lowercase segments starting with a letter; later segments may start with digits, e.g. "landmark.30_st_mary_axe"',
});
