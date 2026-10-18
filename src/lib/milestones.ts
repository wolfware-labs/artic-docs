import snapshot from '../data/milestones.snapshot.json' with { type: 'json' };

export type Milestone = {
  number: number;
  title: string;
  url: string;
  open: number;
  closed: number;
};

export type MilestoneStatus = 'done' | 'in-progress' | 'planned';

const ENDPOINT =
  'https://api.github.com/repos/wolfware-labs/artic/milestones?state=all&per_page=100';

export function milestoneStatus(m: Milestone): MilestoneStatus {
  if (m.closed > 0 && m.open === 0) return 'done';
  if (m.closed > 0) return 'in-progress';
  return 'planned';
}

/** "M7 Accessibility and polish" becomes { code: "M7", name: "Accessibility and polish" }. */
export function parseTitle(title: string): { code: string; name: string } {
  const match = /^(M\d+)\s+(.+)$/.exec(title.trim());
  return match ? { code: match[1], name: match[2] } : { code: '', name: title.trim() };
}

type ApiMilestone = {
  number: number;
  title: string;
  html_url: string;
  open_issues: number;
  closed_issues: number;
};

function isApiMilestone(m: unknown): m is ApiMilestone {
  if (typeof m !== 'object' || m === null) return false;
  const x = m as Record<string, unknown>;
  return (
    Number.isFinite(x.number) &&
    Number.isFinite(x.open_issues) &&
    Number.isFinite(x.closed_issues) &&
    typeof x.title === 'string' &&
    typeof x.html_url === 'string'
  );
}

type Options = {
  fetch?: typeof globalThis.fetch;
  token?: string | undefined;
};

function fromSnapshot(): Milestone[] {
  return [...(snapshot as Milestone[])].sort((a, b) => a.number - b.number);
}

export async function loadMilestones({
  fetch = globalThis.fetch,
  token = process.env.GITHUB_TOKEN,
}: Options = {}): Promise<Milestone[]> {
  if (process.env.ROADMAP_OFFLINE) return fromSnapshot();
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'artic-site',
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(ENDPOINT, { headers, signal: AbortSignal.timeout(10_000) });
    if (res.status !== 200) throw new Error(`GitHub answered ${res.status}`);
    const body = (await res.json()) as ApiMilestone[];
    if (!Array.isArray(body) || body.length === 0 || !body.every(isApiMilestone)) {
      throw new Error('unexpected response shape');
    }
    return body
      .map((m) => ({
        number: m.number,
        title: m.title,
        url: m.html_url,
        open: m.open_issues,
        closed: m.closed_issues,
      }))
      .sort((a, b) => a.number - b.number);
  } catch (err) {
    console.warn(`roadmap: using the committed milestone snapshot (${(err as Error).message})`);
    return fromSnapshot();
  }
}
