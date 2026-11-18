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
      // Compact fronts lean to gables and open ones to hips, five to one, within the weight the
      // family gives its pitched roofs: the share of flat roofs is the family's, not the facade's.
      const gable = style.roof.choices.find((roof) => roof.type === 'gable');
      const hip = style.roof.choices.find((roof) => roof.type === 'hip');
      if (gable && hip) {
        const total = gable.weight + hip.weight;
        gable.weight = rounded((total * (v.name === 'compact' ? 5 : 1)) / 6);
        hip.weight = rounded((total * (v.name === 'compact' ? 1 : 5)) / 6);
      }
      for (const roof of style.roof.choices)
        if (roof.parapet) roof.parapet.height = scaled(roof.parapet.height, v.detail);
      const details = style.facade.details;
      for (const key of ['awnings', 'veranda', 'balconies', 'porch'])
        if (details[key]) details[key].depth = rounded(details[key].depth * v.detail);
      if (details.balconies) details.balconies.every = v.name === 'compact' ? 3 : 1;
      // Same regional palettes, different stable samples; never bleach their visible hue quota.
      for (const [name, palette] of Object.entries(style.palettes)) {
        if (!/^(regional_(wall|roof)|wall_|roof_)/.test(name)) continue;
        const entries = palette.entries;
        const offset = (v.name === 'compact' ? 1 : 2) % entries.length;
        palette.entries = [...entries.slice(offset), ...entries.slice(0, offset)];
      }
      return style;
    }),
  ];
}
