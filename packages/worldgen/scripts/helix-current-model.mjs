/** Project viewpoint locations onto the curved deck before using them as pier/pod stations. */
import './install-deterministic-math.mjs';
import { readFile } from 'node:fs/promises';
import { buildHelix, helixDeckPoint, helixPoint, helixStudy } from './helix-bridge-model.mjs';

const map = JSON.parse(
  await readFile(
    new URL(
      '../../../content/worldgen/source/places/w2/w21/the_helix_bridge/map-frame.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const c = Math.cos(map.heading),
  s = Math.sin(map.heading),
  cos = Math.cos((map.anchor[1] * Math.PI) / 180);
const viewpoints = map.features
  .filter((f) => f.type === 'node' && f.tags?.tourism === 'viewpoint')
  .map((f) => {
    const east = (f.lon - map.anchor[0]) * cos * 111319.490793,
      south = -(f.lat - map.anchor[1]) * 111319.490793;
    return { id: f.id, x: c * east - s * south, z: s * east + c * south };
  })
  .sort((a, b) => a.x - b.x);
if (viewpoints.length !== 4)
  throw Error('the_helix_bridge requires four explicit source viewpoints');
export const helixCurrentPodStations = viewpoints.map((p) => {
  const dx = p.x - map.circleFit.centerX,
    dz = p.z - map.circleFit.centerZ,
    distance = Math.hypot(dx, dz);
  return map.circleFit.centerX + (map.circleFit.radius * dx) / distance;
});
const phaseSamples = {
  6: [1.284699081698724, 1.1363460952792062, 0.8134601836602552, 0.5167542108212192],
  5: [0.04825176046551971, 0.2123127101529867, 0.638173047639603, 0.9907295565424576],
};
export function helixCurrentPhase(count, x) {
  const values = phaseSamples[count];
  if (!values) throw Error('Unknown Helix strand system');
  if (x <= helixCurrentPodStations[0]) return values[0];
  for (let i = 1; i < helixCurrentPodStations.length; i++) {
    if (x > helixCurrentPodStations[i]) continue;
    const t =
      (x - helixCurrentPodStations[i - 1]) /
      (helixCurrentPodStations[i] - helixCurrentPodStations[i - 1]);
    const smooth = t * t * (3 - 2 * t);
    return values[i - 1] + (values[i] - values[i - 1]) * smooth;
  }
  return values.at(-1);
}
export const helixCurrentPoint = (x, j, count, r, cy, pitch, hand) =>
  helixPoint(x, j, count, r, cy, pitch, hand, helixCurrentPhase(count, x));
const { majorPhaseRadians, minorPhaseRadians, ...originalReconstruction } =
  helixStudy.reconstruction;
export const helixCurrentReconstruction = {
  ...originalReconstruction,
  originalNominalPhases: { majorPhaseRadians, minorPhaseRadians },
  phaseSamples,
  phaseMethod:
    'Smooth phase interpolation between pod entrances retains continuous opposing strands and clears the reconstructed access thresholds. Nominal source pitches remain the base; this is photo-led reconstruction, not engineering geometry.',
  podStationsNativeX: helixCurrentPodStations,
  podCentersNativeX: helixCurrentPodStations.map((x) => helixDeckPoint(x, 6, -10.7)[0]),
  mappedViewpoints: viewpoints,
  note:
    helixStudy.reconstruction.note +
    ' Viewpoint X coordinates are projected onto the circular deck to get actual arc stations; they are not used directly as stations. Viewpoints lie within the reconstructed pods and are not claimed as surveyed centroids.',
};
export function buildHelixCurrent(out) {
  buildHelix(out, { podStations: helixCurrentPodStations, phaseAt: helixCurrentPhase });
}
