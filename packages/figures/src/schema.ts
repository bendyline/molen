/**
 * @bendyline/molen-figures/schema — the figures vocabulary alone: the four components, the
 * `figure` renderable kind and molen/figure@1, registered with @bendyline/molen-schema on import.
 * For a host that validates scenes it does not run (a document checker, an editor, a server): no
 * kernel runtime, no SES, no three.js.
 */

import { registerFiguresSchema } from './kernel/schema';

export {
  FIGURE_ATTACHMENT_COMPONENT,
  FIGURE_COMPONENT,
  FIGURE_FORMAT,
  FIGURE_INTENT_COMPONENT,
  FIGURE_MODES,
  FIGURE_STATE_COMPONENT,
  registerFiguresSchema,
} from './kernel/schema';

registerFiguresSchema();
