import {
  driveVehicle,
  installVehicles,
  unmountEntity,
} from '../../../packages/kernel/dist/vehicles.mjs';

/** Run with molen sim/shot --setup ./scenes/cycles.setup.mjs from content/entities. */
export function setup(world) {
  const environment = { groundHeight: () => 0 };
  installVehicles(world, environment);
  world.registerCommand('ride', (_world, command) => {
    const { rider, throttle, steering, brake } = command.payload;
    driveVehicle(world, rider, { throttle, steering, brake });
  });
  world.registerCommand('exit', (_world, command) =>
    unmountEntity(world, command.payload.rider, environment),
  );
}
