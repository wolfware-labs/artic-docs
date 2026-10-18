import { describe, expect, it } from 'vitest';
import { hasSections } from '../../src/lib/toc';

type Item = { depth: number; slug: string; text: string; children: Item[] };

const heading = (depth: number, slug: string, children: Item[] = []): Item => ({
  depth,
  slug,
  text: slug,
  children,
});
const overview = (children: Item[] = []) => heading(2, '_top', children);

describe('hasSections', () => {
  it('is false when the only entry is the overview Starlight adds', () => {
    expect(hasSections({ items: [overview()] })).toBe(false);
  });

  it('is true once the page has a heading of its own', () => {
    expect(hasSections({ items: [overview(), heading(2, 'setup')] })).toBe(true);
  });

  it('counts headings Starlight nested under the overview', () => {
    // A ### before the first ## lands in the overview's children.
    expect(hasSections({ items: [overview([heading(3, 'details')])] })).toBe(true);
  });
});
