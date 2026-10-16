// Opening rhythm and roof/detail alternatives within each construction family. Footprints,
// mapped heights, use rules, shared materials and the base recipe's applicability stay intact.
const rounded = (value) => Math.round(value * 1000) / 1000;
const scaled = (range, factor) => ({
  min: rounded(range.min * factor),
  max: rounded(range.max * factor),
});
export function architectureVariants(base) {
  return [
    base,
    ...[
      { name: 'compact', bay: 0.86, window: 0.85, eave: 0.8, detail: 0.85, probability: 0.96 },
      { name: 'open', bay: 1.2, window: 1.18, eave: 1.15, detail: 1.12, probability: 0.82 },
    ].map((v) => {
      const style = structuredClone(base);
      style.id = `${base.id}.${v.name}`;
      style.title = `${base.title}: ${v.name} facade`;
      style.facade.bays.width = scaled(base.facade.bays.width, v.bay);
      style.facade.windows.width = scaled(base.facade.windows.width, v.window);
      style.facade.windows.height = scaled(
        base.facade.windows.height,
        v.name === 'compact' ? 1.07 : 0.94,
      );
      style.facade.windows.probabilityPerBay = rounded(
        base.facade.windows.probabilityPerBay * v.probability,
      );
      style.roof.overhang = scaled(base.roof.overhang, v.eave);
      for (const roof of style.roof.choices) {
        if (roof.type === 'gable') roof.weight = v.name === 'compact' ? 5 : 1;
        if (roof.type === 'hip') roof.weight = v.name === 'compact' ? 1 : 5;
        if (roof.parapet) roof.parapet.height = scaled(roof.parapet.height, v.detail);
      }
      const details = style.facade.details;
      for (const key of ['awnings', 'veranda', 'balconies'])
        if (details[key]) details[key].depth = rounded(details[key].depth * v.detail);
      if (details.balconies) details.balconies.every = v.name === 'compact' ? 3 : 1;
      // Same regional palette, different stable samples; never bleach its visible hue quota.
      for (const name of ['regional_wall', 'regional_roof']) {
        const entries = style.palettes[name].entries;
        const offset = v.name === 'compact' ? 1 : 2;
        style.palettes[name].entries = [...entries.slice(offset), ...entries.slice(0, offset)];
      }
      return style;
    }),
  ];
}
