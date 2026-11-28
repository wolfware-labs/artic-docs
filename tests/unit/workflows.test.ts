// These checks keep the CI workflows from putting secrets, write tokens or a
// stored checkout token in a job that installs or runs the project's npm
// dependencies. They catch that mix made by accident; they do not prove that no
// job can reach a secret through dependency code. Known limits:
// - Matching is by text. A run step counts only through the commands named in
//   runsDependencyCode, so a shell or node script that installs or imports
//   packages itself is not seen, nor is an install inside a Docker build.
//   The `shell:` of a step and `defaults.run.shell` are not matched either.
// - Remote actions (owner/repo@sha) count as not running the project's
//   dependencies. A local composite action in .github/actions counts by its
//   own steps; any other local action counts as running dependency code,
//   holding a secret and storing credentials.
// - A reusable workflow a job calls with `uses:` is not read; only its own
//   file, when it sits in .github/workflows, is checked.
// - What a dependency job hands to another job (an artifact, a cache, an
//   output) is not followed.
// - The permission check looks for the word "write" in the job's or the
//   workflow's permissions.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, test } from 'vitest';
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

// The steps of each local composite action, by the path a step's `uses` names.
// An action with no action.yml or action.yaml, or one that is not composite,
// is left out, so the predicates take it as the worst case.
// `dir` stands in for .github/actions; the keys are always ./.github/actions/<name>.
const loadLocalActions = (dir: string): Record<string, Step[]> =>
  Object.fromEntries(
    readdirSync(dir).flatMap((d) => {
      const file = ['action.yml', 'action.yaml'].map((f) => join(dir, d, f)).find((f) => existsSync(f));
      if (!file) return [];
      const { runs } = parse(readFileSync(file, 'utf8')) as { runs?: { using?: string; steps?: Step[] } };
      return runs?.using === 'composite' ? [[`./.github/actions/${d}`, runs.steps ?? []]] : [];
    }),
  );

const localActions = loadLocalActions(actionsDir);

// A job's steps with each local action replaced by its own steps, nested ones
// included; an action already expanded adds nothing, so a loop ends. `unknown`
// is true when the job uses a local action that is not in `actions`.
const expandSteps = (job: Job, actions: Record<string, Step[]>) => {
  const seen = new Set<string>();
  let unknown = false;
  const expand = (steps: Step[]): Step[] =>
    steps.flatMap((s) => {
      if (!s.uses?.startsWith('./')) return [s];
      const path = s.uses.replace(/\/+$/, '');
      if (seen.has(path)) return [];
      seen.add(path);
      if (!Object.hasOwn(actions, path)) {
        unknown = true;
        return [];
      }
      return expand(actions[path]);
    });
  const steps = expand(job.steps ?? []);
  return { steps, unknown };
};

// Jobs that install or run the project's npm dependencies.
const runsDependencyCode = (job: Job, actions = localActions) => {
  const { steps, unknown } = expandSteps(job, actions);
  return (
    unknown ||
    steps.some(
      (s) =>
        /\b(pnpm|npm|npx|yarn|corepack|bun)\b|\bnode\s+--run\b|node_modules\/\.bin\/|scripts\/archive-version\.mjs/.test(
          s.run ?? '',
        ) || installsOnSetup(s),
    )
  );
};

// A job sees its own secrets and those in the workflow-level env, in any form:
// secrets.X, secrets['X'], toJSON(secrets) or secrets: inherit. Context names
// are case-insensitive, so SECRETS.X works too. GitHub does not give composite
// actions the secrets context, so a local action's own steps should never match;
// they are searched anyway, in case that changes or the action is miswritten.
const holdsSecret = (job: Job, workflow: Workflow, actions = localActions) => {
  const { steps, unknown } = expandSteps(job, actions);
  return unknown || /\bsecrets\b/i.test(JSON.stringify([workflow.env ?? {}, job, steps]));
};

// actions/checkout stores the token in .git/config unless told not to.
const storesCredentials = (job: Job, actions = localActions) => {
  const { steps, unknown } = expandSteps(job, actions);
  return (
    unknown ||
    steps.some((s) => s.uses?.startsWith('actions/checkout@') && s.with?.['persist-credentials'] !== false)
  );
};

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

  const uses = [
    ...jobs.flatMap(({ file, job }) => (job.steps ?? []).map((s) => [file, s.uses] as const)),
    ...Object.entries(localActions).flatMap(([path, steps]) => steps.map((s) => [path.slice(2), s.uses] as const)),
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
    ['node --run', 'run: node --run build'],
    ['a node_modules/.bin tool', 'run: node_modules/.bin/astro build'],
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
    ['a local action that installs', true, { './.github/actions/deps': [{ run: 'pnpm install' }] }],
    [
      'a local action inside a local action',
      true,
      { './.github/actions/deps': [{ uses: './.github/actions/inner' }], './.github/actions/inner': [{ run: 'npm ci' }] },
    ],
    ['a local action that only echoes', false, { './.github/actions/deps': [{ run: 'echo hi' }] }],
    ['a local action that calls itself', false, { './.github/actions/deps': [{ uses: './.github/actions/deps/' }] }],
    ['a local action the test cannot read', true, {}],
  ])('%s runs dependency code: %s', (_name, runs, actions) => {
    const job = jobOf('jobs:\n  job:\n    steps:\n      - uses: ./.github/actions/deps\n');
    expect(runsDependencyCode(job, actions as Record<string, Step[]>)).toBe(runs);
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
    ['upper case', 'jobs:\n  job:\n    env:\n      TOKEN: ${{ SECRETS.X }}\n    steps:\n      - run: pnpm build\n'],
    ['mixed case in index form', "jobs:\n  job:\n    env:\n      TOKEN: ${{ Secrets['X'] }}\n    steps:\n      - run: pnpm build\n"],
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

  // Each predicate sees a local composite action's steps as the job's own, and
  // takes a local action it cannot read as the worst case.
  const localJob = jobOf('jobs:\n  job:\n    steps:\n      - uses: ./.github/actions/deps\n');
  const checkout = (persist?: boolean) => ({
    uses: 'actions/checkout@abc',
    ...(persist === undefined ? {} : { with: { 'persist-credentials': persist } }),
  });

  test.each([
    ['checks out with no with', true, { './.github/actions/deps': [checkout()] }],
    ['checks out with persist-credentials: false', false, { './.github/actions/deps': [checkout(false)] }],
    [
      'calls a local action that checks out',
      true,
      { './.github/actions/deps': [{ uses: './.github/actions/inner' }], './.github/actions/inner': [checkout(true)] },
    ],
    ['the test cannot read', true, {}],
  ])('a local action that %s stores credentials: %s', (_name, stores, actions) => {
    expect(storesCredentials(localJob, actions as Record<string, Step[]>)).toBe(stores);
  });

  test.each([
    ['only echoes', false, { './.github/actions/deps': [{ run: 'echo hi' }] }],
    ['puts a secret in a step env', true, { './.github/actions/deps': [{ run: 'echo', env: { T: '${{ secrets.X }}' } }] }],
    ['the test cannot read', true, {}],
  ])('a local action that %s reaches a secret: %s', (_name, holds, actions) => {
    const workflow = { jobs: { job: localJob } } as Workflow;
    expect(holdsSecret(localJob, workflow, actions as Record<string, Step[]>)).toBe(holds);
  });

  // The loader reads composite actions from action.yml or action.yaml and
  // leaves every other kind out, so the predicates take it as the worst case.
  describe('loading local actions', () => {
    const dir = mkdtempSync(join(tmpdir(), 'artic-actions-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));
    const write = (name: string, file: string, yaml: string) => {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, file), yaml);
    };
    write('docker', 'action.yml', "runs:\n  using: docker\n  image: Dockerfile\n");
    write('comp', 'action.yaml', 'runs:\n  using: composite\n  steps:\n    - run: echo hi\n      shell: bash\n');
    const actions = loadLocalActions(dir);
    const jobUsing = (name: string) => jobOf(`jobs:\n  job:\n    steps:\n      - uses: ./.github/actions/${name}\n`);

    test('reads a composite action from action.yaml', () => {
      expect(actions['./.github/actions/comp']).toEqual([{ run: 'echo hi', shell: 'bash' }]);
      expect(runsDependencyCode(jobUsing('comp'), actions)).toBe(false);
    });

    test('leaves out an action that is not composite, so it counts as the worst case', () => {
      expect(Object.hasOwn(actions, './.github/actions/docker')).toBe(false);
      const job = jobUsing('docker');
      expect(runsDependencyCode(job, actions)).toBe(true);
      expect(holdsSecret(job, { jobs: { job } }, actions)).toBe(true);
      expect(storesCredentials(job, actions)).toBe(true);
    });
  });
});
