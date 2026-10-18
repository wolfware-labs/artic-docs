export interface Layer {
  /** Callout heading. */
  name: string;
  /** The crate or crates that implement the layer. */
  crate: string;
  /** How the layer meets the one above it. */
  seam: string;
  /** Printed on the slab's top face. */
  label: string;
  /** Slab colors: top light facet, top dark facet, side top, side bottom. */
  faces: [string, string, string, string];
  /** Drop-in replacements, drawn as dimmed outlines beside the slab. */
  alts: string[];
  /** Set on the layer whose first alternative gets swapped in. */
  swap?: { crate: string };
}

/** The stack, top to bottom. */
export const LAYERS: Layer[] = [
  {
    name: 'View language',
    crate: 'artic-xaml-compiler',
    seam: 'compiled to Rust in build.rs',
    label: 'XAML',
    faces: ['#d3edf5', '#b2dae8', '#6a9cc2', '#3c6890'],
    alts: ['Rust builder', 'your DSL'],
  },
  {
    name: 'Core',
    crate: 'artic-core, artic-layout, artic-style',
    seam: 'signals, layout, styles, text, a11y',
    label: 'artic',
    faces: ['#9adfda', '#74c8c3', '#479aa0', '#2a6a73'],
    alts: [],
  },
  {
    name: 'Renderer',
    crate: 'artic-vello',
    seam: 'impl Renderer',
    label: 'vello',
    faces: ['#c0d4f6', '#9fbaee', '#6181c4', '#3b558f'],
    alts: ['skia', 'yours'],
    swap: { crate: 'your skia adapter' },
  },
  {
    name: 'Host',
    crate: 'artic-winit',
    seam: 'impl Host',
    label: 'winit',
    faces: ['#b6cae2', '#93abcb', '#56779d', '#334c6b'],
    alts: ['SDL', 'browser'],
  },
];

/** Read by screen readers in place of the drawing. */
export const STACK_DESCRIPTION =
  'The artic stack, top to bottom. View language: XAML, compiled to Rust in build.rs by ' +
  'artic-xaml-compiler; a Rust builder or your own DSL can replace it. Core: artic-core, ' +
  'artic-layout and artic-style, with signals, layout, styles, text and accessibility. ' +
  'Renderer: artic-vello behind impl Renderer; skia or your own renderer can replace it. ' +
  'Host: artic-winit behind impl Host; SDL or the browser can replace it.';
