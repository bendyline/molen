/**
 * @bendyline/molen-figures/designer — what a figure designer needs beyond the look data: a
 * headless editing model (undo, steer, transient drags), every string behind a typed key with
 * an English table, a one-line description of a look for assistive technology, and a three.js
 * turntable preview that also draws option thumbnails through the same WebGL context.
 *
 * Framework-free: `@bendyline/molen-figures-react` builds the shipped designer on it, and a
 * host can build its own. Needs three.js (a peer dependency); no kernel runtime, no SES.
 */

export type {
  FigureDesignerChange,
  FigureDesignerListener,
  FigureDesignerModel,
  FigureDesignerModelOptions,
  FigureDesignerSource,
} from './designer/model';
export { createFigureDesignerModel } from './designer/model';
export type {
  FigurePreview,
  FigurePreviewFraming,
  FigurePreviewLighting,
  FigurePreviewOptions,
  FigurePreviewPose,
} from './designer/preview';
export { FIGURE_PREVIEW_LIGHTING, mountFigurePreview } from './designer/preview';
export type { FigureDesignerStringKey, FigureDesignerStrings } from './designer/strings';
export {
  describeFigureLook,
  FIGURE_DESIGNER_STRINGS_EN,
  figureColorName,
  figureDesignerStringKeys,
  figureDesignerText,
  formatFigureHeight,
} from './designer/strings';
