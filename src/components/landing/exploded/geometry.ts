// Where every piece of the exploded stack sits at a given scroll progress.
// Coordinates are SVG user units in the layout's viewBox.

import { LAYERS, type Layer } from './layers';
import { clamp, lerp, phases } from './timeline';

/** How visible an unused part is. */
export const DIM = 0.5;

export interface Layout {
  key: 'wide' | 'narrow';
  viewBox: string;
  /** Stack center x, slab half-width, slab thickness. */
  cx: number;
  /** Where the stack starts, if it moves to `cx` before the alternatives slide out. */
  cxStart?: number;
  w: number;
  t: number;
  /** Alternative slots: center x of each, half-width, thickness, drop below the slab. */
  altX: [number, number];
  aw: number;
  altT: number;
  altDy: number;
  /** y of the top slab and the distance between slabs, closed and open. */
  topClosed: number;
  topOpen: number;
  gapClosed: number;
  gapOpen: number;
  /** Largest font size for the label on a slab's top face. */
  faceMax: number;
  /** Gap between a slab and the end of its connector. */
  connInset: number;
  /** x where callout text starts, or null to leave callouts out of the drawing. */
  calloutX: number | null;
  /** Which side of the closed stack the layer names sit on. */
  tagSide: 'left' | 'right';
}

/** The approved desktop drawing. */
export const WIDE: Layout = {
  key: 'wide',
  viewBox: '-20 0 1000 620',
  cx: 470,
  w: 112,
  t: 18,
  altX: [710, 890],
  aw: 66,
  altT: 10,
  altDy: 6,
  topClosed: 250,
  topOpen: 95,
  gapClosed: 19,
  gapOpen: 142,
  faceMax: 22,
  connInset: 14,
  calloutX: 0,
  tagSide: 'left',
};

/** Phones and small tablets: smaller slabs, callouts listed under the drawing. */
export const NARROW: Layout = {
  key: 'narrow',
  viewBox: '0 0 420 440',
  cx: 118,
  // Centered until the alternatives need the room on the right.
  cxStart: 210,
  w: 76,
  t: 12,
  // Far enough apart that the captions under each pair read as two ("Rust builder", "your DSL").
  altX: [264, 380],
  aw: 36,
  altT: 7,
  altDy: 4,
  topClosed: 180,
  topOpen: 50,
  gapClosed: 13,
  gapOpen: 100,
  faceMax: 16,
  connInset: 10,
  calloutX: null,
  // The left margin is too narrow for the names. The right one stays empty until the
  // alternatives slide out.
  tagSide: 'right',
};

/** One slab, solid or outlined. */
export interface Part {
  label: string;
  cx: number;
  cy: number;
  w: number;
  t: number;
  /** 0 = in use (solid), 1 = unused (dimmed outline). */
  ghost: number;
  /** Opacity of the outline's caption. */
  cap: number;
}

export interface LayerFrame {
  index: number;
  layer: Layer;
  /** The layer's own slab. */
  main: Part;
  /** Its alternatives, with the opacity they slide out at. */
  alts: (Part & { opacity: number })[];
  /** Name tag beside the closed stack, so it reads as layers before it opens. */
  tag: { x: number; y: number; opacity: number };
  /** Leader line and callout, when the layout draws them. */
  leader: { x: number; y: number; textX: number; dash: number; opacity: number } | null;
  /** Dashed line from the slab toward its alternatives. */
  connector: { x1: number; x2: number; y: number; opacity: number } | null;
  /** Crate line in the callout. */
  crate: string;
  /** Opacity of the callout. */
  callout: number;
}

export function frame(p: number, L: Layout): LayerFrame[] {
  const ph = phases(p);
  // Captions on the swapping outlines hide while they move.
  const capVis = 1 - Math.sin(Math.PI * ph.move);
  const top = lerp(L.topClosed, L.topOpen, ph.explode);
  const stackX = lerp(L.cxStart ?? L.cx, L.cx, ph.shift);
  const gap = lerp(L.gapClosed, L.gapOpen, ph.explode);

  return LAYERS.map((layer, index) => {
    const cy = top + index * gap;
    const swaps = layer.swap !== undefined;

    // Alternatives slide out from behind the slab.
    const alts = layer.alts.map((label, j) => {
      const moving = swaps && j === 0;
      let cx = lerp(stackX + L.w * 0.4, L.altX[j], ph.alts);
      let w = lerp(L.w * 0.6, L.aw, ph.alts);
      let t = L.altT;
      let ghost = 1;
      if (moving) {
        cx = lerp(cx, stackX, ph.move);
        w = lerp(w, L.w, ph.move);
        t = lerp(L.altT, L.t, ph.move);
        ghost = 1 - ph.plug;
      }
      return {
        label,
        cx,
        cy: cy + L.altDy * (moving ? 1 - ph.move : 1),
        w,
        t,
        ghost,
        cap: moving ? capVis : 1,
        opacity: ph.alts,
      };
    });

    const main: Part = swaps
      ? {
          label: layer.label,
          cx: lerp(stackX, L.altX[0], ph.move),
          cy: cy + L.altDy * ph.move,
          w: lerp(L.w, L.aw, ph.move),
          t: lerp(L.t, L.altT, ph.move),
          ghost: ph.unplug,
          cap: capVis,
        }
      : { label: layer.label, cx: stackX, cy, w: L.w, t: L.t, ghost: 0, cap: 1 };

    // Gone well before the leader lines start drawing.
    const tag = {
      x: L.tagSide === 'left' ? stackX - L.w - 10 : stackX + L.w + 10,
      y: cy + L.t / 2,
      opacity: 1 - clamp(ph.explode * 3),
    };

    let leader: LayerFrame['leader'] = null;
    if (L.calloutX !== null) {
      const x = stackX - L.w;
      leader = {
        x,
        y: cy,
        textX: L.calloutX,
        dash: (x - 30 - L.calloutX + 38) * ph.leaders,
        opacity: ph.leaders,
      };
    }

    let connector: LayerFrame['connector'] = null;
    if (layer.alts.length) {
      const x1 = stackX + L.w + L.connInset;
      const x2 = L.altX[0] - L.aw - L.connInset;
      connector = {
        x1,
        x2: lerp(x1, x2, ph.conn),
        y: cy + L.altDy,
        opacity: ph.conn > 0 ? DIM * (swaps ? capVis : 1) : 0,
      };
    }

    return {
      index,
      layer,
      main,
      alts,
      tag,
      leader,
      connector,
      crate: swaps && ph.plug > 0.5 ? layer.swap!.crate : layer.crate,
      callout: ph.leaders,
    };
  });
}

/** True once the replacement renderer is in the stack. */
export const swapped = (p: number) => phases(p).plug > 0.5;

const pts = (...xy: number[]) => {
  let s = '';
  for (let i = 0; i < xy.length; i += 2) s += `${i ? ' ' : ''}${xy[i]},${xy[i + 1]}`;
  return s;
};

/** Point lists for one isometric slab centered at (cx, cy) on its top face. */
export function slabShapes(cx: number, cy: number, w: number, t: number) {
  const h = w / 2;
  const k = 0.78;
  const ih = h * k;
  const iw = w * k;
  const s = t + 26; // shadow drop
  return {
    shadow: pts(cx - w, cy + s, cx, cy + h + s, cx + w, cy + s, cx, cy - h + s),
    left: pts(cx - w, cy, cx, cy + h, cx, cy + h + t, cx - w, cy + t),
    right: pts(cx, cy + h, cx + w, cy, cx + w, cy + t, cx, cy + h + t),
    topLeft: pts(cx, cy - h, cx, cy + h, cx - w, cy),
    topRight: pts(cx, cy - h, cx + w, cy, cx, cy + h),
    top: pts(cx, cy - h, cx + w, cy, cx, cy + h, cx - w, cy),
    inset: pts(cx, cy - ih, cx + iw, cy, cx, cy + ih, cx - iw, cy),
    frontEdge: pts(cx - w, cy, cx, cy + h, cx + w, cy),
    backEdge: pts(cx - w, cy, cx, cy - h, cx + w, cy),
    h,
  };
}
