import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { hasSections } from './lib/toc';
import {
  LANDING_CARD,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
  docsCard,
  shareImageAlt,
  shareImageUrl,
} from './lib/seo.mjs';

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;

  // Each page shares its own card. The 404 page is not in the docs collection and has no card
  // of its own, so it shares the landing page's.
  const card = route.entry.id === '404' ? LANDING_CARD : docsCard(route.entry.id, route.entry.data);
  const image = shareImageUrl(card, import.meta.env.OG_DESIGN_VERSION);
  const alt = shareImageAlt(card);
  route.head.push(
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: String(SHARE_IMAGE_WIDTH) } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: String(SHARE_IMAGE_HEIGHT) } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: alt } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
    { tag: 'meta', attrs: { name: 'twitter:image:alt', content: alt } },
  );

  // A table of contents with nothing but "Overview" takes a whole column for one link.
  if (route.toc && !hasSections(route.toc)) route.toc = undefined;
});
