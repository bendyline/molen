import type { AircraftInputData, AircraftSpec, AircraftStateData } from '@bendyline/molen-schema';
import * as THREE from 'three';
import {
  type AircraftCockpit,
  type AircraftCockpitControl,
  type AircraftControlChange,
  aircraftControlValue,
} from './aircraft-controls';

export interface AircraftCockpitSession {
  id: string;
  cockpit: AircraftCockpit;
  spec: AircraftSpec;
  input: AircraftInputData;
  state?: AircraftStateData;
  change(change: AircraftControlChange): void;
  /** Release spring-loaded stick/pedal input on blur, exit or pointer cancellation. */
  release(): void;
}
export interface AircraftCockpitPointer {
  /** Call every frame; also hides the panel and cancels input when the pilot leaves. */
  update(): void;
  dispose(): void;
}

/** Capture only actual cockpit-control hits; ordinary canvas drags remain camera gestures. */
export interface AircraftCockpitPointerOptions {
  element: HTMLElement;
  camera: THREE.Camera;
  session(): AircraftCockpitSession | undefined;
  /** Optional host for the accessible companion controls. Defaults to the canvas parent. */
  container?: HTMLElement;
  /** Show optional HTML controls for accessibility or models with incomplete cockpit geometry. */
  companionPanel?: boolean;
}

export function bindAircraftCockpitPointer(
  options: AircraftCockpitPointerOptions,
): AircraftCockpitPointer {
  let binding: AircraftCockpitPointer | undefined;
  return {
    update() {
      // Most Earth views never board an aircraft. Only allocate cockpit UI for a pilot.
      if (!binding && options.session()) binding = bindActiveCockpitPointer(options);
      binding?.update();
    },
    dispose() {
      binding?.dispose();
      binding = undefined;
    },
  };
}

function bindActiveCockpitPointer(options: AircraftCockpitPointerOptions): AircraftCockpitPointer {
  const { element } = options;
  const doc = element.ownerDocument;
  const win = doc.defaultView;
  const panel = doc.createElement('details');
  panel.className = 'molen-cockpit-controls';
  panel.style.cssText =
    'position:absolute;right:12px;bottom:16px;z-index:20;max-width:320px;max-height:55%;overflow:auto;background:#101a22ed;color:#edf3f6;border:1px solid #647783;border-radius:8px;padding:9px 12px;font:12px/1.5 system-ui;box-shadow:0 4px 16px #0005;';
  const summary = doc.createElement('summary');
  summary.textContent = 'Cockpit controls';
  summary.style.cursor = 'pointer';
  panel.append(summary);
  const content = doc.createElement('div');
  panel.append(content);
  if (options.companionPanel) (options.container ?? element.parentElement)?.append(panel);
  panel.hidden = true;
  const hint = doc.createElement('div');
  hint.setAttribute('role', 'status');
  hint.style.cssText =
    'position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:21;pointer-events:none;background:#101a22e8;color:#fff;padding:5px 10px;border-radius:5px;font:12px system-ui;';
  hint.hidden = true;
  (options.container ?? element.parentElement)?.append(hint);
  const caster = new THREE.Raycaster();
  let active: AircraftCockpitSession | undefined;
  let drag:
    | {
        session: AircraftCockpitSession;
        control: AircraftCockpitControl;
        pointer: number;
        x: number;
        y: number;
        value: number;
        pitch: number;
      }
    | undefined;
  const fields: {
    control: AircraftCockpitControl;
    field: HTMLInputElement | HTMLButtonElement;
    output: HTMLOutputElement;
  }[] = [];
  const originalCursor = element.style.cursor;
  const cancel = (): void => {
    const previous = drag;
    drag = undefined;
    previous?.session.release();
    active?.release();
    if (previous && element.hasPointerCapture(previous.pointer))
      element.releasePointerCapture(previous.pointer);
    element.style.cursor = originalCursor;
    hint.hidden = true;
  };
  const usable = (): AircraftCockpitSession | undefined =>
    doc.hidden ? undefined : options.session();
  const showHint = (
    control: AircraftCockpitControl | undefined,
    session?: AircraftCockpitSession,
  ): void => {
    hint.hidden = control === undefined;
    if (control) {
      const value = session ? aircraftControlValue(session.input, control) : 0;
      hint.textContent =
        control.action === 'gear' && session?.state?.grounded
          ? `${control.label} · locked while on the ground`
          : control.action === 'stick'
            ? `${control.label} · drag to steer; release to center`
            : control.action === 'yaw'
              ? `${control.label} · drag sideways; release to center`
              : `${control.label} · ${['gear', 'engine', 'brake'].includes(control.action) ? `${value ? 'on' : 'off'} · click to toggle` : `${Math.round(value * 100)}%${control.action === 'mixture' && value === 0 ? ' · idle cutoff' : ''} · drag up to increase`}`;
    }
  };
  const pick = (
    event: PointerEvent,
    session: AircraftCockpitSession,
  ): AircraftCockpitControl | undefined => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return undefined;
    options.camera.updateWorldMatrix(true, false);
    caster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((event.clientY - rect.top) / rect.height) * 2,
      ),
      options.camera,
    );
    return session.cockpit.pick(caster.ray);
  };
  const stop = (event: Event): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0 || drag) return;
    const session = usable();
    if (!session) return;
    const control = pick(event, session);
    if (!control) return;
    stop(event);
    element.focus({ preventScroll: true });
    const value = aircraftControlValue(session.input, control);
    if (['gear', 'engine', 'brake'].includes(control.action)) {
      session.change({ control, value: Number(!value) });
      showHint(control, usable());
      return;
    }
    drag = {
      session,
      control,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      value,
      pitch: session.input.pitch,
    };
    element.setPointerCapture(event.pointerId);
    element.style.cursor = 'grabbing';
    showHint(control, session);
  };
  const move = (event: PointerEvent): void => {
    const session = usable();
    if (
      drag &&
      (!session || session.id !== drag.session.id || session.cockpit !== drag.session.cockpit)
    )
      cancel();
    if (drag && event.pointerId === drag.pointer) {
      stop(event);
      const x = (event.clientX - drag.x) / 120,
        y = (event.clientY - drag.y) / 160;
      const action = drag.control.action;
      const value =
        action === 'stick' || action === 'yaw'
          ? Math.max(-1, Math.min(1, drag.value + x))
          : Math.max(0, Math.min(1, drag.value - y));
      drag.session.change({
        control: drag.control,
        value,
        ...(action === 'stick' ? { pitch: Math.max(-1, Math.min(1, drag.pitch + y)) } : {}),
      });
      showHint(drag.control, usable());
    } else if (session && event.buttons === 0) {
      const control = pick(event, session);
      element.style.cursor = control ? 'pointer' : originalCursor;
      showHint(control, session);
    }
  };
  const up = (event: PointerEvent): void => {
    if (drag?.pointer === event.pointerId) {
      stop(event);
      cancel();
    }
  };
  const lost = (event: PointerEvent): void => {
    if (drag?.pointer === event.pointerId) cancel();
  };
  const rebuild = (session: AircraftCockpitSession): void => {
    content.replaceChildren();
    fields.length = 0;
    const help = doc.createElement('p');
    help.textContent =
      'Drag the yoke, pedals or throttle in the cockpit. Common power synchronizes all engines.';
    content.append(help);
    for (const control of session.cockpit.controls) {
      if (control.action === 'stick' || control.action === 'yaw') continue;
      const row = doc.createElement('label');
      row.style.cssText =
        'display:grid;grid-template-columns:125px 1fr 38px;align-items:center;gap:7px;margin:6px 0;';
      const name = doc.createElement('span');
      name.textContent = control.label;
      const output = doc.createElement('output');
      const toggle = ['gear', 'engine', 'brake'].includes(control.action);
      const field = toggle ? doc.createElement('button') : doc.createElement('input');
      field.setAttribute('aria-label', control.label);
      field.style.cssText = 'min-width:0;width:100%;accent-color:#62c9ec;';
      if (field instanceof HTMLInputElement) {
        field.type = 'range';
        field.min = '0';
        field.max = '1';
        field.step = '0.01';
        field.addEventListener('input', () => {
          const current = usable();
          if (current?.id === session.id && current.cockpit === session.cockpit)
            current.change({ control, value: Number(field.value) });
        });
      } else {
        field.type = 'button';
        field.addEventListener('click', () => {
          const current = usable();
          if (current?.id === session.id && current.cockpit === session.cockpit)
            current.change({
              control,
              value: Number(!aircraftControlValue(current.input, control)),
            });
        });
      }
      row.append(name, field, output);
      content.append(row);
      fields.push({ control, field, output });
    }
  };
  // Capture precedes the host's navigation gesture handlers; panel input never reaches them.
  element.addEventListener('pointerdown', down, true);
  element.addEventListener('pointermove', move, true);
  element.addEventListener('pointerup', up, true);
  element.addEventListener('pointercancel', up, true);
  element.addEventListener('lostpointercapture', lost);
  panel.addEventListener('keydown', (event) => event.stopPropagation());
  panel.addEventListener('keyup', (event) => event.stopPropagation());
  win?.addEventListener('blur', cancel);
  doc.addEventListener('visibilitychange', cancel);
  return {
    update() {
      const session = usable();
      if (session?.id !== active?.id || session?.cockpit !== active?.cockpit) {
        cancel();
        active = session;
        if (session) {
          if (doc.pointerLockElement === element) doc.exitPointerLock();
          rebuild(session);
        }
      }
      panel.hidden = !session;
      if (!session) return;
      for (const { control, field, output } of fields) {
        const value = aircraftControlValue(session.input, control);
        const locked = control.action === 'gear' && (!session.state || session.state.grounded);
        field.disabled = locked;
        if (field instanceof HTMLInputElement) {
          field.value = String(value);
          output.value = `${Math.round(value * 100)}%`;
        } else {
          field.textContent =
            control.action === 'gear' ? (value ? 'Down' : 'Up') : value ? 'On' : 'Off';
          field.setAttribute('aria-pressed', String(value > 0));
          output.value = locked ? 'Locked' : '';
        }
      }
    },
    dispose() {
      cancel();
      element.removeEventListener('pointerdown', down, true);
      element.removeEventListener('pointermove', move, true);
      element.removeEventListener('pointerup', up, true);
      element.removeEventListener('pointercancel', up, true);
      element.removeEventListener('lostpointercapture', lost);
      win?.removeEventListener('blur', cancel);
      doc.removeEventListener('visibilitychange', cancel);
      panel.remove();
      hint.remove();
    },
  };
}
