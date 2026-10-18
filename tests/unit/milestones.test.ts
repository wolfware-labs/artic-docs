import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import snapshot from '../../src/data/milestones.snapshot.json';
import { loadMilestones, milestoneStatus, parseTitle } from '../../src/lib/milestones';

const api = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('milestoneStatus', () => {
  it('is done when nothing is open and something closed', () => {
    expect(milestoneStatus({ number: 1, title: '', url: '', open: 0, closed: 33 })).toBe('done');
  });
  it('is in progress when some closed and some open', () => {
    expect(milestoneStatus({ number: 2, title: '', url: '', open: 11, closed: 16 })).toBe('in-progress');
  });
  it('is planned when nothing closed', () => {
    expect(milestoneStatus({ number: 3, title: '', url: '', open: 16, closed: 0 })).toBe('planned');
  });
});

describe('parseTitle', () => {
  it('splits the code from the name', () => {
    expect(parseTitle('M7 Accessibility and polish')).toEqual({ code: 'M7', name: 'Accessibility and polish' });
  });
  it('keeps a title without a code whole', () => {
    expect(parseTitle('Backlog')).toEqual({ code: '', name: 'Backlog' });
  });
});

describe('loadMilestones', () => {
  beforeEach(() => vi.stubEnv('ROADMAP_OFFLINE', ''));
  afterEach(() => vi.unstubAllEnvs());
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('returns the snapshot when fetch rejects, with one warning', async () => {
    warn.mockClear();
    const got = await loadMilestones({ fetch: vi.fn().mockRejectedValue(new Error('offline')) as never, token: '' });
    expect(got).toEqual(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the snapshot on a 403', async () => {
    warn.mockClear();
    const got = await loadMilestones({ fetch: api({ message: 'rate limited' }, 403) as never, token: '' });
    expect(got).toEqual(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the snapshot on bad JSON', async () => {
    warn.mockClear();
    const f = vi.fn(async () => new Response('<html>', { status: 200 }));
    expect(await loadMilestones({ fetch: f as never, token: '' })).toEqual(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the snapshot on an empty list', async () => {
    warn.mockClear();
    expect(await loadMilestones({ fetch: api([]) as never, token: '' })).toEqual(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('returns the snapshot when an item is missing closed_issues', async () => {
    warn.mockClear();
    const f = api([{ number: 1, title: 'A', html_url: 'https://x/1', open_issues: 0 }]);
    expect(await loadMilestones({ fetch: f as never, token: '' })).toEqual(snapshot);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('maps the API shape and sorts by number', async () => {
    const f = api([
      { number: 2, title: 'B', html_url: 'https://x/2', open_issues: 1, closed_issues: 2 },
      { number: 1, title: 'A', html_url: 'https://x/1', open_issues: 0, closed_issues: 5 },
    ]);
    expect(await loadMilestones({ fetch: f as never, token: '' })).toEqual([
      { number: 1, title: 'A', url: 'https://x/1', open: 0, closed: 5 },
      { number: 2, title: 'B', url: 'https://x/2', open: 1, closed: 2 },
    ]);
    expect(f.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/wolfware-labs/artic/milestones?state=all&per_page=100',
    );
  });

  it('sends the token as a bearer header', async () => {
    const f = api([{ number: 1, title: 'A', html_url: 'https://x/1', open_issues: 0, closed_issues: 1 }]);
    await loadMilestones({ fetch: f as never, token: 'abc' });
    const init = f.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('skips the request when ROADMAP_OFFLINE is set', async () => {
    vi.stubEnv('ROADMAP_OFFLINE', '1');
    const f = api([]);
    expect(await loadMilestones({ fetch: f as never, token: '' })).toEqual(snapshot);
    expect(f).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
