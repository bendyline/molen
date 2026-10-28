import { type ComponentType, defineComponent } from '@bendyline/molen-kernel/world';
import type { LiveryData } from '@bendyline/molen-schema';
import { Color } from 'three';

export const Livery: ComponentType<LiveryData> = defineComponent<LiveryData>('livery');

export function selectLivery(data: LiveryData | undefined, selected: string): LiveryData {
  if (!data?.variants.some((variant) => variant.id === selected))
    throw new Error(`Unknown livery: ${selected}`);
  return { ...data, selected };
}

/** A custom color belongs to the instance recipe, so unloading/reloading cannot lose it. */
export function tintLivery(data: LiveryData, color: string): LiveryData {
  if (!Object.hasOwn(data.slots, 'body')) return data;
  const hex = `#${new Color(color).getHexString()}`;
  return {
    ...data,
    variants: data.variants.map((variant) =>
      variant.id !== data.selected
        ? variant
        : {
            ...variant,
            paints: {
              ...variant.paints,
              body: { ...variant.paints.body, color: hex, camouflage: undefined },
            },
          },
    ),
  };
}
