// Reads the output of `git diff-index --raw -z --no-renames`: for each entry,
// ":<old mode> <new mode> <old sha> <new sha> <status>" and the path, each
// ending in a NUL.
export function parseRawDiff(raw) {
  const parts = raw.split('\0');
  const entries = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const [oldMode, newMode, , , status] = parts[i].slice(1).split(' ');
    entries.push({ oldMode, newMode, status, path: parts[i + 1] });
  }
  return entries;
}

/**
 * What keeps an archive patch from being applied, or [] when nothing does. A
 * patch may only add regular files to the docs snapshot of `slug` and its
 * version file; `slug` must already have passed versionSlug.
 */
export function archiveEntryProblems(entries, slug) {
  const docs = `src/content/docs/${slug}/`;
  const problems = [];
  for (const { status, newMode, path } of entries) {
    if (status !== 'A') problems.push(`not a new file (${status}): ${path}`);
    else if (newMode !== '100644') problems.push(`not a regular file (${newMode}): ${path}`);
    else if (!path.startsWith(docs) && path !== `src/content/versions/${slug}.json`) {
      problems.push(`outside the ${slug} snapshot: ${path}`);
    }
  }
  if (!entries.some((e) => e.path.startsWith(docs))) problems.push(`no pages under ${docs}`);
  return problems;
}
