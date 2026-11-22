/** Shared by the landing page, the docs route middleware and the share card endpoint. */
import { createHash } from 'node:crypto';

export const SITE = 'https://artic.rs';
export const SITE_NAME = 'artic';
export const REPOSITORY = 'https://github.com/wolfware-labs/artic';

/** The landing page's own text: its <title> and the hero's heading and subtitle. */
export const LANDING_TITLE = 'artic: a cross-platform UI framework for Rust';
export const LANDING_DESCRIPTION =
  'Views in XAML, logic in Rust, and one GPU renderer that draws the same pixels on every platform.';

/**
 * Every page gets its own share card, rendered at build time by src/pages/og/[...slug].png.ts.
 * Cards are 1200x630, the size link previews show.
 */
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/**
 * The renderer (src/lib/og.ts), this file (card sizes and text), and the files the renderer
 * draws with; their hash versions every card.
 */
export const OG_DESIGN_FILES = [
  'src/lib/og.ts',
  'src/lib/seo.mjs',
  'public/brand/artic-logo.svg',
  'node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff',
  'node_modules/@fontsource/barlow/files/barlow-latin-400-normal.woff',
  'node_modules/@fontsource/barlow/files/barlow-latin-500-normal.woff',
  'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff',
];

/** @typedef {{ key: string, eyebrow: string, title: string, description?: string }} Card */

/** @type {Card} */
export const LANDING_CARD = {
  key: 'index',
  eyebrow: 'A cross-platform UI framework for Rust',
  title: 'Write the app. Run it everywhere.',
  description: LANDING_DESCRIPTION,
};

// Sidebar labels for the folders under docs/, so a card names the section the reader sees.
const SECTION_LABELS = {
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
