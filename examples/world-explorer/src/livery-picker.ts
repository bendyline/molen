import type { LiveryData } from '@bendyline/molen-schema';

/** What the livery picker repaints: the vehicle the visitor flies or drives, or has chosen. */
export interface LiverySubject {
  /** Identifies the vehicle: the list is rebuilt when it changes. */
  readonly key: string;
  /** The vehicle's name, shown with the picker. */
  readonly name: string;
  /** Its livery recipe: the type's variants and the one it shows. */
  readonly livery: LiveryData;
  apply(selected: string): void;
}

/** The picker's choices for a subject: none unless there is more than one livery to pick from. */
export function liveryChoices(
  subject: LiverySubject | undefined,
): { value: string; label: string }[] {
  const variants = subject?.livery.variants ?? [];
  return variants.length < 2
    ? []
    : variants.map((variant) => ({ value: variant.id, label: variant.label }));
}

/**
 * A select listing the subject's liveries, under the vehicle picker. It shows only while there is
 * a vehicle with a choice of liveries. `refresh()` is cheap enough for the HUD's 4 Hz update: it
 * rebuilds the options only when the vehicle changes (an open list is left alone), and keeps the
 * selection in step when the livery changes some other way. `done` runs after a pick, to hand
 * the keyboard back to the flight or driving controls.
 */
export function createLiveryPicker(
  elements: { row: HTMLElement; name: HTMLElement; select: HTMLSelectElement },
  subject: () => LiverySubject | undefined,
  done?: () => void,
): { refresh(): void } {
  const { row, name, select } = elements;
  let listed: string | undefined;
  let current: LiverySubject | undefined;
  const refresh = (): void => {
    current = subject();
    const choices = liveryChoices(current);
    if (current === undefined || choices.length === 0) {
      row.style.display = 'none';
      listed = undefined;
      return;
    }
    const signature = `${current.key}|${choices.map((choice) => choice.value).join(',')}`;
    if (signature !== listed) {
      listed = signature;
      name.textContent = current.name;
      select.replaceChildren(...choices.map((choice) => new Option(choice.label, choice.value)));
    }
    if (select.value !== current.livery.selected && document.activeElement !== select)
      select.value = current.livery.selected;
    row.style.display = 'block';
  };
  select.addEventListener('change', () => {
    const chosen = select.value;
    if (current !== undefined && chosen !== '' && chosen !== current.livery.selected) {
      try {
        current.apply(chosen);
      } catch (error) {
        console.warn(`[molen] livery ${chosen}: ${(error as Error).message}`);
      }
    }
    done?.();
    refresh();
  });
  return { refresh };
}
