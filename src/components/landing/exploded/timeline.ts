// Maps scroll progress through the section to the drawing's animation phases.

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Cubic ease in-out. */
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Eased progress of `p` through the window `[a, b]`. */
export const seg = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));

export interface Phases {
  /** Slabs separate. */
  explode: number;
  /** Narrow layouts: the stack moves from the center to make room for the alternatives. */
  shift: number;
  /** Leader lines draw out to the callouts. */
  leaders: number;
  /** Alternatives slide out beside the swappable layers. */
  alts: number;
  /** Connectors grow toward the alternatives once they have landed. */
  conn: number;
  /** vello fades to an outline. */
  unplug: number;
  /** The vello and skia outlines trade places. */
  move: number;
  /** skia lights up in the stack. */
  plug: number;
}

export function phases(p: number): Phases {
  return {
    explode: seg(p, 0.04, 0.38),
    shift: seg(p, 0.4, 0.5),
    leaders: seg(p, 0.3, 0.52),
    alts: seg(p, 0.5, 0.68),
    conn: seg(p, 0.68, 0.76),
    unplug: seg(p, 0.78, 0.85),
    move: seg(p, 0.85, 0.92),
    plug: seg(p, 0.92, 0.98),
  };
}

/** Which of the three steps the drawing is on: 0 assembled, 1 apart, 2 swapped. */
export function stageAt(p: number): 0 | 1 | 2 {
  const ph = phases(p);
  if (ph.unplug > 0) return 2;
  return ph.explode < 0.5 ? 0 : 1;
}

/** Where the drawing rests when it can't follow the scroll: everything out, before the swap. */
export const STATIC_PROGRESS = 0.72;

const FOLLOW = 0.12;
const SNAP = 0.0005;

/**
 * One animation frame of easing toward the scroll position, so wheel steps glide instead
 * of snapping. Lands exactly on `target` once it is close enough, which ends the loop.
 */
export function step(shown: number, target: number): number {
  const next = shown + (target - shown) * FOLLOW;
  return Math.abs(target - next) < SNAP ? target : next;
}
