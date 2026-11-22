import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderCard } from '../../lib/og';
import { LANDING_CARD, docsCard, type Card } from '../../lib/seo.mjs';

export const getStaticPaths = (async () => {
  const docs = await getCollection('docs');
  return [
    { params: { slug: LANDING_CARD.key }, props: LANDING_CARD },
    ...docs.map((entry) => ({ params: { slug: entry.id }, props: docsCard(entry.id, entry.data) })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) =>
  new Response(new Uint8Array(await renderCard(props as Card)), { headers: { 'Content-Type': 'image/png' } });
