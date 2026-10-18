import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import starlightVersions from 'starlight-versions';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { versionsPluginConfig } from './src/lib/versions.mjs';

const archived = JSON.parse(readFileSync(new URL('./versions.json', import.meta.url), 'utf8'));
const versionsConfig = versionsPluginConfig(archived);

function starlightPlugins() {
  return [
    // The landing page lives outside Starlight, so its anchors can't be validated.
    starlightLinksValidator({ exclude: ['/', '/#*'] }),
    // The versions plugin refuses an empty list, so it only loads once a release is archived.
    ...(versionsConfig ? [starlightVersions(versionsConfig)] : []),
  ];
}

export default defineConfig({
  site: 'https://artic.rs',
  vite: {
    resolve: {
      // PrereleaseBanner renders the plugin's banner, which needs the plugin's virtual
      // modules. Without archived versions the plugin is off, so point it at an empty stub.
      alias: versionsConfig
        ? {}
        : {
            'starlight-versions/components/VersionBanner.astro': fileURLToPath(
              new URL('./src/components/docs/NoVersionBanner.astro', import.meta.url),
            ),
          },
    },
  },
  integrations: [
    react(),
    starlight({
      title: 'artic',
      plugins: starlightPlugins(),
      components: { Banner: './src/components/docs/PrereleaseBanner.astro' },
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
