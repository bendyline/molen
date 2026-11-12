/**
 * Lying snow for materials: `enableSnowCover` marks a lit material to take the weather's snow, and
 * the rest is what a ground material needs to draw its own snow from the same snow line.
 */
export {
  enableSnowCover,
  SNOW_COVER_COLOR,
  SNOW_COVER_FACING,
  SNOW_COVER_GLSL,
  SNOW_COVER_PERIOD,
  snowCoverAmount,
  snowCoverFacing,
  snowLineNode,
  writeSnowCoverValue,
} from './weather/snow-cover';
