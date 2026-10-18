import { describe, expect, it } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

const files = globSync('src/**/*.{astro,md,mdx,ts,tsx}').filter(
  (f) => !f.startsWith('src/content/docs/docs/contributing/'),
);

describe('shipped copy', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s has no em dash', (file) => {
    expect(readFileSync(file, 'utf8')).not.toContain('—');
  });
});
