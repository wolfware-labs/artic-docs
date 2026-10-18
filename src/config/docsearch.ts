// Client options for Algolia DocSearch. Each page carries its version in a meta tag
// (see Head.astro), and results are limited to that version's records.
const version =
  document.querySelector<HTMLMetaElement>('meta[name="docsearch:version"]')?.content ?? 'latest';

export default {
  appId: import.meta.env.PUBLIC_DOCSEARCH_APP_ID,
  apiKey: import.meta.env.PUBLIC_DOCSEARCH_API_KEY,
  indexName: import.meta.env.PUBLIC_DOCSEARCH_INDEX,
  searchParameters: { facetFilters: [`version:${version}`] },
};
