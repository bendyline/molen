// Intraspecific/form variation, not new botanical or geographic claims. Original IDs stay valid.
const round = (value) => Math.round(value * 10000) / 10000;
const shade = (hex, factor) =>
  `#${hex
    .slice(1)
    .match(/../g)
    .map((v) =>
      Math.min(255, Math.round(Number.parseInt(v, 16) * factor))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
export function plantVariants(base) {
  return [
    base,
    ...[
      {
        name: 'spreading',
        height: 0.88,
        width: 1.16,
        crown: -0.08,
        stem: 1.08,
        lean: 0.02,
        seed: 137,
        color: 0.94,
      },
      {
        name: 'slender',
        height: 1.12,
        width: 0.84,
        crown: 0.07,
        stem: 0.86,
        lean: 0.045,
        seed: 911,
        color: 1.06,
      },
    ].map((v) => {
      // A taxon has one canonical mapped-tree binding; habitat populations contain all forms.
      const { taxa: _taxa, ...form } = base;
      return {
        ...form,
        id: `${base.id}.${v.name}`,
        title: `${base.title}: ${v.name} form`,
        height: round(Math.max(0.1, base.height * v.height)),
        width: round(base.width * v.width),
        crownBase: round(Math.max(0.05, Math.min(0.85, base.crownBase + v.crown))),
        stemRadius: round(base.stemRadius * v.stem),
        lean: round(Math.min(0.3, base.lean + v.lean)),
        shapeSeed: v.seed,
        foliage: shade(base.foliage, v.color),
        bark: shade(base.bark, v.color),
      };
    }),
  ];
}
