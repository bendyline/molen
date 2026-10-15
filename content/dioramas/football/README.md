# Friday night football

A 24-second loop: four seconds lining up, eight running, four celebrating, eight returning.
Fourteen helmeted figures wear two team palettes; sixty spectators sit in stepped stands and
stand for the cheer cue. A six-digit board shows decorative scores and a loop countdown, with a
pulsing point light. It emits `diorama.cue` (`crowd-cheer`) for a host that wants to attach sound.

The authored stage is 142 × 102 meters. `bounds.json` permits entity origins inside
144 × 32 × 104 meters, including its buried foundation. This is a flat stage: orient and anchor
it to an appropriate open site. Earth placements can sample the whole footprint and move the
stage above refined terrain without restarting the performance.
Configure `homeColor`, `awayColor`, and `spectatorsPerSide` in the script entry. Counts cap at
48 per side. The scene uses primitives and the standard figures capability, with no GLBs.

From the repository root:

```sh
node packages/tooling/dist/cli.mjs validate content/dioramas/football/scene.json
node packages/tooling/dist/cli.mjs scripts check --project content/dioramas/project.json
node packages/tooling/dist/cli.mjs replay content/dioramas/football/football.replay.json
node packages/tooling/dist/cli.mjs sim run content/dioramas/football/scene.json --ticks 420 --hash
node packages/tooling/dist/cli.mjs shot content/dioramas/football/scene.json --ticks 240 --out .artifacts/dioramas/football.png
```

The live preview is `pnpm --filter @bendyline/molen-examples-dioramas dev`. `node
content/dioramas/build.mjs` erases script types into the pack's `dist/football/` directory for
on-demand HTTP or pack loading. Source files remain TypeScript.
