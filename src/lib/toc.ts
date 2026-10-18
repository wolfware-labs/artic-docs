import type { StarlightRouteData } from '@astrojs/starlight/route-data';

type Toc = NonNullable<StarlightRouteData['toc']>;

/**
 * Starlight always puts an "Overview" entry (slug `_top`) at the head of the table of
 * contents. True when the page has headings of its own after it.
 */
export function hasSections(toc: Pick<Toc, 'items'>): boolean {
  return toc.items.some((item) => item.slug !== '_top');
}
