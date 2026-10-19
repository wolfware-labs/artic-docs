/** Shared by the landing page and the docs head config. */
import { createHash } from 'node:crypto';

export const SITE_NAME = 'artic';
export const REPOSITORY = 'https://github.com/wolfware-labs/artic';
/** Card shown when a link to the site is shared: a 1200x630 layout rendered at 2x (`pnpm og`). */
export const SHARE_IMAGE = '/og/artic.png';
export const SHARE_IMAGE_WIDTH = 2400;
export const SHARE_IMAGE_HEIGHT = 1260;
export const SHARE_IMAGE_ALT = 'artic: views in XAML, logic in Rust.';

/**
 * Short content hash for the card's URL (`?v=`). Link previews cache images by URL, so a new
 * hash whenever the file changes makes them fetch it again.
 */
export function shareImageVersion(bytes) {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 10);
}
