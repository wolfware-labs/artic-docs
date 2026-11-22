import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { SHARE_IMAGE_WIDTH, type Card } from './seo.mjs';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// The build runs from the project root; import.meta.url points into the bundle, not at src/.
const read = (path: string) => readFileSync(join(process.cwd(), path));
const font = (pkg: string, file: string) => read(`node_modules/@fontsource/${pkg}/files/${file}`);

// satori reads woff and ttf but not woff2, so these come from the woff builds fontsource ships.
const fonts = [
  { name: 'Barlow Condensed', data: font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff'), weight: 700 },
  { name: 'Barlow', data: font('barlow', 'barlow-latin-400-normal.woff'), weight: 400 },
  { name: 'Barlow', data: font('barlow', 'barlow-latin-500-normal.woff'), weight: 500 },
  { name: 'JetBrains Mono', data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'), weight: 500 },
] as const;

// The brand file as delivered, embedded unchanged. Its viewBox is 582x506.
const logo = `data:image/svg+xml;base64,${read('public/brand/artic-logo.svg').toString('base64')}`;
const logoSize = (width: number) => ({ width, height: Math.round((width * 506) / 582) });

// Same palette as src/styles/tokens.css, and the hero's background gradient.
const c = {
  bg: '#0f1b26',
  glow: '#1d3550',
  line: '#e3eef6',
  mute: '#8aa3b8',
  teal: '#6cc3c0',
  edge: '#21364a',
};

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra = {}): Node => ({
  type,
  props: { style, children, ...extra },
});

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
      backgroundImage: `radial-gradient(circle at 78% 18%, ${c.glow} 0%, rgba(15,27,38,0) 60%), radial-gradient(circle at 84% 62%, rgba(108,195,192,0.14) 0%, rgba(108,195,192,0) 40%)`,
      fontFamily: 'Barlow',
      color: c.line,
    },
    [
      h('img', { position: 'absolute', right: 60, top: (OG_HEIGHT - big.height) / 2, ...big }, undefined, { src: logo, ...big }),
      h(
        'div',
        // satori adds padding outside width and height, so these are the inner sizes.
        { display: 'flex', flexDirection: 'column', width: 600, height: OG_HEIGHT - 114, padding: '60px 0 54px 72px' },
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
                ? h('div', { display: 'block', fontSize: 28, lineHeight: 1.4, color: c.mute, lineClamp: 3 }, description)
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
  return new Resvg(svg, { fitTo: { mode: 'width', value: SHARE_IMAGE_WIDTH } }).render().asPng();
}
