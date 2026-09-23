import type { InputGamepad, InputMap } from '@bendyline/molen-client';
import type { GamepadAxisBinding, InputDevice, InputProfile } from '@bendyline/molen-schema';
import { inputProfileIssues, inputProfileSchema } from '@bendyline/molen-schema';
import type { InputHTMLAttributes, ReactElement } from 'react';
import { useEffect, useId, useRef, useState } from 'react';

export interface InputDeviceState {
  devices: InputGamepad[];
  status: InputMap['gamepadStatus'];
}

/** Poll raw devices for custom or shipped UI; optionally suspend gameplay for the hook's lifetime. */
export function useInputDevices(
  input: InputMap,
  options: { suspend?: boolean; pollMs?: number } = {},
): InputDeviceState {
  const [state, setState] = useState<InputDeviceState>({
    devices: [],
    status: input.gamepadStatus,
  });
  const { suspend = false, pollMs = 50 } = options;
  useEffect(() => {
    const resume = suspend ? input.suspend() : undefined;
    const poll = (): void => {
      input.update();
      setState({ devices: input.devices(), status: input.gamepadStatus });
    };
    poll();
    const handle = setInterval(poll, pollMs);
    return () => {
      clearInterval(handle);
      resume?.();
    };
  }, [input, suspend, pollMs]);
  return state;
}

export interface InputActionOption {
  id: string;
  label: string;
}

/** Controlled, unstyled editor. Hosts own profile selection, persistence, action names and layout. */
export interface InputRemapperProps {
  value: InputProfile;
  onChange(profile: InputProfile): void;
  actions: readonly InputActionOption[];
  devices?: readonly InputGamepad[];
  status?: InputDeviceState['status'];
  className?: string;
  /** Optional host persistence/reset controls; the component never accesses storage. */
  onSave?: () => void;
  onReset?: () => void;
}

// Allow transient text such as "-" or an empty field while calibrating; validate on commit.
function NumberInput({
  value,
  onValue,
  profile,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number;
  profile: InputProfile;
  onValue(value: number): void;
}): ReactElement {
  const [draft, setDraft] = useState(String(value));
  // biome-ignore lint/correctness/useExhaustiveDependencies: replacing a profile must also clear a rejected draft whose numeric value did not change.
  useEffect(() => setDraft(String(value)), [value, profile]);
  return (
    <input
      {...props}
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onValue(draft.trim() === '' ? Number.NaN : Number(draft))}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

const deviceKey = (device?: InputDevice): string => (device ? JSON.stringify(device) : '');

/** Editable keyboard, raw button and axis mappings with learning, calibration and live readings. */
export function InputRemapper({
  value,
  onChange,
  actions,
  devices = [],
  status = 'available',
  className,
  onSave,
  onReset,
}: InputRemapperProps): ReactElement {
  const editorId = useId();
  const [action, setAction] = useState(actions[0]?.id ?? '');
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState('');
  // biome-ignore lint/correctness/useExhaustiveDependencies: an external profile replacement clears errors from the previous editing session.
  useEffect(() => setError(''), [value]);
  const baseline = useRef<readonly InputGamepad[]>([]);
  const selected = actions.some((option) => option.id === action) ? action : (actions[0]?.id ?? '');
  const change = (next: InputProfile): void => {
    const result = inputProfileSchema.safeParse(next);
    const message = result.success
      ? inputProfileIssues(result.data)[0]?.message
      : result.error.issues[0]?.message;
    if (message || !result.success) {
      setError(message ?? 'Invalid profile.');
      return;
    }
    setError('');
    onChange(result.data);
  };
  const bind = (
    source:
      | { code: string }
      | { axis: number; device: InputDevice }
      | { button: number; device: InputDevice },
  ): void => {
    if (!selected) return;
    if ('code' in source)
      change({ ...value, bindings: { ...value.bindings, [source.code]: selected } });
    else {
      const overlaps = (device?: InputDevice): boolean =>
        (device?.id === undefined || device.id === source.device.id) &&
        (device?.index === undefined || device.index === source.device.index);
      if ('axis' in source)
        change({
          ...value,
          axes: [
            ...(value.axes ?? []).filter(
              (binding) => binding.axis !== source.axis || !overlaps(binding.device),
            ),
            { ...source, action: selected },
          ],
        });
      else
        change({
          ...value,
          buttons: [
            ...(value.buttons ?? []).filter(
              (binding) => binding.button !== source.button || !overlaps(binding.device),
            ),
            { ...source, action: selected },
          ],
        });
    }
    setLearning(false);
  };
  // Compare against the snapshot at the start of learning: an idle throttle is not a gesture.
  useEffect(() => {
    if (!learning) return;
    for (const pad of devices) {
      const before = baseline.current.find(
        (previous) => previous.id === pad.id && previous.index === pad.index,
      );
      if (!before) continue;
      const device = { id: pad.id, index: pad.index };
      const button = pad.buttons.findIndex(
        (reading, index) =>
          (reading.pressed || reading.value >= 0.5) &&
          !before.buttons[index]?.pressed &&
          (before.buttons[index]?.value ?? 0) < 0.5,
      );
      if (button >= 0) {
        bind({ button, device });
        return;
      }
      const axis = pad.axes.findIndex(
        (reading, index) => Math.abs(reading - (before.axes[index] ?? reading)) > 0.35,
      );
      if (axis >= 0) {
        bind({ axis, device });
        return;
      }
    }
    // Refresh button baselines so a button held when learning began can be released and pressed.
    baseline.current = devices.map((pad) => ({
      ...pad,
      axes:
        baseline.current.find((previous) => previous.id === pad.id && previous.index === pad.index)
          ?.axes ?? pad.axes,
    }));
  });
  const actionSelect = (
    current: string,
    update: (next: string) => void,
    label: string,
  ): ReactElement => (
    <select aria-label={label} value={current} onChange={(event) => update(event.target.value)}>
      {!actions.some((option) => option.id === current) && (
        <option value={current}>{current}</option>
      )}
      {actions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
  const deviceSelect = (
    current: InputDevice | undefined,
    update: (next: InputDevice | undefined) => void,
  ): ReactElement => {
    const options: InputDevice[] = devices.map((pad) => ({ id: pad.id, index: pad.index }));
    if (current && !options.some((option) => deviceKey(option) === deviceKey(current)))
      options.push(current);
    return (
      <select
        aria-label="Controller"
        value={deviceKey(current)}
        onChange={(event) =>
          update(event.target.value ? (JSON.parse(event.target.value) as InputDevice) : undefined)
        }
      >
        <option value="">Any controller</option>
        {options.map((option) => (
          <option key={deviceKey(option)} value={deviceKey(option)}>
            {option.id ?? 'Any ID'}
            {option.index === undefined ? '' : ` (#${option.index})`}
          </option>
        ))}
      </select>
    );
  };
  const axisChange = (index: number, patch: Partial<GamepadAxisBinding>): void =>
    change({
      ...value,
      axes: value.axes?.map((binding, row) => (row === index ? { ...binding, ...patch } : binding)),
    });

  return (
    <div className={className} data-molen-input-editor="">
      <fieldset>
        <legend>Add a mapping</legend>
        {actionSelect(selected, setAction, 'Action to bind')}
        <button
          type="button"
          disabled={!selected}
          onKeyDown={(event) => {
            if (!learning) return;
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') setLearning(false);
            else if (!event.repeat) bind({ code: event.code });
          }}
          onClick={(event) => {
            event.currentTarget.focus();
            baseline.current = devices;
            setLearning(true);
          }}
        >
          Learn input
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            change({ ...value, axes: [...(value.axes ?? []), { action: selected, axis: 0 }] })
          }
        >
          Add axis
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() =>
            change({
              ...value,
              buttons: [...(value.buttons ?? []), { action: selected, button: 0 }],
            })
          }
        >
          Add button
        </button>
        {learning && (
          <>
            <p role="status">
              Press a key or controller button, or move an axis. Escape cancels. Existing key
              mappings are replaced.
            </p>
            <button type="button" onClick={() => setLearning(false)}>
              Cancel learning
            </button>
          </>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <fieldset>
        <legend>Keyboard and mouse</legend>
        {Object.entries(value.bindings).map(([code, bound]) => (
          <div key={code} data-binding="key">
            <span>{code}</span>{' '}
            {actionSelect(
              bound,
              (next) => change({ ...value, bindings: { ...value.bindings, [code]: next } }),
              `${code} action`,
            )}
            <button
              type="button"
              aria-label={`Remove ${code}`}
              onClick={() => {
                const bindings = { ...value.bindings };
                delete bindings[code];
                change({ ...value, bindings });
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>Controller buttons</legend>
        {(value.buttons ?? []).map((binding, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled stateless rows preserve input focus as fields change.
          <div key={`${index}`} data-binding="button">
            {deviceSelect(binding.device, (device) =>
              change({
                ...value,
                buttons: value.buttons?.map((item, row) =>
                  row === index ? { ...item, device } : item,
                ),
              }),
            )}
            <label htmlFor={`${editorId}-button-${index}`}>
              Button{' '}
              <NumberInput
                profile={value}
                id={`${editorId}-button-${index}`}
                min="0"
                step="1"
                value={binding.button}
                onValue={(number) =>
                  change({
                    ...value,
                    buttons: value.buttons?.map((item, row) =>
                      row === index ? { ...item, button: number } : item,
                    ),
                  })
                }
              />
            </label>
            {actionSelect(
              binding.action,
              (next) =>
                change({
                  ...value,
                  buttons: value.buttons?.map((item, row) =>
                    row === index ? { ...item, action: next } : item,
                  ),
                }),
              `Button ${index} action`,
            )}
            <label htmlFor={`${editorId}-threshold-${index}`}>
              Threshold{' '}
              <NumberInput
                profile={value}
                id={`${editorId}-threshold-${index}`}
                min="0.01"
                max="1"
                step="0.01"
                value={binding.threshold ?? 0.5}
                onValue={(number) =>
                  change({
                    ...value,
                    buttons: value.buttons?.map((item, row) =>
                      row === index ? { ...item, threshold: number } : item,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              aria-label={`Remove button ${index}`}
              onClick={() =>
                change({ ...value, buttons: value.buttons?.filter((_, row) => row !== index) })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>Controller axes</legend>
        {(value.axes ?? []).map((binding, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: controlled stateless rows preserve input focus as fields change.
          <div key={`${index}`} data-binding="axis">
            {deviceSelect(binding.device, (device) => axisChange(index, { device }))}
            <label htmlFor={`${editorId}-axis-${index}`}>
              Axis{' '}
              <NumberInput
                profile={value}
                id={`${editorId}-axis-${index}`}
                min="0"
                step="1"
                value={binding.axis}
                onValue={(number) => axisChange(index, { axis: number })}
              />
            </label>
            {actionSelect(
              binding.action,
              (next) => axisChange(index, { action: next }),
              `Axis ${index} action`,
            )}
            <select
              aria-label={`Axis ${index} mode`}
              value={binding.mode ?? 'signed'}
              onChange={(event) =>
                axisChange(index, { mode: event.target.value as GamepadAxisBinding['mode'] })
              }
            >
              <option value="signed">Signed −1 to 1</option>
              <option value="positive">Positive half</option>
              <option value="negative">Negative half</option>
              <option value="unit">Full travel 0 to 1</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={binding.invert ?? false}
                onChange={(event) => axisChange(index, { invert: event.target.checked })}
              />{' '}
              Invert
            </label>
            {(['deadZone', 'curve', 'min', 'center', 'max'] as const).map((field) => (
              <label key={field} htmlFor={`${editorId}-axis-${index}-${field}`}>
                {
                  {
                    deadZone: 'Dead zone',
                    curve: 'Response curve',
                    min: 'Minimum',
                    center: 'Center',
                    max: 'Maximum',
                  }[field]
                }{' '}
                <NumberInput
                  profile={value}
                  id={`${editorId}-axis-${index}-${field}`}
                  step="0.01"
                  value={
                    binding[field] ??
                    {
                      deadZone: binding.mode === 'unit' ? 0 : 0.12,
                      curve: 1,
                      min: -1,
                      center: 0,
                      max: 1,
                    }[field]
                  }
                  onValue={(number) => axisChange(index, { [field]: number })}
                />
              </label>
            ))}
            <button
              type="button"
              aria-label={`Remove axis ${index}`}
              onClick={() =>
                change({ ...value, axes: value.axes?.filter((_, row) => row !== index) })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </fieldset>
      <fieldset>
        <legend>Detected controllers</legend>
        {status === 'blocked' ? (
          <p>Controller access is blocked by the browser or embedding page.</p>
        ) : status === 'unavailable' ? (
          <p>This browser does not expose the Gamepad API.</p>
        ) : devices.length === 0 ? (
          <p>Connect a controller and press a button while this page is focused.</p>
        ) : null}
        {devices.map((pad) => (
          <div key={`${pad.id}:${pad.index}`}>
            <strong>
              {pad.id} (#{pad.index})
            </strong>
            <p>Mapping: {pad.mapping || 'raw'}</p>
            <p>Axes: {pad.axes.map((axis, index) => `${index}: ${axis.toFixed(3)}`).join(' · ')}</p>
            <p>
              Buttons:{' '}
              {pad.buttons
                .map((button, index) => `${index}: ${button.value.toFixed(2)}`)
                .join(' · ')}
            </p>
          </div>
        ))}
      </fieldset>
      {onSave && (
        <button type="button" onClick={onSave}>
          Save controls
        </button>
      )}
      {onReset && (
        <button type="button" onClick={onReset}>
          Restore defaults
        </button>
      )}
    </div>
  );
}
