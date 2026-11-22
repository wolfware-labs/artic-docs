/** Shared by the landing page, the docs route middleware and the share card endpoint. */
import { createHash } from 'node:crypto';

export const SITE = 'https://artic.rs';
export const SITE_NAME = 'artic';
export const REPOSITORY = 'https://github.com/wolfware-labs/artic';

/**
 * The landing page's own text: its <title>, the hero's heading (one entry per line, rendered
 * by Hero.astro) and the hero's subtitle, which is also the meta description.
 */
export const LANDING_TITLE = 'artic: a cross-platform UI framework for Rust';
export const HERO_HEADING = ['Write the app.', 'Run it everywhere.'];
export const LANDING_DESCRIPTION =
  'Views in XAML, logic in Rust, and one GPU renderer that draws the same pixels on every platform.';

/**
 * Every page gets its own share card, rendered at build time by src/pages/og/[...slug].png.ts.
 * Cards are 1200x630, the size link previews show.
 */
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** What src/lib/og.ts draws with: the site's tokens, its logo, and its fonts. */
export const OG_TOKENS = 'src/styles/tokens.css';
export const OG_LOGO = 'public/brand/artic-logo.svg';
// satori reads woff and ttf but not woff2, so these are the woff builds fontsource ships.
const fontsource = (pkg, file) => `node_modules/@fontsource/${pkg}/files/${file}`;
export const OG_FONTS = [
  { name: 'Barlow Condensed', weight: 700, file: fontsource('barlow-condensed', 'barlow-condensed-latin-700-normal.woff') },
  { name: 'Barlow', weight: 400, file: fontsource('barlow', 'barlow-latin-400-normal.woff') },
  { name: 'Barlow', weight: 500, file: fontsource('barlow', 'barlow-latin-500-normal.woff') },
  { name: 'JetBrains Mono', weight: 500, file: fontsource('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff') },
];

/** Every file a card is drawn from; their hash versions every card (astro.config.mjs). */
export const OG_DESIGN_FILES = [
  'src/lib/og.ts',
  'src/lib/seo.mjs',
  OG_TOKENS,
  OG_LOGO,
  ...OG_FONTS.map((font) => font.file),
];

/** @typedef {{ key: string, eyebrow: string, title: string, description?: string }} Card */

/** @type {Card} */
export const LANDING_CARD = {
  key: 'index',
  eyebrow: 'A cross-platform UI framework for Rust',
  title: HERO_HEADING.join(' '),
  description: LANDING_DESCRIPTION,
};

/**
 * Labels of the folders under docs/. The sidebar in astro.config.mjs uses them too, so a card
 * names the section the reader sees.
 */
export const SECTION_LABELS = {
  'start-here': 'Start here',
  tutorial: 'Tutorial',
  guides: 'Guides',
  concepts: 'Concepts',
  reference: 'Reference',
  contributing: 'Contributing',
  spec: 'Specifications',
  design: 'Design notes',
};
const label = (part) => SECTION_LABELS[part] ?? part.replace(/-/g, ' ');

/**
 * docs/concepts/signals -> "Concepts"; docs/contributing/spec/x -> "Contributing · Specifications";
 * a section index (docs/tutorial) is its own section, and docs/ itself is "Docs". An archived
 * copy (starlight-versions writes it under its version, 0.1/docs/concepts/signals) starts with
 * that version: "0.1 · Concepts".
 * @param {string} id
 */
export function eyebrow(id) {
  const all = id.split('/');
  const at = all.indexOf('docs');
  const version = at > 0 ? all.slice(0, at) : [];
  const parts = all.slice(at + 1);
  const sections = parts.length === 0 ? ['Docs'] : (parts.length > 1 ? parts.slice(0, -1) : parts).map(label);
  return [...version, ...sections].join(' · ');
}

/**
 * The card for one docs entry, from its own frontmatter.
 * @param {string} id
 * @param {{ title: string, description?: string }} data
 * @returns {Card}
 */
export function docsCard(id, data) {
  // Contributor docs keep Markdown code spans in their titles; a card shows plain text.
  const title = data.title.replace(/`/g, '');
  return { key: id, eyebrow: eyebrow(id), title, description: data.description };
}

/** @param {Card} card */
export const shareImageAlt = (card) => `${SITE_NAME} share card: ${card.title}`;

/**
 * Short content hash for a card's URL (`?v=`). Link previews cache images by URL, so a new
 * hash whenever the card changes makes them fetch it again.
 */
export function shareImageVersion(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 10);
}

/**
 * Absolute, versioned URL of a card. `design` is a hash of OG_DESIGN_FILES
 * (astro.config.mjs), so a change to the layout or size refreshes every card, and a page's new
 * title or description refreshes its own.
 * @param {Card} card
 * @param {string} design
 */
export function shareImageUrl(card, design) {
  const version = shareImageVersion(`${design}\n${JSON.stringify(card)}`);
  return `${new URL(`/og/${card.key}.png`, SITE).href}?v=${version}`;
}
