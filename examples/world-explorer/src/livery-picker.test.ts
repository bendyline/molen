import type { LiveryData } from '@bendyline/molen-schema';
import { afterEach, expect, it, vi } from 'vitest';
import { createLiveryPicker, type LiverySubject, liveryChoices } from './livery-picker.js';

const recipe = (selected: string, ids: string[]): LiveryData => ({
  selected,
  slots: {},
  variants: ids.map((id) => ({
    id,
    label: `Scheme ${id}`,
    provenance: { kind: 'inspired', note: '', references: [] },
    paints: {},
  })),
});

/** The few DOM parts the picker touches, without a DOM. */
function fakeElements() {
  let onChange: (() => void) | undefined;
  const select = {
    value: '',
    options: [] as { text: string; value: string }[],
    replaceChildren(...options: { text: string; value: string }[]) {
      this.options = options;
      this.value = options[0]?.value ?? '';
    },
    addEventListener(_type: string, listener: () => void) {
      onChange = listener;
    },
  };
  const elements = {
    row: { style: { display: '' } },
    name: { textContent: '' },
    select,
  };
  return {
    elements: elements as unknown as Parameters<typeof createLiveryPicker>[0],
    raw: elements,
    pick(value: string) {
      select.value = value;
      onChange?.();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

it('offers a choice only when a vehicle has more than one livery', () => {
  expect(liveryChoices(undefined)).toEqual([]);
  const one: LiverySubject = { key: 'a', name: 'A', livery: recipe('x', ['x']), apply() {} };
  expect(liveryChoices(one)).toEqual([]);
  const two: LiverySubject = { key: 'b', name: 'B', livery: recipe('y', ['x', 'y']), apply() {} };
  expect(liveryChoices(two)).toEqual([
    { value: 'x', label: 'Scheme x' },
    { value: 'y', label: 'Scheme y' },
  ]);
});

it('follows the selected vehicle, repaints it on a pick and hands back the keyboard', () => {
  vi.stubGlobal(
    'Option',
    class {
      constructor(
        readonly text: string,
        readonly value: string,
      ) {}
    },
  );
  vi.stubGlobal('document', { activeElement: null });
  const { elements, raw, pick } = fakeElements();
  let livery = recipe('navy', ['navy', 'camo', 'gray']);
  const applied: string[] = [];
  let subject: LiverySubject | undefined;
  const focus = vi.fn();
  const picker = createLiveryPicker(elements, () => subject, focus);

  picker.refresh();
  expect(raw.row.style.display).toBe('none');

  subject = {
    key: 'aircraft:f_16b',
    name: 'F-16B',
    get livery() {
      return livery;
    },
    apply(selected) {
      applied.push(selected);
      livery = { ...livery, selected };
    },
  };
  picker.refresh();
  expect(raw.row.style.display).toBe('block');
  expect(raw.name.textContent).toBe('F-16B');
  expect(raw.select.options.map((option) => option.value)).toEqual(['navy', 'camo', 'gray']);
  expect(raw.select.value).toBe('navy');

  pick('camo');
  expect(applied).toEqual(['camo']);
  expect(focus).toHaveBeenCalledOnce();
  expect(raw.select.value).toBe('camo');

  // Repainted some other way: the picker follows without rebuilding its list.
  const options = raw.select.options;
  livery = { ...livery, selected: 'gray' };
  picker.refresh();
  expect(raw.select.value).toBe('gray');
  expect(raw.select.options).toBe(options);

  // Out of the vehicle, with nothing chosen to visit: hidden.
  subject = undefined;
  picker.refresh();
  expect(raw.row.style.display).toBe('none');
});
