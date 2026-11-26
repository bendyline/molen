// @bendyline/molen-stage — authoring documents a language model can write: a film
// (molen/film@1) and a game (molen/game@1), each compiled into an ordinary data-only
// molen/scene@3 (no scripts), plus a lint for each and short primers that teach them.

export type { FigurePreset, FigurePresetInfo, Look } from './common';
export { FIGURE_PRESETS, LOOKS, TICK_RATE } from './common';
export type {
  BeatAction,
  CompileFilmResult,
  FilmBeat,
  FilmCaption,
  FilmCastMember,
  FilmDoc,
  FilmInfo,
  FilmProp,
  FilmShot,
  Ground,
  PropShape,
  ShotKind,
} from './film';
export { compileFilm, filmSchema, lintFilm, PROP_SHAPES } from './film';
export type { CompileGameResult, GameDoc, GameInfo, GameLayout, GamePiece, Role } from './game';
export { compileGame, gameSchema, lintGame } from './game';
export type { Amount3, Archetype, LayoutPiece, LayoutSize, LayoutSpec } from './layout';
export { generateLayout, SIZE_LIMITS } from './layout';
export { filmPrimer, gamePrimer, scenePrimer } from './primers.generated';
