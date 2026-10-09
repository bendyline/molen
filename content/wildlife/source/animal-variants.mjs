// Modest adult body/coat variation. The same range, habitat, behavior and diagnostic details
// apply to every form; these do not claim a sex, age, subspecies or additional taxon.
const round = (value) => Math.round(value * 100000) / 100000;
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
export function animalVariants(base) {
  return [
    base,
    ...[
      { name: 'compact', height: 0.9, length: 0.94, width: 1.04, color: 0.93 },
      { name: 'rangy', height: 1.08, length: 1.06, width: 0.92, color: 1.06 },
    ].map((v) => ({
      ...base,
      id: `${base.id}.${v.name}`,
      title: `${base.title}: ${v.name} form`,
      body: {
        ...base.body,
        height: round(base.body.height * v.height),
        length: round(base.body.length * v.length),
        width: round(base.body.width * v.width),
        color: shade(base.body.color, v.color),
        accent: shade(base.body.accent, v.color),
      },
      margin: round(base.margin * Math.max(1, v.width)),
      ...(base.winterColor ? { winterColor: shade(base.winterColor, v.color) } : {}),
    })),
  ];
}
