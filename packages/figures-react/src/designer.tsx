import {
  createFigureDesignerModel,
  describeFigureLook,
  type FigureDesignerChange,
  type FigureDesignerModel,
  type FigureDesignerStrings,
  type FigurePreview,
  type FigurePreviewFraming,
  type FigurePreviewLighting,
  type FigurePreviewPose,
  figureDesignerText,
  formatFigureHeight,
  mountFigurePreview,
} from '@bendyline/molen-figures/designer';
import {
  DEFAULT_FIGURE_LOOK_CATALOG,
  FIGURE_LOOK_GARMENTS,
  FIGURE_LOOK_PERSON_PALETTES,
  FIGURE_LOOK_SLOTS,
  FIGURE_LOOK_STEERS,
  type FigureDescriptor,
  type FigureLook,
  type FigureLookCatalog,
  type FigureLookCategory,
  type FigureLookCategoryId,
  type FigureLookColorSlot,
  type FigureLookColorTarget,
  type FigureLookGarment,
  type FigureLookOutfit,
  type FigureLookPaletteId,
  type FigureLookPersonColor,
  type FigureLookSlot,
  type FigureLookSteer,
  figureFromLook,
  figureLookKey,
  figureLookOptions,
  figureLookReplaced,
  normalizeFigureLook,
  setFigureLookOption,
} from '@bendyline/molen-figures/look';
import {
  createContext,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

export type FigureDesignerSection = 'person' | 'outfit';
/** Anything the designer can leave out. */
export type FigureDesignerPart = FigureLookCategoryId | FigureLookPersonColor | 'height' | 'steer';

export interface FigureDesignerProps {
  /** The look under edit (any value: it is repaired first). Controlled: pass back `onChange`'s. */
  look: unknown;
  /** A new look. `change.committed` is false mid-drag: save only committed looks. */
  onChange(look: FigureLook, change: FigureDesignerChange): void;
  /** Which options come first and what random looks lean toward (default 'unspecified'). */
  steer?: FigureLookSteer;
  onSteerChange?(steer: FigureLookSteer): void;
  /** Show the built-in steer control (default true). Hosts name its choices through `strings`. */
  steerControl?: boolean;
  catalog?: FigureLookCatalog;
  strings?: FigureDesignerStrings;
  /** The sections to show, as tabs when there are two (default both). */
  sections?: readonly FigureDesignerSection[];
  /** Parts to leave out. */
  hide?: readonly FigureDesignerPart[];
  /** Shown on the figure instead of the look's own outfit (a uniform); edits still apply to the look. */
  outfit?: FigureLookOutfit;
  /** The 3D preview (default true). Without WebGL the designer says so and keeps working. */
  preview?: boolean;
  /** Little pictures on option tiles, drawn with the preview's context (default true). */
  thumbnails?: boolean;
  units?: 'metric' | 'imperial';
  lighting?: Partial<FigurePreviewLighting>;
  motion?: 'auto' | 'reduced' | 'full';
  randomSeed?: () => string;
  className?: string;
  /** Extra controls in the preview's toolbar (a host's save button). */
  actions?: ReactNode;
}

interface Shared {
  model: FigureDesignerModel;
  catalog: FigureLookCatalog;
  text: (key: string, params?: Record<string, string | number>) => string;
  preview: FigurePreview | undefined;
  thumbnails: boolean;
  focus: (framing: FigurePreviewFraming) => void;
}

const DesignerContext = createContext<Shared | undefined>(undefined);

function useShared(): Shared {
  const shared = useContext(DesignerContext);
  if (shared === undefined) throw new Error('figure designer parts must be inside FigureDesigner');
  return shared;
}

/** A tile's picture: the current look with this option, drawn by the shared preview. */
function Thumbnail({
  figure,
  framing,
}: {
  figure: FigureDescriptor;
  framing: FigurePreviewFraming;
}): ReactElement | null {
  const { preview, thumbnails } = useShared();
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(figure);
  useEffect(() => {
    const canvas = ref.current;
    if (canvas === null || preview === undefined || !thumbnails) return;
    return preview.thumbnail(canvas, JSON.parse(key) as FigureDescriptor, framing);
  }, [preview, thumbnails, key, framing]);
  if (!thumbnails || preview === undefined || !preview.available) return null;
  // A picture of the tile's own label. A canvas with no fallback content adds nothing to the
  // label's accessible name, so it needs no role.
  return <canvas ref={ref} width={112} height={112} data-part="thumbnail" />;
}

function OptionGroup({
  category,
  look,
  steer,
}: {
  category: FigureLookCategory;
  look: FigureLook;
  steer: FigureLookSteer;
}): ReactElement {
  const { model, catalog, text, focus } = useShared();
  const name = useId();
  const slot = (FIGURE_LOOK_SLOTS as readonly string[]).includes(category.id);
  const current = currentOption(look, category.id);
  const entries = figureLookOptions(category.id, { catalog, steer });
  const suggested = entries.filter((e) => e.suggested);
  const others = entries.filter((e) => !e.suggested);
  const tile = (optionId: string | null, label: string): ReactElement => {
    const checked = current === optionId;
    const thumbLook =
      optionId === null
        ? setFigureLookOption(look, category.id, null, { catalog })
        : setFigureLookOption(look, category.id, optionId, { catalog });
    return (
      <label key={optionId ?? 'none'} data-part="option" data-checked={checked || undefined}>
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={() => model.choose(category.id, optionId)}
          onFocus={() => focus(category.framing)}
        />
        <Thumbnail
          figure={figureFromLook(thumbLook, {
            catalog,
            ...(model.outfit ? { outfit: model.outfit } : {}),
          })}
          framing={category.framing}
        />
        <span data-part="option-label">{label}</span>
      </label>
    );
  };
  const open = others.some((e) => e.option.id === current);
  return (
    <fieldset data-category={category.id}>
      <legend>{text(`category.${category.id}`)}</legend>
      <div data-part="options">
        {slot ? tile(null, text('slot.none')) : null}
        {suggested.map((e) => tile(e.option.id, text(`option.${e.option.id}`)))}
      </div>
      {others.length > 0 ? (
        <details data-part="more" open={open || undefined}>
          <summary>{text('more.options')}</summary>
          <div data-part="options">
            {others.map((e) => tile(e.option.id, text(`option.${e.option.id}`)))}
          </div>
        </details>
      ) : null}
    </fieldset>
  );
}

function currentOption(look: FigureLook, id: FigureLookCategoryId): string | null {
  if (
    id === 'body' ||
    id === 'head' ||
    id === 'hair' ||
    id === 'hairTexture' ||
    id === 'facialHair'
  )
    return look.person[id];
  if ((FIGURE_LOOK_GARMENTS as readonly string[]).includes(id))
    return look.outfit[id as FigureLookGarment].id;
  return look.outfit.accessories[id as FigureLookSlot]?.id ?? null;
}

function Swatches({
  legend,
  palette,
  value,
  target,
  framing,
}: {
  legend: string;
  palette: FigureLookPaletteId;
  value: string;
  target: FigureLookColorTarget;
  framing: FigurePreviewFraming;
}): ReactElement {
  const { model, catalog, text, focus } = useShared();
  const name = useId();
  const swatches = catalog.palettes[palette];
  const known = swatches.some((s) => s.hex === value);
  return (
    <fieldset data-part="colors">
      <legend>{legend}</legend>
      <div data-part="swatches">
        {swatches.map((swatch) => {
          const label = text(`swatch.${palette}.${swatch.hex}`);
          return (
            <label key={swatch.hex} data-part="swatch" title={label}>
              <input
                type="radio"
                name={name}
                checked={swatch.hex === value}
                onChange={() => model.setColor(target, swatch.hex)}
                onFocus={() => focus(framing)}
              />
              <span data-part="chip" style={{ background: swatch.hex }} aria-hidden="true" />
              <span data-part="visually-hidden">{label}</span>
            </label>
          );
        })}
        <label data-part="custom" data-checked={!known || undefined}>
          <input
            type="color"
            value={value}
            // React's onChange fires on every step of a picker drag: those steps are transient,
            // and leaving the picker commits one undo step.
            onChange={(event) =>
              model.setColor(target, event.currentTarget.value, { commit: false })
            }
            onBlur={(event) => model.setColor(target, event.currentTarget.value)}
            onFocus={() => focus(framing)}
          />
          <span>{text('color.custom')}</span>
        </label>
      </div>
    </fieldset>
  );
}

function Height({ look, units }: { look: FigureLook; units: 'metric' | 'imperial' }): ReactElement {
  const { model, catalog, text, focus } = useShared();
  const id = useId();
  const range = catalog.heights[look.person.age];
  const commit = (event: { currentTarget: HTMLInputElement }): void =>
    model.setHeight(Number(event.currentTarget.value));
  const shown = formatFigureHeight(look.person.height, units);
  return (
    <div data-part="height">
      <label htmlFor={id}>{text('height.label')}</label>
      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={0.01}
        value={look.person.height}
        aria-valuetext={shown}
        onChange={(event) => model.setHeight(Number(event.currentTarget.value), { commit: false })}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        onFocus={() => focus('body')}
      />
      <output htmlFor={id}>{shown}</output>
    </div>
  );
}

function Steer({
  steer,
  onSteer,
}: {
  steer: FigureLookSteer;
  onSteer: (steer: FigureLookSteer) => void;
}): ReactElement {
  const { text } = useShared();
  const name = useId();
  return (
    <fieldset data-part="steer">
      <legend>{text('steer.label')}</legend>
      <div data-part="segmented">
        {FIGURE_LOOK_STEERS.map((value) => (
          <label key={value} data-checked={value === steer || undefined}>
            <input
              type="radio"
              name={name}
              checked={value === steer}
              onChange={() => onSteer(value)}
            />
            <span>{text(`steer.${value}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Categories worth showing: more than one choice (an accessory slot's other choice is none). */
function shown(category: FigureLookCategory, hide: ReadonlySet<string>): boolean {
  if (hide.has(category.id)) return false;
  const slot = (FIGURE_LOOK_SLOTS as readonly string[]).includes(category.id);
  return category.options.length > (slot ? 0 : 1);
}

function ItemColors({
  category,
  look,
}: {
  category: FigureLookCategory;
  look: FigureLook;
}): ReactElement | null {
  const { catalog, text } = useShared();
  const garment = (FIGURE_LOOK_GARMENTS as readonly string[]).includes(category.id);
  const item = garment
    ? look.outfit[category.id as FigureLookGarment]
    : look.outfit.accessories[category.id as FigureLookSlot];
  if (item === undefined) return null;
  const option = category.options.find((o) => o.id === item.id);
  const slots: readonly FigureLookColorSlot[] = option?.colors ?? [];
  return (
    <>
      {slots.map((slot) => {
        // Under a jacket or coat the top colour is the shirt's.
        const key = slot === 'top' && slots.includes('outer') ? 'color.top.under' : `color.${slot}`;
        return (
          <Swatches
            key={slot}
            legend={
              // Accessories always name their item: several share one panel.
              slots.length > 1 || category.options.length <= 1 || !garment
                ? `${text(`category.${category.id}`)}: ${text(key)}`
                : text(key)
            }
            palette={catalog.slotPalettes[slot]}
            value={item.colors[slot] ?? '#000000'}
            target={{ item: category.id as FigureLookGarment | FigureLookSlot, slot }}
            framing={category.framing}
          />
        );
      })}
    </>
  );
}

function PersonSection({
  look,
  steer,
  onSteer,
  steerControl,
  hide,
  units,
}: {
  look: FigureLook;
  steer: FigureLookSteer;
  onSteer: (steer: FigureLookSteer) => void;
  steerControl: boolean;
  hide: ReadonlySet<string>;
  units: 'metric' | 'imperial';
}): ReactElement {
  const { catalog, text } = useShared();
  const category = (id: FigureLookCategoryId): FigureLookCategory | undefined =>
    catalog.categories.find((c) => c.id === id);
  const group = (id: FigureLookCategoryId): ReactElement | null => {
    const found = category(id);
    return found !== undefined && shown(found, hide) ? (
      <OptionGroup key={id} category={found} look={look} steer={steer} />
    ) : null;
  };
  const color = (id: FigureLookPersonColor, framing: FigurePreviewFraming): ReactElement | null =>
    hide.has(id) ? null : (
      <Swatches
        legend={text(`color.${id}`)}
        palette={FIGURE_LOOK_PERSON_PALETTES[id]}
        value={look.person[id]}
        target={id}
        framing={framing}
      />
    );
  return (
    <>
      {steerControl && !hide.has('steer') ? <Steer steer={steer} onSteer={onSteer} /> : null}
      {color('skin', 'body')}
      {group('head')}
      {group('hair')}
      {group('hairTexture')}
      {color('hairColor', 'head')}
      {group('facialHair')}
      {color('eyes', 'head')}
      {group('body')}
      {hide.has('height') ? null : <Height look={look} units={units} />}
    </>
  );
}

function OutfitSection({
  look,
  steer,
  hide,
}: {
  look: FigureLook;
  steer: FigureLookSteer;
  hide: ReadonlySet<string>;
}): ReactElement {
  const { catalog } = useShared();
  const ids: readonly FigureLookCategoryId[] = [...FIGURE_LOOK_GARMENTS, ...FIGURE_LOOK_SLOTS];
  // A dress covers the bottom: its picker waits until another top is chosen.
  const replaced: ReadonlySet<string> = figureLookReplaced(look.outfit, catalog);
  return (
    <>
      {ids.map((id) => {
        const category = catalog.categories.find((c) => c.id === id);
        if (category === undefined || hide.has(id) || replaced.has(id)) return null;
        return (
          <div key={id} data-part="item">
            {shown(category, hide) ? (
              <OptionGroup category={category} look={look} steer={steer} />
            ) : null}
            <ItemColors category={category} look={look} />
          </div>
        );
      })}
    </>
  );
}

function Tabs({
  sections,
  active,
  onActive,
  ids,
}: {
  sections: readonly FigureDesignerSection[];
  active: FigureDesignerSection;
  onActive: (section: FigureDesignerSection) => void;
  ids: Record<FigureDesignerSection, string>;
}): ReactElement {
  const { text } = useShared();
  const refs = useRef<Partial<Record<FigureDesignerSection, HTMLButtonElement | null>>>({});
  const onKey = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = sections.indexOf(active);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0 && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next =
      event.key === 'Home'
        ? sections[0]
        : event.key === 'End'
          ? sections[sections.length - 1]
          : sections[(index + step + sections.length) % sections.length];
    if (next === undefined) return;
    onActive(next);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" data-part="tabs">
      {sections.map((section) => (
        <button
          key={section}
          ref={(el) => {
            refs.current[section] = el;
          }}
          type="button"
          role="tab"
          id={`${ids[section]}-tab`}
          aria-selected={section === active}
          aria-controls={ids[section]}
          tabIndex={section === active ? 0 : -1}
          onClick={() => onActive(section)}
          onKeyDown={onKey}
        >
          {text(`section.${section}`)}
        </button>
      ))}
    </div>
  );
}

/**
 * The character designer: a 3D preview beside the person (skin, head, hair, body shape, height)
 * and their clothing and accessories. Controlled: the host owns the look and saves it.
 */
export function FigureDesigner(props: FigureDesignerProps): ReactElement {
  const catalog = props.catalog ?? DEFAULT_FIGURE_LOOK_CATALOG;
  const { strings } = props;
  const sections = props.sections ?? ['person', 'outfit'];
  const hide = useMemo(() => new Set<string>(props.hide ?? []), [props.hide]);
  const units = props.units ?? 'metric';
  const [internalSteer, setInternalSteer] = useState<FigureLookSteer>(props.steer ?? 'unspecified');
  const steer = props.steer ?? internalSteer;
  const modelRef = useRef<FigureDesignerModel | undefined>(undefined);
  if (modelRef.current === undefined || modelRef.current.catalog !== catalog)
    modelRef.current = createFigureDesignerModel({
      look: props.look,
      catalog,
      steer,
      ...(props.randomSeed ? { randomSeed: props.randomSeed } : {}),
    });
  const model = modelRef.current;
  const [, setVersion] = useState(0);
  const onChange = useRef(props.onChange);
  onChange.current = props.onChange;
  const textRef = useRef<(key: string, params?: Record<string, string | number>) => string>(
    (key) => key,
  );
  const unitsRef = useRef(units);

  // The host's look and steer win: adopt them when they differ from what the model holds.
  const incoming = useMemo(
    () => normalizeFigureLook(props.look, { catalog }).look,
    [props.look, catalog],
  );
  // All three are quiet: they notify no one, so adopting them while rendering is safe.
  if (figureLookKey(incoming) !== figureLookKey(model.look)) model.setLook(incoming);
  if (model.steer !== steer) model.setSteer(steer);
  if (model.outfit !== props.outfit) model.outfit = props.outfit;

  const [announcement, setAnnouncement] = useState('');
  useEffect(
    () =>
      model.subscribe((m, change) => {
        setVersion((v) => v + 1);
        if (change.source === 'external') return;
        onChange.current(m.look, change);
        if (!change.committed) return;
        const category = m.catalog.categories.find((c) => c.id === change.source);
        if (category !== undefined) {
          const option = currentOption(m.look, category.id);
          setAnnouncement(
            textRef.current('status.changed', {
              category: textRef.current(`category.${category.id}`),
              option:
                option === null
                  ? textRef.current('slot.none')
                  : textRef.current(`option.${option}`),
            }),
          );
        } else if (
          change.source === 'random' ||
          change.source === 'undo' ||
          change.source === 'redo'
        )
          setAnnouncement(
            describeFigureLook(m.look, { catalog: m.catalog, units: unitsRef.current }),
          );
      }),
    [model],
  );

  // Preview.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<FigurePreview | undefined>(undefined);
  const [unavailable, setUnavailable] = useState(false);
  const [framing, setFraming] = useState<FigurePreviewFraming>('body');
  const [pose, setPose] = useState<FigurePreviewPose>('idle');
  const wantPreview = props.preview ?? true;
  // The preview mounts once (per lighting and motion); figure changes are pushed below.
  const firstFigure = useRef(model.figure);
  const lightingKey = JSON.stringify(props.lighting ?? null);
  const motion = props.motion;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!wantPreview || canvas === null) return;
    const lighting = JSON.parse(lightingKey) as Partial<FigurePreviewLighting> | null;
    const mounted = mountFigurePreview(canvas, {
      figure: firstFigure.current,
      ...(lighting ? { lighting } : {}),
      ...(motion ? { motion } : {}),
      onUnavailable: () => setUnavailable(true),
    });
    if (!mounted.available) setUnavailable(true);
    setPreview(mounted);
    return () => {
      mounted.dispose();
      setPreview(undefined);
    };
  }, [wantPreview, lightingKey, motion]);
  const figureKey = JSON.stringify(model.figure);
  useEffect(() => {
    preview?.setFigure(JSON.parse(figureKey) as FigureDescriptor);
  }, [preview, figureKey]);
  useEffect(() => preview?.setFraming(framing), [preview, framing]);
  useEffect(() => preview?.setPose(pose), [preview, pose]);

  const [active, setActive] = useState<FigureDesignerSection>(sections[0] ?? 'person');
  const panelId = useId();
  const ids = { person: `${panelId}-person`, outfit: `${panelId}-outfit` };
  const text = (key: string, params?: Record<string, string | number>): string =>
    figureDesignerText(key, {
      catalog,
      ...(strings ? { strings } : {}),
      ...(params ? { params } : {}),
    });
  textRef.current = text;
  unitsRef.current = units;
  const onSteer = (next: FigureLookSteer): void => {
    if (props.steer === undefined) setInternalSteer(next);
    props.onSteerChange?.(next);
  };
  const look = model.look;
  const shownLook = props.outfit ? { ...look, outfit: props.outfit } : look;
  const description = describeFigureLook(shownLook, {
    catalog,
    units,
    ...(strings ? { strings } : {}),
  });
  const shared: Shared = {
    model,
    catalog,
    text,
    preview: unavailable ? undefined : preview,
    thumbnails: props.thumbnails ?? true,
    focus: (next) => setFraming(next),
  };
  const section = sections.includes(active) ? active : (sections[0] ?? 'person');

  return (
    <DesignerContext.Provider value={shared}>
      <div data-molen-figure-designer="" className={props.className}>
        <div data-part="layout">
          {wantPreview ? (
            <div data-part="stage">
              <canvas
                ref={canvasRef}
                data-part="preview"
                role="img"
                aria-label={text('preview.label', { description })}
              />
              {unavailable ? <p data-part="notice">{text('preview.unavailable')}</p> : null}
              <div data-part="toolbar">
                <button type="button" onClick={() => preview?.turn(-0.5)} disabled={unavailable}>
                  {text('action.rotateLeft')}
                </button>
                <button type="button" onClick={() => preview?.turn(0.5)} disabled={unavailable}>
                  {text('action.rotateRight')}
                </button>
                <button
                  type="button"
                  aria-pressed={framing === 'head'}
                  onClick={() => setFraming(framing === 'head' ? 'body' : 'head')}
                  disabled={unavailable}
                >
                  {text(framing === 'head' ? 'action.viewBody' : 'action.viewHead')}
                </button>
                <button
                  type="button"
                  aria-pressed={pose === 'walk'}
                  onClick={() => setPose(pose === 'walk' ? 'idle' : 'walk')}
                  disabled={unavailable}
                >
                  {text(pose === 'walk' ? 'action.stand' : 'action.walk')}
                </button>
              </div>
            </div>
          ) : null}
          <div data-part="panel">
            <div data-part="actions">
              <button type="button" onClick={() => model.randomize()}>
                {text('action.randomize')}
              </button>
              {sections.includes('outfit') ? (
                <button type="button" onClick={() => model.randomize(['person'])}>
                  {text('action.randomizeOutfit')}
                </button>
              ) : null}
              <button type="button" onClick={() => model.undo()} disabled={!model.canUndo}>
                {text('action.undo')}
              </button>
              <button type="button" onClick={() => model.redo()} disabled={!model.canRedo}>
                {text('action.redo')}
              </button>
              {props.actions}
            </div>
            {sections.length > 1 ? (
              <Tabs sections={sections} active={section} onActive={setActive} ids={ids} />
            ) : null}
            <div
              id={ids[section]}
              data-part="section"
              data-section={section}
              {...(sections.length > 1
                ? { role: 'tabpanel', 'aria-labelledby': `${ids[section]}-tab` }
                : { role: 'region', 'aria-label': text(`section.${section}`) })}
            >
              {section === 'person' ? (
                <PersonSection
                  look={look}
                  steer={steer}
                  onSteer={onSteer}
                  steerControl={props.steerControl ?? true}
                  hide={hide}
                  units={units}
                />
              ) : (
                <OutfitSection look={look} steer={steer} hide={hide} />
              )}
            </div>
            <p data-part="visually-hidden" aria-live="polite">
              {announcement}
            </p>
          </div>
        </div>
      </div>
    </DesignerContext.Provider>
  );
}
