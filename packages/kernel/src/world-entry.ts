// @bendyline/molen-kernel/world — the ECS `World` and core components without the scripting
// runtime. The package root also exports script Compartments, which load SES and lock down the
// host realm's intrinsics on import; a page that embeds molen next to other code (running
// vehicles or figures on the main thread, say) imports from here instead so the host page is
// never hardened. Everything here is also re-exported from the root.

export type { JsonObject, JsonPrimitive, JsonValue } from '@bendyline/molen-schema';
export type { ComponentType, LifetimeData, TransformData } from './component';
export {
  componentDefaults,
  componentHandle,
  defineComponent,
  Lifetime,
  Transform,
} from './component';
export type { Rng } from './rng';
export { createRng, rngFromState, seedToInt } from './rng';
export type { AtmosphereSample } from './weather';
export { sampleAtmosphere, Weather, weatherOf } from './weather';
export type {
  EventHandler,
  Phase,
  QueryResult,
  System,
  SystemInfo,
  TickContext,
  Unsubscribe,
  WorldOptions,
} from './world';
export { restoreRng, World } from './world';
