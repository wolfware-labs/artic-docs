import type { StarlightRouteData } from '@astrojs/starlight/route-data';

type Toc = NonNullable<StarlightRouteData['toc']>;

/**
 * Starlight always puts an "Overview" entry (slug `_top`) at the head of the table of
 * contents, and nests any heading deeper than h2 that comes before the first h2 under it.
 * True when the page has headings of its own, at the top level or under the overview.
 */
export function hasSections(toc: Pick<Toc, 'items'>): boolean {
  return toc.items.some((item) => item.slug !== '_top' || item.children.length > 0);
}
