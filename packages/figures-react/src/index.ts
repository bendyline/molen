/**
 * @bendyline/molen-figures-react — the character designer: pick a person's skin tone, head, hair,
 * body shape and height, then their clothing and accessories, over molen figure looks
 * (`@bendyline/molen-figures/look`), with a live 3D preview and option thumbnails drawn by one
 * WebGL context. Controlled: the host owns the look and its persistence.
 */

export type {
  FigureDesignerPart,
  FigureDesignerProps,
  FigureDesignerSection,
} from './designer';
export { FigureDesigner } from './designer';
