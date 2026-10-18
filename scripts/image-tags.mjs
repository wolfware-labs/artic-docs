import { execFileSync } from 'node:child_process';
import { imageTags } from './lib/image-tags.mjs';

const repo = process.env.IMAGE_REPO;
if (!repo) {
  console.error('IMAGE_REPO is not set');
  process.exit(1);
}
const headTags =
  process.env.RELEASE_TAGS === 'true'
    ? execFileSync('git', ['tag', '--points-at', 'HEAD'], { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
    : [];

try {
  console.log(imageTags({ repo, runNumber: process.env.RUN_NUMBER, headTags }).join('\n'));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
