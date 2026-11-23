import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  type FigureLookCatalog,
  randomFigureLook,
  setFigureLookOption,
} from '@bendyline/molen-figures/look';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { FigureDesigner } from '../src/index';

it('renders a controlled look on the server, with every person choice labelled', () => {
  const html = renderToStaticMarkup(
    <FigureDesigner
      look={randomFigureLook('server')}
      onChange={() => {}}
      strings={{ 'steer.masculine': 'Male', 'steer.unspecified': 'Non-binary' }}
    />,
  );
  for (const text of [
    'Male',
    'Non-binary',
    'Skin tone',
    'Head',
    'Hair style',
    'Hair texture',
    'Body shape',
    'Height',
  ])
    expect(html).toContain(text);
  for (const option of ['Tone 1 of 10', 'Face 12', 'Locs', 'Coily']) expect(html).toContain(option);
  expect(html).toContain('role="tablist"');
});

it('leaves out a category with a single choice', () => {
  const oneShoe: FigureLookCatalog = {
    ...DEFAULT_FIGURE_LOOK_CATALOG,
    categories: DEFAULT_FIGURE_LOOK_CATALOG.categories.map((c) =>
      c.id === 'footwear' ? { ...c, options: c.options.slice(0, 1) } : c,
    ),
  };
  const look = setFigureLookOption(randomFigureLook('server'), 'footwear', 'footwear.shoes');
  const html = renderToStaticMarkup(
    <FigureDesigner
      look={look}
      catalog={oneShoe}
      onChange={() => {}}
      sections={['outfit']}
      preview={false}
    />,
  );
  // This catalogue has one footwear: its colours show, but no one-option picker.
  expect(html).not.toContain('data-category="footwear"');
  expect(html).toContain('Footwear: Colour');
});

it('shows only the outfit for a wardrobe screen, and leaves out hidden parts', () => {
  const html = renderToStaticMarkup(
    <FigureDesigner
      look={{ broken: true }}
      onChange={() => {}}
      sections={['outfit']}
      hide={['bottom']}
      preview={false}
    />,
  );
  expect(html).toContain('Top');
  expect(html).not.toContain('Skin tone');
  expect(html).not.toContain('Skirt');
  expect(html).not.toContain('role="tablist"');
  expect(html).not.toContain('<canvas');
});

it('hides the bottom under a dress and names both colours of a jacket', () => {
  const dress = setFigureLookOption(randomFigureLook('server'), 'top', 'top.dress');
  const withDress = renderToStaticMarkup(
    <FigureDesigner look={dress} onChange={() => {}} sections={['outfit']} preview={false} />,
  );
  expect(withDress).toContain('data-category="top"');
  expect(withDress).not.toContain('data-category="bottom"');
  expect(withDress).toContain('Dress');

  const jacket = setFigureLookOption(randomFigureLook('server'), 'top', 'top.jacket');
  const withJacket = renderToStaticMarkup(
    <FigureDesigner look={jacket} onChange={() => {}} sections={['outfit']} preview={false} />,
  );
  expect(withJacket).toContain('data-category="bottom"');
  expect(withJacket).toContain('Top: Colour');
  expect(withJacket).toContain('Top: Shirt');
  for (const option of ['Hoodie', 'Coat', 'Wide trousers', 'Sneakers', 'Boots', 'Sandals'])
    expect(withJacket).toContain(option);
});

it('offers every accessory slot, single-option ones too, with none as a choice', () => {
  let look = randomFigureLook('server');
  look = setFigureLookOption(look, 'headwear', 'headwear.cap');
  look = setFigureLookOption(look, 'eyewear', 'eyewear.glasses');
  look = setFigureLookOption(look, 'neckwear', null);
  const html = renderToStaticMarkup(
    <FigureDesigner look={look} onChange={() => {}} sections={['outfit']} preview={false} />,
  );
  for (const slot of ['headwear', 'eyewear', 'neckwear', 'backwear', 'earwear', 'wristwear', 'bag'])
    expect(html).toContain(`data-category="${slot}"`);
  for (const text of ['Cap', 'Beanie', 'Sun hat', 'Sunglasses', 'Scarf', 'Headphones', 'Watch'])
    expect(html).toContain(text);
  expect(html).toContain('None');
  expect(html).toContain('Hat: Colour');
  expect(html).toContain('Glasses: Frames');
  // An empty slot has no colours to choose.
  expect(html).not.toContain('Scarf: Colour');
});
