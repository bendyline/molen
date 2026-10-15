# Dioramas: living places

Run `pnpm --filter @bendyline/molen-examples-dioramas dev` from the repository root, then open
http://localhost:5250. Select football, airport ground traffic, little league, fireworks, a fair
or a Saturday market. Drag to orbit, scroll to zoom, or choose the close camera. Pause holds
the simulation. Leave unloads it; Return loads a fresh instance of the same seeded scene.

Direct links use `?diorama=airport` (or `football`, `little-league`, `fireworks`, `fair`, `market`).
The source lives in `content/dioramas/`. `src/load-diorama.ts` builds a lazy Vite import map:
scene data and script text are requested only when the selected placement enters range.
The preview uses the same `DioramaDirector` and `createDioramaVisual` as the geographic viewers.
World Explorer offers the same scenes through its Living places picker and Visit button.

This repository preview imports authored content directly and is not an npm scaffold template.
Published content belongs in the `molen.dioramas` pack. See the shipped
[diorama guide](../../docs-src/guide/dioramas.md) for the API, placement policy and authoring loop.
