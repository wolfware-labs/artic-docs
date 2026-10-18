// Tags and GitHub releases only. The site image carries the version, so
// nothing is committed back to main.
export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/github', { successComment: false, failComment: false, releasedLabels: false }],
  ],
};
