import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

const SITE_BASE = '/docs/contributing/';
const GITHUB_BLOB = 'https://github.com/wolfware-labs/artic/blob/main/docs/';
const GITHUB_ISSUES = 'https://github.com/wolfware-labs/artic/issues/';

// `#123` as GitHub would link it, but not a heading anchor (`#6-controls`), a hex color, an
// entity (`&#123;`, `&amp;#123;`), an escape (`\#123`) or a quoted value.
const ISSUE_REF = /(?<![\w&;/#'"\\-])#(\d{1,5})(?![\w-])/g;

// Nodes whose text stays as written: links of every kind (GFM turns bare URLs into links too),
// link definitions, code and raw HTML.
const KEEP = new Set(['link', 'linkReference', 'definition', 'inlineCode', 'code', 'html']);

const textRanges = (node, ranges = []) => {
  if (KEEP.has(node.type)) return ranges;
  if (node.type === 'text') ranges.push([node.position.start.offset, node.position.end.offset]);
  for (const child of node.children ?? []) textRanges(child, ranges);
  return ranges;
};

// Rewrites only the source of plain text nodes, so the rest of the Markdown is untouched.
const linkIssues = (markdown) => {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  let out = '';
  let from = 0;
  for (const [start, end] of textRanges(tree)) {
    out += markdown.slice(from, start);
    out += markdown
      .slice(start, end)
      .replace(ISSUE_REF, (_, n) => `[#${n}](${GITHUB_ISSUES}${n})`);
    from = end;
  }
  return out + markdown.slice(from);
};

// Only these framework docs are published; everything else stays on GitHub.
const isPublished = (relPath) =>
  relPath.endsWith('.md') &&
  (relPath === 'architecture.md' || relPath.startsWith('spec/') || relPath.startsWith('design/'));

export const slugFor = (relPath) =>
  relPath.replace(/\.md$/, '').toLowerCase().replaceAll('_', '-');

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const titleFromFileName = (relPath) =>
  capitalize(posix.basename(relPath, '.md').replaceAll(/[-_]+/g, ' ').trim());

// Design notes open with "# Design: …"; their sidebar group already says so.
const cleanTitle = (title, relPath) =>
  relPath.startsWith('design/') ? capitalize(title.replace(/^Design:\s*/, '')) : title;

function rewriteTarget(target, relPath) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//')) return target;
  if (target.startsWith('#') || target.startsWith('/')) return target;
  const hashAt = target.indexOf('#');
  const path = hashAt === -1 ? target : target.slice(0, hashAt);
  const anchor = hashAt === -1 ? '' : target.slice(hashAt);
  if (!path) return target;
  const resolved = posix.normalize(posix.join(posix.dirname(relPath), path));
  if (isPublished(resolved)) return `${SITE_BASE}${slugFor(resolved)}/${anchor}`;
  return `${GITHUB_BLOB}${resolved}${anchor}`;
}

export function transformDoc(source, relPath) {
  const lines = source.split(/\r?\n/);
  let title = null;
  let fence = null;
  const out = [];
  for (const line of lines) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1];
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }
    if (title === null) {
      const h1 = line.match(/^# +(.+?)\s*#*\s*$/);
      if (h1) {
        title = h1[1];
        continue;
      }
    }
    out.push(
      line.replace(/(\]\()([^)\s]+)(\))/g, (_, open, target, close) =>
        `${open}${rewriteTarget(target, relPath)}${close}`,
      ),
    );
  }
  return {
    title: title === null ? titleFromFileName(relPath) : cleanTitle(title, relPath),
    body: linkIssues(out.join('\n')),
  };
}

async function walk(dir, base = '') {
  const found = [];
  for (const entry of await readdir(join(dir, base), { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await walk(dir, rel)));
    else found.push(rel);
  }
  return found;
}

export async function syncContributorDocs({ sourceDir, outDir }) {
  const written = [];
  for (const relPath of (await walk(sourceDir)).filter(isPublished).sort()) {
    const { title, body } = transformDoc(await readFile(join(sourceDir, relPath), 'utf8'), relPath);
    const target = join(outDir, `${slugFor(relPath)}.md`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `---\ntitle: ${JSON.stringify(title)}\n---\n${body.replace(/^\n+/, '\n')}`);
    written.push(target);
  }
  return written;
}
