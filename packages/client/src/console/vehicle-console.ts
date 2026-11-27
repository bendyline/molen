// The vehicle console: on-screen touch controls drawn as the vehicle's own. A strip along the
// bottom edge shows its stick (or wheel, or handlebars), pedals, throttle, gear and flap handles
// and dials in 3D through one small WebGL context; invisible zones over them work the controls
// through the same navigation actions as keys and gamepads, and the vehicle's control session.

import type { InputMap } from '../input';
import type { ModelSignals } from '../model-signals';
import { createTouchJoystick, type TouchJoystick } from '../navigation/touch-joystick';
import {
  createTouchButtonZone,
  createTouchLeverZone,
  type TouchZone,
} from '../navigation/touch-lever';
import {
  aircraftDeck,
  buttonTip,
  CONSOLE_ICONS,
  type ConsoleButton,
  type ConsoleItem,
  type ConsoleSubject,
  type ConsoleTip,
  itemTip,
  onFootDeck,
  subjectButtons,
  vehicleDeck,
} from './deck';
import { type ConsoleLayout, layoutConsole } from './layout';
import type { ConsolePart } from './parts';
import { type ConsoleRect, createConsoleStrip, type StripPlacement } from './strip';
import { actionKeys, createConsoleTooltips, type TipRect } from './tooltip';

export interface VehicleConsoleOptions {
  /**
   * Where the controls write: a navigation input map (`NavigationInputSource.map`). With
   * `getProfile`, a control's tooltip lists the keys its actions are bound to.
   */
  input: Pick<InputMap, 'setVirtual' | 'clearVirtual'> & Partial<Pick<InputMap, 'getProfile'>>;
  /**
   * Refocused when a control is touched, so keys keep working (usually the canvas). A mouse
   * resting on a dial over it shows the dial's tooltip.
   */
  focusTarget?: HTMLElement;
  /** `left` puts the stick on the right and the throttle on the left. */
  handed?: 'right' | 'left';
  /** Opacity of controls nobody is touching (default 0.42); touched ones show solid. */
  restOpacity?: number;
  /** Highest device pixel ratio the strip draws at (default 2). */
  maxPixelRatio?: number;
  /** Prefix of the console's software devices in the input map (default `'vehicle-console'`). */
  source?: string;
  /**
   * Draw the subject's change-view and leave buttons in the top corner (default true). A host
   * that offers them in its own toolbar passes false, reads `buttons` and presses each with
   * `tap`. The "more controls" button a landscape phone needs stays in the corner either way.
   */
  cornerButtons?: boolean;
}

export interface VehicleConsole {
  /** The console's layer: it fills the container and passes touches through between controls. */
  readonly element: HTMLElement;
  /** The touch stick, under the drawn stick (or drawn as its two circles on foot). */
  readonly joystick: TouchJoystick;
  readonly subject: ConsoleSubject | undefined;
  /** Where everything went, after the latest layout. */
  readonly layout: ConsoleLayout | undefined;
  /** False once WebGL is unavailable: the controls still work, drawn as plain outlines. */
  readonly drawing: boolean;
  /**
   * The subject's top buttons (change the view, leave the vehicle), drawn in the corner unless
   * `cornerButtons` is false; empty while there is no subject or the console is hidden.
   */
  readonly buttons: readonly ConsoleButton[];
  /**
   * Press and release a navigation action as a tap on a console button does (a host's own
   * button for one of `buttons`). It refocuses `focusTarget` first: the input map takes actions
   * only while that element has focus, and a click on the host's button moved it away.
   */
  tap(action: string): void;
  /**
   * What the viewer is in: an aircraft, a vehicle, on foot, or `undefined` for nothing (the
   * console hides). Call it whenever that may change; the same vehicle keeps its parts.
   */
  setSubject(subject: ConsoleSubject | undefined): void;
  setVisible(visible: boolean): void;
  /**
   * Pose and draw. Call once per frame after the frame renders (dials copy the cockpit's world
   * matrices). It draws only when something moved, faded or changed size.
   */
  update(nowMs: number): void;
  dispose(): void;
}

interface Slot {
  item: ConsoleItem;
  part?: ConsolePart;
  zone?: TouchZone;
  button?: HTMLButtonElement;
  rect?: ConsoleRect;
  aspect?: number;
  opacity: number;
  active: boolean;
  preview?: number;
}

/** What makes two subjects the same: the same vehicle model, or both on foot. */
function subjectKey(subject: ConsoleSubject | undefined): unknown {
  if (subject === undefined) return undefined;
  if (subject.kind === 'aircraft' || subject.kind === 'vehicle') return subject.visual;
  return subject.kind;
}

/** Whether a subject shows its dials (an aircraft's in a chase view, a vehicle's speedometer). */
function showsGauges(subject: ConsoleSubject | undefined): boolean {
  return (subject?.kind === 'aircraft' || subject?.kind === 'vehicle') && subject.gauges === true;
}

/** The units a vehicle's speedometer reads in: a change needs a new face. */
function speedUnitOf(subject: ConsoleSubject | undefined): string | undefined {
  return subject?.kind === 'vehicle' ? subject.speedUnit : undefined;
}

/**
 * Add a vehicle console to `container` (which should be positioned, e.g. the stage around the
 * canvas). It shows nothing until `setSubject`.
 */
export function createVehicleConsole(
  container: HTMLElement,
  options: VehicleConsoleOptions,
): VehicleConsole {
  const document = container.ownerDocument;
  const view = document.defaultView;
  const source = options.source ?? 'vehicle-console';
  const mirror = options.handed === 'left';
  const restOpacity = options.restOpacity ?? 0.42;
  const reducedMotion = view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const root = document.createElement('div');
  root.className = 'molen-console';
  Object.assign(root.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: '2',
  });
  container.append(root);
  const canvas = document.createElement('canvas');
  canvas.className = 'molen-console-strip';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute',
    left: '0',
    bottom: '0',
    width: '100%',
    height: '0',
    pointerEvents: 'none',
    // A thin dark rim keeps the ghosted parts readable over bright sky and snow.
    filter: 'drop-shadow(0 0 1px rgb(0 0 0 / 70%)) drop-shadow(0 1px 2.5px rgb(0 0 0 / 35%))',
  });
  root.append(canvas);
  // Measures the host's safe-area insets (`--molen-console-inset-left` and so on).
  const probe = document.createElement('div');
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingLeft: 'var(--molen-console-inset-left, 0px)',
    paddingRight: 'var(--molen-console-inset-right, 0px)',
    paddingTop: 'var(--molen-console-inset-top, 0px)',
    paddingBottom: 'var(--molen-console-inset-bottom, 0px)',
  });
  root.append(probe);
  const joystick = createTouchJoystick(root, options.input, {
    ...(options.focusTarget ? { focusTarget: options.focusTarget } : {}),
    appearance: 'circles',
  });
  joystick.element.style.pointerEvents = 'auto';
  const top = document.createElement('div');
  top.className = 'molen-console-buttons';
  Object.assign(top.style, {
    position: 'absolute',
    display: 'flex',
    gap: '8px',
    pointerEvents: 'none',
  });
  root.append(top);

  // --- Tooltips, for a mouse or pen resting on a control. ---
  const tooltips = createConsoleTooltips(root, (actions) => {
    try {
      const bindings = options.input.getProfile?.().bindings;
      return bindings ? actionKeys(bindings, actions) : [];
    } catch {
      return [];
    }
  });
  const hovering = (event: PointerEvent): boolean =>
    (event.pointerType === 'mouse' || event.pointerType === 'pen') && event.buttons === 0;
  /** An element's rectangle in the console's layer. */
  const rectOf = (element: HTMLElement): TipRect => {
    const layer = root.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    return {
      left: box.left - layer.left,
      top: box.top - layer.top,
      width: box.width,
      height: box.height,
    };
  };
  /** Show `tip()` while a mouse rests on `element`, placed against `rect()` (default its own). */
  const hoverable = (
    element: HTMLElement,
    key: object,
    tip: () => ConsoleTip | undefined,
    rect: () => TipRect = () => rectOf(element),
  ): void => {
    element.addEventListener('pointerenter', (event) => {
      const shown = hovering(event) ? tip() : undefined;
      if (shown) tooltips.enter(key, shown, rect);
    });
    element.addEventListener('pointerleave', () => tooltips.leave(key));
    element.addEventListener('pointerdown', () => tooltips.press(key));
  };

  let drawing = true;
  const strip = createConsoleStrip(canvas, () => {
    drawing = false;
    canvas.style.display = 'none';
    joystick.setAppearance('circles');
    for (const slot of slots) if (slot.zone) outline(slot.zone, slot.item);
  });

  // --- Navigation actions: each held by a software device of its own. ---
  const held = new Set<string>();
  const setAction = (action: string, value: number): void => {
    held.add(action);
    options.input.setVirtual(`${source}:${action}`, action, value);
  };
  const releaseActions = (): void => {
    for (const action of held) options.input.clearVirtual(`${source}:${action}`);
    held.clear();
  };
  // One short press: a keyboard or assistive click on a button, or the host's `tap`. The input
  // map takes actions only while its element has focus, which a click on a host's button took
  // away, so focus comes back first.
  const tapAction = (action: string): void => {
    options.focusTarget?.focus({ preventScroll: true });
    setAction(action, 1);
    view?.setTimeout(() => setAction(action, 0), 120);
  };

  // --- Buttons. ---
  const makeButton = (spec: ConsoleButton, size: number): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'molen-console-button';
    element.setAttribute('aria-label', spec.label);
    // The console's own tooltip, not `title`: the browser's would show over it a moment later.
    hoverable(element, element, () => buttonTip(spec));
    element.innerHTML = `<svg viewBox="0 0 24 24" width="${Math.round(size * 0.45)}" height="${Math.round(size * 0.45)}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${spec.icon}</svg>`;
    Object.assign(element.style, {
      width: `${size}px`,
      height: `${size}px`,
      display: 'grid',
      placeItems: 'center',
      padding: '0',
      borderRadius: '50%',
      border: '1px solid rgb(255 255 255 / 38%)',
      background: 'rgb(14 20 26 / 30%)',
      color: '#fff',
      backdropFilter: 'blur(6px)',
      pointerEvents: 'auto',
      touchAction: 'none',
      userSelect: 'none',
      cursor: 'pointer',
    });
    let pointer: number | undefined;
    const up = (): void => {
      if (pointer === undefined) return;
      if (element.hasPointerCapture(pointer)) element.releasePointerCapture(pointer);
      pointer = undefined;
      element.style.background = 'rgb(14 20 26 / 30%)';
      if (spec.action) setAction(spec.action, 0);
    };
    element.addEventListener('pointerdown', (event) => {
      if (pointer !== undefined) return;
      event.preventDefault();
      event.stopPropagation();
      options.focusTarget?.focus({ preventScroll: true });
      pointer = event.pointerId;
      element.setPointerCapture(event.pointerId);
      element.style.background = 'rgb(14 20 26 / 62%)';
      if (spec.action) setAction(spec.action, 1);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const)
      element.addEventListener(type, (event) => {
        if (event.pointerId === pointer) up();
      });
    // A keyboard or assistive click: one short press.
    element.addEventListener('click', (event) => {
      if (event.detail !== 0 || !spec.action) return;
      tapAction(spec.action);
    });
    return element;
  };

  // --- The subject's slots. ---
  let subject: ConsoleSubject | undefined;
  let key: unknown;
  let slots: Slot[] = [];
  let ready = false;
  let visible = true;
  let layout: ConsoleLayout | undefined;
  let drawerOpen = false;
  let dirty = true;
  let last: number | undefined;
  let lastGauges = Number.NEGATIVE_INFINITY;
  let size = { width: -1, height: -1 };
  let buttons: readonly ConsoleButton[] = [];
  let topButtons: HTMLButtonElement[] = [];
  let drawerButton: HTMLButtonElement | undefined;
  let generation = 0;
  /** The dial a mouse rests on: dials have no element over them, so the console finds it. */
  let hoveredGauge: Slot | undefined;

  // The stick's zone is the touch stick's own element, kept for every subject.
  const stickSlot = (): Slot | undefined => slots.find((slot) => slot.item.zone?.kind === 'stick');
  hoverable(
    joystick.element,
    joystick,
    () => {
      const slot = stickSlot();
      return slot ? itemTip(slot.item) : undefined;
    },
    () => stickSlot()?.rect ?? rectOf(joystick.element),
  );
  // A dial lets touches through to the world, so a mouse over one is over the canvas.
  const gaugeAt = (event: PointerEvent): Slot | undefined => {
    if (!hovering(event) || options.focusTarget === undefined) return undefined;
    if (event.target !== options.focusTarget) return undefined;
    const layer = root.getBoundingClientRect();
    const x = event.clientX - layer.left;
    const y = event.clientY - layer.top;
    return slots.find((slot) => {
      const rect = slot.item.gauge ? slot.rect : undefined;
      return (
        rect !== undefined &&
        x >= rect.left &&
        x < rect.left + rect.width &&
        y >= rect.top &&
        y < rect.top + rect.height
      );
    });
  };
  const hoverGauge = (slot: Slot | undefined): void => {
    if (slot === hoveredGauge) return;
    if (hoveredGauge) tooltips.leave(hoveredGauge);
    hoveredGauge = slot;
    const tip = slot ? itemTip(slot.item) : undefined;
    // A relayout hides the tooltip, so the dial's rectangle holds while it shows.
    const rect = slot?.rect;
    if (slot && tip && rect) tooltips.enter(slot, tip, () => rect);
  };
  const hideTips = (): void => {
    tooltips.hide();
    hoveredGauge = undefined;
  };
  const onGaugeMove = (event: PointerEvent): void => {
    if (visible && subject !== undefined) hoverGauge(gaugeAt(event));
  };
  const onGaugeLeave = (): void => hoverGauge(undefined);
  container.addEventListener('pointermove', onGaugeMove, { capture: true, passive: true });
  container.addEventListener('pointerdown', onGaugeLeave, { capture: true, passive: true });
  container.addEventListener('pointerleave', onGaugeLeave);

  const outline = (zone: TouchZone, item: ConsoleItem): void => {
    Object.assign(zone.element.style, {
      border: '1px solid rgb(255 255 255 / 45%)',
      borderRadius: '12px',
      background: 'rgb(255 255 255 / 8%)',
      color: '#fff',
      font: '11px system-ui, sans-serif',
      display: 'grid',
      placeItems: 'center',
    });
    zone.element.textContent = item.id;
  };

  const clearSlots = (): void => {
    hideTips();
    for (const slot of slots) {
      slot.zone?.dispose();
      slot.button?.remove();
      slot.part?.dispose();
    }
    slots = [];
    buttons = [];
    for (const element of topButtons) element.remove();
    topButtons = [];
    drawerButton?.remove();
    drawerButton = undefined;
    releaseActions();
    strip.clear();
  };

  const build = (next: ConsoleSubject): void => {
    const context = { setAction, mirror };
    const items =
      next.kind === 'aircraft'
        ? aircraftDeck(next, context)
        : next.kind === 'vehicle'
          ? vehicleDeck(next, context)
          : onFootDeck(next);
    for (const item of items) {
      const slot: Slot = { item, opacity: restOpacity, active: false };
      if (item.part) {
        try {
          slot.part = item.part();
        } catch (error) {
          console.warn(`Vehicle console: no ${item.id} part:`, error);
        }
      }
      const zone = item.zone;
      if (zone?.kind === 'lever') {
        const invert = zone.invert === true;
        slot.zone = createTouchLeverZone(root, {
          ...(options.focusTarget ? { focusTarget: options.focusTarget } : {}),
          axis: zone.axis ?? 'y',
          // A share of the control's own rectangle, measured when a thumb lands.
          travel: () =>
            Math.max(
              24,
              (zone.axis === 'x' ? (slot.rect?.width ?? 100) : (slot.rect?.height ?? 100)) *
                zone.travel,
            ),
          min: zone.min ?? 0,
          max: zone.max ?? 1,
          ...(zone.spring !== undefined ? { spring: invert ? 1 - zone.spring : zone.spring } : {}),
          ...(zone.detents !== undefined
            ? { detents: invert ? zone.detents.map((d) => 1 - d) : zone.detents }
            : {}),
          read: () => (invert ? 1 - zone.read() : zone.read()),
          change: (raw) => {
            const value = invert ? 1 - raw : raw;
            if (zone.preview) slot.preview = value;
            zone.change?.(value);
            dirty = true;
          },
          release: (raw) => {
            const value = invert ? 1 - raw : raw;
            slot.preview = undefined;
            zone.release?.(value);
            dirty = true;
          },
          active: (active) => {
            slot.active = active;
            if (active && zone.preview) slot.preview = zone.read();
          },
        });
      } else if (zone?.kind === 'hold') {
        slot.zone = createTouchButtonZone(root, {
          ...(options.focusTarget ? { focusTarget: options.focusTarget } : {}),
          press: () => {
            slot.active = true;
            slot.preview = 1;
            setAction(zone.action, 1);
          },
          release: () => {
            slot.active = false;
            slot.preview = undefined;
            setAction(zone.action, 0);
          },
        });
      } else if (zone?.kind === 'tap') {
        slot.zone = createTouchButtonZone(root, {
          ...(options.focusTarget ? { focusTarget: options.focusTarget } : {}),
          press: () => {
            slot.active = true;
            zone.press();
            dirty = true;
          },
          release: () => {
            slot.active = false;
          },
        });
      }
      if (slot.zone) {
        const element = slot.zone.element;
        hoverable(
          element,
          slot,
          () => itemTip(item),
          () => slot.rect ?? rectOf(element),
        );
        if (!drawing) outline(slot.zone, item);
      }
      if (item.button) {
        slot.button = makeButton(item.button, Math.round(item.size[0]));
        slot.button.style.position = 'absolute';
        root.append(slot.button);
      }
      slots.push(slot);
    }
    buttons = subjectButtons(next);
    topButtons = options.cornerButtons === false ? [] : buttons.map((spec) => makeButton(spec, 44));
    top.replaceChildren(...topButtons);
    joystick.setAppearance(stickSlot()?.part && drawing ? 'none' : 'circles');
    ready = false;
    const built = ++generation;
    const parts = slots.flatMap((slot) => (slot.part ? [slot.part] : []));
    void strip.prepare(parts).then(() => {
      if (built !== generation) return;
      ready = true;
      dirty = true;
    });
  };

  const readInsets = (): { left: number; right: number; top: number; bottom: number } => {
    const style = view?.getComputedStyle(probe);
    const px = (value: string | undefined): number => Number.parseFloat(value ?? '') || 0;
    return {
      left: px(style?.paddingLeft),
      right: px(style?.paddingRight),
      top: px(style?.paddingTop),
      bottom: px(style?.paddingBottom),
    };
  };

  const relayout = (): void => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    size = { width, height };
    if (subject === undefined) return;
    // Controls may move under a tooltip.
    hideTips();
    const insets = readInsets();
    const gauges = showsGauges(subject);
    const items = slots
      .map((slot) => slot.item)
      .filter((item) => !item.gauge || gauges)
      .filter((item) => item.part === undefined || slots.find((s) => s.item === item)?.part);
    layout = layoutConsole({ width, height, items, insets, mirror, drawerOpen });
    canvas.style.height = `${layout.height}px`;
    for (const slot of slots) {
      const rect = layout.rects.get(slot.item.id);
      slot.rect = rect;
      slot.zone?.setVisible(rect !== undefined && slot.item.zone?.kind !== 'stick');
      if (rect) slot.zone?.place(rect);
      if (slot.button) {
        slot.button.style.display = rect ? 'grid' : 'none';
        if (rect)
          Object.assign(slot.button.style, {
            left: `${rect.left}px`,
            top: `${rect.top}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
          });
      }
      if (rect && slot.part) {
        const aspect = rect.width / rect.height;
        if (aspect !== slot.aspect) {
          slot.part.fit(aspect);
          slot.aspect = aspect;
        }
      }
    }
    const stick = joystick.element.style;
    stick.left = mirror ? '' : `${layout.stick.side}px`;
    stick.right = mirror ? `${layout.stick.side}px` : '';
    stick.bottom = `${layout.stick.bottom}px`;
    Object.assign(top.style, {
      top: `${insets.top + 12}px`,
      left: mirror ? `${insets.left + 12}px` : '',
      right: mirror ? '' : `${insets.right + 12}px`,
    });
    if (layout.drawer && drawerButton === undefined) {
      drawerButton = makeButton(
        {
          label: 'More controls',
          hint: 'Show or hide the other levers',
          icon: CONSOLE_ICONS.more,
          action: '',
          mode: 'tap',
        },
        44,
      );
      drawerButton.addEventListener('pointerup', () => {
        drawerOpen = !drawerOpen;
        drawerButton?.setAttribute('aria-pressed', String(drawerOpen));
        relayout();
      });
      top.prepend(drawerButton);
    } else if (!layout.drawer && drawerButton) {
      drawerButton.remove();
      drawerButton = undefined;
    }
    container.style.setProperty('--molen-console-height', `${layout.height}px`);
    container.style.setProperty('--molen-console-left', `${layout.left}px`);
    container.style.setProperty('--molen-console-right', `${layout.right}px`);
    const buttonsWidth = top.childElementCount > 0 ? top.offsetWidth + 12 + insets.right : 0;
    container.style.setProperty('--molen-console-buttons', `${buttonsWidth}px`);
    dirty = true;
  };

  const show = (): void => {
    const on = visible && subject !== undefined;
    root.style.display = on ? '' : 'none';
    joystick.setVisible(on);
    if (!on) {
      hideTips();
      for (const slot of slots) {
        slot.zone?.setVisible(false);
        slot.active = false;
        slot.preview = undefined;
      }
      releaseActions();
      for (const name of ['height', 'left', 'right', 'buttons'])
        container.style.setProperty(`--molen-console-${name}`, '0px');
    } else relayout();
  };

  const api: VehicleConsole = {
    element: root,
    joystick,
    get subject() {
      return subject;
    },
    get layout() {
      return layout;
    },
    get drawing() {
      return drawing;
    },
    get buttons() {
      return visible ? buttons : [];
    },
    tap(action) {
      if (subject === undefined || !visible) return;
      tapAction(action);
    },
    setSubject(next) {
      const nextKey = subjectKey(next);
      const gaugesBefore = showsGauges(subject);
      if (nextKey !== key || speedUnitOf(next) !== speedUnitOf(subject)) {
        clearSlots();
        key = nextKey;
        subject = next;
        drawerOpen = false;
        if (next) build(next);
        show();
        return;
      }
      subject = next;
      if (showsGauges(next) !== gaugesBefore) relayout();
    },
    setVisible(next) {
      if (next === visible) return;
      visible = next;
      show();
    },
    update(nowMs) {
      const dt = last === undefined ? 0 : Math.max(0, Math.min(0.1, (nowMs - last) / 1000));
      last = nowMs;
      if (!visible || subject === undefined) return;
      if (container.clientWidth !== size.width || container.clientHeight !== size.height)
        relayout();
      if (!layout || !drawing) return;
      const signals: ModelSignals =
        subject.kind === 'aircraft' || subject.kind === 'vehicle' ? subject.visual.signals : {};
      const gaugeTime = nowMs - lastGauges >= 50;
      if (gaugeTime) lastGauges = nowMs;
      let changed = dirty;
      const placements: StripPlacement[] = [];
      const stripTop = size.height - layout.height;
      for (const slot of slots) {
        const { part, rect } = slot;
        if (!part || !rect) continue;
        const active = slot.item.zone?.kind === 'stick' ? joystick.stick.active : slot.active;
        const target = active ? 1 : restOpacity;
        if (slot.opacity !== target) {
          // About 150 ms to show under a thumb, 600 ms to settle back.
          const tau = reducedMotion ? 0 : target > slot.opacity ? 0.05 : 0.2;
          slot.opacity =
            tau === 0 ? target : slot.opacity + (target - slot.opacity) * (1 - Math.exp(-dt / tau));
          if (Math.abs(slot.opacity - target) < 0.004) slot.opacity = target;
          changed = true;
        }
        if (!slot.item.gauge || gaugeTime) {
          const overrides = slot.item.overrides?.(nowMs);
          if (part.pose(overrides ? { ...signals, ...overrides } : signals, slot.preview))
            changed = true;
        }
        placements.push({
          part,
          rect: { ...rect, top: rect.top - stripTop },
          opacity: slot.opacity,
        });
      }
      if (!changed || !ready) return;
      dirty = false;
      strip.draw(placements, options.maxPixelRatio ?? 2);
    },
    dispose() {
      generation++;
      clearSlots();
      container.removeEventListener('pointermove', onGaugeMove, { capture: true });
      container.removeEventListener('pointerdown', onGaugeLeave, { capture: true });
      container.removeEventListener('pointerleave', onGaugeLeave);
      tooltips.dispose();
      strip.dispose();
      joystick.dispose();
      root.remove();
      for (const name of ['height', 'left', 'right', 'buttons'])
        container.style.removeProperty(`--molen-console-${name}`);
    },
  };
  show();
  return api;
}
