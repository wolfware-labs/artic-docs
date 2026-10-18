import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://artic.rs',
  integrations: [
    react(),
    starlight({
      title: 'artic',
      customCss: ['./src/styles/tokens.css', './src/styles/starlight.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/wolfware-labs/artic' },
      ],
    }),
  ],
});
