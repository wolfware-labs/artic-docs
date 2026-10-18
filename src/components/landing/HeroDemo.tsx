import { useEffect, useRef, useState } from 'react';
import './hero-demo.css';

type Device = 'desktop' | 'phone' | 'tablet';
type Field = 'spacing' | 'content' | 'classes';
type Values = Record<Field, string>;

const START: Values = { spacing: '8', content: 'Sign in', classes: 'primary' };
const DEVICES: Device[] = ['desktop', 'phone', 'tablet'];
const DEVICE_LABEL: Record<Device, string> = { desktop: 'Desktop', phone: 'Phone', tablet: 'Tablet' };

type Step =
  | { kind: 'type'; field: Field; to: string }
  | { kind: 'device'; to: Device }
  | { kind: 'wait'; ms: number };

// One loop of the demo: edit, watch the window follow, move to the next device.
const SCRIPT: Step[] = [
  { kind: 'wait', ms: 1400 },
  { kind: 'type', field: 'content', to: 'Log in' },
  { kind: 'wait', ms: 1100 },
  { kind: 'device', to: 'phone' },
  { kind: 'wait', ms: 2000 },
  { kind: 'type', field: 'classes', to: 'accent' },
  { kind: 'wait', ms: 1100 },
  { kind: 'device', to: 'tablet' },
  { kind: 'wait', ms: 2000 },
  { kind: 'type', field: 'spacing', to: '16' },
  { kind: 'wait', ms: 1100 },
  { kind: 'device', to: 'desktop' },
  { kind: 'wait', ms: 2000 },
  { kind: 'type', field: 'content', to: 'Sign in' },
  { kind: 'type', field: 'classes', to: 'primary' },
  { kind: 'type', field: 'spacing', to: '8' },
];

const DELETE_MS = 55;
const TYPE_MS = 95;

export default function HeroDemo() {
  const [values, setValues] = useState<Values>(START);
  const [device, setDevice] = useState<Device>('desktop');
  const [editing, setEditing] = useState<Field | null>(null);
  const [pulse, setPulse] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    let onScreen = true;
    const io = new IntersectionObserver(([e]) => (onScreen = e.isIntersecting));
    if (root.current) io.observe(root.current);

    // Waits `ms` of visible time: the clock stops while the hero is off screen or the tab is hidden.
    const sleep = async (ms: number) => {
      let left = ms;
      while (left > 0 && !cancelled) {
        const tick = Math.min(left, 50);
        await new Promise((r) => setTimeout(r, tick));
        if (onScreen && !document.hidden) left -= tick;
      }
    };

    const set = (field: Field, value: string) => {
      setValues((v) => ({ ...v, [field]: value }));
      setPulse((p) => p + 1);
    };

    const run = async () => {
      const current = { ...START };
      while (!cancelled) {
        for (const step of SCRIPT) {
          if (cancelled) return;
          if (step.kind === 'wait') await sleep(step.ms);
          if (step.kind === 'device') setDevice(step.to);
          if (step.kind === 'type') {
            setEditing(step.field);
            while (current[step.field].length > 0 && !cancelled) {
              current[step.field] = current[step.field].slice(0, -1);
              set(step.field, current[step.field]);
              await sleep(DELETE_MS);
            }
            for (const ch of step.to) {
              if (cancelled) return;
              current[step.field] += ch;
              set(step.field, current[step.field]);
              await sleep(TYPE_MS);
            }
            await sleep(400);
            setEditing(null);
            await sleep(300);
          }
        }
      }
    };
    run();

    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, []);

  const val = (field: Field) => (
    <span className={`s${editing === field ? ' hd-edit' : ''}`}>
      "{values[field]}
      {editing === field && <span className="hd-caret" />}"
    </span>
  );

  const gap = (Number(values.spacing) || 0) * 1.5;

  return (
    <div
      className="hd"
      data-device={device}
      ref={root}
      role="img"
      aria-label="A XAML sign-in view being edited, with the app window updating as it changes, shown on desktop, phone and tablet."
    >
      <div className="hd-stage" aria-hidden="true">
        <div className="hd-device">
          <div className="hd-screen">
            {/* Keyed by device so the content fades back in after each change of frame. */}
            <div className="hd-app" key={device}>
              {device === 'desktop' ? (
                <div className="hd-titlebar">
                  <i />
                  <i />
                  <i />
                  <span>hello</span>
                </div>
              ) : (
                <div className="hd-status">
                  <span>9:41</span>
                  <span className="hd-signal">
                    <b />
                    <b />
                    <b />
                  </span>
                </div>
              )}
              <div className="hd-ui" style={{ gap: `${gap}px` }}>
                <div className="hd-field">you@example.com</div>
                <div className={`hd-btn hd-${values.classes === 'accent' ? 'accent' : 'primary'}`}>
                  {values.content || ' '}
                </div>
              </div>
            </div>
            <span key={`r${pulse}`} className="hd-reload" />
            <span key={`g${device}`} className="hd-glare" />
          </div>
        </div>

        <pre className="hd-code">
          <span className="hd-file">main.xaml</span>
          <code>
            <span className="t">&lt;StackPanel</span> <span className="a">Spacing</span>={val('spacing')}
            {'\n            '}
            <span className="a">Margin</span>=<span className="s">"16"</span>
            <span className="t">&gt;</span>
            {'\n  '}
            <span className="t">&lt;TextBox</span> <span className="a">Text</span>=
            <span className="s">"{'{'}Binding Email{'}'}"</span>
            <span className="t">/&gt;</span>
            {'\n  '}
            <span className="t">&lt;Button</span> <span className="a">Classes</span>={val('classes')}
            {'\n          '}
            <span className="a">Content</span>={val('content')}
            {'\n          '}
            <span className="a">Command</span>=<span className="s">"{'{'}Binding SignIn{'}'}"</span>
            <span className="t">/&gt;</span>
            {'\n'}
            <span className="t">&lt;/StackPanel&gt;</span>
          </code>
        </pre>
      </div>

      <div className="hd-switch" aria-hidden="true">
        <span className="hd-thumb" />
        {DEVICES.map((d) => (
          <span key={d} className={d === device ? 'on' : undefined}>
            {DEVICE_LABEL[d]}
          </span>
        ))}
      </div>
    </div>
  );
}
