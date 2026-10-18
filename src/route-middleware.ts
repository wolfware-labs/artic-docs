import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { hasSections } from './lib/toc';

// A table of contents with nothing but "Overview" takes a whole column for one link.
export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  if (route.toc && !hasSections(route.toc)) route.toc = undefined;
});
