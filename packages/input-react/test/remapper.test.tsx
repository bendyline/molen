import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { InputRemapper } from '../src/index';

it('renders controlled profiles without browser globals and reports unavailable devices', () => {
  const html = renderToStaticMarkup(
    <InputRemapper
      value={{ bindings: { KeyF: 'flaps.up' } }}
      onChange={() => {}}
      actions={[{ id: 'flaps.up', label: 'Flaps up one step' }]}
      status="unavailable"
    />,
  );
  expect(html).toContain('KeyF action');
  expect(html).toContain('Flaps up one step');
  expect(html).toContain('does not expose the Gamepad API');
});
