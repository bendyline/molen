/**
 * The vehicle console: on-screen touch controls for phones and tablets, drawn as the vehicle's
 * own. The stick is the aircraft's own stick (or the car's wheel, the bike's handlebars), with
 * its rudder pedals beside it; the throttle sits at the right edge with the gear and flap handles
 * beside it; the aircraft's own airspeed and altitude dials show between in a chase view. Each
 * is copied out of the vehicle's model and moves as it does in the cockpit, drawn in one strip
 * along the bottom of the screen through one small WebGL context, see-through until a thumb
 * works it. On foot it is the plain two-circle stick with jump and use buttons.
 *
 * `createVehicleConsole(container, { input })` adds it; `setSubject` tells it what the viewer is
 * in, and `update(now)` after each frame poses and draws it. The Earth view mounts it with its
 * `console` option.
 */
export {
  aircraftDeck,
  type ConsoleAircraftSubject,
  type ConsoleButton,
  type ConsoleItem,
  type ConsoleOnFootSubject,
  type ConsoleSubject,
  type ConsoleVehicleSubject,
  type ConsoleZone,
  type DeckContext,
  onFootDeck,
  vehicleDeck,
} from './console/deck';
export {
  type ConsoleLayout,
  type ConsoleLayoutInput,
  type ConsoleLayoutItem,
  layoutConsole,
} from './console/layout';
export type { ConsolePart } from './console/parts';
export type { ConsoleRect } from './console/strip';
export {
  createVehicleConsole,
  type VehicleConsole,
  type VehicleConsoleOptions,
} from './console/vehicle-console';
