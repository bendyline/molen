/**
 * Shipped figure presets: one complete descriptor per species/age, the defaults every authored
 * `figure` component is merged over. Numbers are meters and radians. Bipeds are measured to the
 * head top, quadrupeds to the withers.
 */

import type {
  FigureAge,
  FigureArchetype,
  FigureFeatures,
  FigurePalette,
  FigurePresetId,
  FigureProportions,
  FigureSpecies,
} from './types';

export interface FigurePreset {
  archetype: FigureArchetype;
  species: FigureSpecies;
  height: number;
  build: number;
  age: FigureAge;
  proportions: FigureProportions;
  features: FigureFeatures;
  palette: FigurePalette;
}

const BIPED_PROPORTIONS: FigureProportions = {
  legRatio: 1,
  armRatio: 1,
  torsoRatio: 1,
  headScale: 1,
  neckLength: 1,
  neckPitch: 0,
  shoulderWidth: 1,
  hipWidth: 1,
  bodyLength: 1,
  tailLength: 0,
  earSize: 1,
  snoutLength: 0,
};

const HUMAN_FEATURES: FigureFeatures = {
  hair: 'cap',
  hands: 'mitten',
  sleeves: 'long',
  legs: 'long',
  tail: 'none',
  ears: 'round',
  horns: 'none',
  feet: 'plantigrade',
  mane: false,
};

const QUADRUPED_FEATURES: FigureFeatures = {
  hair: 'none',
  hands: 'mitten',
  sleeves: 'none',
  legs: 'long',
  tail: 'long',
  ears: 'pointed',
  horns: 'none',
  feet: 'digitigrade',
  mane: false,
};

function quadruped(
  species: FigureSpecies,
  height: number,
  build: number,
  proportions: Partial<FigureProportions>,
  features: Partial<FigureFeatures>,
  palette: Partial<FigurePalette> & { skin: string; markings: string },
): FigurePreset {
  const fur = palette.skin;
  return {
    archetype: 'quadruped',
    species,
    height,
    build,
    age: 'adult',
    proportions: { ...BIPED_PROPORTIONS, ...proportions },
    features: { ...QUADRUPED_FEATURES, ...features },
    palette: {
      skin: fur,
      hair: palette.hair ?? fur,
      eyes: palette.eyes ?? '#1a1a1a',
      top: fur,
      bottom: fur,
      shoes: palette.shoes ?? fur,
      accent: palette.accent ?? '#b3332c',
      markings: palette.markings,
    },
  };
}

const DEG = Math.PI / 180;

export const FIGURE_PRESETS: Readonly<Record<FigurePresetId, FigurePreset>> = {
  'human.adult': {
    archetype: 'biped',
    species: 'human',
    height: 1.75,
    build: 0,
    age: 'adult',
    proportions: { ...BIPED_PROPORTIONS },
    features: { ...HUMAN_FEATURES },
    palette: {
      skin: '#d9a686',
      hair: '#2a1a10',
      eyes: '#2b2b2b',
      top: '#3b6ea5',
      bottom: '#2f2f38',
      shoes: '#4a2e1f',
      accent: '#c8a24a',
      markings: '#d9a686',
    },
  },
  'human.child': {
    archetype: 'biped',
    species: 'human',
    height: 1.15,
    build: 0.1,
    age: 'child',
    proportions: { ...BIPED_PROPORTIONS, legRatio: 0.88, neckLength: 0.9, headScale: 1.35 },
    features: { ...HUMAN_FEATURES, sleeves: 'short', legs: 'shorts' },
    palette: {
      skin: '#e2b08f',
      hair: '#4a2c17',
      eyes: '#2b2b2b',
      top: '#e0703a',
      bottom: '#3a5a8c',
      shoes: '#333333',
      accent: '#f2d34d',
      markings: '#e2b08f',
    },
  },
  'human.elder': {
    archetype: 'biped',
    species: 'human',
    height: 1.65,
    build: -0.2,
    age: 'elder',
    proportions: { ...BIPED_PROPORTIONS, legRatio: 0.98, neckLength: 0.9 },
    features: { ...HUMAN_FEATURES },
    palette: {
      skin: '#d3a58a',
      hair: '#c9c9c9',
      eyes: '#2b2b2b',
      top: '#7a6f5a',
      bottom: '#4b4b52',
      shoes: '#3a2a20',
      accent: '#8a6f3a',
      markings: '#d3a58a',
    },
  },
  dog: quadruped(
    'dog',
    0.6,
    0,
    {
      neckLength: 0.35,
      neckPitch: 30 * DEG,
      headScale: 1.15,
      bodyLength: 1.6,
      tailLength: 0.6,
      snoutLength: 0.6,
    },
    { ears: 'floppy', feet: 'digitigrade', tail: 'long' },
    { skin: '#a3763f', markings: '#e8d9bd', accent: '#b3332c' },
  ),
  cat: quadruped(
    'cat',
    0.28,
    -0.2,
    {
      neckLength: 0.3,
      neckPitch: 20 * DEG,
      headScale: 1,
      bodyLength: 1.7,
      tailLength: 1,
      snoutLength: 0.3,
    },
    { ears: 'pointed', feet: 'digitigrade', tail: 'long' },
    { skin: '#6f6f75', markings: '#e6e6e6', eyes: '#3f9a4a' },
  ),
  horse: quadruped(
    'horse',
    1.55,
    0.2,
    {
      legRatio: 1.05,
      neckLength: 0.45,
      neckPitch: 45 * DEG,
      headScale: 1.4,
      bodyLength: 1.55,
      tailLength: 0.7,
      snoutLength: 0.8,
    },
    { ears: 'pointed', feet: 'unguligrade', tail: 'long', mane: true },
    { skin: '#5a3a22', markings: '#f0ead6', hair: '#1f1410', accent: '#7a4a2a' },
  ),
  deer: quadruped(
    'deer',
    1.05,
    -0.5,
    {
      legRatio: 1.1,
      neckLength: 0.45,
      neckPitch: 55 * DEG,
      headScale: 1.1,
      bodyLength: 1.35,
      tailLength: 0.15,
      snoutLength: 0.6,
    },
    { ears: 'pointed', horns: 'antlers', feet: 'unguligrade', tail: 'short' },
    { skin: '#a8743f', markings: '#f2e6cf' },
  ),
  cow: quadruped(
    'cow',
    1.35,
    0.6,
    {
      legRatio: 0.95,
      neckLength: 0.35,
      neckPitch: 15 * DEG,
      headScale: 1.4,
      bodyLength: 1.7,
      tailLength: 0.8,
      snoutLength: 0.6,
    },
    { ears: 'floppy', horns: 'short', feet: 'unguligrade', tail: 'long' },
    { skin: '#f0ede4', markings: '#2b2b2b', accent: '#c8a24a' },
  ),
  sheep: quadruped(
    'sheep',
    0.8,
    0.3,
    {
      legRatio: 0.95,
      neckLength: 0.3,
      neckPitch: 30 * DEG,
      headScale: 1,
      bodyLength: 1.5,
      tailLength: 0.15,
      snoutLength: 0.4,
    },
    { ears: 'floppy', feet: 'unguligrade', tail: 'short' },
    { skin: '#ece7dc', markings: '#3a2f28' },
  ),
};

export function figurePreset(id: FigurePresetId): FigurePreset {
  return FIGURE_PRESETS[id];
}
