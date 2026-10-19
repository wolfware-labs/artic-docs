import { defineMdastPlugin } from 'satteri';

const escapeHtml = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/**
 * Fixes up code fences before Expressive Code sees them. The contributor docs use rustdoc
 * fences (`rust,ignore`), which Shiki reads as an unknown language and leaves unhighlighted.
 * Mermaid fences become a `pre.mermaid` element that the docs head script renders as a diagram.
 */
export const codeBlocks = defineMdastPlugin({
  name: 'artic-code-blocks',
  code(node, ctx) {
    if (node.lang?.startsWith('rust,')) ctx.setProperty(node, 'lang', 'rust');
    if (node.lang === 'mermaid') {
      ctx.replaceNode(node, { type: 'html', value: `<pre class="mermaid">${escapeHtml(node.value)}</pre>` });
    }
  },
});
