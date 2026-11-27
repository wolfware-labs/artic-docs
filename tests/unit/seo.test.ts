import { readFileSync } from 'node:fs';
import satori from 'satori';
import { describe, expect, it } from 'vitest';
import { DESCRIPTION_STYLE, TEXT_COLUMN_WIDTH } from '../../src/lib/og';
import {
  LANDING_CARD,
  LANDING_DESCRIPTION,
  LANDING_TITLE,
  OG_FONTS,
  docsCard,
  eyebrow,
  shareImageAlt,
  shareImageUrl,
  shareImageVersion,
} from '../../src/lib/seo.mjs';

describe('landing text', () => {
  it('keeps the title and says what artic is in the description', () => {
    expect(LANDING_TITLE).toBe('artic: a cross-platform UI framework for Rust');
    expect(LANDING_DESCRIPTION).toBe(
      'artic is a cross-platform UI framework for Rust: views in XAML, logic in Rust, and one GPU renderer that draws the same pixels on every platform.',
    );
  });

  it('gives the share card its own line', () => {
    // The card's eyebrow already says what artic is, so its line starts from what artic does.
    expect(LANDING_CARD.description).toBe(
      'Views in XAML, logic in Rust, and one GPU renderer that draws the same pixels on every platform.',
    );
  });
});

// Draws a card's description box as the card does, with text left as text so a cut shows up
// as the ellipsis that lineClamp adds.
const fonts = OG_FONTS.map(({ name, weight, file }) => ({ name, weight, data: readFileSync(file) }));
async function drawnDescription(text: string): Promise<string> {
  const box = { type: 'div', props: { style: DESCRIPTION_STYLE, children: text } };
  const column = { type: 'div', props: { style: { display: 'flex', width: TEXT_COLUMN_WIDTH }, children: box } };
  return satori(column as never, { width: TEXT_COLUMN_WIDTH, fonts: fonts as never, embedFont: false });
}

describe('share card description', () => {
  // How many characters fit depends on the letters: 125 characters of prose fit, 125 of
  // capitals do not. So the card text is drawn rather than counted.
  it('ends in an ellipsis when the text does not fit in three lines', async () => {
    const capitals = 'XAML GPU RUST '.repeat(9).slice(0, 125);
    expect(await drawnDescription(capitals)).toContain('\u2026');
  });

  it('fits the landing card text in three lines', async () => {
    expect(await drawnDescription(LANDING_CARD.description!)).not.toContain('\u2026');
  });
});

describe('shareImageVersion', () => {
  it('is the first 10 hex characters of the SHA-256 of the input', () => {
    // printf 'card' | sha256sum
    expect(shareImageVersion(Buffer.from('card'))).toBe('8367cd66fd');
  });

  it('changes when the input changes and not otherwise', () => {
    const a = shareImageVersion(Buffer.from('card one'));
    expect(shareImageVersion(Buffer.from('card one'))).toBe(a);
    expect(shareImageVersion(Buffer.from('card two'))).not.toBe(a);
  });
});

describe('share cards', () => {
  it('names the section a docs page sits in', () => {
    expect(eyebrow('docs')).toBe('Docs');
    expect(eyebrow('docs/tutorial')).toBe('Tutorial');
    expect(eyebrow('docs/concepts/signals')).toBe('Concepts');
    expect(eyebrow('docs/start-here/install')).toBe('Start here');
    expect(eyebrow('docs/contributing/spec/technical_spec')).toBe('Contributing · Specifications');
    // starlight-versions archives a release under its version slug.
    expect(eyebrow('0.1/docs')).toBe('0.1 · Docs');
    expect(eyebrow('0.1/docs/concepts/signals')).toBe('0.1 · Concepts');
  });

  it('takes a docs card from the page frontmatter', () => {
    const card = docsCard('docs/concepts/signals', { title: 'Signals', description: 'How change propagates.' });
    expect(card).toEqual({
      key: 'docs/concepts/signals',
      eyebrow: 'Concepts',
      title: 'Signals',
      description: 'How change propagates.',
    });
    expect(shareImageAlt(card)).toBe('artic share card: Signals');
  });

  it('drops Markdown code spans from a title', () => {
    const card = docsCard('docs/contributing/design/facade', { title: 'The facade, `artic::App` and `artic::run`' });
    expect(card.title).toBe('The facade, artic::App and artic::run');
  });

  it('versions a card by its design and its own text', () => {
    const card = docsCard('docs/concepts/signals', { title: 'Signals' });
    const url = shareImageUrl(card, 'design-a');
    expect(url).toMatch(/^https:\/\/artic\.rs\/og\/docs\/concepts\/signals\.png\?v=[0-9a-f]{10}$/);
    expect(shareImageUrl(card, 'design-a')).toBe(url);
    expect(shareImageUrl(card, 'design-b')).not.toBe(url);
    expect(shareImageUrl({ ...card, title: 'Signals!' }, 'design-a')).not.toBe(url);
    expect(shareImageUrl(LANDING_CARD, 'design-a')).toMatch(/^https:\/\/artic\.rs\/og\/index\.png\?v=/);
  });
});
