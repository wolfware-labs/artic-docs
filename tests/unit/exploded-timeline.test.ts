import { describe, expect, it } from 'vitest';
import { phases, stageAt, step } from '../../src/components/landing/exploded/timeline';
import { frame, NARROW, WIDE } from '../../src/components/landing/exploded/geometry';
import { LAYERS } from '../../src/components/landing/exploded/layers';

describe('phases', () => {
  it('starts the explode at 0.04 and finishes it at 0.38', () => {
    expect(phases(0.04).explode).toBe(0);
    expect(phases(0.38).explode).toBe(1);
  });

  it('slides the alternatives out before any connector grows', () => {
    const p = phases(0.6);
    expect(p.alts).toBeGreaterThan(0);
    expect(p.alts).toBeLessThan(1);
    expect(p.conn).toBe(0);
  });

  it('finishes unplugging before the outlines move', () => {
    const p = phases(0.85);
    expect(p.unplug).toBe(1);
    expect(p.move).toBe(0);
  });

  it('ends with the new renderer plugged in', () => {
    expect(phases(1).plug).toBe(1);
  });

  it('keeps every phase in [0, 1], even outside the track', () => {
    for (const p of [-1, 0, 0.3, 0.5, 0.77, 0.9, 1, 2]) {
      for (const v of Object.values(phases(p))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('stageAt', () => {
  it('reads assembled until the stack is half open', () => {
    expect(stageAt(0)).toBe(0);
    expect(stageAt(0.15)).toBe(0);
  });

  it('reads apart while the layers and their alternatives are out', () => {
    expect(stageAt(0.4)).toBe(1);
    expect(stageAt(0.72)).toBe(1);
  });

  it('reads swapped once the renderer starts to unplug', () => {
    expect(stageAt(0.8)).toBe(2);
    expect(stageAt(1)).toBe(2);
  });
});

describe('step', () => {
  it('moves 12% of the way to the target', () => {
    expect(step(0, 1)).toBe(0.12);
  });

  it('snaps to the target once it is close enough', () => {
    expect(step(0.9996, 1)).toBe(1);
  });

  it('works on the way back up', () => {
    expect(step(1, 0)).toBeCloseTo(0.88);
  });
});

describe('frame', () => {
  const renderer = LAYERS.findIndex((l) => l.swap);

  it('draws every layer in both layouts', () => {
    expect(frame(0, WIDE)).toHaveLength(LAYERS.length);
    expect(frame(0, NARROW)).toHaveLength(LAYERS.length);
  });

  it('keeps the stack closed at the start and open at the end', () => {
    const gap = (p: number) => frame(p, WIDE)[1].main.cy - frame(p, WIDE)[0].main.cy;
    expect(gap(0)).toBe(WIDE.gapClosed);
    expect(gap(1)).toBe(WIDE.gapOpen);
  });

  it('names the stock renderer until the swap, then the adapter', () => {
    expect(frame(0.9, WIDE)[renderer].crate).toBe('artic-vello');
    expect(frame(1, WIDE)[renderer].crate).toBe('your skia adapter');
  });

  it('trades the vello and skia slabs during the swap', () => {
    const end = frame(1, WIDE)[renderer];
    expect(end.main.cx).toBe(WIDE.altX[0]);
    expect(end.main.ghost).toBe(1);
    expect(end.alts[0].cx).toBe(WIDE.cx);
    expect(end.alts[0].ghost).toBe(0);
  });

  it('tags each layer by name beside the closed stack, on the side its layout picks', () => {
    for (const L of [WIDE, NARROW]) {
      for (const f of frame(0, L)) {
        expect(f.tag.opacity).toBe(1);
        if (L.tagSide === 'left') expect(f.tag.x).toBeLessThan(L.cx - L.w);
        else expect(f.tag.x).toBeGreaterThan(L.cx + L.w);
        expect(f.tag.y).toBeGreaterThan(f.main.cy);
        expect(f.tag.y).toBeLessThan(f.main.cy + L.t);
      }
    }
  });

  it('fades the tags out before the callouts draw in', () => {
    expect(frame(0.15, WIDE)[0].tag.opacity).toBeGreaterThan(0);
    expect(frame(0.15, WIDE)[0].tag.opacity).toBeLessThan(1);
    expect(frame(0.3, WIDE)[0].tag.opacity).toBe(0);
  });

  it('starts the narrow stack centered and moves it left before the alternatives slide out', () => {
    const center = (p: number) => frame(p, NARROW)[0].main.cx;
    expect(center(0)).toBe(NARROW.cxStart);
    expect(center(0.38)).toBe(NARROW.cxStart);
    expect(center(0.5)).toBe(NARROW.cx);
    expect(phases(0.5).alts).toBe(0);
    // Mid-move it sits between the two positions.
    expect(center(0.45)).toBeLessThan(NARROW.cxStart!);
    expect(center(0.45)).toBeGreaterThan(NARROW.cx);
  });

  it('keeps the wide stack where it is', () => {
    expect(frame(0, WIDE)[0].main.cx).toBe(WIDE.cx);
    expect(frame(0.45, WIDE)[0].main.cx).toBe(WIDE.cx);
  });
});

