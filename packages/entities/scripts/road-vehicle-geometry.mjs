/**
 * Reference-based road vehicles. Metres, +Z forward, +X driver side; no bitmap materials.
 * Geometry carries no manufacturer emblem, wordmark, model lettering or trademarked grille
 * signature: the badge positions hold plain chrome rings. See content/entities/NOTICE.md.
 */
import '../../worldgen/scripts/install-deterministic-math.mjs';
import * as T from 'three';
import { articulateRoadVehicle } from './road-articulation.mjs';
import { detailKit } from './vehicle-detail.mjs';
import { addRoadDashboard, interiorProfile } from './vehicle-interiors.mjs';

/**
 * Fascia vocabulary the builder draws: recipe `grille`, `lamps`, `tail` and `intake`, and the
 * enumerated form keys. Anything else falls back to a default shape, so recipes are checked
 * against these lists (test/road-fascia.test.mjs). The six-slot `slots` grille is deliberately
 * not a seven-slot signature, `twin` is two generic ports, not a maker's kidney shape,
 * `three-port` is plain trapezoid ports (a centre one between two lower side ones), not a
 * maker's winged centre, and `tall` is a generic tall van grille between high-set lamps, with
 * no badge shape of its own. Lamp outlines and graphics (lampShape, lampDrl, tail styles) are
 * generic shapes evoking a type of lamp, never a maker's light signature traced from a car.
 */
export const ROAD_FASCIA_STYLES = {
  grille: [
    'pentagon',
    'triangle',
    'hex',
    'shield',
    'v',
    'trapezoid',
    'oval',
    'closed',
    'split',
    'vertical-slats',
    'slots',
    'slots5',
    'bars',
    'mesh',
    'band',
    'twin',
    'tall',
    'three-port',
  ],
  lamps: [
    'stadium',
    'quad-round',
    'round',
    'round-bar',
    'twin-line',
    'teardrop',
    'y-signature',
    'countryman',
    'oval-upright',
    'jewel-five',
    'c',
    'hammer',
    'boomerang',
    'vertical',
    'pixel-squares',
    'pixels',
    'triple',
    'split',
    'rect',
    'slim',
  ],
  tail: [
    'round',
    'wrap-l',
    'boomerang',
    'racetrack',
    'twin-line',
    'pixel-band',
    'black-panel',
    'band-l',
    'tri-bar',
    'claws',
    'bar',
    'high-l',
    'vertical',
    'c',
    'square',
    'horizontal',
    'round-wrap',
    'slashes',
  ],
  intake: ['none', 'trapezoid', 'wide', 'triple', 'sides', 'slots', 'fangs'],
  form: {
    grilleTrim: ['chrome', 'black', 'body', 'none'],
    grilleFill: ['mesh', 'fine', 'bars', 'slats', 'none'],
    grilleMesh: ['black', 'chrome'],
    exhaust: ['pair', 'single', 'quad', 'centre', 'centre-quad', 'none'],
    spoiler: [true, false, 'wing'],
    bumperFinish: ['black', 'chrome', 'body', 'grey'],
    rockerFinish: ['black', 'grey', 'chrome', 'body'],
    rockerStrip: ['chrome', 'black', 'none'],
    grilleBar: ['chrome', 'body', 'black', 'light'],
    grilleBarShape: ['straight', 'wing', 'v'],
    fogLamps: ['duct', 'round', 'rect', 'bar', 'none'],
    fogTrim: ['chrome', 'none'],
    skid: ['silver', 'black', 'none'],
    garnish: ['chrome', 'black', 'none'],
    diffuser: ['black', 'silver'],
    hoodVents: [true, false, 'centre'],
    sideSteps: ['board', 'tube', 'none'],
    sideStepFinish: ['black', 'chrome'],
    railStyle: ['flush', 'raised', 'feet'],
    spareCover: ['body', 'silver', 'black', 'ring'],
    rollBar: ['black', 'chrome'],
    tread: ['road', 'at', 'mt'],
    wheelStyle: ['alloy', 'split', 'multi', 'mesh', 'dial', 'aero', 'steel', 'hubcap'],
    wheelFinish: ['silver', 'dark', 'machined'],
    ventWindow: [true, false, 'sail'],
    lampLens: ['dark', 'clear'],
    lampShape: ['quad', 'rect', 'wedge', 'boomerang', 'oval', 'rounded'],
    lampDrl: ['line', 'c', 'l', 'chevron', 'bars', 'frame', 'ring', 'none'],
    tailHousing: ['red', 'smoked', 'clear'],
    tailBandFinish: ['black', 'chrome', 'body'],
  },
};

export function roadVehicleModel(s) {
  const root = new T.Group();
  root.name = s.id;
  const { length: L, width: W, height: H, wheelRadius: R, wheelbase: WB, form: f } = s;
  const pickup = s.bodyStyle === 'pickup',
    rugged = s.bodyStyle === 'offroad',
    tall = s.bodyStyle === 'suv' || s.bodyStyle === 'crossover';
  const sedanLike = ['sedan', 'coupe', 'fastback', 'roadster'].includes(s.bodyStyle);
  const mat = (name, color, metalness = 0, roughness = 0.6) =>
    new T.MeshStandardMaterial({
      name,
      color,
      metalness,
      roughness,
      flatShading: true,
      side: T.DoubleSide,
    });
  const paint = mat('vehicle-paint-and-trim', s.color, 0.32, 0.36);
  const black = mat('rubber-and-trim', '#20272c', 0.03, 0.8);
  const rubber = mat('tire-rubber', '#24292b', 0, 0.95);
  const chrome = mat('satin-alloy', '#a4b0b6', 0.75, 0.3);
  // Bright trim (chrome bumpers, bars, garnish, steps) mirrors sky and ground like plating; it
  // is only exported where a recipe asks for chrome trim.
  const polished = mat('polished-chrome', '#dfe5e8', 0.9, 0.2);
  const light = mat('led-optics', '#e5f0ed', 0.15, 0.22);
  // Brighter and more saturated than any red paint, and set in dark bezels, so lamps read on it.
  const red = mat('rear-optics', '#d4202b', 0.15, 0.25);
  const amber = mat('amber-optics', '#c18429', 0.1, 0.35);
  const seat = mat('upholstery', interiorProfile(s.id).trim, 0, 0.92);
  const screen = mat('display-glass', '#173038', 0.1, 0.28);
  const pixel = mat('display-graphics', '#b2c9cb', 0, 0.6);
  // Tinted from outside like real automotive glass, so the greenhouse reads as one dark,
  // reflective band with pillar mass rather than a clear box of seats (only a hint of the cabin
  // shows through). Panes are front-faced only, so the cabin and driver views look out through
  // them untinted.
  const glass = mat('clear-glazing', '#1f2b34', 0.45, 0.08);
  glass.transparent = true;
  glass.opacity = 0.9;
  glass.depthWrite = false;
  glass.side = T.FrontSide;
  const roofGlass = mat('panoramic-roof-glass', '#263b47', 0.25, 0.22);
  const shell = detailKit(root, 'body-shell');
  const details = detailKit(root, 'exterior-fittings');
  const windows = detailKit(root, 'glazing');
  const cabin = detailKit(root, 'cabin');
  const front = detailKit(root, 'front-fascia');
  const rear = detailKit(root, 'rear-fascia');
  const noseRound = f.noseRound ?? (pickup || rugged ? 0.1 : 0.27);
  const tailRound = f.tailRound ?? (pickup || rugged ? 0.055 : 0.15);
  // Tire type: 'road' (smooth, rounded shoulder), 'at' all-terrain blocks, 'mt' mud-terrain lugs.
  const tread = f.tread ?? (rugged ? 'at' : 'road');
  // Rim type: 'alloy' spoked car wheels, 'steel' commercial disc wheels or a 'hubcap' cover;
  // dually doubles the rear tires.
  const wheelStyle = f.wheelStyle ?? 'alloy',
    alloyStyles = ['alloy', 'split', 'multi', 'mesh', 'dial', 'aero'],
    wheelFinish = f.wheelFinish ?? 'silver';
  const darkAlloy = wheelFinish === 'dark' ? mat('graphite-alloy', '#3b4247', 0.6, 0.4) : chrome;
  const roofPaint = f.roofColor ? mat('contrast-roof', f.roofColor, 0.25, 0.4) : paint;
  const endWidth = (end) => (W / 2) * (end > 0 ? f.frontTaper : f.rearTaper);
  // Setback of the plan outline at lateral offset x (the rounded corner profile when present);
  // the fascia conform uses it without y. Given a height y, a rounded corner also follows the
  // body section (tuck and shoulder): the setback of the actual panel at (x, y).
  const endOffset = (x, end, y) => {
    const profile = endProfiles[end > 0 ? 1 : 0];
    if (profile)
      return profile.setback(
        Math.abs(x) / (y === undefined ? 1 : sectionAt(end * (L / 2 - 0.05), y)),
      );
    const p = (end > 0 ? f.noseShape : f.tailShape) ?? 2,
      k = Math.min(0.999, Math.abs(x) / endWidth(end));
    return (
      (end > 0 ? noseRound : tailRound) *
      (1 -
        (p === 2
          ? Math.sqrt(Math.max(0, 1 - k ** 2))
          : Math.pow(Math.max(0, 1 - Math.pow(k, p)), 1 / p)))
    );
  };
  // Fascia fittings follow the rounded nose/rear instead of floating on a flat billboard.
  for (const [d, end] of [
    [front, 1],
    [rear, -1],
  ]) {
    const conform = (mesh, x) => {
      mesh.position.z -= end * endOffset(x, end);
      const epsilon = 0.001;
      mesh.rotation.y +=
        Math.atan((endOffset(x + epsilon, end) - endOffset(x - epsilon, end)) / (epsilon * 2)) *
        end;
      return mesh;
    };
    const box = d.box,
      add = d.add,
      rod = d.rod,
      ring = d.ring,
      contour = d.path;
    d.box = (size, at, material) => {
      if (size[0] < 0.28) return conform(box(size, at, material), at[0]);
      const count = Math.ceil(size[0] / 0.075);
      let mesh;
      for (let i = 0; i < count; i++) {
        const x = at[0] - size[0] / 2 + ((i + 0.5) * size[0]) / count;
        mesh = conform(box([size[0] / count, size[1], size[2]], [x, at[1], at[2]], material), x);
      }
      return mesh;
    };
    d.add = (geometry, material, at = [0, 0, 0]) => conform(add(geometry, material, at), at[0]);
    d.rod = (a, b, r, material) =>
      rod(
        [a[0], a[1], a[2] - end * endOffset(a[0], end)],
        [b[0], b[1], b[2] - end * endOffset(b[0], end)],
        r,
        material,
      );
    d.ring = (r, t, at, material, axis) => conform(ring(r, t, at, material, axis), at[0]);
    d.path = (points, radius, material, ...options) =>
      contour(
        points.map((p) => [p[0], p[1], p[2] - end * endOffset(p[0], end)]),
        radius,
        material,
        ...options,
      );
  }
  // Polygon surface with explicit outward normal; bodies are hollow rather than filled slabs.
  function face(d, points, material, normal) {
    let p = points;
    if (normal) {
      const n = new T.Vector3()
        .subVectors(new T.Vector3(...p[1]), new T.Vector3(...p[0]))
        .cross(new T.Vector3().subVectors(new T.Vector3(...p[2]), new T.Vector3(...p[0])));
      if (n.dot(new T.Vector3(...normal)) < 0) p = [...p].reverse();
    }
    const vertices = [];
    for (let i = 1; i < p.length - 1; i++) {
      const a = new T.Vector3(...p[i]).sub(new T.Vector3(...p[0]));
      const b = new T.Vector3(...p[i + 1]).sub(new T.Vector3(...p[0]));
      if (a.cross(b).lengthSq() <= 1e-16) continue;
      if (d === front || d === rear) {
        const end = d === front ? 1 : -1;
        const steps = Math.max(
          1,
          Math.ceil(Math.max(Math.abs(p[i][0] - p[0][0]), Math.abs(p[i + 1][0] - p[0][0])) / 0.07),
        );
        const point = (u, v) => {
          const q = p[0].map(
            (n, k) => n + ((p[i][k] - n) * u) / steps + ((p[i + 1][k] - n) * v) / steps,
          );
          q[2] -= end * endOffset(q[0], end);
          return q;
        };
        for (let u = 0; u < steps; u++)
          for (let v = 0; v < steps - u; v++) {
            vertices.push(...point(u, v), ...point(u + 1, v), ...point(u, v + 1));
            if (u + v < steps - 1)
              vertices.push(...point(u + 1, v), ...point(u + 1, v + 1), ...point(u, v + 1));
          }
      } else vertices.push(...p[0], ...p[i], ...p[i + 1]);
    }
    if (!vertices.length) return undefined;
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.computeVertexNormals();
    return d.add(g, material);
  }
  const path = (d, points, radius, material) => {
    d.path(points, radius, material);
  };
  // Sill height carries the body type as much as the roof does: a pickup's cab and bed stand on
  // a frame at about axle height, SUVs ride a hand higher than cars. Override with form.clearance.
  const belt = H * f.belt,
    clearance = f.clearance ?? Math.max(0.13, R * (pickup ? 1 : rugged ? 0.68 : tall ? 0.6 : 0.48));
  const cowl = L * f.windshieldBase,
    rf = L * f.roofFront,
    rr = L * f.roofRear,
    rb = L * f.rearBase;
  const style = s.bodyStyle;
  const boxy = pickup || rugged || style === 'cargo-van';
  // The belt rises from the A pillar to the C pillar on most modern bodies (a wedge), so the
  // side glass tapers toward the rear instead of standing as a tall rectangle.
  const beltRise = f.beltRise ?? (boxy ? 0 : sedanLike ? 0.035 : 0.025);
  // Height of the rear deck (trunk lid, tailgate top or bed rail) at the tail.
  // A pickup's bed rail (form.bedRail, y/H) runs level from the bed's front wall to the tailgate,
  // independent of the cab's belt and its rise toward the rear door glass.
  const bedRail = pickup && f.bedRail !== undefined ? H * f.bedRail : undefined;
  const deckEnd = bedRail ?? (f.deck !== undefined ? H * f.deck : belt * 0.94 + beltRise);
  const roofCrown = f.roofCrown ?? (pickup || rugged ? 0.035 : 0.075);
  const roofDrop = f.roofDrop ?? (pickup || rugged ? 0.025 : 0.06);
  // Published SUV heights often include the roof rails; then the roof itself stands below H.
  const roofTop = f.rails && f.railsInHeight ? H - 0.055 : H;
  const roofY = roofTop - roofCrown - roofDrop,
    roofW = W * f.roofWidth;
  // Greenhouses narrow in plan toward the rear header: a full-width roof all the way back reads
  // as a wagon from the rear three-quarter. roofTaper is the fraction lost at the rear header.
  const roofTaper =
    f.roofTaper ??
    (boxy || f.cargoVan
      ? 0
      : style === 'van'
        ? 0.04
        : style === 'wagon'
          ? 0.05
          : style === 'suv'
            ? 0.07
            : 0.1);
  const roofWAt = (z) =>
    roofW * (1 - roofTaper * Math.pow(Math.min(1, Math.max(0, (rf - z) / (rf - rr))), 1.5));
  const frontGlassY = f.windshieldTop ?? roofY;
  // The roof arc peaks over the front seats on most cars (roofPeak 0 = rear header, 1 = front).
  // A fastback's roof keeps falling behind the peak into the rear glass: roofDropRear is the
  // fall to the rear header, so the side glass, C pillars and backlight follow one slope.
  const roofPeak = rr + (rf - rr) * (f.roofPeak ?? 0.5);
  const roofDropRear = f.roofDropRear ?? roofDrop;
  const arcEdge = (z) =>
    roofTop -
    roofCrown -
    (z > roofPeak ? roofDrop : roofDropRear) *
      ((z - roofPeak) / (z > roofPeak ? rf - roofPeak : roofPeak - rr)) ** 2;
  // A raised roof above a lower windshield header (windshieldTop) rises from the header as a cap
  // that slopes up and back over capRun (m) and rolls into the roof, instead of a vertical face.
  const capRun = Math.min(
    (rf - rr) * 0.45,
    f.capRun ??
      (f.cargoVan && f.windshieldTop !== undefined ? 1.1 * (arcEdge(rf) - frontGlassY) : 0),
  );
  const roofEdge = (z) => {
    const s = capRun > 0 ? Math.max(0, (rf - z) / capRun) : 1;
    return s >= 1 ? arcEdge(z) : frontGlassY + (arcEdge(z) - frontGlassY) * (1 - (1 - s) ** 2);
  };
  const rearY = roofEdge(rr);
  const axleFront = L / 2 - (f.frontOverhang ?? (L - WB) * 0.46),
    axleRear = axleFront - WB;
  const arch = R + (f.archGap ?? (pickup || rugged ? 0.08 : tall ? 0.06 : 0.045)),
    // Arch outline as a superellipse: 2 is a car's round opening, about 3.5 a truck's squared one.
    archPower = f.archShape ?? (pickup || rugged ? 3.4 : 2),
    archRise = (dz) =>
      arch *
      Math.pow(
        Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(dz) / arch), archPower)),
        1 / archPower,
      ),
    track = W * 0.86,
    tireW = f.tireWidth ?? (pickup || rugged ? 0.26 : 0.225);
  const capWidthAt = (z) => {
    const round = z > 0 ? noseRound : tailRound;
    if (Math.abs(z) > L / 2 - round) {
      // A superellipse cap: noseShape / tailShape 2 is the ellipse, below 2 a pointed beak
      // (sports-car noses), above 2 a flatter face with tighter corners.
      const u = (L / 2 - Math.abs(z)) / round,
        p = (z > 0 ? f.noseShape : f.tailShape) ?? 2;
      return (
        endWidth(z) *
        (p === 2
          ? Math.sqrt(Math.max(0, 2 * u - u * u))
          : Math.pow(Math.max(0, 1 - Math.pow(Math.max(0, 1 - u), p)), 1 / p))
      );
    }
    const t = Math.max(0, (Math.abs(z) / L - 0.32) / 0.18);
    const waist = f.waist ?? 0;
    const swell = Math.max(
      ...[axleFront, axleRear].map((a) => Math.max(0, 1 - ((z - a) / (arch * 1.8)) ** 2)),
    );
    return (
      (W / 2) * (1 - t * (1 - (z > 0 ? f.frontTaper : f.rearTaper))) * (1 - waist * (1 - swell))
    );
  };
  // Plan-view corners. The elliptical end cap (depth noseRound/tailRound) meets the sides in a
  // knife-edge corner, which reads as a flat slab from the three-quarter views. noseCorner and
  // tailCorner roll that corner to the given radius (m) with a morphological opening of the plan
  // outline: the centre bow, and with it the end tip in side view, stays where it was fitted,
  // while the quarters turn into the end through a broad radius at every height.
  // Defaults follow top-down photos of current cars: tails are nearly flat across with corner
  // radii of about 0.15-0.25 m (the roundness from behind comes from the section's shoulder roll).
  const tailCorner =
    f.tailCorner ??
    (pickup || rugged || style === 'cargo-van'
      ? 0.12
      : sedanLike
        ? 0.24
        : style === 'suv' || style === 'van'
          ? 0.18
          : 0.2);
  const endProfiles = [-1, 1].map((end) => {
    const r = end > 0 ? (f.noseCorner ?? 0) : tailCorner;
    if (!(r > 0.01)) return undefined;
    const step = 0.004,
      reach = Math.round(r / step),
      depth = (end > 0 ? noseRound : tailRound) + 2.5 * r,
      count = Math.ceil(depth / step);
    const arc = Array.from({ length: 2 * reach + 1 }, (_, k) =>
      Math.sqrt(Math.max(0, r * r - ((k - reach) * step) ** 2)),
    );
    // Raw half-width by setback d from the tip; nothing exists beyond the tip.
    const raw = (i) => (i < 0 ? -Infinity : capWidthAt(end * (L / 2 - i * step)));
    const eroded = new Map();
    for (let i = -reach; i <= count + reach; i++) {
      let w = Infinity;
      for (let k = 0; k <= 2 * reach; k++) w = Math.min(w, raw(i + k - reach) - arc[k]);
      eroded.set(i, w);
    }
    const widths = [];
    for (let i = 0; i <= count; i++) {
      let w = 0;
      for (let k = 0; k <= 2 * reach; k++) {
        const e = eroded.get(i + k - reach);
        if (e >= 0) w = Math.max(w, e + arc[k]);
      }
      widths.push(Math.min(raw(i), Math.max(w, i ? widths[i - 1] : 0)));
    }
    const width = (d) => {
      const u = Math.max(0, d / step),
        i = Math.min(count - 1, Math.floor(u)),
        v = Math.min(1, u - i);
      return widths[i] + (widths[i + 1] - widths[i]) * v;
    };
    const full = widths.findIndex((w) => w >= widths[count] - 0.002);
    const setback = (x) => {
      if (x >= widths[full]) return full * step;
      let i = 0;
      while (widths[i + 1] < x) i++;
      return (i + (x - widths[i]) / Math.max(1e-9, widths[i + 1] - widths[i])) * step;
    };
    // Stations at equal steps along the rounded outline, from the tip to the end of the corner.
    const span = (end > 0 ? noseRound : tailRound) + 1.3 * r;
    const lengths = [0];
    for (let i = 1; i <= count; i++)
      lengths.push(lengths[i - 1] + Math.hypot(step, widths[i] - widths[i - 1]));
    const total = lengths[Math.min(count, Math.round(span / step))];
    const stations = [];
    for (let j = 0, i = 0; j <= 14; j++) {
      while (i < count && lengths[i] < (total * j) / 14) i++;
      stations.push(end * (L / 2 - i * step));
    }
    return { depth, width, setback, stations };
  });
  const widthAt = (z) => {
    const profile = endProfiles[z > 0 ? 1 : 0];
    const d = L / 2 - Math.abs(z);
    return profile && d < profile.depth ? profile.width(d) : capWidthAt(z);
  };
  const fenderRise = (z) => {
    if (!f.fenderCrown || (z >= rb && z <= cowl)) return 0;
    const fade = Math.min(1, Math.abs(z > cowl ? z - cowl : z - rb) / 0.3);
    return (
      f.fenderCrown *
      fade *
      Math.max(...[axleFront, axleRear].map((a) => Math.max(0, 1 - ((z - a) / (arch * 2.2)) ** 2)))
    );
  };
  // The hood rolls over toward its leading edge instead of falling in one straight plane.
  const hoodCurve = f.hoodCurve ?? (boxy ? 1.15 : 1.45);
  // beltDip (m) drops the window line under the door mirror at the front of the front door
  // glass (vans), over beltDipRun (m) behind the A pillar's foot, stepping back up behind it.
  const beltDip = f.beltDip ?? 0,
    dipEnd = cowl - (f.windshieldWrap ?? (boxy ? 0.02 : 0.07)) - (f.beltDipRun ?? 0.3),
    dipRamp = beltDip * 1.2;
  // beltKink (0-1) gathers that share of beltRise into a kick-up over the beltKinkRun (m) ahead
  // of beltKinkAt (z/L; default the blind quarter's dloEnd, else 0.2 m ahead of the rear
  // header), a hockey-stick window line; the total rise and the rear glass base stay put.
  const beltKink = Math.min(1, Math.max(0, f.beltKink ?? 0)),
    kinkRun = f.beltKinkRun ?? 0.14,
    kinkZ = Math.max(
      rb + kinkRun + 0.02,
      L * (f.beltKinkAt ?? f.dloEnd ?? (rr + 0.2) / L) + kinkRun,
    );
  const riseAt = (z) => {
    const lin = (cowl - z) / (cowl - rb);
    if (!(beltKink > 0)) return lin;
    const k = Math.max(0, Math.min(1, (kinkZ - z) / kinkRun));
    return (1 - beltKink) * lin + beltKink * k * k * (3 - 2 * k);
  };
  const beltLine = (z) =>
    (z > cowl ? belt : z < rb ? belt + beltRise : belt + beltRise * riseAt(z)) -
    (beltDip > 0 && z <= cowl
      ? beltDip * Math.max(0, Math.min(1, (z - dipEnd + dipRamp) / dipRamp))
      : 0);
  // hoodDrop (m) sets the hood and fender tops that far below the belt at the cowl, stepping
  // down at the scuttle and rising to the fitted hood edge (a clamshell bonnet). ducktail (m)
  // dips a trunk lid or fastback deck that far ahead of its lip, so the lip kicks up to the
  // fitted tail height.
  const hoodDrop = f.hoodDrop ?? 0,
    ducktail = f.ducktail ?? 0;
  // rearGlassBase (y/H) stands a hatch or SUV's tailgate glass lower than the side glass's
  // rear belt (belt + beltRise): the D pillars keep that height down to the glass base (rb),
  // and the tailgate behind it starts from the lower glass foot (CR-V, Pilot).
  const glassFootY =
      f.rearGlassBase !== undefined && !pickup
        ? Math.min(belt + beltRise, H * f.rearGlassBase)
        : belt + beltRise,
    glassDrop = belt + beltRise - glassFootY > 0.005;
  // cabRake (m, pickups) carries the cab's back down and rearward below its glass as a sloping
  // sail to rail height that far behind rb, where the bed then starts (Rivian).
  const cabRake = pickup ? Math.max(0, f.cabRake ?? 0) : 0,
    cabBack = rb - cabRake;
  const railAt = (z) =>
    bedRail !== undefined && z <= cabBack - 0.06
      ? bedRail
      : bedRail !== undefined
        ? belt + beltRise
        : glassFootY +
          ((deckEnd - glassFootY) * (rb - z)) / (rb + L / 2) -
          (ducktail * Math.pow((rb - z) / (rb + L / 2), 3) * ((z + L / 2) / (rb + L / 2))) / 0.105;
  const beltAt = (z) =>
    (z > cowl
      ? belt -
        hoodDrop +
        (H * f.nose - belt + hoodDrop) * Math.pow((z - cowl) / (L / 2 - cowl), hoodCurve)
      : z < rb
        ? cabRake > 0 && z >= cabBack - 0.06
          ? railAt(cabBack - 0.07) +
            (belt + beltRise - railAt(cabBack - 0.07)) *
              Math.max(0, Math.min(1, (z - cabBack) / cabRake))
          : railAt(z)
        : beltLine(z)) + fenderRise(z);
  // The hood's rear centre (and with it the windshield base) can stand above the belt line,
  // as on most trucks and many SUVs; the lift fades out toward the hood's leading edge.
  const cowlRise = f.cowlRise ?? 0;
  // It includes the cowl itself, where the hood's rear edge meets the windshield's foot.
  const cowlLift = (z) =>
    z >= cowl ? cowlRise * Math.max(0, 1 - ((z - cowl) / (L / 2 - cowl)) ** 2) : 0;
  // Body section from sill to belt, as width fractions by height t between the sill and the
  // belt: the rocker tucks under (tuck) over the lowest tenth, the door stands as one nearly
  // upright panel out to a crisp shoulder crease (crease, t), the widest line of the body, and
  // above it the shoulder rolls in (shoulder) to the belt, where the glass stands inboard. Toward
  // the tail the shoulder rolls in further (rearShoulder), so a tailgate or deck narrows toward
  // its top instead of standing as a full-width slab. The arch region keeps the same heights.
  const tuck = f.tuck ?? (boxy ? 0.035 : 0.05),
    shoulder = f.shoulder ?? (boxy ? 0.03 : 0.08),
    crease = Math.min(0.9, Math.max(0.3, f.crease ?? (boxy ? 0.8 : 0.75))),
    rearShoulder =
      f.rearShoulder ?? (boxy || pickup ? 0 : sedanLike ? 0.03 : style === 'van' ? 0.04 : 0.06);
  const shoulderAt = (z) =>
    shoulder +
    (z < axleRear
      ? rearShoulder * Math.pow(Math.min(1, (axleRear - z) / (axleRear + L / 2)), 1.5)
      : 0);
  const sectionKnots = [
    [0, 1 - tuck],
    [0.1, 1 - tuck * 0.4],
    [crease, 1],
    [crease + (1 - crease) * 0.45, 0.65],
    [1, 0],
  ];
  // doorCrease (m; + a ridge, - a scoop) runs a second character line along the doors between
  // the arches, rising from doorCreaseRise[0] (t) behind the front arch to doorCreaseRise[1]
  // ahead of the rear one and fading out toward both (Prius, Swift; Supra's door scoop).
  const doorCrease = f.doorCrease ?? 0,
    [creaseFront, creaseRear] = f.doorCreaseRise ?? [0.3, 0.55],
    doorSpan = (z) =>
      Math.max(0, Math.min(1, (axleFront - arch - z) / (axleFront - axleRear - 2 * arch))),
    doorRow = (z) =>
      Math.min(
        crease - 0.05,
        Math.max(0.15, creaseFront + (creaseRear - creaseFront) * doorSpan(z)),
      ),
    doorDepth = (z) =>
      z < axleFront - arch && z > axleRear + arch
        ? doorCrease * (1 - Math.pow(2 * doorSpan(z) - 1, 4))
        : 0;
  const knotsAt = (z) => {
    if (!doorCrease) return sectionKnots;
    const [t0, k0] = sectionKnots[1],
      [t1, k1] = sectionKnots[2],
      t = doorRow(z);
    return [
      sectionKnots[0],
      sectionKnots[1],
      [t, k0 + ((k1 - k0) * (t - t0)) / (t1 - t0) + doorDepth(z) / Math.max(0.3, widthAt(z))],
      ...sectionKnots.slice(2),
    ];
  };
  const sectionAt = (z, y) => {
    const t = Math.max(0, Math.min(1, (y - clearance) / (beltAt(z) - clearance)));
    // Above the crease the knot values give the fraction of the shoulder roll still to come.
    const roll = (k) => 1 - shoulderAt(z) + shoulderAt(z) * k;
    const knots = knotsAt(z);
    for (let i = 1; i < knots.length; i++) {
      const [t0, k0] = knots[i - 1],
        [t1, k1] = knots[i];
      const a = t0 > crease - 1e-9 ? roll(k0) : k0,
        b = t1 > crease + 1e-9 ? roll(k1) : k1;
      if (t <= t1) return a + ((b - a) * (t - t0)) / (t1 - t0);
    }
    return 1 - shoulderAt(z);
  };
  const sideX = (z, y) => widthAt(z) * sectionAt(z, y);
  // Half-width of the body's top edge (the shoulder line the hood, deck and sills start from).
  const topX = (z) => widthAt(z) * (1 - shoulderAt(z));
  // The side glass stands inboard of that shoulder: glassBase (/W) is the half-width of the
  // window sill and windshield base, so a shoulder shows beside the greenhouse from above and
  // behind (real cars: about 0.41-0.44; vans and trucks with flush glass about 0.45).
  const sill = Math.min(
    W *
      (f.glassBase ??
        (boxy || f.cargoVan ? 0.452 : style === 'van' || style === 'city' ? 0.44 : 0.43)),
    // Never outboard of the shoulder edge along the cabin (a narrow waist).
    ...Array.from({ length: 9 }, (_, i) => {
      const z0 = Math.max(rb, axleRear);
      return topX(z0 + ((cowl - z0) * i) / 8) - 0.006;
    }),
  );
  // Hood and deck section across the half-width u (0 centre .. 1 the shoulder edge): a flat,
  // crowned panel (hoodSculpt, m at the centre) out to a crisp edge at hoodEdge (u) beside the
  // fender tops, which stand fenderPeak (m; deckPeak at the rear deck's haunches) proud of the
  // panel's edge and then roll down into the shoulder, so the hood dips between the fenders.
  const hoodEdge = Math.min(0.9, Math.max(0.5, f.hoodEdge ?? (boxy ? 0.84 : 0.78))),
    ridge = hoodEdge + (1 - hoodEdge) * 0.45,
    deckKnots = [
      // u, fraction of the centre crown, fraction of the fender peak
      [0, 1, 0],
      [hoodEdge * 0.45, 0.94, 0],
      [hoodEdge, 0.7, 0],
      [ridge, 0.7, 1],
      [ridge + (1 - ridge) * 0.55, 0.4, 0.6],
      [1, 0, 0],
    ],
    // hoodDome (m) raises a flat power dome hoodDomeWidth (u) wide down the hood's centre with
    // crisp edges, full height at the cowl and gone a hand before the leading edge (trucks).
    hoodDome = f.hoodDome ?? 0,
    domeWidth = Math.min(hoodEdge - 0.08, f.hoodDomeWidth ?? 0.42),
    domeKnots = hoodDome > 0 ? [domeWidth, domeWidth + 0.06] : [],
    deckFractions = [...deckKnots.map(([u]) => u), ...domeKnots]
      .sort((a, b) => a - b)
      .flatMap((u) => (u ? [-u, u] : [0]))
      .sort((a, b) => a - b);
  // By default the ridge only just stands proud of the hood's edge and stays below its centre.
  const fenderPeak = f.fenderPeak ?? (boxy ? 0 : Math.min(0.012, 0.3 * (f.hoodSculpt ?? 0.045))),
    deckPeak = f.deckPeak ?? 0;
  const domeAt = (z, a) =>
    hoodDome > 0 && z > cowl
      ? hoodDome *
        Math.max(0, Math.min(1, (domeWidth + 0.06 - a) / 0.06)) *
        Math.max(0, Math.min(1, (L / 2 - 0.12 - z) / (0.35 * (L / 2 - cowl))))
      : 0;
  // Height of the hood or deck skin above beltAt(z) at fraction u of its half-width.
  const deckLift = (z, u) => {
    const a = Math.min(1, Math.abs(u));
    let i = 1;
    while (i < deckKnots.length - 1 && deckKnots[i][0] < a) i++;
    const [u0, c0, p0] = deckKnots[i - 1],
      [u1, c1, p1] = deckKnots[i],
      k = (a - u0) / (u1 - u0);
    const peak = z > cowl ? fenderPeak : z < rb ? deckPeak : 0;
    return (
      (c0 + (c1 - c0) * k) * ((f.hoodSculpt ?? 0.045) - fenderRise(z) + cowlLift(z)) +
      (p0 + (p1 - p0) * k) * peak +
      domeAt(z, a)
    );
  };
  const bottomAt = (z) =>
    Math.max(
      clearance,
      ...[axleFront, axleRear].map((a) =>
        Math.abs(z - a) < arch ? R + archRise(z - a) : clearance,
      ),
    );
  const stations = new Set([
    -L / 2,
    -L * 0.42,
    -L * 0.32,
    rb,
    rr,
    0,
    rf,
    cowl,
    L * 0.32,
    L * 0.42,
    L / 2,
  ]);
  for (const end of [-1, 1])
    if (endProfiles[end > 0 ? 1 : 0])
      for (const z of endProfiles[end > 0 ? 1 : 0].stations) stations.add(z);
    else
      for (let i = 0; i <= 8; i++)
        stations.add(end * (L / 2 - ((end > 0 ? noseRound : tailRound) * i) / 8));
  for (const a of [axleFront, axleRear]) {
    for (let i = 0; i <= 20; i++) stations.add(a - arch + (2 * arch * i) / 20);
    // The arch ends at hub height, then drops to the sill. Sample both sides of that
    // discontinuity so interpolation cannot cut a long triangular opening in a door.
    for (const end of [-1, 1])
      for (const offset of [-0.0001, 0.0001]) stations.add(a + end * arch + offset);
  }
  // A level bed rail steps from the cab's belt at the bed's front wall.
  if (bedRail !== undefined)
    for (const offset of [0, 0.0001]) stations.add(cabBack - 0.06 + offset);
  if (cabRake > 0) for (const k of [0, 0.5, 1]) stations.add(cabBack + cabRake * k);
  // A dropped hood or a window dip steps at the scuttle; the dip and a ducktail need their own
  // stations to keep their shape.
  if (hoodDrop || beltDip) stations.add(cowl + 0.0001);
  if (glassDrop) stations.add(rb - 0.0001);
  if (beltDip) for (const z of [dipEnd - dipRamp, dipEnd]) stations.add(z);
  if (beltKink) for (const k of [0, 0.25, 0.5, 0.75, 1]) stations.add(kinkZ - kinkRun * k);
  if (ducktail)
    for (const s of [0.25, 0.5, 0.62, 0.75, 0.86, 0.94]) stations.add(rb - s * (rb + L / 2));
  // The tail is drawn with extra rows from where it starts to lean (behind the rear arch): its
  // tumble-under, lean and rolled deck lip (tailLip, m radius) need more than the side's knots.
  const tailStart = axleRear - arch - 0.02,
    tailLip = f.tailLip ?? (boxy ? 0.02 : sedanLike ? 0.06 : 0.045);
  stations.add(tailStart);
  // Likewise the nose ahead of the front arch carries extra rows for its lean and chin.
  const noseStart = axleFront + arch + 0.02;
  stations.add(noseStart);
  const zs = [...stations].filter((z) => z >= -L / 2 && z <= L / 2).sort((a, b) => a - b);
  // A pickup bed is about 0.55 m deep below its rails, not a well down to the sills.
  const bedFloor = Math.max(clearance + 0.3, belt - 0.56);
  // Side panel rows: the section knots, at the same heights along the whole side (rows below an
  // arch top collapse onto the opening), so the shoulder crease runs on unbroken over the arches.
  // Added tail rows include every knot and lie on the straight section between them, so the
  // strips stay watertight where they meet the side's rows at tailStart, which the end lean does
  // not move.
  const rows = sectionKnots.map(([t]) => t);
  // Side rows at z: the knots there (a door crease's row moves with z).
  const sideRows = (z) => knotsAt(z).map(([t]) => t);
  const noseRows = (z) =>
    [...new Set([...sideRows(z), 0.2, 0.3, 0.4, 0.5, 0.6])].sort((a, b) => a - b);
  const rowsAt = (z) => {
    if (z >= noseStart - 1e-6) return noseRows(z);
    if (z > tailStart + 1e-6) return sideRows(z);
    const span = Math.max(0.2, beltAt(z) - bottomAt(z)),
      lip = Math.min(tailLip, span * 0.2);
    return [
      ...new Set([
        ...rows,
        0.22,
        0.36,
        0.5,
        0.62,
        ...[1, 0.55, 0.2].map((k) => 1 - (lip * k) / span),
      ]),
    ].sort((a, b) => a - b);
  };
  const sidePoint = (side, z, row) => {
    const y = Math.max(bottomAt(z), clearance + (beltAt(z) - clearance) * row);
    return [side * sideX(z, y), y, z];
  };
  // A black glass panel (rearPanel, m) continues the rear glass down the tailgate, as on cars
  // whose hatch glass runs below the side windows or carries a dark lower pane (Volt, smart).
  const rearPanel = f.rearPanel ?? 0,
    panelLow = glassFootY - rearPanel;
  // Height of a hood or rear deck's base line: a rear deck below a lowered tailgate glass
  // starts at the glass foot right at rb (the side panel steps there).
  const deckBase = (z) => (glassDrop && z === rb ? beltAt(rb - 1e-9) : beltAt(z));
  const inRearPanel = (quad) => {
    if (!(rearPanel > 0)) return false;
    const c = [0, 1, 2].map((i) => quad.reduce((sum, p) => sum + p[i], 0) / quad.length);
    const half = W * ((f.rearGlassWidth ?? sill / W) - 0.05);
    return c[2] < rb - 0.005 && c[1] > panelLow && Math.abs(c[0]) < half;
  };
  // Black body cladding: flare (m) is the radial width of broad arch flares standing flareDepth
  // (m) proud of the panel (flareTop, m, over the crown; flareShape squares the outer edge like
  // archShape); rocker (m) the height of the lower-door band; bumperTrim (m, or [front, rear])
  // the height of black lower bumpers above the sill.
  const flare = f.flare ?? 0,
    flareTop = f.flareTop ?? flare,
    flareShape = f.flareShape ?? archPower,
    flareDepth = f.flareDepth ?? Math.min(0.05, Math.max(0.015, flare * 0.3)),
    rocker = f.rocker ?? 0,
    bumperTrim = Array.isArray(f.bumperTrim)
      ? f.bumperTrim
      : [f.bumperTrim ?? 0, f.bumperTrim ?? 0];
  // bumperFinish ('black', 'chrome' or 'body'; or [front, rear]) is the finish of those bumpers;
  // bumperIntake (m, or [front, rear]) keeps a black band that high at the foot of a chrome or
  // body-colour bumper (a cutaway's chrome bar over its black valance, a van's lower intake).
  const bumperFinish = Array.isArray(f.bumperFinish)
      ? f.bumperFinish
      : [f.bumperFinish ?? 'black', f.bumperFinish ?? 'black'],
    bumperIntake = Array.isArray(f.bumperIntake)
      ? f.bumperIntake
      : [f.bumperIntake ?? 0, f.bumperIntake ?? 0];
  // 'grey' is unpainted textured plastic (van and work-truck bumpers, rockers).
  const greyTrim = [f.bumperFinish, f.rockerFinish].flat().includes('grey')
    ? mat('textured-trim', '#50575b', 0.04, 0.85)
    : black;
  const trimMaterial = (finish) =>
    ({ chrome: polished, body: paint, grey: greyTrim })[finish] ?? black;
  const bumperMaterial = (i) => trimMaterial(bumperFinish[i]);
  // The skin spans heights base..height above the sill, in the given material; a proud skin
  // (m) stands off the panel as a separate bar with a rounded face (fullest at mid-height, so a
  // chrome bar catches sky above and ground below), closed along its top, foot and ends.
  function skin(side, from, to, height, material = black, base = 0, proud = 0) {
    const cuts = [from, ...zs.filter((z) => z > from && z < to), to];
    const point = (
      z,
      k,
      off = proud ? 0.004 + proud * (0.5 + 0.5 * Math.sin(Math.PI * k)) : 0.004,
    ) => {
      const low = bottomAt(z),
        top = Math.max(0, Math.min(height, beltAt(z) - low - 0.05)),
        foot = Math.min(top, base),
        y = low + (base > 0 ? foot + (top - foot) * k : top * k),
        h = 0.002,
        slope = (sideX(z + h, y) - sideX(z - h, y)) / (2 * h),
        n = Math.hypot(1, slope);
      // Offset along the outward plan normal, so the skin also clears the ends.
      return [side * (sideX(z, y) + off / n), y, z - (slope * off) / n];
    };
    // Rows at most 0.2 m apart, so a tall skin follows the leaning fascia instead of cutting
    // its chord under the body panel.
    const rows = Math.max(proud > 0 ? 4 : 2, Math.ceil((height - base) / 0.2 - 1e-9));
    for (let i = 1; i < cuts.length; i++)
      for (const [k0, k1] of Array.from({ length: rows }, (_, j) => [j / rows, (j + 1) / rows]))
        face(
          details,
          [point(cuts[i - 1], k0), point(cuts[i], k0), point(cuts[i], k1), point(cuts[i - 1], k1)],
          material,
          [side, 0, 0],
        );
    if (proud > 0) {
      for (let i = 1; i < cuts.length; i++)
        for (const [k, up] of [
          [1, 1],
          [0, -1],
        ])
          face(
            details,
            [
              point(cuts[i - 1], k, 0.004),
              point(cuts[i], k, 0.004),
              point(cuts[i], k),
              point(cuts[i - 1], k),
            ],
            material,
            [0, up, 0],
          );
      for (const [z, out] of [
        [from, -1],
        [to, 1],
      ])
        face(
          details,
          [point(z, 0, 0.004), point(z, 1, 0.004), point(z, 1), point(z, 0)],
          material,
          [0, 0, out],
        );
    }
  }
  // A black bumper is one skin; a chrome or body-colour one stands on its black intake band,
  // and a chrome bar stands 3 cm proud of the fascia. bumperWrap (m, or [front, rear]) is how
  // far the bumper runs along the side past the plan corner (default: a chrome bar 0.12 m, so
  // it stops short of the arch as a step bumper does; others reach the arch).
  const bumperWrap = Array.isArray(f.bumperWrap) ? f.bumperWrap : [f.bumperWrap, f.bumperWrap];
  const bumper = (side, i, start, stop) => {
    const wrap = bumperWrap[i] ?? (bumperFinish[i] === 'chrome' ? 0.12 : undefined),
      corner = i === 0 ? noseRound + 1.3 * (f.noseCorner ?? 0) : tailRound + 1.3 * tailCorner,
      from = wrap !== undefined && i === 0 ? Math.max(start, L / 2 - corner - wrap) : start,
      to = wrap !== undefined && i === 1 ? Math.min(stop, -L / 2 + corner + wrap) : stop;
    const intake = bumperFinish[i] === 'black' ? 0 : Math.min(bumperIntake[i], bumperTrim[i]);
    if (intake > 0) skin(side, from, to, intake);
    if (intake < bumperTrim[i])
      skin(
        side,
        from,
        to,
        bumperTrim[i],
        bumperMaterial(i),
        intake,
        bumperFinish[i] === 'chrome' ? 0.03 : 0,
      );
  };
  for (const side of [-1, 1]) {
    for (let i = 1; i < zs.length; i++) {
      const a = zs[i - 1],
        b = zs[i],
        // A strip takes one row set at both its stations: the tail's, the nose's or the side's.
        rowsA = b <= tailStart + 1e-6 || a >= noseStart - 1e-6 ? rowsAt(a) : sideRows(a),
        rowsB = b <= tailStart + 1e-6 || a >= noseStart - 1e-6 ? rowsAt(b) : sideRows(b);
      for (let j = 1; j < rowsB.length; j++) {
        const quad = [
          sidePoint(side, a, rowsA[j - 1]),
          sidePoint(side, b, rowsB[j - 1]),
          sidePoint(side, b, rowsB[j]),
          sidePoint(side, a, rowsA[j]),
        ];
        face(shell, quad, inRearPanel(quad) ? black : paint, [side, 0, 0]);
      }
    }
    // Arch lips follow a real opening; there is no painted side panel behind the tires.
    for (const a of [axleFront, axleRear]) {
      const arc = [];
      for (let i = 0; i <= 24; i++) {
        const angle = (i * Math.PI) / 24,
          c = Math.cos(angle),
          z = a + Math.sign(c) * Math.pow(Math.abs(c), 2 / archPower) * arch;
        const y = R + archRise(z - a);
        const p = [side * (sideX(z, y) + 0.006), y, z];
        arc.push(p);
        if (i)
          face(
            shell,
            [
              arc[i - 1],
              p,
              [side * (track / 2 - tireW * 0.6), p[1], p[2]],
              [side * (track / 2 - tireW * 0.6), arc[i - 1][1], arc[i - 1][2]],
            ],
            black,
            [0, -1, 0],
          );
      }
      if (flare > 0) {
        // Broad flare: a black band around the opening, standing flareDepth proud at the lip
        // and meeting the panel flush at its outer edge, with legs down to the sill. It is
        // flare wide at the legs and flareTop over the crown; flareShape squares its outer edge.
        const outer = arc.map((_, i) => {
          const c = Math.cos((i * Math.PI) / 24),
            z = a + Math.sign(c) * Math.pow(Math.abs(c), 2 / flareShape) * (arch + flare),
            y = R + (arch + flareTop) * Math.pow(Math.max(0, 1 - c * c), 1 / flareShape);
          return [side * (sideX(z, y) + 0.004), y, z];
        });
        const proud = arc.map((p) => [p[0] + side * flareDepth, p[1], p[2]]);
        const low = clearance + 0.01,
          leg = (p, offset) => [side * (sideX(p[2], low) + offset), low, p[2]];
        const lip = [leg(arc[0], 0.006), ...arc, leg(arc[24], 0.006)],
          rim = [
            leg(arc[0], 0.006 + flareDepth * 0.6),
            ...proud,
            leg(arc[24], 0.006 + flareDepth * 0.6),
          ],
          edge = [leg(outer[0], 0.004), ...outer, leg(outer[24], 0.004)];
        // flareFinish 'body' paints them (Bronco Outer Banks, H3); default black plastic.
        const flareMaterial = f.flareFinish === 'body' ? paint : black;
        for (let i = 1; i < lip.length; i++) {
          face(details, [rim[i - 1], rim[i], edge[i], edge[i - 1]], flareMaterial, [side, 0, 0]);
          face(details, [lip[i - 1], lip[i], rim[i], rim[i - 1]], flareMaterial, [side, -1, 0]);
        }
      } else path(details, arc, f.cladding ? 0.035 : 0.016, f.cladding ? black : paint);
    }
    // Lower-door cladding (rocker, in rockerFinish: black, grey, chrome or body) and lower
    // bumpers: a skin just proud of the body that follows its section and plan outline around
    // the ends. rockerStrip ('chrome' or 'black') runs a slim bright strip along the lower doors
    // at the rocker's top edge (or 0.12 m above the sill without one).
    const doorFrom = axleRear + arch + flare * 0.5,
      doorTo = axleFront - arch - flare * 0.5;
    if (rocker > 0) skin(side, doorFrom, doorTo, rocker, trimMaterial(f.rockerFinish));
    if (f.rockerStrip && f.rockerStrip !== 'none') {
      const y = rocker > 0 ? rocker : 0.12;
      skin(side, doorFrom, doorTo, y + 0.013, trimMaterial(f.rockerStrip), y - 0.013, 0.006);
    }
    // sideSteps: running boards ('board', a flat step on brackets) or tube steps ('tube', a
    // bent rail with step pads) between the arches below the sill, in sideStepFinish (black or
    // chrome).
    if (f.sideSteps && f.sideSteps !== 'none') {
      const z0 = axleRear + arch + 0.06,
        z1 = axleFront - arch - 0.06,
        zc = (z0 + z1) / 2,
        inner = sideX(zc, clearance) - 0.03,
        outer = Math.max(inner + 0.12, track / 2 + tireW * 0.42),
        y = clearance - 0.07,
        finish = f.sideStepFinish === 'chrome' ? polished : black;
      if (f.sideSteps === 'tube') {
        const x = side * (outer - 0.035);
        path(
          details,
          [
            [side * inner, y + 0.05, z0 - 0.02],
            [x, y, z0 + 0.12],
            [x, y, z1 - 0.12],
            [side * inner, y + 0.05, z1 + 0.02],
          ],
          0.034,
          finish,
        );
        for (const z of [z0 + 0.25, zc, z1 - 0.25])
          details.box([0.075, 0.016, 0.2], [x, y + 0.033, z], black);
      } else {
        details.box([outer - inner, 0.045, z1 - z0], [(side * (inner + outer)) / 2, y, zc], black);
        path(
          details,
          [
            [side * outer, y + 0.012, z0 + 0.02],
            [side * outer, y + 0.012, z1 - 0.02],
          ],
          0.016,
          finish,
        );
      }
      for (const z of [z0 + 0.2, zc, z1 - 0.2])
        details.box([0.1, 0.07, 0.05], [side * (inner - 0.03), y + 0.04, z], black);
    }
    if (bumperTrim[0] > 0) bumper(side, 0, axleFront + arch, L / 2);
    if (bumperTrim[1] > 0) bumper(side, 1, -L / 2, axleRear - arch);
    details.box(
      [0.035, 0.06, WB - arch * 2],
      [
        side * (sideX((axleFront + axleRear) / 2, clearance + 0.045) - 0.012),
        clearance + 0.045,
        (axleFront + axleRear) / 2,
      ],
      f.cladding ? black : paint,
    );
  }
  // Bonnet and deck skins: a crowned panel between crisp edges and the fender tops (deckLift).
  function deck(a, b, isBed = false) {
    const cuts = [...new Set([a, ...zs.filter((z) => z > a && z < b), b])],
      fractions = deckFractions;
    for (let j = 1; j < cuts.length; j++)
      for (let k = 1; k < fractions.length; k++) {
        const point = (z, x) => [
          x * topX(z),
          isBed ? bedFloor - 0.02 : deckBase(z) + deckLift(z, x),
          z,
        ];
        const quad = [
          point(cuts[j - 1], fractions[k - 1]),
          point(cuts[j - 1], fractions[k]),
          point(cuts[j], fractions[k]),
          point(cuts[j], fractions[k - 1]),
        ];
        face(shell, quad, isBed || inRearPanel(quad) ? black : paint, [0, 1, 0]);
      }
  }
  deck(cowl, L / 2);
  if (cabRake > 0) {
    // The raked cab back is a painted sail down to the bed's front.
    deck(cabBack, rb);
    deck(-L / 2, cabBack, true);
  } else deck(-L / 2, rb, pickup);
  cabin.box([W * 0.87, 0.035, cowl - rb], [0, clearance + 0.02, (cowl + rb) / 2], black);
  for (const end of [-1, 1]) {
    const z = end * (L / 2 - 0.015),
      w = endWidth(end),
      y = clearance + 0.11,
      b = end > 0 ? 0 : 1;
    // The low strip takes a chrome or body-colour bumper's finish unless its intake band covers it.
    const strip =
      bumperFinish[b] !== 'black' && bumperTrim[b] > 0 && bumperIntake[b] < 0.16
        ? bumperMaterial(b)
        : f.cladding || pickup
          ? black
          : paint;
    if (!endProfiles[end > 0 ? 1 : 0])
      (end > 0 ? front : rear).box([w * 1.65, 0.1, 0.07], [0, y, z], strip);
    // On a rounded corner the strip follows the tucked lower panel, not the full-width outline.
    else
      for (let i = 0; i < 22; i++) {
        const x = w * 0.825 * ((i + 0.5) / 11 - 1);
        (end > 0 ? front : rear).box(
          [(w * 1.65) / 22, 0.1, 0.07],
          [x, y, z + end * (endOffset(x, end) - endOffset(x, end, y))],
          strip,
        );
      }
  }
  if (clearance > 0.18) {
    // A raised body shows what it stands on: an undertray, and on body-on-frame trucks the rails,
    // crossmembers and the live rear axle with its differential, instead of sky under the sills.
    cabin.box([W * 0.58, 0.03, L * 0.86], [0, clearance + 0.005, 0], black);
    if (pickup || rugged) {
      for (const side of [-1, 1])
        details.box(
          [0.075, 0.17, L * 0.84],
          [side * W * 0.26, clearance - 0.07, (axleFront + axleRear) / 2 - L * 0.02],
          black,
        );
      for (const z of [axleFront - 0.45, axleRear + 0.55, -L / 2 + 0.35])
        details.box([W * 0.52, 0.08, 0.08], [0, clearance - 0.08, z], black);
      const hub = track / 2 - tireW * 0.55;
      details.rod([-hub, R, axleRear], [hub, R, axleRear], 0.045, black);
      const diff = details.add(new T.SphereGeometry(0.13, 10, 6), black, [0.04, R, axleRear]);
      diff.scale.set(1, 0.85, 0.9);
      details.rod([0.04, R, axleRear + 0.1], [0, clearance - 0.06, axleRear + 1.1], 0.035, black);
    }
  }
  if (pickup) {
    const floorY = bedFloor;
    // Cab and bed are separate bodies: the bed's front wall stands a hand's width behind the
    // cab back, and its inner walls and rail caps follow the outer rail line (form.deck).
    const bedFront = cabBack - 0.06,
      tailZ = -L / 2 + 0.06,
      railY = (z) => beltAt(z) + 0.006,
      // Inner walls stand 4 cm inside the body's top edge, so a rounded or waisted tail (SSR)
      // never shows them through its quarters.
      wallX = (z) => Math.min(W * 0.43, topX(z) - 0.04);
    const bedCuts = [tailZ, ...zs.filter((z) => z > tailZ && z < cabBack), cabBack];
    for (let x = -W * 0.37; x <= W * 0.38; x += 0.12)
      if (Math.abs(x) < wallX(tailZ) - 0.02)
        details.box(
          [0.018, 0.018, bedFront + L / 2 - 0.12],
          [x, floorY, (-L / 2 + bedFront) / 2],
          black,
        );
    for (const side of [-1, 1]) {
      for (let i = 1; i < bedCuts.length; i++) {
        const a = bedCuts[i - 1],
          b = bedCuts[i],
          c = Math.min(b, bedFront);
        if (a < bedFront)
          face(
            shell,
            [
              [side * wallX(a), floorY, a],
              [side * wallX(c), floorY, c],
              [side * wallX(c), railY(c), c],
              [side * wallX(a), railY(a), a],
            ],
            paint,
            [-side, 0, 0],
          );
        face(
          details,
          [
            [side * (wallX(a) - 0.005), railY(a), a],
            [side * (wallX(b) - 0.005), railY(b), b],
            [side * (topX(b) + 0.004), railY(b), b],
            [side * (topX(a) + 0.004), railY(a), a],
          ],
          black,
          [0, 1, 0],
        );
      }
      // Bed wheel tubs and tiedown eyes.
      details.box([0.24, 0.18, 0.8], [side * W * 0.38, floorY + 0.08, axleRear], black);
      for (const z of [bedFront - 0.15, -L / 2 + 0.22])
        details.ring(0.026, 0.006, [side * W * 0.41, beltAt(z) - 0.13, z], chrome, 'x');
    }
    // tonneau: a body-colour hard cover over the bed at rail height (SSR).
    if (f.tonneau) {
      const cuts = [...bedCuts.filter((z) => z < bedFront), bedFront],
        lid = (z, u) => [u * (wallX(z) + 0.02), railY(z) + 0.012 + 0.02 * (1 - u * u), z];
      for (let i = 1; i < cuts.length; i++)
        for (const [u0, u1] of [
          [-1, -0.5],
          [-0.5, 0],
          [0, 0.5],
          [0.5, 1],
        ])
          face(
            details,
            [lid(cuts[i - 1], u0), lid(cuts[i - 1], u1), lid(cuts[i], u1), lid(cuts[i], u0)],
            paint,
            [0, 1, 0],
          );
    }
    // Cab back and bed front wall.
    for (const z of [cabBack, bedFront])
      face(
        shell,
        [
          [-wallX(z), floorY, z],
          [wallX(z), floorY, z],
          [wallX(z), railY(z), z],
          [-wallX(z), railY(z), z],
        ],
        paint,
        [0, 0, -1],
      );
    rear.box([0.2, 0.035, 0.03], [0, deckEnd - 0.2, -L / 2 - 0.025], black);
    // Cab and bed are separate pressings: a dark shut line divides them from sill to rail.
    const gapZ = cabBack - 0.05,
      low = bottomAt(gapZ) + 0.02,
      top = beltAt(gapZ) - 0.02;
    for (const side of [-1, 1])
      path(
        details,
        rows.map((row) => {
          const y = low + (top - low) * row;
          return [side * (sideX(gapZ, y) + 0.004), y, gapZ];
        }),
        0.008,
        black,
      );
  }
  // Compound roof crown and bowed glazing keep modern silhouettes without texture shading.
  const roofSections = [
    0,
    ...(roofDropRear > roofDrop ? [0.07] : []),
    0.15,
    ...(roofDropRear > roofDrop ? [0.25] : []),
    0.35,
    0.5,
    0.65,
    0.85,
    1,
  ]
    .map((t) => rr + (rf - rr) * t)
    // Keep the header station itself (rr + (rf - rr) * 1 can miss rf by a rounding error, which
    // dropped it and opened a slot between the windshield header and the cap: Transit).
    .map((z) => (Math.abs(z - rf) < 1e-9 ? rf : z))
    .filter((z) => !capRun || z < rf - capRun || z === rf)
    .concat(capRun ? [1, 0.75, 0.5, 0.32, 0.18, 0.07].map((s) => rf - capRun * s) : [])
    .sort((a, b) => a - b);
  const across = [-1, -0.75, -0.4, 0, 0.4, 0.75, 1];
  const roofPoint = (z, u) => [u * roofWAt(z), roofEdge(z) + roofCrown * (1 - u * u), z];
  for (let i = 1; !f.openTop && i < roofSections.length; i++) {
    for (let j = 1; j < across.length; j++)
      face(
        shell,
        [
          roofPoint(roofSections[i - 1], across[j - 1]),
          roofPoint(roofSections[i - 1], across[j]),
          roofPoint(roofSections[i], across[j]),
          roofPoint(roofSections[i], across[j - 1]),
        ],
        f.blackRoof ? black : f.roofGlass ? roofGlass : roofPaint,
        [0, 1, 0],
      );
  }
  for (const z of f.openTop ? [] : [rf, rr])
    path(
      details,
      across.map((u) => roofPoint(z, u)),
      0.024,
      f.blackRoof ? black : roofPaint,
    );
  // Bowed windshield and backlight: each pane bulges along its normal, so its foot stands
  // steeper and its head runs into the roof. Pillars and side glass share the same edge.
  const rearGlassWidth = f.rearGlassWidth ?? Math.min(sill, topX(rb) - 0.006) / W;
  // A pane's foot follows the hood or deck section it stands on (deckLift), easing to the belt
  // at its corners so the side glass sills meet it.
  const footLift = (z, width) => {
    const k = Math.min(1, width / topX(z));
    return (u) => deckLift(z, u * k) - deckLift(z, k) * u * u;
  };
  const screens = {
    front: {
      zBase: cowl,
      zTop: rf,
      baseY: belt,
      topY: frontGlassY,
      width: sill,
      topWidth: roofW,
      bow: f.windshieldBow ?? (boxy ? 0.012 : 0.035),
      wrap: f.windshieldWrap ?? (boxy ? 0.02 : 0.07),
      lift: footLift(cowl, sill),
    },
    rear: {
      zBase: rb,
      zTop: rr,
      baseY: glassFootY,
      topY: rearY,
      // rearGlassWidth (half-width / W at the base) narrows a tumblehome tailgate glass, so
      // broad D pillars show from behind.
      width: W * rearGlassWidth,
      topWidth: roofWAt(rr),
      bow: f.rearBow ?? (boxy ? 0 : sedanLike ? 0.05 : 0.025),
      wrap: f.rearWrap ?? (boxy ? 0 : 0.045),
      lift: pickup ? () => 0 : footLift(rb, W * rearGlassWidth),
    },
  };
  // Panes also wrap in plan view: the base corners sit back from the centre line, so the
  // pillar foot is behind the cowl, while the head meets the straight roof header.
  const screenPoint = ({ zBase, zTop, baseY, topY, width, topWidth, bow, wrap, lift }, t, u) => {
    const dz = zTop - zBase,
      dy = topY - baseY,
      length = Math.hypot(dz, dy) || 1,
      bulge = bow * 4 * t * (1 - t);
    return [
      u * (width * (1 - t) + topWidth * t),
      baseY +
        dy * t +
        lift(u) * (1 - t) +
        roofCrown * t * (1 - u * u) +
        (Math.abs(dz) / length) * bulge,
      zBase +
        dz * t +
        ((Math.sign(-dz) * dy) / length) * bulge +
        Math.sign(dz) * wrap * u * u * (1 - t),
    ];
  };
  const screenSteps = [0, 0.2, 0.4, 0.6, 0.8, 1];
  // lid (0-1) paints the pane's lower part as a body-colour panel: a mid-engine car's engine
  // cover behind the cabin (engineLid, a fraction of the backlight from its base).
  function windscreen(screen, normal, lid = 0) {
    const point = (t, u) => screenPoint(screen, t, u);
    const steps = [
      ...new Set([0, 0.2, 0.4, 0.6, 0.8, 1, ...(lid > 0 && lid < 1 ? [lid] : [])]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < steps.length; i++)
      for (let j = 1; j < across.length; j++)
        face(
          steps[i] <= lid ? shell : windows,
          [
            point(steps[i - 1], across[j - 1]),
            point(steps[i - 1], across[j]),
            point(steps[i], across[j]),
            point(steps[i], across[j - 1]),
          ],
          steps[i] <= lid ? paint : glass,
          normal,
        );
    if (lid > 0 && lid < 1)
      path(
        details,
        across.map((u) => point(lid, u)),
        0.016,
        black,
      );
    path(
      details,
      across.map((u) => point(0, u)),
      0.024,
      black,
    );
  }
  windscreen(screens.front, [0, 1, 1]);
  if (f.windshieldTop !== undefined) {
    const header = (u) => [u * roofW, frontGlassY + roofCrown * (1 - u * u), rf];
    for (let i = 1; !capRun && !f.openTop && i < across.length; i++)
      face(
        shell,
        [
          header(across[i - 1]),
          header(across[i]),
          roofPoint(rf, across[i]),
          roofPoint(rf, across[i - 1]),
        ],
        paint,
        [0, 0, 1],
      );
    path(details, across.map(header), 0.022, black);
  }
  if (f.openTop) {
    // An open car's windshield stands in a real frame: a black header of box section along the
    // pane's top edge (the A pillars carry the body colour), not a thin hoop over the cabin.
    const frame = across.map((u) => {
      const top = screenPoint(screens.front, 1, u),
        below = screenPoint(screens.front, 0.86, u),
        dy = top[1] - below[1],
        dz = top[2] - below[2],
        run = Math.hypot(dy, dz) || 1,
        up = [0, dy / run, dz / run],
        out = [0, -dz / run, dy / run];
      const at = (p, a, b) => p.map((v, k) => v + up[k] * a + out[k] * b);
      return [
        at(below, 0, 0.007),
        at(top, 0.045, 0.007),
        at(top, 0.045, -0.032),
        at(below, 0, -0.025),
      ];
    });
    for (let j = 1; j < across.length; j++)
      for (let k = 1; k < 4; k++)
        face(
          details,
          [frame[j - 1][k - 1], frame[j][k - 1], frame[j][k], frame[j - 1][k]],
          black,
          k === 1 ? [0, 0.4, 1] : k === 2 ? [0, 1, 0] : [0, -0.4, -1],
        );
    for (const j of [0, across.length - 1])
      face(details, frame[j], black, [Math.sign(across[j]), 0, 0]);
  }
  if (!f.openTop && !f.cargoVan) windscreen(screens.rear, [0, 1, -1], f.engineLid ?? 0);
  // Close the wedge between the straight hood (or deck) edge and the wrapped pane foot.
  for (const [screen, edgeZ, material, normal] of [
    [screens.front, cowl, black, [0, 1, 0]],
    ...(!f.openTop && !f.cargoVan ? [[screens.rear, rb, paint, [0, 1, 0]]] : []),
  ])
    if (screen.wrap)
      for (let j = 1; j < across.length; j++) {
        const a = screenPoint(screen, 0, across[j - 1]),
          b = screenPoint(screen, 0, across[j]),
          // The wedge starts on the hood (deck) skin's own edge.
          edge = (p) => [p[0], deckBase(edgeZ) + deckLift(edgeZ, p[0] / topX(edgeZ)), edgeZ];
        face(shell, [edge(a), edge(b), b, a], material, normal);
      }
  if (f.openTop) {
    // An actual open passenger cell: folded fabric, rear bulkhead and two roll hoops.
    const deckY = beltLine(rb);
    cabin.box([W * 0.84, 0.24, 0.05], [0, deckY - 0.1, rb + 0.04], black);
    details.box([W * 0.7, 0.065, 0.2], [0, deckY + 0.035, rb - 0.12], black);
    for (const x of [-W * 0.23, W * 0.23])
      path(
        details,
        [
          [x - 0.13, deckY, rb + 0.08],
          [x - 0.13, H - 0.21, rb + 0.08],
          [x + 0.13, H - 0.21, rb + 0.08],
          [x + 0.13, deckY, rb + 0.08],
        ],
        0.025,
        chrome,
      );
  }
  const bz = f.bPillar !== undefined ? L * f.bPillar : pickup ? -L * 0.02 : -L * 0.06;
  // Rear doors end over the rear wheel, wherever the rear glass is: an SUV or hatchback carries a
  // quarter window and a C pillar behind them. Two-door cars have one long door, not a door
  // reaching back to the rear screen.
  const rearShut =
    f.rearDoor !== undefined
      ? L * f.rearDoor
      : pickup || sedanLike
        ? rb + 0.18
        : Math.max(rb + 0.18, axleRear - arch * 0.3);
  const coupeShut = Math.max(rb + 0.2, cowl - (f.doorLength ?? 1.22));
  // Blind rear quarter / broad C pillar: dloEnd (z/L) ends the side glass at the belt and
  // dloEndTop (z/L) at the roof edge (default: parallel to the rear glass); dloEndBulge (m) bows
  // that edge rearward into a D-shaped window.
  const blindQuarter =
    f.dloEnd !== undefined && !f.cargoVan && !f.openTop
      ? {
          end: Math.max(rb + 0.05, L * f.dloEnd),
          top: Math.min(
            rf - 0.1,
            Math.max(
              rr + 0.03,
              f.dloEndTop !== undefined ? L * f.dloEndTop : L * f.dloEnd + rr - rb,
            ),
          ),
          bulge: f.dloEndBulge ?? 0,
        }
      : undefined;
  // Half-width of the side glass's lower edge (the window sill) at z: a straight line from the
  // backlight's foot to the windshield's, which pillars, posts and sill ledges stand on.
  const glassX = (z) => {
    const z0 = rb + screens.rear.wrap,
      z1 = cowl - screens.front.wrap,
      k = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
    return screens.rear.width + (sill - screens.rear.width) * k;
  };
  // Window frames and the B pillar carry some visual mass, as the real seals and pillars do.
  // frameRadius (m) thins them for frameless coupes; frameFinish ('black', 'chrome', 'body')
  // gives the window surround a chrome or body-colour finish.
  const frameRadius = f.frameRadius ?? 0.028,
    frameMaterial = { chrome, body: paint }[f.frameFinish] ?? black;
  for (const side of [-1, 1]) {
    const aPillar = screenSteps.map((t) => screenPoint(screens.front, t, side));
    const cPillar = screenSteps.map((t) => screenPoint(screens.rear, t, side));
    const points = [
      aPillar[0],
      [side * roofW, roofY, rf],
      [side * roofWAt(rr), rearY, rr],
      cPillar[0],
    ];
    // Side glass stops dloDrop below the roof edge on bodies with a painted band or drip rail
    // above the windows (vans, off-roaders); the pillars above that line are painted.
    const dloDrop = f.dloDrop ?? 0;
    // dloFall (m) lowers the glass top line further toward the rear, from the B pillar to the
    // rear header, so the side glass narrows into a pointed quarter (Prius, Supra, Saab); the
    // band above it is painted like dloDrop's.
    const dloFall = f.dloFall ?? 0,
      dropAt = (z) =>
        dloDrop + dloFall * Math.pow(Math.max(0, Math.min(1, (bz - z) / (bz - rr))), 1.5),
      dropped = dloDrop > 0 || dloFall > 0;
    const clipPillar = (pillar, limitY) => {
      const k = pillar.findIndex((p) => p[1] > limitY);
      if (k <= 0) return { below: pillar.slice(0, -1), above: [], cut: undefined };
      const a = pillar[k - 1],
        b = pillar[k],
        t = (limitY - a[1]) / (b[1] - a[1]),
        cut = a.map((v, i) => v + (b[i] - v) * t);
      return { below: pillar.slice(0, k), above: pillar.slice(k), cut };
    };
    const frontClip = clipPillar(aPillar, roofEdge(rf) - dropAt(rf)),
      rearClip = clipPillar(cPillar, roofEdge(rr) - dropAt(rr));
    // The glass's lower edge from the rear forward to the A pillar's foot: up a beltKink and
    // down a beltDip notch under the mirror.
    const glassEnd = blindQuarter ? blindQuarter.end : rb + screens.rear.wrap;
    const sillPoints = [
      ...(beltKink > 0 ? [1, 0.75, 0.5, 0.25, 0].map((k) => kinkZ - kinkRun * k) : []),
      ...(beltDip > 0 ? [dipEnd - dipRamp, dipEnd, aPillar[0][2]] : []),
    ]
      .filter((z) => z > glassEnd + 0.005 && z <= aPillar[0][2])
      .map((z) => [side * glassX(z), beltLine(z), z]);
    const windowOutline = dropped
      ? [
          ...frontClip.below,
          frontClip.cut,
          ...roofSections.toReversed().map((z) => [side * roofWAt(z), roofEdge(z) - dropAt(z), z]),
          rearClip.cut,
          ...rearClip.below.toReversed(),
        ].filter(Boolean)
      : [
          ...aPillar.slice(0, -1),
          ...roofSections.toReversed().map((z) => [side * roofWAt(z), roofEdge(z), z]),
          ...cPillar.slice(0, -1).toReversed(),
        ];
    const fullOutline = [...windowOutline, ...sillPoints];
    // Side glass in its frame. dloSplit (z/L at the belt, or a list) stands a body-colour pillar
    // dloSplitWidth (m) wide across it, its top dloSplitRake (m) further back: the FJ's thick C
    // pillar ahead of its wraparound quarter, a 911's quarter window behind the door glass.
    const splits = f.dloSplit === undefined ? [] : [f.dloSplit].flat();
    function sideGlass(outline) {
      // Clip the outline (in side view, z and y) to the side of the line through (z0, y0) and
      // (z1, y1) where keep(sign) holds.
      const clip = (poly, [z0, y0], [z1, y1], keep) => {
        const s = (p) => (z1 - z0) * (p[1] - y0) - (y1 - y0) * (p[2] - z0);
        const out = [];
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i],
            b = poly[(i + 1) % poly.length],
            sa = s(a),
            sb = s(b);
          if (keep(sa)) out.push(a);
          if (keep(sa) !== keep(sb)) out.push(a.map((v, k) => v + ((b[k] - v) * sa) / (sa - sb)));
        }
        return out;
      };
      const yLow = Math.min(...outline.map((p) => p[1])) - 0.05,
        yHigh = Math.max(...outline.map((p) => p[1])) + 0.05;
      const cut = (z) => {
        const rake = (f.dloSplitRake ?? 0) / Math.max(0.1, yHigh - yLow);
        return [
          [z, yLow],
          [z - rake * (yHigh - yLow), yHigh],
        ];
      };
      let pieces = [outline];
      for (const at of splits) {
        const half = (f.dloSplitWidth ?? 0.12) / 2,
          [a0, a1] = cut(L * at + half),
          [b0, b1] = cut(L * at - half);
        const next = [];
        for (const poly of pieces) {
          // Ahead of the pillar, behind it, and the pillar itself (painted, just outboard).
          next.push(clip(poly, a0, a1, (v) => v < 0));
          next.push(clip(poly, b0, b1, (v) => v > 0));
          const pillar = clip(
            clip(poly, a0, a1, (v) => v >= 0),
            b0,
            b1,
            (v) => v <= 0,
          );
          if (pillar.length > 2)
            face(
              shell,
              pillar.map(([x, y, z]) => [x + side * 0.004, y, z]),
              f.blackPillar ? black : paint,
              [side, 0, 0],
            );
        }
        pieces = next.filter((poly) => poly.length > 2);
      }
      for (const poly of pieces) {
        face(windows, poly, glass, [side, 0, 0]);
        path(details, [...poly, poly[0]], frameRadius, frameMaterial);
      }
    }
    if (dropped && !f.openTop && !f.cargoVan) {
      for (let i = 1; i < roofSections.length; i++) {
        const a = roofSections[i - 1],
          b = roofSections[i];
        face(
          shell,
          [
            [side * roofWAt(a), roofEdge(a) - dropAt(a), a],
            [side * roofWAt(b), roofEdge(b) - dropAt(b), b],
            [side * roofWAt(b), roofEdge(b), b],
            [side * roofWAt(a), roofEdge(a), a],
          ],
          f.blackPillar || f.blackRoof ? black : roofPaint,
          [side, 0, 0],
        );
      }
      for (const [clip, z] of [
        [frontClip, rf],
        [rearClip, rr],
      ])
        if (clip.cut)
          face(
            shell,
            [clip.cut, ...clip.above, [side * roofWAt(z), roofEdge(z) - dropAt(z), z]],
            f.blackPillar || f.blackRoof ? black : roofPaint,
            [side, 0, 0],
          );
      // alpine (count): small glazed lights in that band over the rear seats (Defender).
      for (let i = 0; i < (f.alpine ?? 0); i++) {
        const span = (Math.min(bz, rf) - rr - 0.1) / f.alpine,
          z1 = Math.min(bz, rf) - 0.06 - span * i,
          z0 = z1 - span + 0.07;
        const at = (z, k) => {
          const d = dropAt(z);
          return [side * (roofWAt(z) + 0.004), roofEdge(z) - d + 0.03 + (d - 0.055) * k, z];
        };
        const pane = [at(z0, 0), at(z1, 0), at(z1, 1), at(z0, 1)];
        if (dropAt(z0) > 0.09) {
          face(windows, pane, glass, [side, 0, 0]);
          path(details, [...pane, pane[0]], 0.014, black);
        }
      }
    }
    if (f.cargoVan) {
      const splitBottom = [side * glassX(bz), beltLine(bz), bz];
      const splitTop = [side * roofWAt(bz), frontGlassY, bz];
      const frontTop = aPillar.at(-1);
      face(windows, [...aPillar, splitTop, splitBottom, ...sillPoints], glass, [side, 0, 0]);
      const capCuts = [rf, ...roofSections.filter((z) => z < rf && z > bz).toReversed(), bz];
      const sillAt = (z) => frontTop.map((v, i) => v + ((splitTop[i] - v) * (z - rf)) / (bz - rf));
      for (let i = 1; i < capCuts.length; i++) {
        const a = capCuts[i - 1],
          b = capCuts[i];
        face(
          shell,
          [
            sillAt(a),
            sillAt(b),
            [side * roofWAt(b), roofEdge(b), b],
            [side * roofWAt(a), roofEdge(a), a],
          ],
          paint,
          [side, 0, 0],
        );
      }
      // The cargo side starts at the B pillar's full height, so no slot opens above the cab door.
      // Vertical strips (not one fan of slivers) keep its flat shading even.
      const cargoCuts = [bz, ...roofSections.filter((z) => z < bz).toReversed()];
      const lowAt = (z) =>
        splitBottom.map((v, i) => v + ((points[3][i] - v) * (z - bz)) / (points[3][2] - bz));
      for (let i = 1; i < cargoCuts.length; i++) {
        const a = cargoCuts[i - 1],
          b = cargoCuts[i];
        face(
          shell,
          [
            lowAt(a),
            lowAt(b),
            [side * roofWAt(b), roofEdge(b), b],
            [side * roofWAt(a), roofEdge(a), a],
          ],
          paint,
          [side, 0, 0],
        );
      }
      face(shell, [lowAt(rr), points[3], [side * roofWAt(rr), rearY, rr]], paint, [side, 0, 0]);
      path(details, [...aPillar, splitTop, splitBottom, ...sillPoints, aPillar[0]], 0.024, black);
      const insetX = side * (glassX(bz) - 0.002);
      for (const y of [belt + 0.18, roofY - 0.2])
        details.rod([insetX, y, rb + 0.18], [insetX, y, bz - 0.18], 0.008, paint);
    } else if (!f.openTop && blindQuarter) {
      // The side glass ends at dloEnd (at the belt) / dloEndTop (at the roof edge) along a
      // straight or D-shaped edge; body colour fills the quarter from there to the rear glass.
      const foot = cPillar[0];
      const edge = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
        const z =
            blindQuarter.end +
            (blindQuarter.top - blindQuarter.end) * t -
            blindQuarter.bulge * 4 * t * (1 - t),
          low = [side * glassX(z), beltLine(z), z],
          top = [side * roofWAt(z), roofEdge(z) - dropAt(z), z];
        return low.map((v, i) => (i === 2 ? z : v + (top[i] - v) * t));
      });
      const glassOutline = [
        ...windowOutline.filter((p) => p[2] > blindQuarter.top + 0.01),
        ...edge.toReversed(),
        ...sillPoints,
      ];
      sideGlass(glassOutline);
      const pillarTop = dropped
        ? [rearClip.cut, ...rearClip.below.toReversed()]
        : cPillar.toReversed();
      face(
        shell,
        [
          foot,
          ...edge,
          ...roofSections
            .filter((z) => z < blindQuarter.top - 0.01 && z > rr + 0.01)
            .toReversed()
            .map((z) => [side * roofWAt(z), roofEdge(z) - dropAt(z), z]),
          ...pillarTop.filter(Boolean).slice(0, -1),
        ],
        f.blackPillar ? black : paint,
        [side, 0, 0],
      );
    } else if (!f.openTop) {
      sideGlass(fullOutline);
    } else details.rod(points[0], points[3], 0.024, black);
    // ventWindow: true divides a quarter vent from the front door glass with a post; 'sail' fills
    // that corner with the black mirror sail most vans and trucks carry instead.
    if (f.ventWindow && !f.openTop) {
      const foot = aPillar[0],
        sail = f.ventWindow === 'sail',
        back = foot[2] - (sail ? 0.22 : 0.3),
        low = [side * glassX(back), beltLine(back), back];
      if (sail) {
        const up = screenPoint(screens.front, Math.min(0.6, 0.22 / (frontGlassY - belt)), side);
        face(
          details,
          [foot, low, up].map(([x, y, z]) => [x + side * 0.006, y, z]),
          black,
          [side, 0, 0],
        );
      } else {
        // The post stands upright to the A pillar, or to the window top behind a raked one.
        const t = (foot[2] - back) / (foot[2] - rf);
        details.rod(
          low,
          t < 1
            ? screenPoint(screens.front, t, side)
            : [side * roofWAt(back), roofEdge(back) - dropAt(back), back],
          frameRadius * 0.8,
          black,
        );
      }
    }
    // The A pillar takes the body colour, or black with blackPillar / blackRoof (two-tone roofs
    // carry it down the pillars); aPillar ('body', 'black', 'roof') overrides.
    path(
      details,
      aPillar,
      rugged ? 0.045 : 0.04,
      { black, roof: roofPaint, body: paint }[
        f.aPillar ?? (f.blackPillar || f.blackRoof ? 'black' : 'body')
      ] ?? paint,
    );
    const quarterWidth = pickup ? 0.1 : raggedQuarter();
    function raggedQuarter() {
      return rugged ? 0.12 : s.bodyStyle === 'sedan' || s.bodyStyle === 'coupe' ? 0.25 : 0.18;
    }
    if (!f.openTop && !blindQuarter)
      face(
        shell,
        [
          [points[3][0], beltLine(rb + quarterWidth), rb + quarterWidth],
          ...cPillar,
          [points[2][0], roofEdge(rr + quarterWidth * 0.45), rr + quarterWidth * 0.45],
        ],
        f.blackPillar ? black : paint,
        [side, 0, 0],
      );
    // Below a lowered tailgate glass the D pillar ends in a body-colour face at rb, from the
    // glass foot up to the belt, between the glass edge and the shoulder.
    if (glassDrop && !f.openTop && !f.cargoVan)
      face(
        shell,
        [
          [side * W * rearGlassWidth, glassFootY, rb + 0.002],
          [side * topX(rb), glassFootY, rb + 0.002],
          [side * topX(rb), beltLine(rb), rb + 0.002],
          [side * W * rearGlassWidth, beltLine(rb), rb + 0.002],
        ],
        f.blackPillar ? black : paint,
        [0, 0, -1],
      );
    // Follow the waist at every body station, including the narrow centre of a sports car.
    const cabinStations = zs.filter((z) => z >= rb && z <= cowl);
    for (let i = 1; i < cabinStations.length; i++) {
      const a = cabinStations[i - 1],
        b = cabinStations[i];
      // The sill ledge from the shoulder edge in to the glass.
      face(
        shell,
        [
          [side * topX(a), beltLine(a), a],
          [side * topX(b), beltLine(b), b],
          [side * glassX(b), beltLine(b), b],
          [side * glassX(a), beltLine(a), a],
        ],
        paint,
        [0, 1, 0],
      );
      // Door trim, kept inside the rolled shoulder.
      const trimX = (z) =>
        Math.min(widthAt(z) * 0.91 - 0.025, sideX(z, belt - 0.055) - 0.02, glassX(z) - 0.005);
      face(
        cabin,
        [
          [side * trimX(a), clearance + 0.035, a],
          [side * trimX(b), clearance + 0.035, b],
          [side * trimX(b), belt - 0.055, b],
          [side * trimX(a), belt - 0.055, a],
        ],
        black,
        [-side, 0, 0],
      );
    }
    if (!f.openTop)
      path(
        details,
        roofSections.map((z) => [side * roofWAt(z), roofEdge(z) - 0.015, z]),
        0.025,
        f.blackRoof ? black : roofPaint,
      );
    if (!f.openTop)
      details.rod(
        [side * glassX(bz), beltLine(bz), bz],
        [side * roofWAt(bz), f.cargoVan ? frontGlassY : roofEdge(bz) - dropAt(bz), bz],
        f.cargoVan ? 0.039 : 0.046,
        f.safetyCell ? chrome : black,
      );
    if (
      !f.openTop &&
      !pickup &&
      !['sedan', 'coupe', 'fastback'].includes(s.bodyStyle) &&
      !(blindQuarter && rr + 0.08 < blindQuarter.top)
    )
      details.rod(
        [side * glassX(rr + 0.08), beltLine(rr + 0.08), rr + 0.08],
        [side * roofWAt(rr + 0.08), roofEdge(rr + 0.08) - dropAt(rr + 0.08), rr + 0.08],
        0.028,
        f.blackPillar ? black : paint,
      );
    const twoDoor = f.twoDoor || (f.asymmetricDoors && side > 0);
    if (
      !f.openTop &&
      !f.cargoVan &&
      !twoDoor &&
      rearShut - rr > 0.3 &&
      !(blindQuarter && rearShut < blindQuarter.end + 0.05)
    )
      details.rod(
        [side * glassX(rearShut), beltLine(rearShut), rearShut],
        [side * roofWAt(rearShut), roofEdge(rearShut) - dropAt(rearShut), rearShut],
        0.034,
        f.blackPillar ? black : paint,
      );
    // tridion ('black', 'silver'; true = black): the safety cell's sweep behind the door, a
    // contrast band tridionWidth (m) wide from the sill up to the belt (smart; pair it with
    // blackRoof, blackPillar and a rocker for the roof frame and the sill).
    if (f.tridion) {
      const back = (twoDoor ? coupeShut : rearShut) - 0.01;
      skin(side, back - (f.tridionWidth ?? 0.18), back, 2, f.tridion === 'silver' ? chrome : black);
    }
    // Door shuts follow the side skin; handles and fuel flap stand only millimetres proud.
    for (const z of twoDoor ? [coupeShut, cowl - 0.05] : [rearShut, bz, cowl - 0.05]) {
      const low = Math.max(clearance + 0.13, bottomAt(z) + 0.035),
        top = beltAt(z) - 0.035;
      path(
        details,
        rows.map((row) => {
          const y = low + (top - low) * row;
          return [side * (sideX(z, y) + 0.004), y, z];
        }),
        0.0035,
        black,
      );
    }
    for (const z of twoDoor
      ? [coupeShut + 0.12]
      : f.cargoVan
        ? [bz + 0.13]
        : [bz + 0.13, rearShut + 0.15]) {
      const y = beltAt(z) - 0.105,
        x = side * (sideX(z, y) + 0.006);
      details.box([0.025, 0.028, 0.135], [x, y, z], f.flushHandles ? black : paint);
      if (!f.flushHandles) details.box([0.008, 0.012, 0.08], [x + side * 0.017, y, z], chrome);
    }
    // Door mirror: a rounded housing, wider than it is deep, on a short arm from the sail at
    // the door's front upper corner, behind the A-pillar foot; glass to the rear, a repeater
    // on the leading face. mirrorScale sizes it (pickups 1.3 by default; vans about 1.5; 0
    // leaves it off where a cab draws its own); above 1.2 trucks get a taller rounded head and
    // vans a tall black box with rectangular glass.
    const mk = f.mirrorScale ?? (pickup ? 1.3 : 1),
      vanHead = mk > 1.2 && (style === 'van' || style === 'cargo-van'),
      mt = vanHead ? 1.4 : mk > 1.2 && boxy ? 1.2 : 1;
    if (mk > 0) {
      const mz = cowl - (f.windshieldWrap ?? (boxy ? 0.02 : 0.07)) - 0.2,
        my = belt + 0.09 + 0.055 * (mk * mt - 1) * 0.8,
        mx = side * (sideX(mz, belt - 0.02) + 0.08 * mk);
      details.rod(
        [side * (sideX(mz, belt - 0.02) - 0.01), belt + 0.01, mz + 0.04],
        [mx - side * 0.045 * mk, my - 0.012 * mk * mt, mz],
        0.016 * Math.sqrt(mk),
        black,
      );
      const housing = details.add(
        vanHead
          ? new T.BoxGeometry(2, 2, 1).translate(0, 0, 0.5)
          : new T.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2),
        vanHead ? black : paint,
        [mx, my, mz],
      );
      housing.scale.set(0.08 * mk, 0.055 * mk * mt, 0.065 * mk);
      const mirrorGlass = details.add(
        (vanHead ? new T.PlaneGeometry(2, 2) : new T.CircleGeometry(1, 14)).rotateY(Math.PI),
        chrome,
        [mx, my, mz - 0.002],
      );
      mirrorGlass.scale.set(0.073 * mk, 0.048 * mk * mt, 1);
      details.box(
        [0.05 * mk, 0.011, 0.012],
        [mx + side * 0.03 * mk, my - 0.03 * mk * mt, mz + 0.045 * mk],
        light,
      );
    }
    if (f.rails && (f.railStyle ?? 'flush') === 'flush') {
      // Factory rails sit low and continuous along the roof edge on a solid foot, with tapered
      // end caps; railStyle 'raised' keeps the bar-on-posts rack of rugged trims.
      const u = 0.88,
        lift = 0.032,
        surface = (z) => roofEdge(z) + roofCrown * (1 - u * u),
        cuts = [
          rr + 0.06,
          rr + 0.16,
          ...roofSections.filter((z) => z > rr + 0.2 && z < rf - 0.16),
          rf - 0.12,
          rf - 0.04,
        ];
      const top = cuts.map((z, i) => [
        side * roofWAt(z) * u,
        surface(z) + (i === 0 || i === cuts.length - 1 ? lift * 0.25 : lift),
        z,
      ]);
      path(details, top, 0.014, f.blackRails ? black : chrome);
      for (let i = 1; i < cuts.length; i++)
        face(
          details,
          [
            [side * roofWAt(cuts[i - 1]) * u, surface(cuts[i - 1]), cuts[i - 1]],
            [side * roofWAt(cuts[i]) * u, surface(cuts[i]), cuts[i]],
            top[i],
            top[i - 1],
          ],
          black,
          [side, 0, 0],
        );
    } else if (f.rails && f.railStyle === 'feet') {
      // railStyle 'feet': low factory rails standing clear of the roof on three feet, so a gap
      // shows under the bar (not the tall rack of 'raised').
      const u = 0.86,
        lift = 0.055,
        surface = (z) => roofEdge(z) + roofCrown * (1 - u * u),
        za = rr + 0.08,
        zb = rf - 0.06,
        cuts = [
          za,
          za + 0.12,
          ...roofSections.filter((z) => z > za + 0.16 && z < zb - 0.16),
          zb - 0.12,
          zb,
        ],
        top = cuts.map((z, i) => [
          side * roofWAt(z) * u,
          surface(z) + (i === 0 || i === cuts.length - 1 ? lift * 0.3 : lift),
          z,
        ]);
      path(details, top, 0.013, f.blackRails ? black : chrome);
      for (const z of [za + 0.06, (za + zb) / 2, zb - 0.06])
        details.box([0.024, lift, 0.075], [side * roofWAt(z) * u, surface(z) + lift / 2, z], black);
    } else if (f.rails) {
      path(
        details,
        [
          [side * roofWAt(rr + 0.08) * 0.9, roofY + 0.05, rr + 0.08],
          [side * roofWAt(rr + 0.23) * 0.9, roofTop + 0.055, rr + 0.23],
          [side * roofWAt(rf - 0.1) * 0.9, roofTop + 0.055, rf - 0.1],
        ],
        0.022,
        chrome,
      );
      for (const z of [rr + 0.23, rf - 0.1])
        details.rod(
          [side * roofWAt(z) * 0.9, roofEdge(z) + roofCrown * 0.19, z],
          [side * roofWAt(z) * 0.9, roofTop + 0.055, z],
          0.018,
          black,
        );
    }
    if (f.slidingDoors) {
      const a = f.cargoVan ? rb : rearShut - 0.05,
        b = f.cargoVan ? bz - 0.2 : rb + 0.1;
      details.rod(
        [side * (sideX(a, beltAt(a) - 0.1) + 0.006), beltAt(a) - 0.1, a],
        [side * (sideX(b, beltAt(b) - 0.1) + 0.006), beltAt(b) - 0.1, b],
        0.009,
        black,
      );
    }
    if (rugged)
      for (const z of [bz + 0.06, cowl - 0.1])
        for (const y of [belt - 0.15, belt - 0.4])
          details.box([0.035, 0.04, 0.09], [side * (sideX(z, y) + 0.012), y, z], paint);
    // Side intake: at sideIntakeZ (z/L; default just ahead of the rear glass base),
    // sideIntakeDrop (m) below the belt, e.g. a door scoop or a sail vent.
    if (f.sideIntakes) {
      const z = f.sideIntakeZ !== undefined ? L * f.sideIntakeZ : rb - 0.1,
        y = beltAt(z) - (f.sideIntakeDrop ?? 0.16),
        x = side * (sideX(z, y) - 0.002);
      details.box([0.015, 0.2, 0.36], [x, y, z], black);
      for (let i = 0; i < 4; i++)
        details.box([0.024, 0.012, 0.3], [x + side * 0.01, y - 0.07 + i * 0.045, z], chrome);
    }
    if (f.sideCladding) {
      const z = (axleFront + axleRear) / 2,
        y = clearance + 0.16;
      details.box([0.018, 0.18, WB - arch * 1.6], [side * (sideX(z, y) + 0.004), y, z], black);
    }
    if (f.safetyCell) path(details, [points[3], points[2], points[1]], 0.055, chrome);
  }
  if (f.cargoVan) {
    face(
      shell,
      [
        [-W * rearGlassWidth, belt, rb],
        [-roofWAt(rr), rearY, rr],
        [roofWAt(rr), rearY, rr],
        [W * rearGlassWidth, belt, rb],
      ],
      paint,
      [0, 0, -1],
    );
    const partitionZ = bz - 0.16;
    cabin.box(
      [W * 0.84, roofY - clearance - 0.08, 0.03],
      [0, (roofY + clearance) / 2, partitionZ],
      black,
    );
    for (let i = -4; i <= 4; i++)
      cabin.box(
        [0.025, 0.018, partitionZ - rb - 0.08],
        [i * W * 0.085, clearance + 0.05, (partitionZ + rb) / 2],
        chrome,
      );
    path(
      details,
      [
        [0, clearance + 0.15, -L / 2 - 0.025],
        [0, belt, rb - 0.01],
        [0, rearY, rr - 0.01],
      ],
      0.004,
      black,
    );
    for (const side of [-1, 1])
      rear.box([0.1, 0.025, 0.03], [side * 0.12, belt * 0.8, -L / 2 - 0.035], black);
  }
  {
    const z = axleRear - 0.3,
      y = beltAt(z) - 0.22;
    details.box([0.012, 0.13, 0.16], [sideX(z, y) + 0.002, y, z], paint);
  }
  // Windscreen wipers are attached to the sloping pane.
  for (const x of [-W * 0.21, W * 0.21]) {
    const dz = 0.08,
      y =
        screenPoint(screens.front, dz / (cowl - rf), 0)[1] - roofCrown * (dz / (cowl - rf)) + 0.018;
    const mount = new T.Group();
    mount.name = `wiper-mount-${Math.sign(x)}`;
    mount.position.set(x - 0.15, y, cowl - dz);
    mount.rotation.x = -Math.atan2(cowl - rf, roofY - belt);
    root.add(mount);
    const arm = new T.Group();
    arm.name = `wiper-${Math.sign(x)}`;
    mount.add(arm);
    const wd = detailKit(arm, `wiper-skin-${Math.sign(x)}`);
    wd.rod([0, 0, 0.012], [W * 0.19, 0.02, 0.012], 0.008, black);
    wd.rod([W * 0.11, 0.025, 0.015], [W * 0.29, 0.025, 0.015], 0.009, black);
    wd.finish();
  }
  // hoodVents: true a vent either side of the hood, 'centre' one wider vent on its crown.
  if (f.hoodVents)
    for (const x of f.hoodVents === 'centre' ? [0] : [-W * 0.22, W * 0.22]) {
      const z = (cowl + L / 2) / 2,
        y = x
          ? beltAt(z) + 0.04
          : beltAt(z) + (f.hoodSculpt ?? 0.045) - fenderRise(z) + cowlLift(z),
        w = x ? 0.23 : 0.36;
      details.box([w, 0.015, 0.3], [x, y, z], black);
      for (let i = 0; i < 4; i++)
        details.box([w - 0.02, 0.012, 0.016], [x, y + 0.012, z - 0.12 + i * 0.075], chrome);
    }
  // spoiler: a lip on the trailing edge of a trunk lid or fastback deck, a deeper roof-edge
  // spoiler over the glass of a hatch or SUV; 'wing' stands a wing on two stalks.
  if (f.spoiler === 'wing') {
    const z = -L * 0.45,
      y = beltAt(z) + 0.095;
    details.box([W * 0.78, 0.045, 0.16], [0, y, z], paint);
    for (const x of [-W * 0.27, W * 0.27]) details.box([0.03, 0.1, 0.07], [x, y - 0.06, z], black);
  } else if (f.spoiler && sedanLike) {
    // A wedge across the deck's trailing edge that follows the lid's crown and plan taper.
    const deckPoint = (z, u, rise = 0) => [u * topX(z), beltAt(z) + deckLift(z, u) + rise, z];
    const lip = [-0.78, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.78].map((u) => [
      deckPoint(-L / 2 + 0.17, u),
      deckPoint(-L / 2 + 0.035, u, 0.035),
      deckPoint(-L / 2 + 0.035, u),
    ]);
    for (let i = 1; i < lip.length; i++) {
      const [a, b] = [lip[i - 1], lip[i]];
      face(details, [a[0], b[0], b[1], a[1]], paint, [0, 1, -0.3]);
      face(details, [a[1], b[1], b[2], a[2]], paint, [0, 0, -1]);
    }
    for (const [i, x] of [
      [0, -1],
      [lip.length - 1, 1],
    ])
      face(details, lip[i], paint, [x, 0, 0]);
  } else if (!f.openTop && (f.spoiler || (!pickup && s.bodyStyle !== 'sedan'))) {
    // Roof-edge spoiler over a hatch or SUV's glass: it carries the roof's width and crown on
    // past the rear header (narrowing a little) and ends in a thin trailing edge, so it never
    // overhangs a tapered roof; spoiler true makes it deeper.
    const depth = f.spoiler ? 0.17 : 0.07,
      thick = f.spoiler ? 0.035 : 0.022,
      w0 = roofWAt(rr),
      top = (u, k) => [
        u * w0 * (1 - 0.04 * k),
        rearY + roofCrown * (1 - u * u) - 0.002 - (f.spoiler ? 0.012 : 0.016) * k,
        rr + 0.03 - (depth + 0.03) * k,
      ],
      under = (u, k) => {
        const p = top(u, k);
        return [p[0], p[1] - 0.004 - thick * k, p[2]];
      },
      material = f.blackRoof ? black : paint;
    for (let j = 1; j < across.length; j++) {
      const [a, b] = [across[j - 1], across[j]];
      face(details, [top(a, 0), top(b, 0), top(b, 1), top(a, 1)], material, [0, 1, 0]);
      face(details, [under(a, 0), under(b, 0), under(b, 1), under(a, 1)], material, [0, -1, 0]);
      face(details, [top(a, 1), top(b, 1), under(b, 1), under(a, 1)], material, [0, 0, -1]);
    }
    for (const u of [-1, 1])
      face(details, [top(u, 0), top(u, 1), under(u, 1), under(u, 0)], material, [u, 0, 0]);
  }
  // Fascia optics that turn a corner follow the skin itself: the plan outline of the body at
  // their height (sideX), by arc length s from the centre line across the end and on along the
  // side, so lamps stay on the surface however the end is tapered, rounded or rolled under.
  const outlines = new Map();
  const endOutline = (end, y) => {
    const key = `${end}:${y.toFixed(4)}`;
    if (!outlines.has(key)) {
      const reach = (end > 0 ? noseRound : tailRound) + 1.2,
        points = [];
      // Above the top of a tailgate or deck that falls toward the tail, the end at this height
      // is that sloping panel (with its crown), so the outline runs across it.
      const tailTop = beltAt(-L / 2),
        fall = (beltAt(rb) - tailTop) / (rb + L / 2),
        onPanel = end < 0 && !pickup && fall > 0.01 && y > tailTop;
      let arc = 0,
        corner;
      for (let i = 0; i <= 48; i++) {
        let z = end * (L / 2 - reach * (i / 48) ** 2);
        const x = sideX(z, y),
          last = points.at(-1);
        if (onPanel) {
          const flat = Math.min(rb, -L / 2 + (y - tailTop) / fall),
            crown =
              (f.hoodSculpt ?? 0.045) *
              (1 - Math.min(1, (x / Math.max(0.01, widthAt(flat) * (1 - shoulder))) ** 2));
          z = Math.max(z, Math.min(rb, -L / 2 + (y - crown - tailTop) / fall));
        }
        if (last) {
          // The corner is where the outline, out toward the side, turns more along the side
          // than across the end.
          if (corner === undefined && x > W * 0.3 && Math.abs(z - last[2]) > Math.abs(x - last[1]))
            corner = arc;
          arc += Math.hypot(x - last[1], z - last[2]);
        }
        points.push([arc, x, z]);
      }
      outlines.set(key, { points, corner: corner ?? arc });
    }
    return outlines.get(key);
  };
  // Skin point at arc length s and height y (side -1 mirrors it), lifted along the plan normal.
  const skinAt = (end, side, s, y, lift = 0) => {
    const { points } = endOutline(end, y);
    let i = 1;
    while (i < points.length - 1 && points[i][0] < s) i++;
    const [a0, x0, z0] = points[i - 1],
      [a1, x1, z1] = points[i],
      t = Math.min(1, Math.max(0, (s - a0) / (a1 - a0 || 1))),
      run = Math.hypot(x1 - x0, z1 - z0) || 1,
      nx = (-end * (z1 - z0)) / run,
      nz = (end * (x1 - x0)) / run;
    return {
      p: [side * (x0 + (x1 - x0) * t + nx * lift), y, z0 + (z1 - z0) * t + nz * lift],
      n: [side * nx, 0, nz],
    };
  };
  // Arc length where the skin reaches lateral offset x (as seen from ahead or behind) at y;
  // never more than a hand past the corner, where the side runs on nearly parallel.
  const arcAt = (end, x, y) => {
    const { points, corner } = endOutline(end, y),
      limit = corner + 0.08;
    for (let i = 1; i < points.length && points[i - 1][0] < limit; i++) {
      const [a0, x0] = points[i - 1],
        [a1, x1] = points[i];
      if (x1 >= Math.abs(x))
        return Math.min(limit, a0 + ((a1 - a0) * (Math.abs(x) - x0)) / (x1 - x0 || 1));
    }
    return limit;
  };
  // A fitting given in fascia coordinates (x, y, z as for front/rear) moved onto the skin plus
  // `extra`; the result is pre-compensated for the fascia conform, which adds the plan setback.
  const onSkin = (end, x, y, extra) => {
    const { p } = skinAt(end, Math.sign(x) || 1, arcAt(end, x, y), y, extra);
    return [p[0], p[1], p[2] + end * endOffset(p[0], end)];
  };
  // A lamp, bezel or panel on the skin: columns by arc length s0..s1 (one side), each spanning
  // heights low(s)..high(s). Added at the origin, so the fascia conform leaves it unchanged.
  function skinPatch(d, end, side, s0, s1, low, high, lift, material, columns) {
    const count = columns ?? Math.max(4, Math.ceil(Math.abs(s1 - s0) / 0.04));
    const spans = Array.from({ length: count + 1 }, (_, i) => {
      const s = s0 + ((s1 - s0) * i) / count,
        a = low(s);
      return [s, a, Math.max(a, high(s))];
    });
    const rows = Math.max(1, Math.ceil(Math.max(...spans.map(([, a, b]) => b - a)) / 0.07));
    const grid = spans.map(([s, a, b]) =>
      Array.from({ length: rows + 1 }, (_, j) =>
        skinAt(end, side, s, a + ((b - a) * j) / rows, lift),
      ),
    );
    const vertices = [],
      u = new T.Vector3(),
      v = new T.Vector3();
    for (let i = 0; i < count; i++)
      for (let j = 0; j < rows; j++) {
        const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
        for (const [a, b, c] of [
          [q[0], q[1], q[2]],
          [q[0], q[2], q[3]],
        ]) {
          u.fromArray(b.p).sub(v.fromArray(a.p));
          const normal = new T.Vector3().fromArray(c.p).sub(v).cross(u).negate();
          if (normal.lengthSq() < 1e-14) continue;
          const order = normal.dot(v.fromArray(a.n)) < 0 ? [a, c, b] : [a, b, c];
          for (const point of order) vertices.push(...point.p);
        }
      }
    if (!vertices.length) return undefined;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return d.add(geometry, material);
  }
  // Clip the line p + t d (d of unit length) to a convex outline: the [t0, t1] inside, if any.
  const chord = (outline, [px, py], [dx, dy]) => {
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < outline.length; i++) {
      const [ax, ay] = outline[i],
        [bx, by] = outline[(i + 1) % outline.length],
        ex = bx - ax,
        ey = by - ay,
        den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((ax - px) * ey - (ay - py) * ex) / den,
        k = ((ax - px) * dy - (ay - py) * dx) / den;
      if (k < -1e-9 || k > 1 + 1e-9) continue;
      lo = Math.min(lo, t);
      hi = Math.max(hi, t);
    }
    return hi > lo ? [lo, hi] : undefined;
  };
  // A convex fascia opening or panel (outline of [x, y]) on the real skin, `lift` (m) proud of
  // it: columns about 4.5 cm apart and rows about 7 cm, each point set back by the plan outline
  // at its own height, so a wide port costs columns rather than a fan of subdivided triangles
  // and corner ports stay on a rounded or tucked skin.
  function fasciaFace(end, outline, material, lift = 0.021) {
    const xs = outline.map(([x]) => x),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      cols = Math.max(8, Math.ceil((x1 - x0) / 0.045));
    const spans = [];
    for (let i = 0; i <= cols; i++) {
      const x = x0 + ((x1 - x0) * i) / cols,
        c = chord(outline, [Math.min(x1 - 1e-4, Math.max(x0 + 1e-4, x)), 0], [0, 1]);
      if (c) spans.push([x, c[0], c[1]]);
    }
    if (spans.length < 2) return;
    const rows = Math.max(1, Math.ceil(Math.max(...spans.map(([, a, b]) => b - a)) / 0.07)),
      at = ([x, a, b], j) => {
        const y = a + ((b - a) * j) / rows;
        return [x, y, end * (L / 2 - endOffset(x, end, y) + lift)];
      },
      vertices = [];
    for (let i = 1; i < spans.length; i++)
      for (let j = 0; j < rows; j++) {
        const q = [
          at(spans[i - 1], j),
          at(spans[i], j),
          at(spans[i], j + 1),
          at(spans[i - 1], j + 1),
        ];
        for (const k of end > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]) vertices.push(...q[k]);
      }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return (end > 0 ? front : rear).add(geometry, material);
  }
  // Grille and intake infill as low ridges a few millimetres proud of the opening, clipped to
  // its outline and bent round the nose: a diamond mesh, horizontal bars or vertical slats.
  // Flat, so a mesh reads as texture rather than a field of studs at three-quarter views.
  function infill(outline, fill, material, count, depth = 0) {
    const ys = outline.map(([, y]) => y),
      xs = outline.map(([x]) => x),
      height = Math.max(...ys) - Math.min(...ys),
      width = Math.max(...xs) - Math.min(...xs),
      mid = (Math.max(...ys) + Math.min(...ys)) / 2,
      lines = [];
    if (fill === 'mesh' || fill === 'fine') {
      // 'fine' is a tighter mesh of slimmer ridges (about twice the triangles).
      const pitch = fill === 'fine' ? 0.032 : Math.max(0.045, Math.min(0.07, height / 4)),
        slope = 0.55,
        run = Math.hypot(1, slope),
        k = Math.ceil((height / 2 + (slope * width) / 2) / pitch);
      for (const dir of [-1, 1])
        for (let i = -k; i <= k; i++)
          lines.push([
            [0, mid + i * pitch],
            [1 / run, (dir * slope) / run],
            fill === 'fine' ? 0.007 : 0.009,
          ]);
    } else if (fill === 'bars') {
      const n = count ?? 5,
        bar = Math.max(0.018, Math.min(0.06, height / (n * 2.2)));
      for (let i = 0; i < n; i++)
        lines.push([[0, mid - height / 2 + ((i + 0.5) * height) / n], [1, 0], bar]);
    } else if (fill === 'slats') {
      const n = count ?? 17;
      for (let i = 0; i < n; i++)
        lines.push([[Math.min(...xs) + ((i + 0.5) * width) / n, mid], [0, 1], 0.014]);
    }
    const vertices = [];
    for (const [p, d, size] of lines) {
      const span = chord(outline, p, d);
      if (!span || span[1] - span[0] < 0.03) continue;
      const [t0, t1] = [span[0] + 0.01, span[1] - 0.01],
        pieces = Math.ceil((t1 - t0) / 0.1),
        at = (t, side) => {
          const x = p[0] + d[0] * t - (d[1] * side * size) / 2,
            y = p[1] + d[1] * t + (d[0] * side * size) / 2;
          return [x, y, zf + depth + 0.004 + (side ? 0 : 0.006) - endOffset(x, 1, y)];
        };
      for (let i = 0; i < pieces; i++) {
        const a = t0 + ((t1 - t0) * i) / pieces,
          b = t0 + ((t1 - t0) * (i + 1)) / pieces;
        // Bright strips read on the dark opening as they are; dark ones need a ridge to catch light.
        for (const [s0, s1] of material === black
          ? [
              [-1, 0],
              [0, 1],
            ]
          : [[-1, 1]]) {
          const q = [at(a, s0), at(b, s0), at(b, s1), at(a, s1)];
          const n =
            (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
          for (const k of n < 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) vertices.push(...q[k]);
        }
      }
    }
    if (!vertices.length) return;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    front.add(geometry, material);
  }
  // Headlamps: lampX (/W) and lampY (/H) place the cluster centre, lampWidth and lampHeight (m)
  // size the style's housing, lampSweep (m) carries it round the corner and back along the
  // fender toward the hood edge, as swept clusters do.
  const lampX = W * (f.lampX ?? 0.355),
    lampW = f.lampWidth ?? W * 0.2,
    lampH = f.lampHeight ?? (pickup && s.lamps === 'c' ? H * 0.24 : pickup ? 0.22 : 0.11);
  const lampY =
    f.lampY !== undefined
      ? H * f.lampY
      : H * f.nose -
        (s.lamps.startsWith('round') ? H * 0.078 : s.lamps === 'vertical' ? 0.15 : lampH * 0.6);
  // Grille perimeter and lamp signatures are authored per model, independent of body dimensions.
  // The opening stays under the hood's leading edge. 'band' is a dark band across the whole face
  // carrying the lamps; 'twin' two separate ports either side of a painted centre.
  const gw = (W * f.grilleWidth) / 2,
    zf = L / 2 + 0.021;
  let gy =
      s.grille === 'band' && f.grilleY === undefined
        ? lampY
        : H * (f.grilleY ?? (pickup ? 0.47 : raggedGrilleY())),
    gh = (H * f.grilleHeight) / 2;
  function raggedGrilleY() {
    return rugged ? 0.47 : s.grille === 'closed' ? 0.27 : 0.41;
  }
  if (s.grille !== 'closed' && gy + gh > H * f.nose - 0.015) {
    const bottom = gy - gh;
    gh = Math.max(0.02, (H * f.nose - 0.015 - bottom) / 2);
    gy = bottom + gh;
  }
  let outline;
  if (s.grille === 'pentagon')
    outline = [
      [-gw * 0.84, gy + gh],
      [gw * 0.84, gy + gh],
      [gw, gy + gh * 0.15],
      [0, gy - gh],
      [-gw, gy + gh * 0.15],
    ];
  else if (s.grille === 'triangle')
    outline = [
      [-gw, gy + gh],
      [gw, gy + gh],
      [0, gy - gh],
    ];
  else if (s.grille === 'hex' || s.grille === 'shield' || s.grille === 'v')
    outline = [
      [-gw * 0.72, gy + gh],
      [gw * 0.72, gy + gh],
      [gw, gy + gh * 0.25],
      [gw * 0.75, gy - gh],
      [-gw * 0.75, gy - gh],
      [-gw, gy + gh * 0.25],
    ];
  else if (s.grille === 'trapezoid')
    outline = [
      [-gw * 0.62, gy + gh],
      [gw * 0.62, gy + gh],
      [gw, gy - gh],
      [-gw, gy - gh],
    ];
  else if (s.grille === 'oval')
    outline = Array.from({ length: 16 }, (_, i) => [
      Math.cos((i * Math.PI) / 8) * gw,
      gy + Math.sin((i * Math.PI) / 8) * gh,
    ]);
  // 'tall': a van's tall grille, full width under the hood edge and narrowing a little toward
  // the bumper, between high-set lamps (ProMaster/Ducato type; split into rows by bars below).
  else if (s.grille === 'tall')
    outline = [
      [-gw * 0.92, gy + gh],
      [gw * 0.92, gy + gh],
      [gw, gy + gh * 0.82],
      [gw * 0.86, gy - gh],
      [-gw * 0.86, gy - gh],
      [-gw, gy + gh * 0.82],
    ];
  else
    outline = [
      [-gw, gy + gh],
      [gw, gy + gh],
      [gw, gy - gh],
      [-gw, gy - gh],
    ];
  // grilleTrim is the surround (chrome, black, body or none); grilleFill replaces the style's
  // infill (mesh, bars, slats or none) in grilleMesh colour (black or chrome); grilleBars sets
  // the number of bars or slats.
  const trim =
    f.grilleTrim ??
    (s.grille === 'band'
      ? 'none'
      : ['mesh', 'hex', 'tall'].includes(s.grille)
        ? 'black'
        : 'chrome');
  const meshMaterial =
    f.grilleMesh === 'chrome' || (f.grilleMesh === undefined && s.make === 'GMC') ? chrome : black;
  const ports =
    s.grille === 'twin'
      ? [-1, 1].map((side) => {
          const cx = side * gw * 0.52,
            hw = gw * 0.46,
            c = Math.min(hw, gh) * 0.35;
          return [
            [cx - hw + c, gy + gh],
            [cx + hw - c, gy + gh],
            [cx + hw, gy + gh - c],
            [cx + hw, gy - gh + c],
            [cx + hw - c, gy - gh],
            [cx - hw + c, gy - gh],
            [cx - hw, gy - gh + c],
            [cx - hw, gy + gh - c],
          ];
        })
      : s.grille === 'three-port'
        ? [
            // A taller centre port narrowing to its foot between two lower side ports.
            [
              [-gw * 0.3, gy + gh],
              [gw * 0.3, gy + gh],
              [gw * 0.3, gy - gh * 0.5],
              [gw * 0.14, gy - gh],
              [-gw * 0.14, gy - gh],
              [-gw * 0.3, gy - gh * 0.5],
            ],
            ...[-1, 1].map((side) => [
              [side * gw * 0.4, gy + gh * 0.5],
              [side * gw, gy + gh * 0.5],
              [side * gw * 0.94, gy - gh * 0.55],
              [side * gw * 0.43, gy - gh * 0.55],
            ]),
          ]
        : [outline];
  // grilleFrame (m): a flat frame that wide round each opening in the grilleTrim finish
  // (body colour unless chrome or black), as on grilles with a painted surround.
  const frame = (port, t, material) => {
    const cx = port.reduce((sum, p) => sum + p[0], 0) / port.length,
      cy = port.reduce((sum, p) => sum + p[1], 0) / port.length,
      normals = port.map((a, i) => {
        const b = port[(i + 1) % port.length],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1,
          n = [(b[1] - a[1]) / length, (a[0] - b[0]) / length];
        return (a[0] - cx) * n[0] + (a[1] - cy) * n[1] < 0 ? [-n[0], -n[1]] : n;
      }),
      at = (p, n) => [p[0] + n[0] * t, p[1] + n[1] * t];
    for (const [i, a] of port.entries()) {
      const b = port[(i + 1) % port.length],
        n = normals[i],
        next = normals[(i + 1) % port.length];
      fasciaFace(1, [a, b, at(b, n), at(a, n)], material, 0.027);
      if (Math.hypot(n[0] - next[0], n[1] - next[1]) > 1e-3)
        fasciaFace(1, [b, at(b, n), at(b, next)], material, 0.027);
    }
  };
  if (s.grille === 'band')
    for (const side of [-1, 1])
      skinPatch(
        front,
        1,
        side,
        0,
        endOutline(1, gy).corner + 0.04,
        () => gy - gh,
        () => gy + gh,
        0.012,
        black,
      );
  if (s.grille !== 'closed') {
    for (const port of ports) {
      if (s.grille !== 'band') fasciaFace(1, port, black);
      if (f.grilleFrame > 0)
        frame(port, f.grilleFrame, trim === 'chrome' ? chrome : trim === 'black' ? black : paint);
      else if (trim !== 'none')
        path(
          front,
          [...port, port[0]].map(([x, y]) => [x, y, zf + 0.008]),
          trim === 'body' ? 0.02 : 0.012,
          trim === 'chrome' ? chrome : trim === 'black' ? black : paint,
        );
    }
    if (
      f.grilleFill !== undefined ||
      s.grille === 'twin' ||
      s.grille === 'band' ||
      s.grille === 'three-port'
    ) {
      const fill = f.grilleFill ?? (s.grille === 'band' ? 'none' : 'mesh');
      for (const port of ports)
        infill(
          port,
          fill,
          fill === 'mesh' || fill === 'fine'
            ? meshMaterial
            : f.grilleMesh === 'black'
              ? black
              : chrome,
          f.grilleBars,
        );
    } else if (s.grille === 'split') {
      front.box([0.035, gh * 2.15, 0.025], [0, gy, zf + 0.02], paint);
      for (const side of [-1, 1])
        for (let i = 1; i < 6; i++)
          front.box(
            [0.012, gh * 1.65, 0.025],
            [side * (0.05 + i * gw * 0.14), gy, zf + 0.035],
            chrome,
          );
    } else if (s.grille === 'vertical-slats') {
      for (let i = -8; i <= 8; i++)
        front.box([0.014, gh * 1.8, 0.018], [i * gw * 0.105, gy, zf + 0.022], chrome);
    } else if (s.grille === 'slots5') {
      front.box([gw * 2, gh * 2, 0.012], [0, gy, zf + 0.01], paint);
      for (let i = -2; i <= 2; i++)
        front.box([gw * 0.21, gh * 1.65, 0.015], [i * gw * 0.36, gy, zf + 0.025], black);
    } else if (s.grille === 'slots') {
      // Six open slots: a generic slotted truck grille, deliberately not a seven-slot signature.
      front.box([gw * 2, gh * 2, 0.012], [0, gy, zf + 0.01], paint);
      for (let i = -2.5; i <= 2.5; i++)
        front.box([gw * 0.17, gh * 1.75, 0.015], [i * gw * 0.3, gy, zf + 0.025], black);
    } else if (['bars', 'v', 'oval'].includes(s.grille)) {
      for (let i = -2; i <= 2; i++)
        front.box([gw * 1.77, 0.025, 0.015], [0, gy + i * gh * 0.32, zf + 0.015], chrome);
      if (s.grille === 'v')
        path(
          front,
          [
            [-gw * 0.9, gy + gh, zf + 0.035],
            [0, gy - gh * 0.9, zf + 0.035],
            [gw * 0.9, gy + gh, zf + 0.035],
          ],
          0.022,
          chrome,
        );
    } else if (s.grille === 'pentagon') {
      // The MDX diamond grille spreads small facets outward around its central badge.
      for (let row = -2; row <= 2; row++)
        for (let col = -6; col <= 6; col++) {
          if ((row < 0 && Math.abs(col) > 6 + row * 2) || (Math.abs(col) < 2 && Math.abs(row) < 2))
            continue;
          const x = col * gw * 0.13,
            y = gy + row * gh * 0.3;
          face(
            front,
            [
              [x - 0.012, y, zf + 0.024],
              [x, y + 0.018, zf + 0.027],
              [x + 0.012, y, zf + 0.024],
              [x, y - 0.018, zf + 0.024],
            ],
            chrome,
            [0, 0, 1],
          );
        }
    } else if (s.grille !== 'triangle') infill(outline, 'mesh', meshMaterial);
    // Two bars in the surround's finish split a tall grille into three rows.
    if (s.grille === 'tall')
      for (const k of [-0.3, 0.3]) {
        const y = gy + k * gh,
          [x0, x1] = chord(outline, [0, y], [1, 0]);
        front.rod(
          [x0 + 0.01, y, zf + 0.014],
          [x1 - 0.01, y, zf + 0.014],
          0.016,
          trim === 'chrome' ? chrome : trim === 'body' ? paint : black,
        );
      }
  } else if ((s.intake ?? 'none') === 'none')
    front.box([W * 0.58, 0.07, 0.018], [0, clearance + 0.18, zf], black);
  // Lower intake (recipe intake: trapezoid, wide, triple or sides) below the grille, sized by
  // intakeWidth (/W) and intakeHeight (/H), centred at intakeY (/H). It replaces the default
  // duct pair (and the closed grille's strip) and carries a black mesh.
  const intake = s.intake ?? 'none';
  if (intake !== 'none') {
    const iw = (W * (f.intakeWidth ?? 0.62)) / 2,
      ih = (H * (f.intakeHeight ?? 0.1)) / 2,
      iy = f.intakeY !== undefined ? H * f.intakeY : clearance + 0.07 + ih,
      c = ih * 0.45;
    const port = (side, inner, rise) => [
      [side * inner, iy + ih * rise],
      [side * iw, iy + ih],
      [side * iw, iy - ih],
      [side * inner, iy - ih * 0.85],
    ];
    const openings =
      intake === 'trapezoid'
        ? [
            [
              [-iw * 0.78, iy + ih],
              [iw * 0.78, iy + ih],
              [iw, iy - ih],
              [-iw, iy - ih],
            ],
          ]
        : intake === 'wide'
          ? [
              [
                [-iw + c, iy + ih],
                [iw - c, iy + ih],
                [iw, iy + ih - c],
                [iw, iy - ih + c],
                [iw - c, iy - ih],
                [-iw + c, iy - ih],
                [-iw, iy - ih + c],
                [-iw, iy + ih - c],
              ],
            ]
          : intake === 'triple'
            ? [
                [
                  [-iw * 0.34, iy + ih * 0.9],
                  [iw * 0.34, iy + ih * 0.9],
                  [iw * 0.4, iy - ih],
                  [-iw * 0.4, iy - ih],
                ],
                port(-1, iw * 0.58, 0.8),
                port(1, iw * 0.58, 0.8),
              ]
            : intake === 'slots' || intake === 'fangs'
              ? [-1, 1].map((side) => {
                  // Narrow upright slots at the corners, or fangs: corner vents narrowing
                  // down to a point toward the centre, crossed by bright blades.
                  const sw =
                    intake === 'slots' ? Math.max(0.035, iw * 0.12) : Math.max(0.07, iw * 0.3);
                  return intake === 'slots'
                    ? [
                        [side * (iw - sw), iy + ih],
                        [side * iw, iy + ih],
                        [side * iw, iy - ih],
                        [side * (iw - sw * 0.85), iy - ih],
                      ]
                    : [
                        [side * (iw - sw), iy + ih],
                        [side * iw, iy + ih],
                        [side * (iw - sw * 0.3), iy - ih],
                        [side * (iw - sw * 0.62), iy - ih],
                      ];
                })
              : [port(-1, iw * 0.45, 0.55), port(1, iw * 0.45, 0.55)];
    // Proud of the lower valance strip, which stands to zf.
    for (const opening of openings) {
      fasciaFace(1, opening, black, 0.026);
      if (intake === 'fangs') infill(opening, 'bars', chrome, 3, 0.006);
      else if (intake !== 'slots') infill(opening, 'mesh', black, undefined, 0.003);
    }
  }
  for (const side of [-1, 1]) {
    const x = side * lampX;
    const sweep = f.lampSweep ?? 0;
    if (f.lampOnHood) {
      const z = axleFront + arch * 0.7,
        xx = side * W * 0.355;
      const y = beltAt(z) + 0.025;
      const lens = details.add(new T.SphereGeometry(1, 16, 8), black, [xx, y, z]);
      lens.scale.set(0.12, 0.025, 0.19);
      const optic = details.ring(0.095, 0.009, [xx, y + 0.023, z + 0.04], chrome);
      optic.rotation.x = -Math.PI * 0.4;
      const lamp = details.add(new T.CircleGeometry(0.08, 20), light, [xx, y + 0.024, z + 0.042]);
      lamp.rotation.x = -Math.PI * 0.4;
    } else if (s.lamps === 'stadium') {
      const outline = [],
        r = (f.lampWidth ?? 0.144) / 2,
        run = Math.max(0, (f.lampHeight ?? 0.284) / 2 - r);
      for (let i = 0; i <= 32; i++) {
        const a = (i * Math.PI) / 16;
        outline.push([
          x + Math.cos(a) * r,
          lampY + Math.sin(a) * r + Math.sign(Math.sin(a)) * run,
          zf + 0.026,
        ]);
      }
      face(front, outline, black, [0, 0, 1]);
      path(front, outline, 0.015, light);
    } else if (s.lamps === 'quad-round') {
      const k = (f.lampWidth ?? 0.38) / 0.38;
      for (const dx of [-0.095 * k, 0.095 * k]) {
        front.add(new T.CircleGeometry(0.085 * k, 20), black, [x + dx, lampY, zf + 0.02]);
        front.ring(0.069 * k, 0.009, [x + dx, lampY, zf + 0.029], light);
        front.add(new T.CircleGeometry(0.043 * k, 16), chrome, [x + dx, lampY, zf + 0.032]);
      }
    } else if (s.lamps.startsWith('round')) {
      const rad = f.lampWidth !== undefined ? f.lampWidth / 2 : H * 0.07;
      front.add(new T.CircleGeometry(rad, 24), black, [x, lampY, zf + 0.02]);
      front.ring(rad * 0.83, 0.012, [x, lampY, zf + 0.026], light);
      front.add(new T.CircleGeometry(rad * 0.46, 16), chrome, [x, lampY, zf + 0.03]);
      if (s.lamps === 'round-bar')
        front.box([lampW, 0.022, 0.016], [x - side * 0.12, lampY, zf + 0.035], light);
    } else if (s.lamps === 'twin-line') {
      const k = f.lampHeight !== undefined ? f.lampHeight / 0.114 : 1;
      for (const dy of [-0.038 * k, 0.038 * k]) {
        front.box([lampW, 0.038 * k, 0.025], [x, lampY + dy, zf + 0.021], black);
        front.box([lampW * 0.92, 0.016 * k, 0.025], [x, lampY + dy, zf + 0.035], light);
      }
    } else if (s.lamps === 'teardrop') {
      // A round outboard end tapering to a point inboard and a little lower.
      const r = Math.min(lampW * 0.45, lampH / 2),
        cx = x + side * (lampW / 2 - r),
        shape = [[x - (side * lampW) / 2, lampY - lampH * 0.18]];
      for (let i = 0; i <= 12; i++) {
        const a = ((110 - (220 * i) / 12) * Math.PI) / 180;
        shape.push([cx + side * r * Math.cos(a), lampY + r * Math.sin(a)]);
      }
      face(
        front,
        shape.map(([px, py]) => [px, py, zf + 0.024]),
        black,
        [0, 0, 1],
      );
      path(
        front,
        [...shape, shape[0]].map(([px, py]) => [px, py, zf + 0.03]),
        0.01,
        light,
      );
      front.add(new T.CircleGeometry(r * 0.5, 16), chrome, [cx, lampY, zf + 0.034]);
    } else if (s.lamps === 'y-signature') {
      const k = f.lampHeight !== undefined ? f.lampHeight / 0.11 : 1;
      for (const dy of [-0.055 * k, 0.055 * k])
        front.rod(
          [x - side * lampW * 0.4, lampY + dy, zf + 0.03],
          [x, lampY, zf + 0.03],
          0.0075,
          light,
        );
      front.rod([x, lampY, zf + 0.03], [x + side * lampW * 0.45, lampY, zf + 0.03], 0.0075, light);
    } else if (s.lamps === 'countryman') {
      const k = (f.lampWidth ?? 0.24) / 0.24;
      const shape = [
        [-0.11, -0.075],
        [-0.12, 0.035],
        [-0.075, 0.125],
        [0.055, 0.135],
        [0.115, 0.075],
        [0.12, -0.045],
        [0.065, -0.11],
        [-0.04, -0.115],
      ].map(([dx, dy]) => [x + side * dx * k, lampY + dy * k, zf + 0.027]);
      face(front, shape, black, [0, 0, 1]);
      path(front, [...shape, shape[0]], 0.012, chrome);
      front.ring(0.063 * k, 0.011, [x, lampY + 0.006 * k, zf + 0.042], light);
      front.add(new T.CircleGeometry(0.044 * k, 20), chrome, [x, lampY + 0.006 * k, zf + 0.045]);
      front.box([0.07 * k, 0.022, 0.012], [x, lampY - 0.076 * k, zf + 0.04], light);
    } else if (s.lamps === 'oval-upright' && !(sweep > 0) && f.lampShape === undefined) {
      const rx = (f.lampWidth ?? 0.18) / 2,
        ry = (f.lampHeight ?? 0.28) / 2;
      const shape = Array.from({ length: 25 }, (_, i) => [
        x + Math.cos((i * Math.PI) / 12) * rx,
        lampY + Math.sin((i * Math.PI) / 12) * ry,
        zf + 0.024,
      ]);
      face(front, shape, black, [0, 0, 1]);
      path(front, shape, 0.012, chrome);
      front.ring(0.052 * (rx / 0.09), 0.01, [x, lampY - 0.015 * (ry / 0.14), zf + 0.04], light);
    } else {
      const h = s.lamps === 'vertical' ? (f.lampHeight ?? 0.28) : lampH;
      // lampLens 'clear': a clear lens over a bright reflector (older trucks and vans), so the
      // housing reads bright with lit bulbs instead of a dark housing with chrome projectors.
      const clear = f.lampLens === 'clear',
        housing = clear ? chrome : black;
      const w = s.lamps === 'vertical' ? (f.lampWidth ?? 0.12) : lampW;
      // The housing lies on the skin by arc length: s0 at its inner edge, s1 at its outer edge
      // as seen from ahead and, with lampSweep, tip that far round the corner and back along
      // the fender, rising and tapering under the fender top. lampShape is its outline: quad
      // (leaning inboard), rect, wedge (narrowing inboard), boomerang (a notch between two outer
      // arms), oval or rounded (square with rounded corners). lampDrl is the lit graphic inside
      // it: line (along the top), c (open inboard), l (along the foot and up the outer end),
      // chevron (pointing inboard), bars, frame (round the outline), ring (round one
      // projector) or none. lampDrop (m) carries the housing and its graphic down from the inner
      // end beside the grille, lampProjectors counts the lenses. Graphics are drawn inside the
      // housing's own outline, so they fit whatever its size.
      const s0 = arcAt(1, lampX - w / 2, lampY),
        s1 = Math.max(s0 + 0.02, arcAt(1, lampX + w / 2, lampY)),
        tip = sweep > 0 ? Math.max(s1, endOutline(1, lampY).corner) + sweep : s1,
        span = s1 - s0,
        u = (sa) => Math.min(1, Math.max(0, (sa - s0) / span)),
        v = (sa) => (tip > s1 ? Math.min(1, Math.max(0, (sa - s1) / (tip - s1))) : 0),
        cap = (sa) => beltAt(skinAt(1, 1, sa, lampY).p[2]) - 0.015;
      const shape =
        f.lampShape ?? (s.lamps === 'rect' ? 'rect' : s.lamps === 'oval-upright' ? 'oval' : 'quad');
      const drl =
        f.lampDrl ??
        ({ c: 'c', hammer: 'c', boomerang: 'chevron', vertical: 'bars', 'oval-upright': 'frame' }[
          s.lamps
        ] ||
          (['jewel-five', 'pixel-squares', 'pixels'].includes(s.lamps) ? 'none' : 'line'));
      // Upper (top) and lower (bottom) edges: by u across the face (fractions of h about lampY),
      // then from their values at s1 rising and tapering along the sweep; ovals and rounded
      // squares span s0..tip whole.
      const [hi, lo] = {
        rect: [() => 0.5, () => -0.5],
        wedge: [(k) => 0.1 + 0.4 * k, (k) => -0.15 - 0.35 * k],
        boomerang: [(k) => 0.5 * k, (k) => -0.2 - 0.3 * k],
      }[shape] ?? [(k) => 0.5 - 0.15 * k, (k) => -0.35 - 0.15 * k];
      let top, bottom;
      if (shape === 'oval' || shape === 'rounded') {
        const length = tip - s0,
          r = Math.min(h * 0.35, length * 0.3),
          half = (sa) => {
            const d = Math.max(0, Math.min(sa - s0, tip - sa));
            return shape === 'oval'
              ? (h / 2) * Math.sqrt(Math.max(0, 1 - (1 - (2 * d) / length) ** 2))
              : h / 2 - r + Math.sqrt(Math.max(0, r * r - (r - Math.min(r, d)) ** 2));
          },
          // A swept oval lies back along the fender, rising toward its tip.
          centre = (sa) => lampY + (tip > s1 ? h * 0.4 * ((sa - s0) / length - 0.5) : 0);
        top = (sa) => centre(sa) + Math.max(0.003, half(sa));
        bottom = (sa) => centre(sa) - Math.max(0.003, half(sa));
      } else {
        const hi1 = lampY + h * hi(1),
          lo1 = lampY + h * lo(1);
        top = (sa) =>
          sa <= s1
            ? lampY + h * hi(u(sa))
            : hi1 + (lampY + h * (shape === 'boomerang' ? 0.85 : 0.8) - hi1) * v(sa);
        bottom = (sa) =>
          sa <= s1
            ? lampY + h * lo(u(sa))
            : shape === 'boomerang'
              ? top(sa) - h * (0.42 - 0.24 * v(sa))
              : lo1 + (lampY + h * 0.6 - lo1) * v(sa);
      }
      const hiC = (sa) => Math.min(cap(sa), top(sa)),
        loC = (sa) => Math.min(hiC(sa) - 0.012, bottom(sa)),
        mid = (sa) => (hiC(sa) + loC(sa)) / 2;
      const drop = f.lampDrop ?? 0,
        bands = [];
      if (shape === 'boomerang') {
        // The notch: across the face it opens over the outer 30 %; on a swept lamp the upper
        // arm runs on to the tip and a short lower arm stops halfway.
        const sN = tip > s1 ? s1 : s0 + span * 0.7,
          n = (sa) => (tip > s1 ? 0 : h * 0.17 * Math.max(0, (sa - sN) / (s1 - sN))),
          centre = (sa) => lampY + (h * (hi(u(sa)) + lo(u(sa)))) / 2;
        bands.push([s0, sN, loC, hiC]);
        if (tip > s1) {
          const lowEnd = s1 + (tip - s1) * 0.5,
            k = (sa) => (sa - s1) / (lowEnd - s1),
            lo1 = lampY + h * lo(1);
          bands.push([s1, tip, loC, hiC]);
          bands.push([
            s1,
            lowEnd,
            (sa) => lo1 + h * 0.3 * k(sa),
            (sa) => Math.min(hiC(sa) - 0.03, lo1 + h * (0.32 - 0.22 * k(sa))),
          ]);
        } else {
          bands.push([sN, s1, (sa) => centre(sa) + n(sa), hiC]);
          bands.push([sN, s1, loC, (sa) => centre(sa) - n(sa)]);
        }
      } else bands.push([s0, tip, loC, hiC]);
      const dw = Math.max(0.035, Math.min(0.07, w * 0.18));
      if (drop > 0) bands.push([s0, s0 + dw, () => lampY - h / 2 - drop, (sa) => loC(sa) + 0.012]);
      // Curved outlines take finer columns so their ends read round, not faceted.
      const curved = shape === 'oval' || shape === 'rounded';
      for (const [a, b, lo, hi] of bands)
        skinPatch(
          front,
          1,
          side,
          a,
          b,
          lo,
          hi,
          0.021,
          housing,
          curved ? Math.max(12, Math.ceil((b - a) / 0.02)) : undefined,
        );
      // Fittings on the housing: fit() places one `extra` in front of it at (sa, y), compensated
      // for the fascia conform; lit() lays a lit strip on it.
      const fit = (sa, y, extra) => {
        const { p } = skinAt(1, side, sa, y, 0.021 + extra);
        return [p[0], p[1], p[2] + endOffset(p[0], 1)];
      };
      const m = Math.min(0.01, h * 0.08),
        th = Math.min(0.016, Math.max(0.008, h * 0.14)),
        end = tip > s1 ? tip - 0.015 : s1 - m,
        lit = (a, b, lo, hi, columns) =>
          b > a + 0.004 && skinPatch(front, 1, side, a, b, lo, hi, 0.03, light, columns),
        // A strip along the upper (dir -1) or lower (dir 1) edge, and an upright strip.
        along = (a, b, edge, dir) =>
          lit(
            a,
            b,
            (sa) => (dir > 0 ? edge(sa) + m : edge(sa) - m - th),
            (sa) => (dir > 0 ? edge(sa) + m + th : edge(sa) - m),
          ),
        post = (sa, y0 = (k) => loC(k) + m, y1 = (k) => hiC(k) - m) =>
          lit(sa - th / 2, sa + th / 2, y0, y1, 1);
      if (drl === 'line') along(s0 + m, end, hiC, -1);
      else if (drl === 'c') {
        along(s0 + span * 0.12, end, hiC, -1);
        post(s1 - m - th / 2);
        along(s0 + span * 0.3, s1 - m, loC, 1);
      } else if (drl === 'l') {
        along(s0 + m, s1 - m, loC, 1);
        post(s1 - m - th / 2);
        if (tip > s1) along(s1, end, hiC, -1);
      } else if (drl === 'chevron') {
        const a = s0 + span * 0.1,
          b = s1 - m;
        for (const edge of [(sa) => hiC(sa) - m - th / 2, (sa) => loC(sa) + m + th / 2]) {
          const line = (sa) => mid(a) + ((edge(b) - mid(a)) * (sa - a)) / (b - a);
          lit(
            a,
            b,
            (sa) => line(sa) - th / 2,
            (sa) => line(sa) + th / 2,
          );
        }
        if (tip > s1) along(s1, end, hiC, -1);
      } else if (drl === 'bars') for (const k of [0.35, 0.65]) post(s0 + span * k);
      else if (drl === 'frame') {
        along(s0 + m, end, hiC, -1);
        along(s0 + m, tip > s1 ? end : s1 - m, loC, 1);
        post(s0 + m + th / 2);
        if (!(tip > s1)) post(s1 - m - th / 2);
      }
      if (drop > 0 && drl !== 'none')
        post(
          s0 + m + th / 2,
          () => lampY - h / 2 - drop + m,
          (sa) => hiC(sa) - m,
        );
      const sc = s0 + span * (drl === 'c' ? 0.6 : 0.5),
        size = (sa) => hiC(sa) - loC(sa);
      if (drl === 'ring')
        front.ring(
          Math.max(0.012, Math.min(size(sc) * 0.36, span * 0.3)),
          0.008,
          fit(sc, mid(sc), 0.012),
          light,
        );
      if (s.lamps === 'jewel-five') {
        for (let i = 0; i < 5; i++) {
          const sa = s0 + span * (0.5 + (i - 2) * 0.175),
            bw = Math.min(0.048, span * 0.15),
            bh = Math.min(0.053, size(sa) * 0.75);
          front.box([bw, bh, 0.018], fit(sa, mid(sa), 0.003), chrome);
          front.box([bw * 0.73, bh * 0.72, 0.021], fit(sa, mid(sa), 0.01), light);
        }
        along(s0 + span * 0.05, s1 - span * 0.05, loC, 1);
      } else if (s.lamps === 'pixel-squares') {
        const q = Math.min(0.045, span * 0.2);
        for (const k of [-1, 1]) {
          const sa = sc + k * q * 1.45,
            qh = Math.min(0.034, size(sa) * 0.36),
            p = [
              [sa - q, mid(sa) - qh],
              [sa + q, mid(sa) - qh],
              [sa + q, mid(sa) + qh],
              [sa - q, mid(sa) + qh],
            ].map(([a, y]) => fit(a, y, 0.004));
          path(front, [...p, p[0]], 0.008, light);
        }
      } else if (s.lamps === 'pixels') {
        const step = Math.min(0.062, span * 0.3);
        for (let i = 0; i < 3; i++) {
          const sa = sc + step - i * step;
          front.box(
            [step * 0.72, Math.min(0.042, size(sa) * 0.6), 0.018],
            fit(sa, mid(sa) - i * Math.min(0.024, size(sa) * 0.15), 0),
            light,
          );
        }
      }
      const count =
        f.lampProjectors ??
        (drl === 'ring' || shape === 'oval'
          ? 1
          : s.lamps === 'triple'
            ? 3
            : s.lamps === 'jewel-five'
              ? 0
              : 2);
      for (let i = 0; i < count; i++) {
        const sa = sc + (i - (count - 1) / 2) * Math.min(0.065, span * 0.28),
          r = Math.max(0.008, Math.min(drl === 'ring' ? 0.03 : 0.023, size(sa) * 0.3));
        front.add(new T.CircleGeometry(r, 12), clear ? light : chrome, fit(sa, mid(sa), 0.006));
      }
      // A split lamp's main unit sits lower in the bumper (lampLowY, /H), under its DRL.
      if (s.lamps === 'split') {
        const y = f.lampLowY !== undefined ? H * f.lampLowY : lampY - 0.2,
          a = arcAt(1, lampX - Math.min(0.1, w * 0.35), y),
          b = arcAt(1, lampX + Math.min(0.1, w * 0.35), y);
        skinPatch(
          front,
          1,
          side,
          a,
          b,
          () => y - 0.042,
          () => y + 0.042,
          0.021,
          housing,
        );
        for (const k of [0.3, 0.7]) {
          const { p } = skinAt(1, side, a + (b - a) * k, y, 0.035);
          front.add(new T.CircleGeometry(0.022, 12), clear ? light : chrome, [
            p[0],
            p[1],
            p[2] + endOffset(p[0], 1),
          ]);
        }
      }
      const sm = s1 - 0.012;
      front.box([0.018, Math.min(0.032, size(sm) * 0.5), 0.015], fit(sm, mid(sm), 0), amber);
    }
    // Low air ducts and separate foglight recesses, unless a lower intake replaces them; or fog
    // lamp pods (fogLamps round, rect or bar) at fogX (/W) and fogY (m above the sill) in a
    // black recess on the skin, with a chrome surround when fogTrim is 'chrome'.
    const fog = f.fogLamps ?? (intake === 'none' ? 'duct' : 'none');
    if (fog === 'duct') {
      front.box([0.14, 0.08, 0.018], [side * W * 0.35, clearance + 0.18, zf], black);
      front.box([0.055, 0.022, 0.022], [side * W * 0.35, clearance + 0.18, zf + 0.015], light);
    } else if (fog !== 'none') {
      const fx = side * W * (f.fogX ?? 0.35),
        fy = clearance + (f.fogY ?? 0.18),
        [pw, ph] = { round: [0.12, 0.11], rect: [0.15, 0.075], bar: [0.22, 0.045] }[fog],
        pod = (w, h, r) =>
          Array.from({ length: 16 }, (_, i) => {
            const a = ((i + 0.5) * Math.PI) / 8,
              c = Math.cos(a),
              sn = Math.sin(a);
            return [
              fx + Math.sign(c) * (w / 2 - r) + c * r,
              fy + Math.sign(sn) * (h / 2 - r) + sn * r,
            ];
          }),
        onFace = ([x, y], lift) => [x, y, L / 2 - endOffset(x, 1, y) + lift + endOffset(x, 1)];
      const recess = pod(pw, ph, Math.min(pw, ph) * 0.4);
      fasciaFace(1, recess, black, 0.024);
      fasciaFace(
        1,
        fog === 'round' ? pod(0.075, 0.075, 0.0375) : pod(pw * 0.78, ph * 0.5, ph * 0.2),
        light,
        0.03,
      );
      if (f.fogTrim === 'chrome')
        path(
          front,
          [...recess, recess[0]].map((p) => onFace(p, 0.03)),
          0.009,
          chrome,
        );
    }
    // Tail lamps (recipe tail) lie on the skin: tailWidth x tailHeight (m) centred at tailX (/W)
    // and tailY (/H); tailWrap (m) carries a lamp from its inner edge round the corner and that
    // far along the quarter panel; tailCount repeats round lamps inboard; tailBar (m) is the
    // height of a full-width bar. Each lens sits in a dark bezel tailBezel (m) wide, so it
    // reads on red, black and white paint alike.
    const tail = s.tail,
      tall = ['vertical', 'c', 'square', 'high-l', 'band-l'].includes(tail),
      ty = f.tailY !== undefined ? H * f.tailY : Math.min(belt * 0.83 + beltRise, deckEnd - 0.12),
      tx = W * (f.tailX ?? 0.375),
      tw =
        f.tailWidth ??
        { round: 0.156, 'wrap-l': 0.39, boomerang: 0.42 }[tail] ??
        (tall ? 0.13 : 0.32),
      th =
        f.tailHeight ??
        { round: 0.156, 'wrap-l': 0.24, boomerang: 0.2, racetrack: 0.1 }[tail] ??
        (tall ? 0.24 : 0.09),
      wrap = f.tailWrap ?? { 'wrap-l': 0.2, boomerang: 0.25, racetrack: 0.06 }[tail] ?? 0,
      rim = f.tailBezel ?? (tail === 'racetrack' ? 0.03 : 0.012),
      { corner } = endOutline(-1, ty),
      inner = arcAt(-1, tx - tw / 2, ty),
      edge = arcAt(-1, tx + tw / 2, ty),
      outer = wrap > 0 ? Math.max(edge, corner) + wrap : edge;
    const band = (y0, y1) => [() => y0, () => y1];
    const strip = (s0, s1, y0, y1, lift, material, columns) =>
      skinPatch(rear, -1, side, s0, s1, ...band(y0, y1), lift, material, columns);
    // tailHousing 'smoked' leaves a red rim round a dark centre in every lens, 'clear' a bright
    // lens round a red centre (the lamp's red elements on a clear housing).
    const housingFinish = f.tailHousing ?? 'red';
    const lens = (s0, s1, low, high, material = red, plain = false) => {
      const clamp = (sa) => Math.min(s1, Math.max(s0, sa));
      if (!plain && material === red && housingFinish !== 'red') {
        const e = (sa) =>
          Math.min(housingFinish === 'clear' ? 0.05 : 0.016, (high(sa) - low(sa)) * 0.26);
        const inset = Math.min(0.016, (s1 - s0) * 0.2);
        lens(s0, s1, low, high, housingFinish === 'clear' ? chrome : red, true);
        skinPatch(
          rear,
          -1,
          side,
          s0 + inset,
          s1 - inset,
          (sa) => low(sa) + e(sa),
          (sa) => high(sa) - e(sa),
          0.018,
          housingFinish === 'clear' ? red : black,
        );
        return;
      }
      if (rim > 0)
        skinPatch(
          rear,
          -1,
          side,
          Math.max(0, s0 - rim),
          s1 + rim,
          (sa) => low(clamp(sa)) - rim,
          (sa) => high(clamp(sa)) + rim,
          0.006,
          black,
        );
      skinPatch(rear, -1, side, s0, s1, low, high, 0.012, material);
    };
    const disc = (sc, r, ry, lift, material, yc = ty) => {
      const half = (sa) => ry * Math.sqrt(Math.max(0, 1 - ((sa - sc) / r) ** 2));
      skinPatch(
        rear,
        -1,
        side,
        Math.max(0, sc - r),
        sc + r,
        (sa) => yc - half(sa),
        (sa) => yc + half(sa),
        lift,
        material,
        12,
      );
    };
    // A round lens with a dark ring inside it, read as the lamp's inner graphic.
    const roundLens = (sc, r, ry, yc = ty) => {
      if (rim > 0) disc(sc, r + rim, ry + rim, 0.006, black, yc);
      disc(sc, r, ry, 0.012, red, yc);
      disc(sc, r * 0.62, ry * 0.62, 0.016, black, yc);
      disc(sc, r * 0.5, ry * 0.5, 0.02, red, yc);
    };
    // tailStack stacks the tailCount lamps downward instead of repeating them inboard.
    const stack = !!f.tailStack;
    const u = (sa) => Math.min(1, Math.max(0, (sa - inner) / (edge - inner || 1))),
      v = (sa) => Math.max(0, (sa - edge) / (outer - edge || 1));
    if (tail === 'round')
      for (let k = 0; k < (f.tailCount ?? 1); k++)
        roundLens(
          arcAt(-1, stack ? tx : tx - k * tw * 1.2, ty),
          tw / 2,
          th / 2,
          stack ? ty - k * th * 1.15 : ty,
        );
    else if (tail === 'round-wrap') {
      // A wedge-shaped wrap housing in a clear (satin) finish holding a round red lens toward
      // its outer end, the lens's height most of the housing's.
      lens(
        inner,
        outer,
        (sa) => ty - th * (sa <= edge ? 0.3 + 0.2 * u(sa) : 0.5 - 0.35 * v(sa)),
        (sa) => ty + th * (sa <= edge ? 0.25 + 0.25 * u(sa) : 0.5 - 0.15 * v(sa)),
        housingFinish === 'red' ? chrome : housingFinish === 'smoked' ? black : chrome,
        true,
      );
      const r = Math.min(th * 0.4, (edge - inner) * 0.3);
      roundLens(inner + (edge - inner) * 0.68, r, r, ty + th * 0.04);
    } else if (tail === 'c') {
      // A C open inboard: red along the top, round the outer end and along the foot of the
      // lamp, with a dark centre.
      const e = Math.min(0.03, th * 0.24, (outer - inner) * 0.2);
      lens(inner, outer, ...band(ty - th / 2, ty + th / 2), red, true);
      strip(inner, outer - e, ty - th / 2 + e, ty + th / 2 - e, 0.019, black);
    } else if (tail === 'slashes') {
      // Parallel slanted strips (claw marks), tailCount of them, stacked in a dark housing.
      const n = f.tailCount ?? 3,
        pitch = th / n,
        k = (sa) => (sa - inner) / (outer - inner || 1);
      strip(inner - rim, outer + rim, ty - th / 2 - rim, ty + th / 2 + rim, 0.006, black);
      for (let i = 0; i < n; i++) {
        const y0 = ty - th / 2 + (i + 0.15) * pitch;
        skinPatch(
          rear,
          -1,
          side,
          inner + 0.01,
          outer - 0.01,
          (sa) => y0 + pitch * 0.3 * k(sa),
          (sa) => y0 + pitch * (0.42 + 0.3 * k(sa)),
          0.012,
          red,
        );
      }
    } else if (tail === 'wrap-l') {
      // A wedge, deeper outboard, whose upper arm turns the corner onto the quarter panel.
      const k = th / 0.24,
        kw = tw / 0.39;
      lens(
        inner,
        outer,
        (sa) =>
          sa <= edge
            ? ty -
              k *
                (u(sa) < 0.75
                  ? 0.06 + (0.08 * u(sa)) / 0.75
                  : 0.14 - (0.06 * (u(sa) - 0.75)) / 0.25)
            : ty + k * (-0.08 + 0.11 * v(sa)),
        (sa) => (sa <= edge ? ty + k * (0.04 + 0.06 * u(sa)) : ty + k * (0.1 - 0.02 * v(sa))),
      );
      // The lit inner stroke only on a lamp large enough to hold it (on a small one it reads as
      // a numeral).
      if (k >= 0.7 && kw >= 0.75)
        path(
          rear,
          [
            [tx - 0.16 * kw, ty + 0.005 * k],
            [tx + 0.1 * kw, ty + 0.035 * k],
            [tx + 0.1 * kw, ty - 0.08 * k],
          ].map(([px, py]) => onSkin(-1, side * px, py, 0.018)),
          0.012,
          light,
        );
    } else if (tail === 'boomerang') {
      // A wedge pointing inboard; along the quarter it splits into a long upper and a short
      // lower arm, leaving the notch that makes the boomerang (tailNotch, 0-1, deepens it).
      const notch = f.tailNotch ?? 0;
      lens(
        inner,
        edge,
        (sa) => ty - th * (0.2 + 0.3 * u(sa)),
        (sa) => ty + th * (0.7 * u(sa) - 0.2),
      );
      lens(
        edge,
        outer,
        (sa) => ty + th * Math.min(0.38 - 0.1 * v(sa), (0.8 + 1.4 * notch) * v(sa) - 0.5),
        (sa) => ty + th * (0.5 - 0.1 * v(sa)),
      );
      lens(
        edge,
        edge + (outer - edge) * (0.5 + 0.25 * notch),
        ...band(ty - th * 0.5, ty - th * (0.3 + 0.08 * notch)),
      );
    } else if (tail === 'racetrack') lens(0, corner + wrap, ...band(ty - th / 2, ty + th / 2));
    else if (tail === 'twin-line') {
      // Two slim lines in one dark housing, wrapping the corner together.
      strip(inner, outer, ty - th / 2 - rim, ty + th / 2 + rim, 0.006, black);
      for (const dy of [-0.25, 0.25])
        strip(inner + 0.01, outer, ty + (dy - 0.13) * th, ty + (dy + 0.13) * th, 0.012, red);
    } else if (tail === 'pixel-band') {
      // A dark band across the tail with two rows of square pixels at each end.
      const pitch = th / 2,
        size = pitch * 0.78;
      strip(0, outer, ty - th / 2 - rim, ty + th / 2 + rim, 0.006, black);
      for (let row = 0; row < 2; row++)
        for (let i = 0; (i + 1) * pitch <= tw; i++) {
          const sc = arcAt(-1, tx + tw / 2 - (i + 0.5) * pitch, ty),
            y0 = ty - th / 2 + row * pitch + (pitch - size) / 2;
          strip(sc - size / 2, sc + size / 2, y0, y0 + size, 0.012, red, 1);
        }
    } else if (tail === 'black-panel') {
      // Lamps behind one dark glass panel spanning the tailgate up to the deck edge.
      strip(
        0,
        outer + rim,
        ty - th / 2 - 0.04,
        Math.max(ty + th / 2, deckEnd - 0.025),
        0.006,
        black,
      );
      strip(inner, outer, ty - th / 2, ty + th / 2, 0.012, red);
    } else if (tail === 'tri-bar') {
      // Three vertical bars in a dark housing.
      const bh = Math.max(th, 0.16);
      strip(inner - rim, edge + rim, ty - bh / 2 - rim, ty + bh / 2 + rim, 0.006, black);
      for (let i = 0; i < 3; i++) {
        const sc = arcAt(-1, tx + (i - 1) * Math.min(0.068, tw * 0.3), ty);
        strip(sc - 0.0185, sc + 0.0185, ty - bh / 2, ty + bh / 2, 0.012, red, 1);
      }
    } else if (tail === 'band-l') {
      // A vertical lamp at the corner joined across the tailgate by a slim band at its top.
      const bar = Math.min(0.035, th * 0.2);
      lens(inner, outer, ...band(ty - th / 2, ty + th / 2));
      lens(0, inner, ...band(ty + th / 2 - bar, ty + th / 2));
    } else {
      lens(inner, outer, ...band(ty - th / 2, ty + th / 2));
      // Further lamps inboard of the first (tailCount), as on twin-lamp tails, or below it.
      for (let k = 1; k < (f.tailCount ?? 1); k++) {
        const x = stack ? tx : tx - k * tw * 1.12,
          y = stack ? ty - k * th * 1.15 : ty;
        lens(arcAt(-1, x - tw / 2, y), arcAt(-1, x + tw / 2, y), ...band(y - th / 2, y + th / 2));
      }
    }
    if (tail === 'claws')
      for (let i = 0; i < 2; i++) {
        const sc = arcAt(-1, tx + (i - 0.5) * 0.08, ty);
        lens(sc - 0.02, sc + 0.02, ...band(ty - 0.135, ty + 0.025));
      }
    // 'bar' and 'claws' join the lamps with a full-width bar tailBar (m) high at tailBarY (/H);
    // tailBand (m) lays a dark garnish band across the whole tail behind the lamps or the bar.
    const barY = f.tailBarY !== undefined ? H * f.tailBarY : belt * 0.87 + beltRise;
    if (tail === 'bar' || tail === 'claws') {
      const bar = (f.tailBar ?? 0.025) / 2;
      lens(0, arcAt(-1, W * 0.37, barY), ...band(barY - bar, barY + bar));
    }
    // tailBandFinish 'chrome' or 'body' makes it a garnish bar between the lamps (Continental,
    // Alphard, Pilot) at tailBandY (/H) if given.
    if (f.tailBand) {
      const y =
          f.tailBandY !== undefined
            ? H * f.tailBandY
            : tail === 'bar' || tail === 'claws'
              ? barY
              : ty,
        finish = { chrome: polished, body: paint }[f.tailBandFinish];
      if (finish) strip(0, inner + rim, y - f.tailBand / 2, y + f.tailBand / 2, 0.009, finish);
      else
        strip(
          0,
          Math.max(outer, corner) + rim,
          y - f.tailBand / 2,
          y + f.tailBand / 2,
          0.003,
          black,
        );
    }
    {
      // Reversing lamp in the lens.
      const sc = arcAt(-1, tx, ty),
        y = ty - Math.min(0.04, th * 0.3);
      strip(sc - 0.025, sc + 0.025, y - 0.009, y + 0.009, 0.023, light, 1);
    }
    if (tail === 'high-l')
      details.rod(
        [side * roofWAt(rr - 0.02), roofY - 0.02, rr - 0.02],
        [side * W * 0.45, beltLine(rb), rb - 0.02],
        0.022,
        housingFinish === 'clear' ? chrome : red,
      );
  }
  // Exhaust tips (form exhaust: pair at the corners, single, quad, centre, centre-quad or none;
  // exhaustX /W of the outermost tip, exhaustRadius m), standing just proud of the lower tail
  // panel wherever its plan rounding and tuck put it.
  {
    const style = f.exhaust ?? (f.electric || pickup ? 'none' : 'pair'),
      r = f.exhaustRadius ?? 0.033,
      x = W * (f.exhaustX ?? 0.32),
      y = clearance + 0.03;
    const tips = {
      pair: [-x, x],
      single: [-x],
      quad: [-x, -x + r * 2.6, x - r * 2.6, x],
      centre: [-r * 1.4, r * 1.4],
      'centre-quad': [-r * 4.1, -r * 1.4, r * 1.4, r * 4.1],
      none: [],
    }[style];
    for (const tip of tips ?? [])
      details.ring(r, r * 0.24, [tip, y, -L / 2 + endOffset(tip, -1, y) - 0.03], chrome);
  }
  if (f.frontLightBar)
    front.box(
      [W * 0.82, 0.024, 0.025],
      [0, f.lightBarY !== undefined ? H * f.lightBarY : lampY, zf + 0.035],
      light,
    );
  // A bevelled bar across the face, its centre line y(x) from x = 0 to x1 (one side mirrored):
  // a face rising to its top edge, a front band and a face falling to its foot, so a chrome
  // bar catches sky and ground in turn instead of reading as one flat grey band.
  const bevelBar = (x1, y, height, depth, material, z = zf + 0.03) => {
    const steps = Math.max(2, Math.ceil(x1 / 0.06));
    for (const side of [-1, 1])
      for (let i = 0; i < steps; i++) {
        const a = (x1 * i) / steps,
          b = (x1 * (i + 1)) / steps,
          profile = (x) => [
            [side * x, y(x) + height / 2, z],
            [side * x, y(x) + height / 4, z + depth],
            [side * x, y(x) - height / 4, z + depth],
            [side * x, y(x) - height / 2, z],
          ];
        const [p, q] = [profile(a), profile(b)];
        for (let k = 1; k < 4; k++)
          face(front, [p[k - 1], q[k - 1], q[k], p[k]], material, [
            0,
            k === 1 ? 1 : k === 3 ? -1 : 0,
            1,
          ]);
      }
  };
  // grilleBar: a bar across the face joining the headlamps' inner ends (chrome, body, black, or
  // light: a lit strip), grilleBarHeight (m) tall at grilleBarY (/H, default the lamp centre).
  // grilleBarShape 'wing' sweeps its ends up into the lamps' upper edges; 'v' runs two blades
  // from the foot of the grille up into the lamps instead.
  if (f.grilleBar) {
    const finish = f.grilleBar,
      height = f.grilleBarHeight ?? (finish === 'light' ? 0.016 : 0.032),
      by = f.grilleBarY !== undefined ? H * f.grilleBarY : lampY,
      reach = lampX - lampW / 2 + 0.035,
      shape = f.grilleBarShape ?? 'straight',
      y = (x) =>
        shape === 'v'
          ? gy - gh * 0.85 + (by - gy + gh * 0.85) * (x / reach)
          : shape === 'wing'
            ? by + lampH * 0.45 * Math.pow(Math.min(1, x / reach), 3)
            : by;
    if (finish === 'light')
      for (const side of [-1, 1])
        skinPatch(
          front,
          1,
          side,
          0,
          arcAt(1, reach, by),
          (sa) => y(sa) - height / 2,
          (sa) => y(sa) + height / 2,
          0.05,
          light,
        );
    else bevelBar(reach, y, height, 0.014, { body: paint, black }[finish] ?? polished);
  }
  // Lower bumper details, front and rear (each key takes one value for both ends or a
  // [front, rear] pair): skid ('silver' or 'black') a plate under the centre of the bumper
  // skidHeight (m) tall and skidWidth (/W) wide, narrowing to its foot; garnish ('chrome' or
  // 'black') a slim strip across the bumper at garnishY (m above the sill). Rear only:
  // diffuser ('black' or 'silver') a dark valance diffuserHeight (m) tall across the tail with
  // upright fins and, when silver, a bright upper edge and fins.
  const perEnd = (value) => (Array.isArray(value) ? value : [value, value]);
  for (const [i, end] of [
    [0, 1],
    [1, -1],
  ]) {
    const d = end > 0 ? front : rear,
      proud = bumperFinish[i] === 'chrome' && bumperTrim[i] > 0 ? 0.03 : 0;
    const skid = perEnd(f.skid)[i];
    if (skid && skid !== 'none') {
      const sh = perEnd(f.skidHeight ?? 0.11)[i],
        sw = (W * perEnd(f.skidWidth ?? 0.26)[i]) / 2,
        y0 = clearance + 0.015;
      for (const side of [-1, 1]) {
        const s1 = arcAt(end, sw, y0 + sh / 2);
        skinPatch(
          d,
          end,
          side,
          0,
          s1,
          (sa) => y0 + sh * 0.35 * Math.pow(sa / s1, 2),
          () => y0 + sh,
          0.032 + proud,
          skid === 'black' ? black : chrome,
        );
      }
    }
    const garnish = perEnd(f.garnish)[i];
    if (garnish && garnish !== 'none') {
      const gyb = clearance + perEnd(f.garnishY ?? 0.09)[i];
      for (const side of [-1, 1])
        skinPatch(
          d,
          end,
          side,
          0,
          endOutline(end, gyb).corner,
          () => gyb - 0.012,
          () => gyb + 0.012,
          0.034 + proud,
          garnish === 'black' ? black : polished,
        );
    }
  }
  if (f.diffuser) {
    const dh = f.diffuserHeight ?? 0.17,
      y0 = clearance + 0.005,
      y1 = clearance + dh,
      silver = f.diffuser === 'silver',
      proud = bumperFinish[1] === 'chrome' && bumperTrim[1] > 0 ? 0.03 : 0;
    for (const side of [-1, 1]) {
      const s1 = arcAt(-1, W * 0.42, (y0 + y1) / 2);
      skinPatch(
        rear,
        -1,
        side,
        0,
        s1,
        () => y0,
        (sa) => y1 - dh * 0.25 * Math.pow(sa / s1, 3),
        0.03 + proud,
        black,
      );
      if (silver)
        skinPatch(
          rear,
          -1,
          side,
          0,
          s1 * 0.97,
          (sa) => y1 - 0.016 - dh * 0.25 * Math.pow(sa / s1, 3),
          (sa) => y1 - 0.004 - dh * 0.25 * Math.pow(sa / s1, 3),
          0.034 + proud,
          chrome,
        );
      for (const k of [0.18, 0.38, 0.58]) {
        const x = side * W * k * 0.42,
          y = y0 + dh * 0.38;
        details.box(
          [0.012, dh * 0.7, 0.06],
          [x, y, -L / 2 + endOffset(x, -1, y) - 0.035 - proud],
          silver ? chrome : black,
        );
      }
    }
  }
  // tailgateCap: a black spoiler cap along a pickup's tailgate top.
  if (f.tailgateCap && pickup)
    rear.box([W * 0.86, 0.055, 0.075], [0, deckEnd - 0.012, -L / 2 + 0.02], black);
  // rollBar ('black' or 'chrome'): a pickup's sports bar over the front of the bed, two raked
  // hoops from the rails joined across the top, with braces down to the bed front.
  if (f.rollBar && pickup) {
    const z = rb - 0.32,
      y = beltAt(z),
      top = y + 0.36,
      x = W * 0.4,
      material = f.rollBar === 'chrome' ? polished : black;
    path(
      details,
      [
        [-x, y, z],
        [-x, top - 0.06, z + 0.04],
        [-x + 0.08, top, z + 0.05],
        [x - 0.08, top, z + 0.05],
        [x, top - 0.06, z + 0.04],
        [x, y, z],
      ],
      0.032,
      material,
    );
    for (const side of [-1, 1])
      details.rod([side * x, top - 0.06, z + 0.04], [side * x, y, rb - 0.1], 0.024, material);
  }
  // deckGrille: a louvred engine-lid grille on the rear deck behind the rear glass, deckGrille
  // (m) long: a dark panel crossed by raised slats running fore and aft.
  // With an engineLid the grille lies on that body-colour cover in the rear pane instead.
  if (f.deckGrille) {
    const length = typeof f.deckGrille === 'number' ? f.deckGrille : 0.32,
      lid = f.engineLid > 0 && !f.openTop && !f.cargoVan ? Math.min(1, f.engineLid) : 0,
      z1 = rb - 0.06,
      z0 = Math.max(-L / 2 + 0.2, z1 - length),
      // Point on the grille at a (0..1 along it) and u (fraction of the half-width).
      deckPoint = (a, u, rise) => {
        if (lid > 0) {
          const p = screenPoint(screens.rear, lid * (0.12 + 0.76 * a), u);
          return [p[0], p[1] + rise, p[2]];
        }
        const z = z0 + (z1 - z0) * a;
        return [u * topX(z), deckBase(z) + deckLift(z, u) + rise, z];
      },
      us = [-0.5, -0.25, 0, 0.25, 0.5],
      as = [0, 1 / 3, 2 / 3, 1];
    for (let j = 1; j < as.length; j++)
      for (let k = 1; k < us.length; k++)
        face(
          details,
          [
            deckPoint(as[j - 1], us[k - 1], 0.004),
            deckPoint(as[j - 1], us[k], 0.004),
            deckPoint(as[j], us[k], 0.004),
            deckPoint(as[j], us[k - 1], 0.004),
          ],
          black,
          [0, 1, 0],
        );
    for (let k = 0; k < 13; k++) {
      const u = -0.46 + (0.92 * k) / 12;
      path(
        details,
        as.map((a) => deckPoint(a, u, 0.011)),
        0.006,
        k === 6 ? paint : black,
      );
    }
  }
  if (f.clawDrl)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        front.rod(
          [side * (W * 0.35 + i * 0.045), lampY - 0.06, zf + 0.032],
          [side * (W * 0.33 + i * 0.045), lampY - 0.28, zf + 0.032],
          0.012,
          light,
        );
  if (f.lowerRound)
    for (const side of [-1, 1]) {
      front.add(new T.CircleGeometry(0.115, 20), black, [side * W * 0.34, gy - 0.05, zf + 0.021]);
      front.ring(0.087, 0.012, [side * W * 0.34, gy - 0.05, zf + 0.035], light);
    }
  if (f.windowDividers)
    for (const side of [-1, 1]) {
      details.rod(
        [side * W * 0.495, belt - 0.08, -L * 0.1],
        [side * W * 0.495, belt - 0.08, -L * 0.39],
        0.01,
        black,
      );
      for (const z of [-L * 0.04, -L * 0.27])
        details.rod(
          [side * W * 0.493, belt + 0.05, z],
          [side * W * 0.4, H - 0.08, z],
          0.017,
          black,
        );
    }
  if (f.grilleSlash)
    front.rod(
      [-gw * 0.85, gy - gh * 0.8, zf + 0.045],
      [gw * 0.85, gy + gh * 0.8, zf + 0.045],
      0.018,
      chrome,
    );
  if (f.stripes) {
    const stripeY = (x, z) =>
      beltAt(z) +
      (1 - (x / (widthAt(z) * 0.96)) ** 2) * ((f.hoodSculpt ?? 0.045) - fenderRise(z)) +
      0.003;
    for (const x of [-W * 0.075, W * 0.075]) {
      for (let i = 0; i < 16; i++) {
        const a = cowl + ((L / 2 - noseRound - cowl) * i) / 16,
          b = cowl + ((L / 2 - noseRound - cowl) * (i + 1)) / 16;
        face(
          details,
          [
            [x - 0.055, stripeY(x - 0.055, a), a],
            [x + 0.055, stripeY(x + 0.055, a), a],
            [x + 0.055, stripeY(x + 0.055, b), b],
            [x - 0.055, stripeY(x - 0.055, b), b],
          ],
          light,
          [0, 1, 0],
        );
      }
    }
  }
  // Neutral badges only. A reference interpretation carries no manufacturer emblem, wordmark or
  // model lettering in its geometry; the make, model and year identify it in recipe.json, the
  // entity doc and the README instead (see content/entities/NOTICE.md). The same plain chrome
  // ring and disc front and rear keep the badge positions without reproducing any mark.
  {
    const y = s.grille === 'closed' ? H * f.nose + 0.016 : gy;
    front.ring(0.042, 0.006, [0, y, zf + 0.04], chrome);
    front.add(new T.CircleGeometry(0.024, 20), chrome, [0, y, zf + 0.042]);
    rear.ring(0.03, 0.005, [0, belt * 0.78 + beltRise, -L / 2 - 0.043], chrome);
    // The house brand is the one wordmark geometry may carry (medium-fi "Bendy house brand").
    if (s.make === 'Bendy')
      rear.text('BENDY', [0, belt * 0.71 + beltRise, -L / 2 - 0.035], 0.04, Math.PI, chrome);
  }
  if (f.roofSign) {
    // Lit taxi roof sign on a low base, lettered both ways.
    const y = roofY + roofCrown + 0.02;
    details.box([W * 0.36, 0.035, 0.36], [0, y, (rr + rf) / 2], black);
    details.box([W * 0.32, 0.15, 0.26], [0, y + 0.09, (rr + rf) / 2], light);
    for (const end of [-1, 1])
      details.text(
        f.roofSign,
        [0, y + 0.09, (rr + rf) / 2 + end * 0.132],
        0.07,
        end < 0 ? Math.PI : 0,
        black,
      );
  }
  for (const end of [-1, 1]) {
    const d = end > 0 ? front : rear,
      z = end * (L / 2 + 0.045),
      y = clearance + 0.13;
    d.box([0.31, 0.15, 0.018], [0, y, z], black);
    d.box([0.285, 0.125, 0.02], [0, y, z + end * 0.01], light);
    d.text(
      s.plate ?? `MLN ${String(s.year).slice(2)}`,
      [0, y, z + end * 0.023],
      0.037,
      end < 0 ? Math.PI : 0,
      black,
    );
  }
  // Wheels have separate steering/spin/caliper transforms, bevelled tires and open alloy spokes.
  function wheel(name, x, z) {
    const pivot = new T.Group();
    pivot.name = name;
    pivot.position.set(x, R, z);
    root.add(pivot);
    const spin = new T.Group();
    spin.name = `${name}-spin`;
    pivot.add(spin);
    const d = detailKit(spin, 'wheel-surfaces');
    const fixed = detailKit(pivot, `${name}-brakes`);
    // Road tires have a smooth crown and a rounded shoulder; all-terrain and mud-terrain tires
    // keep a squarer shoulder and carry tread blocks (form.tread).
    const profile =
      tread === 'road'
        ? [
            [-0.5, 0.71],
            [-0.51, 0.82],
            [-0.47, 0.92],
            [-0.38, 0.975],
            [-0.22, 1],
            [0.22, 1],
            [0.38, 0.975],
            [0.47, 0.92],
            [0.51, 0.82],
            [0.5, 0.71],
          ].map(([x, r]) => [tireW * x, R * r])
        : [
            [-tireW * 0.5, R * 0.71],
            [-tireW * 0.5, R * 0.87],
            [-tireW * 0.38, R * 0.97],
            [-tireW * 0.26, R],
            [tireW * 0.26, R],
            [tireW * 0.38, R * 0.97],
            [tireW * 0.5, R * 0.87],
            [tireW * 0.5, R * 0.71],
          ];
    const tire = new T.LatheGeometry(
      profile.map(([x, r]) => new T.Vector2(r, x)),
      tread === 'road' ? 36 : 32,
    ).rotateZ(Math.PI / 2);
    // A dually's rear axle carries a second tire just inboard of the outer one.
    const dual = f.dually && z === axleRear ? tire.clone() : undefined;
    d.add(tire, rubber);
    // Rim, spokes, lugs and caliper face outboard. The inboard face is only seen from under the
    // car, so it is a dark disc that closes the tire rather than a second detailed wheel.
    const outboard = Math.sign(x) || 1;
    d.add(new T.CircleGeometry(R * 0.71, 16).rotateY((-outboard * Math.PI) / 2), black, [
      -outboard * tireW * 0.5,
      0,
      0,
    ]);
    if (dual) {
      d.add(dual.translate(-outboard * tireW * 1.2, 0, 0), rubber);
      d.add(new T.CircleGeometry(R * 0.71, 16).rotateY((-outboard * Math.PI) / 2), black, [
        -outboard * tireW * 1.7,
        0,
        0,
      ]);
    }
    if (alloyStyles.includes(wheelStyle)) alloyRim(outboard);
    else commercialRim(outboard, !!dual);
    // Alloy rims: a bright lip round a dark inner barrel with the brake disc and caliper behind
    // the face, so the openings read dark and the design reads at three-quarter distance.
    // wheelStyle 'alloy' N straight spokes (spokes), 'split' N twin spokes, 'multi' N slim
    // spokes (default 15), 'mesh' cross-laced spokes, 'dial' a dished face pierced by N round
    // holes, 'aero' a flat cover with N slots near the rim; wheelFinish 'silver', 'dark'
    // (graphite) or 'machined' (bright faces on dark-painted spokes and lip).
    function alloyRim(side) {
      const xx = side * (tireW * 0.51),
        rim = R * 0.7,
        hub = R * 0.18,
        design = f.aeroWheels && wheelStyle === 'alloy' ? 'aero' : wheelStyle,
        bright = wheelFinish === 'dark' ? darkAlloy : chrome,
        flank = wheelFinish === 'silver' ? chrome : wheelFinish === 'dark' ? darkAlloy : black;
      // Rim point at radius r, angle a, inset behind the face (m).
      const at = (r, a, inset = 0) => [xx - side * inset, Math.cos(a) * r, Math.sin(a) * r];
      d.ring(rim, 0.013, [xx, 0, 0], wheelFinish === 'machined' ? black : bright, 'x');
      d.add(
        new T.LatheGeometry(
          [
            [rim * 0.99, 0.006],
            [rim * 0.9, 0.045],
            [rim * 0.62, 0.062],
          ].map(([r, inset]) => new T.Vector2(r, side * inset)),
          20,
        ).rotateZ(Math.PI / 2),
        black,
        [xx, 0, 0],
      );
      // Brake disc behind the spokes (it turns with the wheel; the caliper does not).
      d.add(new T.CircleGeometry(rim * 0.62, 18).rotateY((side * Math.PI) / 2), chrome, [
        xx - side * 0.052,
        0,
        0,
      ]);
      // A spoke from the hub at angle a0 to the rim at angle a1, wHub and wRim wide (m), with a
      // face standing `depth` proud of its flanks; the face rises from inset 0.012 at the hub.
      const spoke = (a0, a1, wHub, wRim, depth = 0.022) => {
        const r0 = hub * 0.95,
          r1 = rim * 0.96,
          h0 = wHub / 2 / r0,
          h1 = wRim / 2 / r1;
        const top = [
          at(r0, a0 - h0, 0.012),
          at(r1, a1 - h1),
          at(r1, a1 + h1),
          at(r0, a0 + h0, 0.012),
        ];
        const foot = [
          at(r0, a0 - h0, 0.012 + depth),
          at(r1, a1 - h1, depth),
          at(r1, a1 + h1, depth),
          at(r0, a0 + h0, 0.012 + depth),
        ];
        face(d, top, bright, [side, 0, 0]);
        for (const [i, j] of [
          [0, 1],
          [2, 3],
        ])
          face(d, [top[i], top[j], foot[j], foot[i]], flank, [0, 0, 0]);
      };
      const count =
        f.spokes ??
        (design === 'multi'
          ? 15
          : design === 'mesh'
            ? 10
            : f.aeroWheels
              ? 5
              : s.make === 'Toyota'
                ? 6
                : s.make === 'Honda'
                  ? 10
                  : 5);
      const pitch = (Math.PI * 2) / count;
      if (design === 'dial' || design === 'aero') {
        // A dished face (dial) or a flat cover (aero), pierced near the rim.
        const dish = design === 'dial' ? 0.026 : 0.008;
        const profile = [
          [rim * 0.97, 0.004],
          [rim * 0.55, dish],
          [hub, dish * 0.4],
        ];
        d.add(
          new T.LatheGeometry(
            profile.map(([r, inset]) => new T.Vector2(r, side * inset)),
            Math.max(20, count * 4),
          ).rotateZ(Math.PI / 2),
          bright,
          [xx, 0, 0],
        );
        for (let i = 0; i < count; i++) {
          const a = (i + 0.5) * pitch,
            r = design === 'dial' ? rim * 0.68 : rim * 0.8,
            inset = design === 'dial' ? dish * 0.62 - 0.003 : dish * 0.45 - 0.003;
          d.add(
            new T.CircleGeometry(1, design === 'dial' ? 12 : 8)
              .scale(
                design === 'dial' ? rim * 0.2 : Math.min(rim * 0.22, (r * pitch) / 3),
                design === 'dial' ? rim * 0.2 : rim * 0.075,
                1,
              )
              .rotateY((side * Math.PI) / 2)
              .rotateX(a),
            black,
            at(r, a, inset),
          );
        }
      } else
        for (let i = 0; i < count; i++) {
          const a = i * pitch,
            wide = (rim * pitch * (count > 6 ? 0.3 : 0.36)) / (design === 'split' ? 1.9 : 1);
          if (design === 'split')
            for (const k of [-1, 1])
              spoke(a + k * pitch * 0.05, a + k * pitch * 0.13, wide * 0.8, wide);
          else if (design === 'mesh')
            for (const k of [-1, 1]) spoke(a, a + k * pitch, 0.016, 0.014, 0.014);
          else spoke(a, a, Math.min(wide, hub * pitch * 0.75), wide);
        }
      d.add(new T.CylinderGeometry(hub, hub, 0.018, 12).rotateZ(Math.PI / 2), bright, [
        xx - side * 0.012,
        0,
        0,
      ]);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        d.add(new T.CylinderGeometry(0.009, 0.009, 0.012, 6).rotateZ(Math.PI / 2), black, [
          xx,
          Math.cos(a) * R * 0.12,
          Math.sin(a) * R * 0.12,
        ]);
      }
      fixed.box(
        [0.02, R * 0.26, R * 0.13],
        [xx - side * 0.038, R * 0.4, 0],
        s.bodyStyle === 'coupe' ? red : chrome,
      );
    }
    // Commercial rims (wheelStyle): 'steel' is a pressed disc dished in from the rim to a raised
    // bolt flange, with hand holes round it, lug nuts and a hub (a dually's hub-piloted wheels:
    // oval holes, eight or ten lugs and a hub standing proud); 'hubcap' a domed full cover with
    // vent slots and a centre cap. The outer rear disc of a dually pair is dished deep toward its
    // hub, as that wheel is mounted.
    function commercialRim(side, outerDual) {
      const xx = side * (tireW * 0.51),
        rim = R * 0.7,
        cover = wheelStyle === 'hubcap',
        piloted = !!f.dually,
        dish = outerDual ? 0.075 : 0.02;
      d.ring(rim, 0.013, [xx, 0, 0], chrome, 'x');
      // Disc profile as [radius, inset behind the tire face].
      const profile = cover
        ? [
            [rim * 0.99, 0.008],
            [rim * 0.82, -0.004],
            [rim * 0.45, -0.014],
            [R * 0.12, -0.018],
            [0, -0.018],
          ]
        : [
            [rim * 0.99, 0.01],
            [rim * 0.86, 0.03],
            [rim * 0.62, 0.02 + dish * 0.55],
            [R * 0.3, dish],
            [R * 0.05, dish],
          ];
      const insetAt = (r) => {
        let i = 1;
        while (i < profile.length - 1 && profile[i][0] > r) i++;
        const [r0, a0] = profile[i - 1],
          [r1, a1] = profile[i];
        return a0 + ((a1 - a0) * (r0 - r)) / (r0 - r1);
      };
      d.add(
        new T.LatheGeometry(
          profile.map(([r, inset]) => new T.Vector2(r, side * inset)),
          24,
        ).rotateZ(Math.PI / 2),
        chrome,
        [xx, 0, 0],
      );
      // Hand holes (or the cover's vent slots), dark ovals lying on the disc.
      const holes = cover ? 8 : piloted ? 5 : 6,
        rh = rim * (cover ? 0.62 : 0.74),
        [along, across] = cover
          ? [R * 0.07, R * 0.025]
          : piloted
            ? [R * 0.11, R * 0.055]
            : [R * 0.06, R * 0.06];
      for (let i = 0; i < holes; i++) {
        const a = ((i + 0.5) * Math.PI * 2) / holes;
        d.add(
          new T.CircleGeometry(1, 12)
            .scale(along, across, 1)
            .rotateY((side * Math.PI) / 2)
            .rotateX(a),
          black,
          [xx - side * (insetAt(rh) - 0.004), Math.cos(a) * rh, Math.sin(a) * rh],
        );
      }
      if (cover)
        d.add(new T.CylinderGeometry(R * 0.12, R * 0.13, 0.016, 12).rotateZ(Math.PI / 2), chrome, [
          xx + side * 0.024,
          0,
          0,
        ]);
      else {
        // Lug nuts on the flange round a hub: hub-piloted hubs stand out past the tire face.
        const lugs = piloted ? (R > 0.47 ? 10 : 8) : 5,
          bolt = R * (piloted ? 0.235 : 0.19),
          face = xx - side * (dish - 0.012),
          hub = piloted ? dish + (outerDual ? 0.005 : 0.04) : 0.016;
        for (let i = 0; i < lugs; i++) {
          const a = (i * Math.PI * 2) / lugs;
          d.add(new T.CylinderGeometry(0.014, 0.014, 0.026, 6).rotateZ(Math.PI / 2), black, [
            face,
            Math.cos(a) * bolt,
            Math.sin(a) * bolt,
          ]);
        }
        d.add(
          // Wider at the flange (the cylinder's top turns inboard), narrower at its cap.
          new T.CylinderGeometry(R * 0.17, R * (piloted ? 0.13 : 0.11), hub, 12).rotateZ(
            (side * Math.PI) / 2,
          ),
          chrome,
          [xx - side * (dish - hub / 2), 0, 0],
        );
      }
      fixed.box([0.025, R * 0.26, R * 0.13], [xx - side * (dish + 0.06), R * 0.35, 0], black);
    }
    // Tread blocks, merged with the tire material rather than individual draw calls: small
    // all-terrain blocks, or staggered mud-terrain lugs, each one bent prism from the crown over
    // the shoulder with only its visible faces.
    const lugs = f.lite || tread === 'road' ? 0 : tread === 'mt' ? 18 : 32;
    if (tread === 'mt' && lugs) {
      const vertices = [],
        h = 0.013,
        quad = (a, b, c, e) => vertices.push(...a, ...b, ...c, ...a, ...c, ...e);
      for (let i = 0; i < lugs; i++)
        for (const sign of [-1, 1]) {
          const a = ((i + (sign > 0 ? 0.5 : 0)) * Math.PI * 2) / lugs,
            spread = 0.027 / R;
          // Across the tire as [x, radius]: on the tire, and raised h along its outward normal.
          const base = [
              [0.06, R],
              [0.3, R],
              [0.5, R * 0.86],
            ],
            top = [
              [0.06, R + h],
              [0.31, R + h],
              [0.5 + h / tireW, R * 0.86],
            ];
          const at = ([x, r], da) => [sign * tireW * x, Math.cos(a + da) * r, Math.sin(a + da) * r];
          for (let k = 1; k < 3; k++) {
            quad(
              at(top[k - 1], -spread),
              at(top[k], -spread),
              at(top[k], spread),
              at(top[k - 1], spread),
            );
            for (const da of [-spread, spread])
              quad(at(base[k - 1], da), at(base[k], da), at(top[k], da), at(top[k - 1], da));
          }
          for (const k of [0, 2])
            quad(
              at(base[k], -spread),
              at(base[k], spread),
              at(top[k], spread),
              at(top[k], -spread),
            );
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      d.add(geometry, rubber);
    } else
      for (let i = 0; i < lugs; i++)
        for (const sign of [-1, 1]) {
          const a = (i * Math.PI * 2) / lugs;
          const block = d.box(
            [tireW * 0.32, 0.005, 0.035],
            [sign * tireW * 0.2, Math.cos(a) * (R + 0.001), Math.sin(a) * (R + 0.001)],
            rubber,
          );
          block.rotation.x = a;
        }
    d.finish();
    fixed.finish();
    return pivot;
  }
  for (const side of [-1, 1])
    for (const [axle, z] of [
      ['front', axleFront],
      ['rear', axleRear],
    ])
      wheel(`wheel-${axle}-${side > 0 ? 'left' : 'right'}`, (side * track) / 2, z);
  if (f.spare) {
    // Carried on the tailgate by a short bracket, not hovering behind it.
    const d = detailKit(root, 'rear-spare');
    const z = -L / 2 - R * 0.21 - 0.045;
    // spareCover: 'body', 'silver' or 'black' a full cover with a dark centre; 'ring' a black
    // cover over the tire only, leaving the alloy face with its openings.
    const cover = f.spareCover;
    if (['body', 'silver', 'black'].includes(cover)) {
      d.add(
        new T.CylinderGeometry(R * 1.01, R * 1.01, R * 0.44, 24).rotateX(Math.PI / 2),
        { body: paint, silver: chrome, black }[cover],
        [0, belt * 0.85, z],
      );
      d.add(
        new T.CircleGeometry(R * 0.36, 16).rotateY(Math.PI),
        cover === 'black' ? chrome : black,
        [0, belt * 0.85, z - R * 0.22 - 0.015],
      );
    } else
      d.add(
        new T.TorusGeometry(R * 0.79, R * (cover === 'ring' ? 0.23 : 0.21), 8, 24),
        cover === 'ring' ? black : rubber,
        [0, belt * 0.85, z],
      );
    d.add(new T.CylinderGeometry(R * 0.53, R * 0.53, 0.13, 16).rotateX(Math.PI / 2), chrome, [
      0,
      belt * 0.85,
      z,
    ]);
    if (cover === 'ring')
      for (let i = 0; i < 6; i++) {
        const a = ((i + 0.5) * Math.PI) / 3;
        d.add(
          new T.CircleGeometry(1, 10)
            .scale(R * 0.09, R * 0.13, 1)
            .rotateY(Math.PI)
            .rotateZ(-a),
          black,
          [Math.sin(a) * R * 0.33, belt * 0.85 + Math.cos(a) * R * 0.33, z - 0.068],
        );
      }
    d.box([0.16, 0.16, -z - L / 2 + 0.02], [0, belt * 0.85, (z - L / 2) / 2], black);
    d.finish();
  }
  // The eye and controls are authored together so the driver can actually see out.
  const eye = s.driverEye ?? [W * 0.23, H - 0.32, cowl - 0.66],
    dashY = f.fitCabin
      ? Math.max(eye[1] - 0.36, Math.min(eye[1] - 0.27, belt - 0.055))
      : eye[1] - 0.27,
    dashZ = eye[2] + 0.57;
  const seatY = eye[1] - 0.59;
  const cabinWidth =
    Math.min(...zs.filter((z) => z >= eye[2] - 0.7 && z <= cowl).map(widthAt)) * 1.8 - 0.035;
  const headroomAt = (x, z) => {
    if (f.openTop) return H + 0.3;
    if (z >= rr && z <= rf) return roofEdge(z) + roofCrown * (1 - (x / roofWAt(z)) ** 2);
    const front = z > rf;
    const base = front ? cowl : rb;
    const top = front ? rf : rr;
    const t = Math.max(0, Math.min(1, (z - base) / (top - base)));
    const halfWidth =
      (front ? sill : W * rearGlassWidth) * (1 - t) + (front ? roofW : roofWAt(rr)) * t;
    return (
      belt + ((front ? frontGlassY : rearY) - belt) * t + roofCrown * (1 - (x / halfWidth) ** 2) * t
    );
  };
  for (let row = 0; row < (f.rows ?? 2); row++)
    for (const x of [-W * 0.23, W * 0.23]) {
      const z = eye[2] - 0.14 - row * 0.77;
      if (z < rb + 0.17) continue;
      const seatRoot = new T.Group();
      seatRoot.name = `seat-${row}-${x > 0 ? 'left' : 'right'}`;
      root.add(seatRoot);
      const upholstery = detailKit(seatRoot, 'upholstery');
      const ceiling =
        Math.min(
          ...[-0.215, 0.215].flatMap((dx) =>
            [-0.29, 0.225].map((dz) => headroomAt(x + dx, z + dz)),
          ),
        ) - 0.055;
      // Rear seats in a fastback have less headroom than the front row. Fit the complete seat,
      // including its headrest and belt, beneath the actual roof/rear-glass profile.
      seatRoot.position.y = seatY;
      seatRoot.scale.y = Math.min(1, Math.max(0.4, (ceiling - seatY) / 0.67));
      upholstery.box([0.43, 0.1, 0.45], [x, 0, z], seat);
      const back = upholstery.box([0.43, 0.48, 0.08], [x, 0.25, z - 0.2], seat);
      back.rotation.x = -0.13;
      for (const dx of [-0.17, 0.17])
        upholstery.box([0.045, 0.4, 0.11], [x + dx, 0.25, z - 0.16], black);
      upholstery.box([0.25, 0.16, 0.09], [x, 0.59, z - 0.22], seat);
      for (const dx of [-0.075, 0.075])
        upholstery.rod([x + dx, 0.42, z - 0.22], [x + dx, 0.55, z - 0.22], 0.008, chrome);
      for (const dx of [-0.11, 0.11])
        upholstery.rod([x + dx, 0.065, z - 0.16], [x + dx, 0.065, z + 0.17], 0.0025, chrome);
      upholstery.rod(
        [x + Math.sign(x) * 0.15, 0.45, z - 0.16],
        [x - Math.sign(x) * 0.15, 0.07, z + 0.08],
        0.013,
        black,
      );
      upholstery.finish();
      seatRoot.updateMatrixWorld(true);
      seatRoot.traverse((mesh) => {
        if (!mesh.isMesh) return;
        cabin.add(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mesh.material);
        mesh.geometry.dispose();
      });
      root.remove(seatRoot);
    }
  addRoadDashboard(
    root,
    s,
    {
      eye,
      width: cabinWidth,
      doorTop: belt - 0.025,
      dashY,
      dashZ,
      seatY,
      clearance,
      shallowDash: f.fitCabin && belt - 0.055 < eye[1] - 0.36,
      cabin,
      black,
      chrome,
      pixel,
      screen,
      red,
    },
    detailKit,
  );
  // Match the bowed windshield base and the fascia with one continuous, tapered cowl.
  // A rotated rectangular box left open strips at its edges and around the lower A-pillars.
  const nearZ = dashZ - (f.fitCabin && belt - 0.055 < eye[1] - 0.36 ? 0.075 : 0);
  const nearY = dashY + 0.064;
  const cowlPoint = (u) => [u * sill, belt + 0.004, cowl + 0.008];
  for (let i = 1; i < across.length; i++) {
    const a = across[i - 1],
      b = across[i];
    face(
      cabin,
      [
        [a * cabinWidth * 0.425, nearY, nearZ],
        [b * cabinWidth * 0.425, nearY, nearZ],
        cowlPoint(b),
        cowlPoint(a),
      ],
      black,
      [0, 1, 0],
    );
  }
  for (const side of [-1, 1]) {
    face(
      cabin,
      [
        [side * cabinWidth * 0.425, nearY, nearZ],
        cowlPoint(side),
        [side * (sill - 0.01 * W), clearance + 0.035, cowl],
        [side * cabinWidth * 0.425, clearance + 0.035, nearZ],
      ],
      black,
      [-side, 0, 0],
    );
  }
  // Each wheel well has an inner wall; an open rear arch otherwise exposes the far-side sky.
  for (const axle of [axleFront, axleRear])
    for (const side of [-1, 1]) {
      const x = side * (track / 2 - tireW / 2 - 0.015);
      const rim = Array.from({ length: 25 }, (_, i) => {
        const z = axle - arch + (i * arch) / 12;
        return [x, R + archRise(z - axle), z];
      });
      face(cabin, [...rim, [x, R, axle + arch], [x, R, axle - arch]], black, [-side, 0, 0]);
    }
  // Interior mirror mounted inside the top of the windscreen.
  cabin.box([0.2, 0.06, 0.025], [0, frontGlassY - 0.11, rf + 0.12], black);
  cabin.box([0.18, 0.043, 0.005], [0, frontGlassY - 0.11, rf + 0.105], chrome);
  for (const d of [shell, details, windows, cabin, front, rear]) d.finish();
  // Engine bay under the opening hood (road-articulation.mjs): a dark tray that follows the
  // hood's fall and stays inset from the plan outline, section and nose, built before the end
  // lean so it leans with the nose and never shows through a rounded or low front.
  if (s.articulate !== false) {
    const bayFront = (hw, y) => L / 2 - endOffset(hw, 1, y) - 0.05;
    const top = (z) => beltAt(z) - 0.035,
      bottom = (z) => Math.max(clearance + 0.06, top(z) - 0.12),
      half = (z) => Math.max(0.05, Math.min(W * 0.325, widthAt(z) * sectionAt(z, top(z)) - 0.05));
    const z0 = cowl + 0.08;
    let z1 = L / 2 - 0.1;
    for (let k = 0; k < 4; k++)
      z1 = Math.min(z1, bayFront(half(z1), bottom(z1)), bayFront(half(z1), top(z1)));
    if (z1 > z0 + 0.1) {
      const cuts = Array.from({ length: 7 }, (_, i) => z0 + ((z1 - z0) * i) / 6);
      const ring = (z) => [
        [-half(z), bottom(z), z],
        [half(z), bottom(z), z],
        [half(z), top(z), z],
        [-half(z), top(z), z],
      ];
      const vertices = [];
      const quad = (a, b, c, d) => vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let i = 1; i < cuts.length; i++) {
        const a = ring(cuts[i - 1]),
          b = ring(cuts[i]);
        for (let k = 0; k < 4; k++) quad(a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]);
      }
      for (const [z, flip] of [
        [z0, true],
        [z1, false],
      ]) {
        const r = ring(z);
        if (flip) quad(r[3], r[2], r[1], r[0]);
        else quad(...r);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals();
      const bay = new T.Mesh(geometry, black);
      bay.name = 'engine-bay';
      root.add(bay);
    }
  }
  leanEnds(root, {
    L,
    clearance,
    ends: [
      {
        sign: 1,
        start: axleFront + arch + 0.02,
        bumper: clearance + (H * f.nose - clearance) * (f.bumperLine ?? (boxy ? 0.3 : 0.5)),
        top: H * f.nose,
        lean: f.noseSlope ?? (boxy ? 0.06 : sedanLike ? 0.2 : style === 'van' ? 0.13 : 0.15),
        chin: f.chin ?? (boxy ? 0.05 : 0.1),
      },
      {
        sign: -1,
        start: axleRear - arch - 0.02,
        bumper: clearance + (deckEnd - clearance) * (f.rearBumperLine ?? (boxy ? 0.3 : 0.5)),
        top: deckEnd,
        lean: f.tailSlope ?? (boxy ? 0.02 : sedanLike ? 0.12 : 0.07),
        chin: f.tailTuck ?? (boxy ? 0.06 : sedanLike ? 0.1 : 0.08),
        lip: tailLip,
      },
    ],
  });
  return s.articulate === false
    ? root
    : articulateRoadVehicle(root, s, {
        cowl,
        bz,
        rearShut,
        coupeShut,
        clearance,
        belt,
        roofY,
        rb,
        rr,
        paint,
        black,
      });
}

/**
 * Lean the body ends in side view. The bumper line stays the longest point; above it the
 * fascia leans back to the hood or deck edge, below it the valance tucks under. Every finished
 * surface but the wheels moves with it, so lamps, grille and plate stay on the fascia. Points
 * are only drawn toward the axles, never past each other, so no face folds.
 */
function leanEnds(root, { L, clearance, ends }) {
  const setback = (end, y) => {
    // A rolled lip (quarter circle of radius end.lip) turns the top of the fascia into the deck.
    const lip = end.lip ?? 0,
      roll = Math.min(y, end.top) - (end.top - lip);
    if (y >= end.bumper)
      return (
        end.lean * Math.pow(Math.min(1, (y - end.bumper) / (end.top - end.bumper)), 1.5) +
        (lip > 0 && roll > 0 ? lip - Math.sqrt(Math.max(0, lip * lip - roll * roll)) : 0)
      );
    return end.chin * Math.pow(Math.min(1, (end.bumper - y) / (end.bumper - clearance)), 1.4);
  };
  const warp = (x, y, z) => {
    for (const end of ends) {
      const span = L / 2 - end.sign * end.start,
        u = (end.sign * z - end.sign * end.start) / span;
      if (span <= 0 || u <= 0) continue;
      // Fittings standing proud of the tip (plates, lamps) move with the tip, not further.
      return [
        x,
        y,
        z - end.sign * Math.min(setback(end, y), span * 0.6) * Math.pow(Math.min(1, u), 1.5),
      ];
    }
    return [x, y, z];
  };
  const p = new T.Vector3(),
    n = new T.Vector3(),
    jacobian = new T.Matrix3(),
    columns = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  const h = 1e-4;
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    for (let o = mesh; o && o !== root; o = o.parent) if (o.name.startsWith('wheel-')) return;
    const matrix = toRoot.clone().multiply(mesh.matrixWorld),
      inverse = matrix.clone().invert(),
      normalMatrix = new T.Matrix3().getNormalMatrix(matrix),
      backMatrix = new T.Matrix3().getNormalMatrix(inverse),
      geometry = mesh.geometry,
      position = geometry.getAttribute('position'),
      normal = geometry.getAttribute('normal');
    const moved = [];
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix);
      const q = warp(p.x, p.y, p.z);
      moved.push(q);
      if (normal) {
        // Normals transform by the inverse transpose of the warp's Jacobian.
        for (let k = 0; k < 3; k++) {
          const a = [p.x, p.y, p.z],
            b = [p.x, p.y, p.z];
          a[k] += h;
          b[k] -= h;
          const fa = warp(...a),
            fb = warp(...b);
          columns[k].set(
            (fa[0] - fb[0]) / (2 * h),
            (fa[1] - fb[1]) / (2 * h),
            (fa[2] - fb[2]) / (2 * h),
          );
        }
        jacobian.set(
          columns[0].x,
          columns[1].x,
          columns[2].x,
          columns[0].y,
          columns[1].y,
          columns[2].y,
          columns[0].z,
          columns[1].z,
          columns[2].z,
        );
        jacobian.invert().transpose();
        n.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).applyMatrix3(jacobian);
        n.applyMatrix3(backMatrix).normalize();
        normal.setXYZ(i, n.x, n.y, n.z);
      }
    }
    for (const [i, q] of moved.entries()) {
      p.set(...q).applyMatrix4(inverse);
      position.setXYZ(i, p.x, p.y, p.z);
    }
    // Faceted triangles keep one face normal after the warp.
    if (normal && !geometry.index) {
      const a = new T.Vector3(),
        b = new T.Vector3(),
        c = new T.Vector3(),
        face = new T.Vector3(),
        na = new T.Vector3(),
        nb = new T.Vector3(),
        nc = new T.Vector3();
      for (let i = 0; i + 2 < position.count; i += 3) {
        na.fromBufferAttribute(normal, i);
        nb.fromBufferAttribute(normal, i + 1);
        nc.fromBufferAttribute(normal, i + 2);
        if (na.distanceToSquared(nb) > 1e-6 || na.distanceToSquared(nc) > 1e-6) continue;
        a.fromBufferAttribute(position, i);
        b.fromBufferAttribute(position, i + 1);
        c.fromBufferAttribute(position, i + 2);
        face.subVectors(c, b).cross(a.sub(b)).normalize();
        if (face.lengthSq() < 0.5) continue;
        if (face.dot(na) < 0) face.negate();
        for (let k = 0; k < 3; k++) normal.setXYZ(i + k, face.x, face.y, face.z);
      }
    }
    position.needsUpdate = true;
    if (normal) normal.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  });
}
