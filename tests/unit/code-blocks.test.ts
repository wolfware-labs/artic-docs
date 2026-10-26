import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { codeBlocks } from '../../src/lib/code-blocks.mjs';

const render = (md: string) => markdownToHtml(md, { mdastPlugins: [codeBlocks] }).html;

describe('codeBlocks', () => {
  it('highlights rustdoc-style fences as Rust', () => {
    for (const fence of ['rust,ignore', 'rust,no_run', 'rust']) {
      expect(render(`\`\`\`${fence}\nfn main() {}\n\`\`\``)).toContain('class="language-rust"');
    }
  });

  it('leaves other languages alone', () => {
    expect(render('```xml\n<a/>\n```')).toContain('class="language-xml"');
    expect(render('```\nplain\n```')).not.toContain('language-');
  });

  it('turns mermaid fences into a diagram element with the source escaped', () => {
    const html = render('```mermaid\ngraph TD\n  a["<b>"] --> b & c\n```');
    expect(html).toContain(
      '<pre class="mermaid">graph TD\n  a[&quot;&lt;b&gt;&quot;] --&gt; b &amp; c</pre>',
    );
    expect(html).not.toContain('language-mermaid');
  });

  it('finds fences nested in lists', () => {
    expect(render('- item\n\n  ```rust,ignore\n  fn x() {}\n  ```')).toContain('class="language-rust"');
  });
});
