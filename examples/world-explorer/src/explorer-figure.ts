import {
  EarthAvatar,
  type EarthAvatarFrame,
  type EarthAvatarOptions,
} from '@bendyline/molen-earth/client';
import type { FigureDescriptor, FigureLook } from '@bendyline/molen-figures/look';
import {
  type FigureLookSource,
  type FigureLookStorage,
  figureBodies,
  figureWanted,
  initialLook,
  randomLook,
  rememberLook,
} from './figure-look.js';

export interface ExplorerFigureOptions extends EarthAvatarOptions {
  params: URLSearchParams;
  /** Hold the world's keys while the designer is open; the returned function gives them back. */
  suspendInput: () => () => void;
  /** Focused once the designer closes. */
  focusTarget: HTMLElement;
}

export interface ExplorerFigure {
  /** False with `?figure=0` and in frozen captures: no body, and no third-person view of one. */
  readonly enabled: boolean;
  /** Whether the last frame drew it. */
  readonly shown: boolean;
  /** `seated` while the viewer rides in something. */
  update(
    dt: number,
    frame: EarthAvatarFrame & { seated: boolean },
    camera: readonly [number, number, number],
  ): void;
  dispose(): void;
}

const STATUS: Record<FigureLookSource, string> = {
  random: 'Someone new each visit, until you design one.',
  saved: 'Your design, kept in this browser.',
  link: 'The figure this link names.',
  visit: 'Someone new for this visit. Your design is back next time.',
};

function browserStorage(): FigureLookStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

/**
 * The viewer's own figure: someone random when the page loads, or the one designed here before.
 * It walks in the third-person view and sits in whatever the viewer drives or flies. The panel's
 * "Your figure" buttons open the character designer or draw someone new.
 */
export function createExplorerFigure(options: ExplorerFigureOptions): ExplorerFigure {
  const controls = document.getElementById('figure-controls') as HTMLFieldSetElement;
  if (!figureWanted(options.params)) {
    controls.hidden = true;
    return { enabled: false, shown: false, update() {}, dispose() {} };
  }
  const status = document.getElementById('figure-status') as HTMLElement;
  const storage = browserStorage();
  const avatar = new EarthAvatar(options);
  const first = initialLook(options.params, storage);
  let designed = first.source === 'saved';
  let look: FigureLook = first.look;
  let bodies = figureBodies(look);
  let worn: FigureDescriptor | undefined;
  const wear = (next: FigureLook, source: FigureLookSource): void => {
    look = next;
    bodies = figureBodies(next);
    status.textContent = STATUS[source];
    controls.dataset.source = source;
  };
  wear(first.look, first.source);

  const dialog = document.createElement('dialog');
  dialog.id = 'figure-dialog';
  dialog.setAttribute('aria-labelledby', 'figure-dialog-title');
  const heading = document.createElement('h2');
  heading.id = 'figure-dialog-title';
  heading.textContent = 'Your figure';
  const done = document.createElement('button');
  done.type = 'button';
  done.textContent = 'Done';
  const titlebar = document.createElement('header');
  titlebar.append(heading, done);
  const host = document.createElement('div');
  dialog.append(titlebar, host);
  document.body.append(dialog);
  let unmount: (() => void) | undefined;
  let resume: (() => void) | undefined;
  const close = (): void => {
    unmount?.();
    unmount = undefined;
    resume?.();
    resume = undefined;
  };
  const open = async (): Promise<void> => {
    if (dialog.open) return;
    resume = options.suspendInput();
    document.exitPointerLock?.();
    host.textContent = 'Loading the designer…';
    dialog.showModal();
    try {
      // React and the designer load the first time they are wanted, not with the world.
      const { mountFigureDesigner } = await import('./figure-designer.js');
      // Closed (or closed and opened again) while it loaded.
      if (!dialog.open || unmount !== undefined) return;
      host.textContent = '';
      unmount = mountFigureDesigner(host, {
        look,
        onCommit: (next) => {
          designed = true;
          wear(next, 'saved');
          rememberLook(storage, next);
        },
      });
    } catch (error) {
      host.textContent = `The designer could not load: ${String(error)}`;
    }
  };
  done.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    close();
    options.focusTarget.focus();
  });
  document.getElementById('figure-design')?.addEventListener('click', () => void open());
  document.getElementById('figure-random')?.addEventListener('click', () => {
    wear(randomLook(), designed ? 'visit' : 'random');
    options.focusTarget.focus();
  });

  return {
    enabled: true,
    get shown() {
      return avatar.shown;
    },
    update(dt, frame, camera) {
      const body = frame.seated ? bodies.seated : bodies.standing;
      if (body !== worn) {
        worn = body;
        avatar.setFigure(body);
      }
      avatar.update(dt, frame, camera);
    },
    dispose() {
      close();
      dialog.remove();
      avatar.dispose();
    },
  };
}
