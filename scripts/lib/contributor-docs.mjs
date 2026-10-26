import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';

const SITE_BASE = '/docs/contributing/';
const GITHUB_BLOB = 'https://github.com/wolfware-labs/artic/blob/main/docs/';
const GITHUB_ISSUES = 'https://github.com/wolfware-labs/artic/issues/';

// `#123` as GitHub would link it, but not a heading anchor (`](#6)`, `#6-controls`), a hex
// color, an entity (`&#123;`, `&amp;#123;`), an existing link's text or a quoted value.
const ISSUE_REF = /(?<![\w&;/#'"[\]-]|\]\()#(\d{1,5})(?![\w-])/g;

// Text whose #numbers stay as they are. First a CommonMark code span: a backtick run closed by
// a run of the same length, which may wrap lines but not cross a blank one. Then an inline
// link or image, an autolink, and a bare URL.
const KEEP = new RegExp(
  [
    /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/.source,
    /!?\[[^\]\n]*\]\([^)\s]*\)/.source,
    /<[a-z][a-z0-9+.-]*:[^>\s]*>/.source,
    /\bhttps?:\/\/[^\s<>()]+/.source,
  ].join('|'),
  'gi',
);

const linkIssues = (text) => {
  const link = (part) => part.replace(ISSUE_REF, (_, n) => `[#${n}](${GITHUB_ISSUES}${n})`);
  let out = '';
  let from = 0;
  for (const span of text.matchAll(KEEP)) {
    out += link(text.slice(from, span.index)) + span[0];
    from = span.index + span[0].length;
  }
  return out + link(text.slice(from));
};

// Only these framework docs are published; everything else stays on GitHub.
const isPublished = (relPath) =>
  relPath.endsWith('.md') &&
  (relPath === 'architecture.md' || relPath.startsWith('spec/') || relPath.startsWith('design/'));

export const slugFor = (relPath) =>
  relPath.replace(/\.md$/, '').toLowerCase().replaceAll('_', '-');

const titleFromFileName = (relPath) => {
  const words = posix.basename(relPath, '.md').replaceAll(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

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
  // Text between fences, held so a code span that wraps a line is seen whole.
  let prose = [];
  const flush = () => {
    if (prose.length) out.push(linkIssues(prose.join('\n')));
    prose = [];
  };
  for (const line of lines) {
    const marker = line.match(/^\s*(```+|~~~+)/)?.[1];
    if (marker) {
      if (!fence) fence = marker[0];
      else if (marker[0] === fence) fence = null;
      flush();
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
    prose.push(
      line.replace(/(\]\()([^)\s]+)(\))/g, (_, open, target, close) =>
        `${open}${rewriteTarget(target, relPath)}${close}`,
      ),
    );
  }
  flush();
  return { title: title ?? titleFromFileName(relPath), body: out.join('\n') };
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
