// @bendyline/molen-client/audio — sound for Molen experiences: a pure director that turns sound
// banks, audio components and signals (weather, sky, listener, entity state, events) into voice
// commands, and a Web Audio backend that plays them. Three-free at runtime, so the director also
// runs in Node (`molen audio plan`, tests). See guide/audio.md.

export {
  type AudioClientLike,
  type AudioWorldLike,
  entitySourceFromClient,
  entitySourceFromWorld,
} from './audio/adapters';
export {
  hash32,
  mergeSoundbanks,
  type ResolvedSound,
  type SoundBank,
  type SoundbankInput,
  unitRandom,
} from './audio/bank';
export { AudioDirector, type AudioDirectorOptions, type VoiceSnapshot } from './audio/director';
export {
  type AudioLayer,
  type AudioLayerOptions,
  type AudioLayerStats,
  type AudioRendererLike,
  createAudioLayer,
} from './audio/layer';
export { type AudioCameraLike, listenerFromCamera } from './audio/listener';
export { type AudioPackSetLike, loadPackSoundbanks } from './audio/packs';
export { createRecordingBackend, type RecordingBackend } from './audio/recording-backend';
export {
  curve,
  type EntityMotion,
  evalWhen,
  Gate,
  resolveSignal,
  type SignalContext,
  type SignalValue,
} from './audio/signals';
export type {
  AudioBackend,
  AudioBackendStats,
  AudioEntitySource,
  AudioEnvironmentSignals,
  AudioListenerState,
  AudioSkySignals,
  AudioVec3,
  DirectorInput,
  VoiceCommand,
  VoiceSpatial,
} from './audio/types';
export { attachAutoplayUnlock, type Unlockable } from './audio/unlock';
export { WebAudioBackend, type WebAudioBackendOptions } from './audio/web-audio-backend';
