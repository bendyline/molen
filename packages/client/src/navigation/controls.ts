import type { InputProfile } from '@bendyline/molen-schema';
import { NAVIGATION_ACTIONS as A, type NavigationInputSource } from './input-source';

export interface NavigationControlsOptions {
  /** Button destination. The editor opens in a modal dialog. */
  container: HTMLElement;
  focusTarget: HTMLElement;
  /** Opt into localStorage persistence; use the same key to share mappings between hosts. */
  storageKey?: string;
}

export interface NavigationControls {
  dispose(): void;
}

/** Controller discovery and raw axis/button mapping for the built-in navigation profiles. */
export function createNavigationControls(
  source: NavigationInputSource,
  options: NavigationControlsOptions,
): NavigationControls {
  const map = source.map;
  const doc = options.container.ownerDocument;
  const defaults = new Map(map.profileNames().map((name) => [name, map.getProfile(name)]));
  let storageMessage = '';
  if (options.storageKey) {
    try {
      const saved: unknown = JSON.parse(
        doc.defaultView?.localStorage.getItem(options.storageKey) ?? 'null',
      );
      if (saved && typeof saved === 'object') {
        for (const name of map.profileNames()) {
          if (Object.hasOwn(saved, name)) {
            try {
              map.defineProfile(
                name,
                (saved as Record<string, InputProfile>)[name] as InputProfile,
              );
            } catch {
              storageMessage = 'Some saved mappings were invalid; defaults were restored.';
            }
          }
        }
      }
    } catch {
      storageMessage = 'Saved controls could not be loaded. You can still remap this session.';
    }
  }
  const button = (text: string, parent: HTMLElement, action: () => void): HTMLButtonElement => {
    const element = doc.createElement('button');
    element.type = 'button';
    element.textContent = text;
    element.addEventListener('click', action);
    parent.append(element);
    return element;
  };
  const dialog = doc.createElement('dialog');
  dialog.setAttribute('aria-label', 'Joystick and controller settings');
  dialog.className = 'molen-navigation-controls';
  dialog.style.cssText =
    'box-sizing:border-box;width:min(600px,calc(100vw - 24px));max-height:85vh;overflow:auto;padding:20px;border:1px solid #607b8a;border-radius:12px;background:#162b38;color:#e1edf4;font:14px/1.5 system-ui;color-scheme:dark';
  const heading = doc.createElement('h2');
  heading.textContent = 'Joystick and controller settings';
  dialog.append(heading);
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  const hint = doc.createElement('p');
  hint.textContent =
    'Press a controller button to let the browser detect it. Move each axis to identify its number below. Controls are suspended while this editor is open.';
  dialog.append(status, hint);
  const select = (text: string): HTMLSelectElement => {
    const label = doc.createElement('label');
    label.style.cssText =
      'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0;color:inherit;font:inherit';
    label.append(`${text} `);
    const field = doc.createElement('select');
    field.setAttribute('aria-label', text);
    field.style.cssText = 'max-width:100%;min-width:0;font:inherit';
    label.append(field);
    dialog.append(label);
    return field;
  };
  const option = (field: HTMLSelectElement, value: string, text: string): void => {
    const item = doc.createElement('option');
    item.value = value;
    item.textContent = text;
    field.append(item);
  };
  const profile = select('Profile');
  for (const name of map.profileNames())
    option(profile, name, name === 'pilot' ? 'pilot (aircraft)' : name);
  const device = select('Controller');
  const raw = doc.createElement('pre');
  raw.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px';
  dialog.append(raw);
  const axis = select('Axis');
  const axisAction = select('Axis action');
  const invertLabel = doc.createElement('label');
  const invert = doc.createElement('input');
  invert.type = 'checkbox';
  invertLabel.append(invert, ' Reverse axis');
  dialog.append(invertLabel);
  const zoneLabel = doc.createElement('label');
  zoneLabel.style.cssText = 'display:block;margin:10px 0';
  zoneLabel.append('Dead zone ');
  const zone = doc.createElement('input');
  zone.type = 'number';
  zone.min = '0';
  zone.max = '0.9';
  zone.step = '0.01';
  zone.value = '0.12';
  zone.style.width = '6em';
  zoneLabel.append(zone);
  dialog.append(zoneLabel);
  const bindings = doc.createElement('div');
  const feedback = doc.createElement('p');
  feedback.setAttribute('role', 'status');
  feedback.textContent = storageMessage;
  let pairs: Array<[label: string, negative: string, positive: string]> = [];
  let resume: (() => void) | undefined;
  let deviceSignature = '';
  let controlSignature = '';
  const currentDevice = () => map.devices().find((pad) => String(pad.index) === device.value);
  const renderBindings = (): void => {
    bindings.replaceChildren();
    const current = map.getProfile(profile.value);
    for (const kind of ['axes', 'buttons'] as const) {
      current[kind]?.forEach((binding, index) => {
        const row = doc.createElement('p');
        row.style.cssText = 'font-size:12px;overflow-wrap:anywhere';
        row.append(
          `${'axis' in binding ? `Axis ${binding.axis} (${binding.mode ?? 'signed'}${binding.invert ? ', reversed' : ''})` : `Button ${binding.button}`} → ${binding.action.replace('nav-', '')} · ${binding.device?.id ?? 'any controller'} `,
        );
        button('Remove', row, () => {
          const next = map.getProfile(profile.value);
          next[kind]?.splice(index, 1);
          map.defineProfile(profile.value, next);
          renderBindings();
        });
        bindings.append(row);
      });
    }
  };
  const sameDevice = (binding: { device?: { id?: string; index?: number } }): boolean => {
    const pad = currentDevice();
    return (
      !!pad &&
      (binding.device?.id === undefined || binding.device.id === pad.id) &&
      (binding.device?.index === undefined || binding.device.index === pad.index)
    );
  };
  const bindAxis = button('Assign axis', dialog, () => {
    const pad = currentDevice();
    const deadZone = Number(zone.value);
    if (!pad || !Number.isFinite(deadZone) || deadZone < 0 || deadZone >= 1) {
      feedback.textContent = 'Choose a detected controller and a dead zone from 0 to less than 1.';
      return;
    }
    const next = map.getProfile(profile.value);
    const pair = pairs[Number(axisAction.value)];
    const actions = pair ? [pair[1], pair[2]] : [A.power];
    const index = Number(axis.value);
    next.axes = (next.axes ?? []).filter(
      (binding) =>
        !sameDevice(binding) || (binding.axis !== index && !actions.includes(binding.action)),
    );
    const common = { axis: index, device: { id: pad.id }, invert: invert.checked, deadZone };
    if (pair) {
      next.axes.push(
        { ...common, action: pair[1], mode: 'negative' },
        { ...common, action: pair[2], mode: 'positive' },
      );
    } else next.axes.push({ ...common, deadZone: 0, action: A.power, mode: 'unit' });
    map.defineProfile(profile.value, next);
    feedback.textContent =
      'Axis assigned. Close the editor to try it; Save keeps it for next time.';
    renderBindings();
  });
  const padButton = select('Button');
  const buttonAction = select('Button action');
  const bindButton = button('Assign button', dialog, () => {
    const pad = currentDevice();
    if (!pad) return;
    const next = map.getProfile(profile.value);
    const index = Number(padButton.value);
    next.buttons = (next.buttons ?? []).filter(
      (binding) => !sameDevice(binding) || binding.button !== index,
    );
    next.buttons.push({ button: index, action: buttonAction.value, device: { id: pad.id } });
    map.defineProfile(profile.value, next);
    feedback.textContent =
      'Button assigned. Close the editor to try it; Save keeps it for next time.';
    renderBindings();
  });
  const updateProfile = (): void => {
    const pilot = profile.value === 'pilot';
    pairs = [
      [pilot ? 'Pitch (positive = nose up)' : 'Forward / backward', A.forward, A.back],
      [pilot ? 'Roll (positive = right)' : 'Left / right', A.left, A.right],
      ['Look left / right', A.lookLeft, A.lookRight],
      ['Look up / down', A.lookUp, A.lookDown],
      ...(pilot
        ? [['Rudder (positive = right)', A.yawLeft, A.yawRight] as [string, string, string]]
        : [['Down / up', A.down, A.up] as [string, string, string]]),
    ];
    axisAction.replaceChildren();
    pairs.forEach((pair, index) => {
      option(axisAction, String(index), pair[0]);
    });
    if (pilot) option(axisAction, 'power', 'Throttle / collective (absolute lever)');
    buttonAction.replaceChildren();
    const actions: Array<[string, string]> = [
      [A.jump, pilot || profile.value === 'drive' ? 'Brake' : 'Jump'],
      [A.interact, 'Enter / exit vehicle'],
      [A.view, 'Change view'],
      ...(pilot
        ? ([
            [A.throttleUp, 'Increase throttle'],
            [A.throttleDown, 'Decrease throttle'],
            [A.engine, 'Engine'],
            [A.gear, 'Landing gear'],
            [A.flaps, 'Flaps'],
            [A.vector, 'Thrust vector'],
            [A.recover, 'Recover'],
          ] as Array<[string, string]>)
        : ([
            [A.sprint, 'Sprint / handbrake'],
            [A.up, 'Up'],
            [A.down, 'Down'],
          ] as Array<[string, string]>)),
    ];
    for (const [value, label] of actions) option(buttonAction, value, label);
    renderBindings();
  };
  profile.addEventListener('change', updateProfile);
  const mappingDetails = doc.createElement('details');
  const mappingSummary = doc.createElement('summary');
  mappingSummary.textContent = 'Current mappings';
  mappingDetails.append(mappingSummary, bindings);
  dialog.append(feedback, mappingDetails);
  button('Save', dialog, () => {
    if (!options.storageKey) return;
    try {
      doc.defaultView?.localStorage.setItem(
        options.storageKey,
        JSON.stringify(
          Object.fromEntries(map.profileNames().map((name) => [name, map.getProfile(name)])),
        ),
      );
      feedback.textContent = 'Controls saved on this browser.';
    } catch {
      feedback.textContent =
        'Browser storage is unavailable. Mappings still work for this session.';
    }
  }).hidden = !options.storageKey;
  button('Reset profile', dialog, () => {
    const original = defaults.get(profile.value);
    if (original) map.defineProfile(profile.value, original);
    feedback.textContent = 'Default gamepad mappings restored. Save to keep this reset.';
    renderBindings();
  });
  button('Done', dialog, () => dialog.close());
  const close = (): void => {
    resume?.();
    resume = undefined;
    options.focusTarget.focus();
  };
  dialog.addEventListener('close', close);
  const open = button('Controllers', options.container, () => {
    profile.value = map.activeProfile ?? map.profileNames()[0] ?? '';
    updateProfile();
    resume = map.suspend();
    doc.exitPointerLock?.();
    dialog.showModal();
    poll();
  });
  doc.body.append(dialog);
  const poll = (): void => {
    if (dialog.open) map.update();
    const pads = map.devices();
    open.textContent = `Controllers (${pads.length})`;
    if (!dialog.open) return;
    const message =
      map.gamepadStatus === 'blocked'
        ? 'Controller access is blocked by the browser or embedding page.'
        : map.gamepadStatus === 'unavailable'
          ? 'This browser does not expose controller input. Use HTTPS or localhost in a browser with Gamepad API support.'
          : pads.length
            ? `${pads.length} controller(s) detected.`
            : 'No controller detected yet. Focus this page and press a controller button.';
    if (status.textContent !== message) status.textContent = message;
    const signature = JSON.stringify(pads.map((pad) => [pad.id, pad.index]));
    if (signature !== deviceSignature) {
      deviceSignature = signature;
      const previous = device.value;
      device.replaceChildren();
      for (const pad of pads) option(device, String(pad.index), `${pad.id} (#${pad.index})`);
      if (pads.some((pad) => String(pad.index) === previous)) device.value = previous;
    }
    const pad = currentDevice();
    const controls = JSON.stringify([pad?.id, pad?.index, pad?.axes.length, pad?.buttons.length]);
    if (controls !== controlSignature) {
      controlSignature = controls;
      axis.replaceChildren();
      padButton.replaceChildren();
      pad?.axes.forEach((_, index) => {
        option(axis, String(index), String(index));
      });
      pad?.buttons.forEach((_, index) => {
        option(padButton, String(index), String(index));
      });
    }
    bindAxis.disabled = !pad?.axes.length;
    bindButton.disabled = !pad?.buttons.length;
    raw.textContent = pad
      ? `Axes: ${pad.axes.map((value, index) => `${index}: ${value.toFixed(2)}`).join('  ')}\nPressed buttons: ${pad.buttons.flatMap((value, index) => (value.pressed || value.value > 0.5 ? [index] : [])).join(', ') || 'none'}`
      : '';
  };
  const timer = setInterval(poll, 100);
  return {
    dispose() {
      clearInterval(timer);
      resume?.();
      dialog.remove();
      open.remove();
    },
  };
}
