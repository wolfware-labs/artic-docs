import starlightDocSearch from '@astrojs/starlight-docsearch';

const SETTINGS = ['PUBLIC_DOCSEARCH_APP_ID', 'PUBLIC_DOCSEARCH_API_KEY', 'PUBLIC_DOCSEARCH_INDEX'];

/** True when every Algolia setting is present and non-empty. */
export function docsearchEnabled(env) {
  return SETTINGS.every((name) => Boolean(env[name]));
}

/**
 * Algolia DocSearch when it is fully configured; otherwise no plugin, so Starlight's
 * built-in search stays. The credentials are read in the browser by the client options module.
 */
export function searchPlugins(env) {
  if (!docsearchEnabled(env)) return [];
  return [starlightDocSearch({ clientOptionsModule: './src/config/docsearch.ts' })];
}

/** "latest" for the current docs, or the slug of the archived version the path belongs to. */
export function versionFromPath(pathname, versions) {
  const [first] = pathname.split('/').filter(Boolean);
  return versions.includes(first) ? first : 'latest';
}
