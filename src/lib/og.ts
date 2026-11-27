import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import {
  OG_FONTS,
  OG_LOGO,
  OG_TOKENS,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_WIDTH,
  type Card,
} from './seo.mjs';

const OG_WIDTH = SHARE_IMAGE_WIDTH;
const OG_HEIGHT = SHARE_IMAGE_HEIGHT;

// The build runs from the project root; import.meta.url points into the bundle, not at src/.
const read = (path: string) => readFileSync(join(process.cwd(), path));

const fonts = OG_FONTS.map(({ name, weight, file }) => ({ name, weight, data: read(file) }));

// The brand file as delivered, embedded unchanged. Its viewBox is 582x506.
const logo = `data:image/svg+xml;base64,${read(OG_LOGO).toString('base64')}`;
const logoSize = (width: number) => ({ width, height: Math.round((width * 506) / 582) });

// The site's palette, read from its tokens so a new colour there reaches the cards.
const tokens = read(OG_TOKENS).toString('utf8');
const token = (name: string) => {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(tokens)?.[1];
  if (!value) throw new Error(`${OG_TOKENS} has no --${name} colour`);
  return value;
};
// A token colour with an alpha, for gradient stops (#rgb or #rrggbb).
const rgba = (hex: string, alpha: number) => {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
};
const c = {
  bg: token('bg'),
  glow: token('glow'),
  line: token('line'),
  mute: token('mute'),
  teal: token('teal'),
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

// The width of the text column, and the description's style inside it: three lines at most,
// cut with an ellipsis. tests/unit/seo.test.ts draws card text with the same two.
export const TEXT_COLUMN_WIDTH = 600;
export const DESCRIPTION_STYLE = { display: 'block', fontFamily: 'Barlow', fontSize: 28, lineHeight: 1.4, color: c.mute, lineClamp: 3 };

export const titleSize = (title: string) => (title.length > 40 ? 58 : title.length > 26 ? 68 : 80);

export async function renderCard({ eyebrow, title, description }: Card): Promise<Buffer> {
  const big = logoSize(400);
  const small = logoSize(46);
  const tree = h(
    'div',
    {
      display: 'flex',
      position: 'relative',
      width: OG_WIDTH,
      height: OG_HEIGHT,
      backgroundColor: c.bg,
      backgroundImage: `radial-gradient(circle at 78% 18%, ${c.glow} 0%, ${rgba(c.bg, 0)} 60%), radial-gradient(circle at 84% 62%, ${rgba(c.teal, 0.14)} 0%, ${rgba(c.teal, 0)} 40%)`,
      fontFamily: 'Barlow',
      color: c.line,
    },
    [
      h('img', { position: 'absolute', right: 60, top: (OG_HEIGHT - big.height) / 2, ...big }, undefined, { src: logo, ...big }),
      h(
        'div',
        // satori adds padding outside width and height, so these are the inner sizes.
        { display: 'flex', flexDirection: 'column', width: TEXT_COLUMN_WIDTH, height: OG_HEIGHT - 114, padding: '60px 0 54px 72px' },
        [
          h('div', { display: 'flex', alignItems: 'center', gap: 14 }, [
            h('img', small, undefined, { src: logo, ...small }),
            h('div', { fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: 40, lineHeight: 1 }, 'artic'),
          ]),
          h(
            'div',
            { display: 'flex', flexDirection: 'column', justifyContent: 'center', flexGrow: 1, gap: 18 },
            [
              h('div', { display: 'flex', fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 20, letterSpacing: 3, color: c.teal, textTransform: 'uppercase' }, eyebrow),
              h('div', { display: 'block', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: titleSize(title), lineHeight: 1.04, letterSpacing: -0.5, lineClamp: 3 }, title),
              description
                ? h('div', DESCRIPTION_STYLE, description)
                : null,
            ].filter(Boolean),
          ),
          h('div', { display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'JetBrains Mono', fontWeight: 500, fontSize: 22, color: c.mute }, [
            h('div', { width: 48, height: 3, backgroundColor: c.teal }),
            'artic.rs',
          ]),
        ],
      ),
    ],
  );

  const svg = await satori(tree as never, { width: OG_WIDTH, height: OG_HEIGHT, fonts: fonts as never });
  return new Resvg(svg).render().asPng();
}
