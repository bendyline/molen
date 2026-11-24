import type { FigureLook } from '@bendyline/molen-figures/look';
import { FigureDesigner } from '@bendyline/molen-figures-react';
import designerCss from '@bendyline/molen-figures-react/style.css?inline';
import { type ReactElement, useState } from 'react';
import { createRoot } from 'react-dom/client';

/** The explorer's panel colors, through the designer's own theme properties. */
const THEME = `
:host {
  --molen-figure-designer-color: #deedf6;
  --molen-figure-designer-muted: #a9c2d1;
  --molen-figure-designer-surface: #162733;
  --molen-figure-designer-surface-raised: #243746;
  --molen-figure-designer-border: rgb(255 255 255 / 22%);
  --molen-figure-designer-accent: #bde5c8;
  --molen-figure-designer-accent-contrast: #102230;
  --molen-figure-designer-focus-ring: #bde5c8;
  --molen-figure-designer-preview-background: linear-gradient(#a9c8dc, #dbe6ea);
  --molen-figure-designer-sticky-top: 0px;
  display: block;
}
`;

function Designer(props: { look: FigureLook; onCommit: (look: FigureLook) => void }): ReactElement {
  const [look, setLook] = useState(props.look);
  return (
    <FigureDesigner
      look={look}
      onChange={(next, change) => {
        setLook(next);
        // The preview follows a drag; the figure in the world changes once it ends.
        if (change.committed) props.onCommit(next);
      }}
    />
  );
}

/**
 * Put the figure designer in `host`, in a shadow tree: its stylesheet yields to any host rule, and
 * this page styles bare `button` and `label` elements. Returns the function that takes it away.
 */
export function mountFigureDesigner(
  host: HTMLElement,
  options: { look: FigureLook; onCommit: (look: FigureLook) => void },
): () => void {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `${THEME}${designerCss}`;
  const container = document.createElement('div');
  shadow.replaceChildren(style, container);
  const root = createRoot(container);
  root.render(<Designer look={options.look} onCommit={options.onCommit} />);
  return () => {
    root.unmount();
    shadow.replaceChildren();
  };
}
