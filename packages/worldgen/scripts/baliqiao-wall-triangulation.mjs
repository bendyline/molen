/** Non-convex stone-wall tessellation owned by molen.worldgen.structure.baliqiao. */
import earcut from 'earcut';
export function baliqiaoWallTriangles(profile) {
  const ids = earcut(profile.flat(), [], 2);
  return Array.from({ length: ids.length / 3 }, (_, i) =>
    ids.slice(i * 3, i * 3 + 3).map((id) => profile[id]),
  ).filter(([a, b, c]) => {
    const p = [a, b, c].map((p) => p.map(Math.fround));
    return (
      Math.abs(
        (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]),
      ) > 1e-5
    );
  });
}
