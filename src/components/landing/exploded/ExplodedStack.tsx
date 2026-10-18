import { useEffect, useRef, useState } from 'react';
import './exploded.css';
import { frame, NARROW, slabShapes, swapped, WIDE, type Layout, type Part } from './geometry';
import { LAYERS, STACK_DESCRIPTION } from './layers';
import { clamp, STATIC_PROGRESS, step } from './timeline';

const NARROW_QUERY = '(max-width: 899.98px)';
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

type Faces = { id: string; colors: readonly string[] };

function SolidSlab({ part, faces, layout }: { part: Part; faces: Faces; layout: Layout }) {
  const { cx, cy, w, t, label } = part;
  const s = slabShapes(cx, cy, w, t);
  const size = Math.min(layout.faceMax, (w * 1.5) / Math.max(4, label.length));
  return (
    <>
      <polygon points={s.shadow} fill="#020a12" opacity={0.35} filter={`url(#${layout.key}-soft)`} />
      <polygon points={s.left} fill={`url(#${faces.id}-l)`} />
      <polygon points={s.right} fill={`url(#${faces.id}-r)`} />
      <polygon points={s.topLeft} fill={faces.colors[0]} />
      <polygon points={s.topRight} fill={faces.colors[1]} />
      <polygon points={s.inset} fill="none" stroke="#0e2135" strokeOpacity={0.22} />
      <polyline points={s.frontEdge} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.2} />
      <polyline points={s.backEdge} fill="none" stroke="#ffffff" strokeOpacity={0.25} />
      <line x1={cx} y1={cy + s.h} x2={cx} y2={cy + s.h + t} stroke="#ffffff" strokeOpacity={0.3} />
      <text
        className="xs-face"
        transform={`translate(${cx} ${cy}) matrix(1 -.5 1 .5 0 0)`}
        textAnchor="middle"
        dy=".35em"
        fontSize={size}
      >
        {label}
      </text>
    </>
  );
}

function GhostSlab({ part }: { part: Part }) {
  const { cx, cy, w, t, label, cap } = part;
  const s = slabShapes(cx, cy, w, t);
  const st = {
    fill: '#8fa8e8',
    fillOpacity: 0.05,
    stroke: '#8fa8e8',
    strokeDasharray: '4 4',
    strokeWidth: 1.1,
  };
  return (
    <>
      <polygon points={s.left} {...st} />
      <polygon points={s.right} {...st} />
      <polygon points={s.top} {...st} />
      <g opacity={cap}>
        <line x1={cx} y1={cy + s.h + t + 6} x2={cx} y2={cy + s.h + t + 16} stroke="#8fa8e8" />
        <text className="xs-cap" x={cx} y={cy + s.h + t + 32} textAnchor="middle">
          {label}
        </text>
      </g>
    </>
  );
}

/** A slab that crossfades between in use (solid) and unused (dimmed outline). */
function Slab({ part, faces, layout }: { part: Part; faces: Faces; layout: Layout }) {
  return (
    <>
      {part.ghost < 1 && (
        <g opacity={1 - part.ghost}>
          <SolidSlab part={part} faces={faces} layout={layout} />
        </g>
      )}
      {part.ghost > 0 && (
        <g opacity={part.ghost * 0.5}>
          <GhostSlab part={part} />
        </g>
      )}
    </>
  );
}

function Drawing({ progress, layout }: { progress: number; layout: Layout }) {
  const layers = frame(progress, layout);
  const k = layout.key;
  return (
    <svg
      className={`xs-drawing xs-${k}`}
      viewBox={layout.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={STACK_DESCRIPTION}
    >
      <defs>
        <filter id={`${k}-soft`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={layout.key === 'wide' ? 9 : 6} />
        </filter>
        {LAYERS.map((L, i) => (
          <g key={i}>
            <linearGradient id={`${k}-${i}-l`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={L.faces[1]} />
              <stop offset="1" stopColor={L.faces[2]} />
            </linearGradient>
            <linearGradient id={`${k}-${i}-r`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={L.faces[2]} />
              <stop offset="1" stopColor={L.faces[3]} />
            </linearGradient>
          </g>
        ))}
      </defs>
      {/* Bottom layer first, so upper slabs and their shadows sit on top. */}
      {[...layers].reverse().map((f) => {
        const faces = { id: `${k}-${f.index}`, colors: f.layer.faces };
        return (
          <g key={f.index}>
            {f.alts.map((a, j) =>
              a.opacity > 0 ? (
                <g key={j} opacity={a.opacity}>
                  <Slab part={a} faces={faces} layout={layout} />
                </g>
              ) : null,
            )}
            <Slab part={f.main} faces={faces} layout={layout} />
            {f.leader && f.leader.opacity > 0 && (
              <g opacity={f.leader.opacity}>
                <circle cx={f.leader.x} cy={f.leader.y} r={3} fill="#6cc3c0" />
                <polyline
                  points={`${f.leader.x},${f.leader.y} ${f.leader.x - 30},${f.leader.y - 22} ${f.leader.textX},${f.leader.y - 22}`}
                  fill="none"
                  stroke="#d4e8f3"
                  strokeOpacity={0.7}
                  strokeDasharray={`${f.leader.dash} 1000`}
                />
                <text className="xs-ann" x={f.leader.textX} y={f.leader.y - 30}>
                  {f.layer.name}
                </text>
                <text className="xs-id" x={f.leader.textX} y={f.leader.y - 4}>
                  {f.crate}
                </text>
                <text className="xs-id xs-seam" x={f.leader.textX} y={f.leader.y + 14}>
                  {f.layer.seam}
                </text>
              </g>
            )}
            {f.connector && f.connector.opacity > 0 && (
              <line
                opacity={f.connector.opacity}
                x1={f.connector.x1}
                y1={f.connector.y}
                x2={f.connector.x2}
                y2={f.connector.y}
                stroke="#8fa8e8"
                strokeWidth={1.2}
                strokeDasharray="3 4"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Narrow screens: the callouts as a list under the drawing, keyed by each slab's color. */
function Callouts({ progress }: { progress: number }) {
  const layers = frame(progress, NARROW);
  return (
    <ul className="xs-callouts" aria-hidden="true">
      {layers.map((f) => (
        <li
          key={f.index}
          style={{ opacity: f.callout, transform: `translateY(${(1 - f.callout) * 8}px)` }}
        >
          <svg className="xs-swatch" viewBox="0 0 20 10" aria-hidden="true">
            <polygon points="0,5 10,0 10,10" fill={f.layer.faces[0]} />
            <polygon points="10,0 20,5 10,10" fill={f.layer.faces[1]} />
          </svg>
          <span className="xs-name">{f.layer.name}</span>
          <code className="xs-crate">
            {/* Break crate lists only between crates. */}
            {f.crate.split(', ').map((c, i, all) => (
              <span key={c}>
                <span>
                  {c}
                  {i < all.length - 1 ? ',' : ''}
                </span>
                {i < all.length - 1 ? ' ' : ''}
              </span>
            ))}
          </code>
          <code className="xs-crate xs-seam">{f.layer.seam}</code>
        </li>
      ))}
    </ul>
  );
}

type Mode = 'both' | 'wide' | 'narrow';

export default function ExplodedStack() {
  const track = useRef<HTMLDivElement>(null);
  // Until the island runs, and whenever motion is reduced, show the drawing with
  // everything out, before the swap.
  const [shown, setShown] = useState(STATIC_PROGRESS);
  const [live, setLive] = useState(false);
  // Server output carries both layouts and lets CSS pick; once running, draw only one.
  const [mode, setMode] = useState<Mode>('both');

  useEffect(() => {
    const narrow = matchMedia(NARROW_QUERY);
    const reduce = matchMedia(REDUCE_QUERY);
    const sync = () => {
      setMode(narrow.matches ? 'narrow' : 'wide');
      setLive(!reduce.matches);
    };
    sync();
    narrow.addEventListener('change', sync);
    reduce.addEventListener('change', sync);
    return () => {
      narrow.removeEventListener('change', sync);
      reduce.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (!live) {
      setShown(STATIC_PROGRESS);
      return;
    }
    let current = 0;
    let target = 0;
    let raf = 0;

    const progress = () => {
      const el = track.current;
      if (!el) return 0;
      const r = el.getBoundingClientRect();
      return clamp(-r.top / (r.height - innerHeight));
    };
    // Ease toward the scroll position; stop asking for frames once it lands.
    const tick = () => {
      current = step(current, target);
      setShown(current);
      raf = current === target ? 0 : requestAnimationFrame(tick);
    };
    const onScroll = () => {
      target = progress();
      if (!raf && current !== target) raf = requestAnimationFrame(tick);
    };

    current = target = progress();
    setShown(current);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [live]);

  return (
    <div
      className="xs"
      data-live={live}
      data-progress={Math.round(shown * 100) / 100}
      data-swapped={swapped(shown)}
    >
      <div ref={track} className="xs-track">
        <div className="xs-stage">
          <div className="xs-wrap">
            <h2 id="how-it-works-title">Every layer comes apart.</h2>
            <p className="xs-one">
              Swap the view language, the renderer or the window host. Your views and logic stay
              the same.
            </p>
            {mode !== 'narrow' && <Drawing progress={shown} layout={WIDE} />}
            {mode !== 'wide' && (
              <div className="xs-narrow-body">
                <Drawing progress={shown} layout={NARROW} />
                <Callouts progress={shown} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
