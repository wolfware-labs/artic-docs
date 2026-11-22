import { describe, expect, it } from 'vitest';
import {
  LANDING_CARD,
  docsCard,
  eyebrow,
  shareImageAlt,
  shareImageUrl,
  shareImageVersion,
} from '../../src/lib/seo.mjs';

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
