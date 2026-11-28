import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const workflowDir = join(root, '.github/workflows');
const actionsDir = join(root, '.github/actions');

type Step = { uses?: string; run?: string; with?: Record<string, unknown> };
type Job = { if?: string; needs?: string | string[]; permissions?: unknown; steps?: Step[] };
type Workflow = { permissions?: unknown; env?: Record<string, unknown>; jobs: Record<string, Job> };

const workflows = readdirSync(workflowDir)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((file) => ({ file, doc: parse(readFileSync(join(workflowDir, file), 'utf8')) as Workflow }));

const jobs = workflows.flatMap(({ file, doc }) =>
  Object.entries(doc.jobs).map(([id, job]) => ({ file, id, job, workflow: doc })),
);

// pnpm/action-setup installs too, unless run_install is left out or false.
const installsOnSetup = (s: Step) =>
  !!s.uses?.startsWith('pnpm/action-setup@') && ![undefined, false, 'false'].includes(s.with?.run_install as never);

// Jobs that install or run the project's npm dependencies.
const runsDependencyCode = (job: Job) =>
  (job.steps ?? []).some(
    (s) =>
      /\b(pnpm|npm|npx|yarn|corepack|bun)\b|scripts\/archive-version\.mjs/.test(s.run ?? '') ||
      s.uses === './.github/actions/build-site' ||
      installsOnSetup(s),
  );

// A job sees its own secrets and those in the workflow-level env, in any form:
// secrets.X, secrets['X'], toJSON(secrets) or secrets: inherit.
const holdsSecret = (job: Job, workflow: Workflow) => /\bsecrets\b/.test(JSON.stringify([workflow.env ?? {}, job]));

// actions/checkout stores the token in .git/config unless told not to.
const storesCredentials = (job: Job) =>
  (job.steps ?? []).some((s) => s.uses?.startsWith('actions/checkout@') && s.with?.['persist-credentials'] !== false);

// The one job allowed to hold a write token after an install: semantic-release
// pushes the release tag and the GitHub release with github.token.
const writeAfterInstall = new Set(['deploy.yml:release']);

const needsOf = (job: Job) => (job.needs === undefined ? [] : [job.needs].flat());

describe('workflows', () => {
  const dependencyJobs = jobs.filter((j) => runsDependencyCode(j.job)).map((j) => [`${j.file}:${j.id}`, j] as const);

  test.each(dependencyJobs)(
    '%s runs dependency code with no secrets and no write permission',
    (name, { job, workflow }) => {
      expect(holdsSecret(job, workflow)).toBe(false);
      if (writeAfterInstall.has(name)) return;
      const permissions = job.permissions ?? workflow.permissions;
      expect(JSON.stringify(permissions ?? {})).not.toContain('write');
    },
  );

  // Otherwise the token checkout stores in .git/config is readable by every
  // install script and build step that runs after it.
  test.each(dependencyJobs)('%s checks out without storing credentials', (_name, { job }) => {
    expect(storesCredentials(job)).toBe(false);
  });

  test.each(jobs.map((j) => [`${j.file}:${j.id}`, j] as const))(
    '%s declares permissions, on the job or the workflow',
    (_name, { job, workflow }) => {
      expect(job.permissions ?? workflow.permissions).toBeDefined();
    },
  );

  // A job's default `if` is success(), which also fails when a job further up the
  // needs chain was skipped. Below a job that runs with always(), each job needs its own if.
  test.each(jobs.map((j) => [`${j.file}:${j.id}`, j] as const))(
    '%s has its own if when a job it needs runs with always()',
    (_name, { job, workflow }) => {
      const upstream = new Set<string>();
      const queue = needsOf(job);
      while (queue.length) {
        const id = queue.shift()!;
        if (upstream.has(id)) continue;
        upstream.add(id);
        queue.push(...needsOf(workflow.jobs[id]));
      }
      const belowAlways = [...upstream].some((id) => /\balways\(\)/.test(workflow.jobs[id].if ?? ''));
      if (belowAlways) expect(job.if ?? '').toMatch(/\balways\(\)|!\s*cancelled\(\)/);
    },
  );

  const actionFiles = readdirSync(actionsDir).map((d) => join(actionsDir, d, 'action.yml'));
  const uses = [
    ...jobs.flatMap(({ file, job }) => (job.steps ?? []).map((s) => [file, s.uses] as const)),
    ...actionFiles.flatMap((f) =>
      ((parse(readFileSync(f, 'utf8')) as { runs: { steps?: Step[] } }).runs.steps ?? []).map(
        (s) => [f.slice(root.length + 1), s.uses] as const,
      ),
    ),
  ].filter((u): u is readonly [string, string] => typeof u[1] === 'string' && !u[1].startsWith('./'));

  test.each(uses)('%s pins %s to a commit', (_file, ref) => {
    expect(ref).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
  });
});

// The checks above only hold if these predicates see every way a workflow can
// run dependency code or reach a secret, so each one is pinned here.
describe('workflow policy predicates', () => {
  const jobOf = (yaml: string) => (parse(yaml) as Workflow).jobs.job;

  test.each([
    ['npm ci', 'run: npm ci'],
    ['npx', 'run: npx astro build'],
    ['npm and npx in one step', 'run: npm ci && npx astro build'],
    ['yarn', 'run: yarn install'],
    ['corepack', 'run: corepack enable'],
    ['bun', 'run: bun install'],
    ['pnpm', 'run: pnpm build'],
    ['the archive script', 'run: node scripts/archive-version.mjs 1.0.0'],
    ['the build-site action', 'uses: ./.github/actions/build-site'],
    ['pnpm/action-setup with run_install: true', 'uses: pnpm/action-setup@abc\n        with:\n          run_install: true'],
    [
      'pnpm/action-setup with a run_install list',
      'uses: pnpm/action-setup@abc\n        with:\n          run_install: |\n            - args: [--frozen-lockfile]',
    ],
  ])('%s runs dependency code', (_name, step) => {
    const job = jobOf(`jobs:\n  job:\n    steps:\n      - ${step}\n`);
    expect(runsDependencyCode(job)).toBe(true);
  });

  test.each([
    ['a local script', 'run: node scripts/image-tags.mjs'],
    ['a Docker build', 'run: docker build -t site .'],
    ['an .npmrc path', 'run: cat .npmrc'],
    ['pnpm/action-setup alone', 'uses: pnpm/action-setup@abc'],
    ['pnpm/action-setup with run_install: false', 'uses: pnpm/action-setup@abc\n        with:\n          run_install: false'],
    [
      "pnpm/action-setup with run_install: 'false'",
      "uses: pnpm/action-setup@abc\n        with:\n          run_install: 'false'",
    ],
  ])('%s does not run dependency code', (_name, step) => {
    const job = jobOf(`jobs:\n  job:\n    steps:\n      - ${step}\n`);
    expect(runsDependencyCode(job)).toBe(false);
  });

  test.each([
    ['workflow-level env', 'env:\n  TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}\njobs:\n  job:\n    steps:\n      - run: pnpm build\n'],
    ['job env', 'jobs:\n  job:\n    env:\n      TOKEN: ${{ secrets.X }}\n    steps:\n      - run: pnpm build\n'],
    [
      'step env in index form',
      "jobs:\n  job:\n    steps:\n      - run: pnpm build\n        env:\n          KEY: ${{ secrets['DOCS_BOT_PRIVATE_KEY'] }}\n",
    ],
    ['an action input', 'jobs:\n  job:\n    steps:\n      - uses: x/y@abc\n        with:\n          token: ${{ secrets.X }}\n'],
    ['the whole secrets context', 'jobs:\n  job:\n    steps:\n      - run: echo "$S"\n        env:\n          S: ${{ toJSON(secrets) }}\n'],
    ['secrets: inherit', 'jobs:\n  job:\n    uses: ./.github/workflows/other.yml\n    secrets: inherit\n'],
  ])('%s reaches a secret', (_name, yaml) => {
    const workflow = parse(yaml) as Workflow;
    expect(holdsSecret(workflow.jobs.job, workflow)).toBe(true);
  });

  test('github.token and repo variables are not secrets', () => {
    const workflow = parse(
      'env:\n  A: ${{ vars.A }}\njobs:\n  job:\n    steps:\n      - run: pnpm build\n        env:\n          GITHUB_TOKEN: ${{ github.token }}\n',
    ) as Workflow;
    expect(holdsSecret(workflow.jobs.job, workflow)).toBe(false);
  });

  test.each([
    ['no with', 'uses: actions/checkout@abc', true],
    ['persist-credentials: true', 'uses: actions/checkout@abc\n        with:\n          persist-credentials: true', true],
    ['persist-credentials: false', 'uses: actions/checkout@abc\n        with:\n          persist-credentials: false', false],
  ])('checkout with %s stores credentials: %s', (_name, step, stores) => {
    const job = jobOf(`jobs:\n  job:\n    steps:\n      - ${step}\n`);
    expect(storesCredentials(job)).toBe(stores);
  });
});
