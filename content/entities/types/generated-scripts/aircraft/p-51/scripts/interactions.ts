// Installed once per registered external entity type. `config.type` is injected by Molen.
const matches = (entity: MolenEntityId): boolean =>
  molen.get(entity, 'vehicle')?.kind === config.type ||
  molen.get(entity, 'aircraft')?.kind === config.type;

molen.on('vehicle-mounted', (event) => {
  if (!matches(event.vehicle)) return;
  molen.emit('entity-mounted', { ...event, type: config.type });
});

molen.on('vehicle-unmounted', (event) => {
  if (!matches(event.vehicle)) return;
  molen.emit('entity-unmounted', { ...event, type: config.type });
});
