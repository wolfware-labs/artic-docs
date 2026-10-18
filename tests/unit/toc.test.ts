import { describe, expect, it } from 'vitest';
import { hasSections } from '../../src/lib/toc';

const overview = { depth: 2, slug: '_top', text: 'Overview', children: [] };

describe('hasSections', () => {
  it('is false when the only entry is the overview Starlight adds', () => {
    expect(hasSections({ minHeadingLevel: 2, maxHeadingLevel: 3, items: [overview] })).toBe(false);
  });

  it('is true once the page has a heading of its own', () => {
    const items = [overview, { depth: 2, slug: 'setup', text: 'Setup', children: [] }];
    expect(hasSections({ minHeadingLevel: 2, maxHeadingLevel: 3, items })).toBe(true);
  });
});
