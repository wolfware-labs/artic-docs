import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import starlightVersions from 'starlight-versions';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { docsearchEnabled, searchPlugins } from './src/lib/search.mjs';
import { versionsPluginConfig } from './src/lib/versions.mjs';

const archived = JSON.parse(readFileSync(new URL('./versions.json', import.meta.url), 'utf8'));
const versionsConfig = versionsPluginConfig(archived);
const docsearch = docsearchEnabled(process.env);
const stub = fileURLToPath(new URL('./src/components/docs/NoPlugin.astro', import.meta.url));

function starlightPlugins() {
  return [
    // The landing page lives outside Starlight, so its anchors can't be validated.
    starlightLinksValidator({ exclude: ['/', '/#*'] }),
    // The versions plugin refuses an empty list, so it only loads once a release is archived.
    ...(versionsConfig ? [starlightVersions(versionsConfig)] : []),
    ...searchPlugins(process.env),
  ];
}

export default defineConfig({
  site: 'https://artic.rs',
  // The newsletter e2e builds a second copy of the site with the form switched on.
  outDir: process.env.ARTIC_OUT_DIR || 'dist',
  vite: {
    resolve: {
      // Our Banner and Search overrides render components from plugins that may be off.
      // A plugin that is off has no virtual modules, so point its components at an empty stub.
      alias: {
        ...(versionsConfig
          ? {}
          : {
              'starlight-versions/components/VersionBanner.astro': stub,
              'starlight-versions/components/VersionSearch.astro': stub,
            }),
        ...(docsearch ? {} : { '@astrojs/starlight-docsearch/DocSearch.astro': stub }),
      },
    },
  },
  integrations: [
    react(),
    starlight({
      title: 'artic',
      // Starlight asks for /favicon.svg by default; point it at the logo the landing page uses.
      favicon: '/brand/artic-logo.png',
      plugins: starlightPlugins(),
      routeMiddleware: './src/route-middleware.ts',
      // DocSearch replaces Pagefind, which would otherwise index the build for nothing.
      pagefind: !docsearch,
      components: {
        Banner: './src/components/docs/PrereleaseBanner.astro',
        Head: './src/components/docs/Head.astro',
        Search: './src/components/docs/Search.astro',
        SiteTitle: './src/components/docs/SiteTitle.astro',
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            'docs/start-here/install',
            'docs/start-here/first-app',
            'docs/start-here/project-tour',
            'docs/start-here/examples',
          ],
        },
        { label: 'Tutorial', items: ['docs/tutorial'] },
        {
          label: 'Guides',
          items: [
            'docs/guides/style-a-button',
            'docs/guides/bind-a-list',
            'docs/guides/add-a-screen',
            'docs/guides/ship-to-ios',
          ],
        },
        {
          label: 'Concepts',
          items: [
            'docs/concepts/signals',
            'docs/concepts/compiled-bindings',
            'docs/concepts/layout',
            'docs/concepts/styling',
            'docs/concepts/host-and-renderer',
          ],
        },
        {
          label: 'Reference',
          items: [
            'docs/reference/controls',
            'docs/reference/markup-extensions',
            'docs/reference/cli',
          ],
        },
        {
          label: 'Contributing',
          items: [{ autogenerate: { directory: 'docs/contributing' } }],
        },
      ],
      customCss: ['./src/styles/tokens.css', './src/styles/starlight.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/wolfware-labs/artic' },
      ],
    }),
  ],
});
