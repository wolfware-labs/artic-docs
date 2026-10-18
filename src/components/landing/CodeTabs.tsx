import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface CodeTab {
  id: string;
  /** File path; the last segment is shown in the stronger weight. */
  label: string;
  /** Pre-highlighted HTML from the build. */
  html: string;
  hint: string;
}

interface Props {
  tabs: CodeTab[];
  /** The rendered result, shown under the code. */
  children?: ReactNode;
}

function Label({ path }: { path: string }) {
  const i = path.lastIndexOf('/') + 1;
  return (
    <>
      {path.slice(0, i)}
      <b>{path.slice(i)}</b>
    </>
  );
}

export default function CodeTabs({ tabs, children }: Props) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent) {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight' ? (active === last ? 0 : active + 1)
      : e.key === 'ArrowLeft' ? (active === 0 ? last : active - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="code-tabs">
      <div className="file">
        <div className="tabs" role="tablist" aria-label="Project files" onKeyDown={onKeyDown}>
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={i === active}
              aria-controls={`panel-${t.id}`}
              tabIndex={i === active ? 0 : -1}
              onClick={() => setActive(i)}
            >
              <Label path={t.label} />
            </button>
          ))}
        </div>
        {tabs.map((t, i) => (
          <div
            key={t.id}
            className="panel"
            role="tabpanel"
            id={`panel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            tabIndex={0}
            hidden={i !== active}
            dangerouslySetInnerHTML={{ __html: t.html }}
          />
        ))}
      </div>
      {children}
      {tabs.map((t, i) => (
        <p key={t.id} className="hint" hidden={i !== active}>
          {t.hint}
        </p>
      ))}
    </div>
  );
}
