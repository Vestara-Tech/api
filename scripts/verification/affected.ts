import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Scope = 'static' | 'affected' | 'module' | 'platform';

export interface ModuleDefinition {
  sources: string[];
  tests: string[];
  dependsOn?: string[];
  cwd?: string;
  verify?: {
    static?: string[];
    tests?: string[];
  };
}

export interface VerificationConfig {
  version: number;
  defaultLevel: Scope;
  levels: Record<string, string>;
  aliases: Record<string, string>;
  fullVerificationTriggers: string[];
  neverWatch: boolean;
  reuseEvidence: boolean;
  escalateOnUnknownImpact: boolean;
  contractPatterns: string[];
  sharedModules: string[];
  modules: Record<string, ModuleDefinition>;
}

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

export const DEFAULT_CONFIG: VerificationConfig = {
  version: 2,
  defaultLevel: 'affected',
  levels: { V0: 'static', V1: 'affected', V2: 'module', V3: 'platform' },
  fullVerificationTriggers: [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    'tsconfig.json',
    'tsconfig.build.json',
    'vitest.config.ts',
    '.vestara/verification.json',
  ],
  aliases: {},
  neverWatch: true,
  reuseEvidence: true,
  escalateOnUnknownImpact: true,
  contractPatterns: ['contracts/**', 'src/routes/**', '**/*.schema.ts', '**/*.types.ts'],
  sharedModules: ['core', 'bootstrap', 'plugins', 'types'],
  modules: {},
};

export function loadConfig(repoRoot: string): VerificationConfig {
  const configPath = join(repoRoot, '.vestara', 'verification.json');
  if (!existsSync(configPath)) return DEFAULT_CONFIG;
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<VerificationConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (error) {
    console.error(`[verify] invalid configuration at ${configPath}:`, error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Repository package manager detection. The verification tooling discovers the
 * package manager from the lockfile rather than assuming interchangeability.
 * pnpm is canonical for this repository; npm/bun are supported where a
 * corresponding lockfile is present.
 */
export function detectPackageManager(repoRoot: string): 'pnpm' | 'npm' {
  if (existsSync(join(repoRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(repoRoot, 'package-lock.json'))) return 'npm';
  return 'npm';
}

export function execCommand(repoRoot: string, args: string[]): string[] {
  try {
    const out = execFileSync(args[0], args.slice(1), { cwd: repoRoot, encoding: 'utf8' });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * FASTVERIFY-006: collect the changed file set from the current branch
 * (relative to the merge-base with origin/main), staged changes, the working
 * tree, and untracked non-ignored files. Falls back to HEAD when origin/main
 * does not exist.
 */
export function gitChangedFiles(repoRoot: string): string[] {
  let base = 'HEAD';
  const hasRemoteMain = execCommand(repoRoot, ['git', 'rev-parse', '--verify', '--quiet', 'origin/main']).length > 0;
  if (hasRemoteMain) {
    const merged = execCommand(repoRoot, ['git', 'merge-base', 'HEAD', 'origin/main']);
    if (merged.length > 0) base = merged[0]!;
  }

  const changed = new Set<string>();
  for (const file of execCommand(repoRoot, ['git', 'diff', '--name-only', base])) changed.add(file);
  for (const file of execCommand(repoRoot, ['git', 'diff', '--cached', '--name-only'])) changed.add(file);
  for (const file of execCommand(repoRoot, ['git', 'diff', '--name-only'])) changed.add(file);
  for (const file of execCommand(repoRoot, ['git', 'ls-files', '--others', '--exclude-standard'])) changed.add(file);
  return [...changed].sort();
}

const TEST_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/;
const DOC_PATTERN = /\.mdx?$/;

const WORKSPACE_ROOTS = ['packages', 'vestara-apps'];
const IGNORED_DIRECTORIES = new Set(['dist', 'node_modules', '.turbo', '.vite']);

function walkFiles(repoRoot: string, relDir: string, visit: (file: string) => void): void {
  const dir = join(repoRoot, relDir);
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue;

    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(repoRoot, join(relDir, entry), visit);
    } else {
      visit(relative(repoRoot, full).split('\\').join('/'));
    }
  }
}

function isWorkspaceSourceFile(file: string): boolean {
  return (file.startsWith('packages/') || file.startsWith('vestara-apps/')) && file.includes('/src/') && /\.(ts|tsx)$/.test(file);
}

function isWorkspaceTestFile(file: string): boolean {
  return (file.startsWith('packages/') || file.startsWith('vestara-apps/')) && file.includes('/tests/') && TEST_PATTERN.test(file);
}

function isWorkspaceConfigFile(file: string): boolean {
  return (
    (file.startsWith('packages/') || file.startsWith('vestara-apps/')) &&
    (file.endsWith('/package.json') ||
      file.endsWith('/tsconfig.json') ||
      file.endsWith('/tsconfig.build.json') ||
      file.endsWith('/vite.config.ts') ||
      file.endsWith('/vitest.config.ts') ||
      file.endsWith('/index.html'))
  );
}

export interface Classification {
  sources: string[];
  shared: string[];
  tests: string[];
  triggers: string[];
  tooling: string[];
  contracts: string[];
  docs: string[];
  other: string[];
}

export function classifyFiles(files: string[], config: VerificationConfig): Classification {
  const result: Classification = {
    sources: [],
    shared: [],
    tests: [],
    triggers: [],
    tooling: [],
    contracts: [],
    docs: [],
    other: [],
  };
  for (const file of files) {
    if (config.fullVerificationTriggers.includes(file)) result.triggers.push(file);
    else if (file.startsWith('scripts/verification/')) result.tooling.push(file);
    else if (file.startsWith('contracts/')) result.contracts.push(file);
    else if (file.startsWith('src/')) {
      const segments = file.split('/');
      const top = segments[1];
      if (top !== undefined && config.sharedModules.includes(top)) result.shared.push(file);
      else result.sources.push(file);
    }
    else if (isWorkspaceSourceFile(file)) result.sources.push(file);
    else if (file.startsWith('tests/') || TEST_PATTERN.test(file)) result.tests.push(file);
    else if (isWorkspaceTestFile(file)) result.tests.push(file);
    else if (isWorkspaceConfigFile(file)) result.tooling.push(file);
    else if (DOC_PATTERN.test(file)) result.docs.push(file);
    else result.other.push(file);
  }
  return result;
}

export function findTestFiles(repoRoot: string): string[] {
  const out: string[] = [];
  for (const root of ['tests', ...WORKSPACE_ROOTS]) {
    walkFiles(repoRoot, root, (file) => {
      if (file.startsWith('tests/') || file.includes('/tests/')) {
        if (TEST_PATTERN.test(file)) out.push(file);
      }
    });
  }
  return out.sort();
}

export function findSourceFiles(repoRoot: string): string[] {
  const out: string[] = [];
  for (const root of ['src', ...WORKSPACE_ROOTS]) {
    walkFiles(repoRoot, root, (file) => {
      if (file.startsWith('src/') || file.includes('/src/')) {
        if (file.endsWith('.ts') || file.endsWith('.tsx')) out.push(file);
      }
    });
  }
  return [...new Set(out)].sort();
}

export function findDependencyFiles(repoRoot: string, config: VerificationConfig): string[] {
  const out = new Set<string>(config.fullVerificationTriggers);
  for (const root of WORKSPACE_ROOTS) {
    walkFiles(repoRoot, root, (file) => {
      if (isWorkspaceConfigFile(file)) out.add(file);
    });
  }
  out.add('vitest.config.ts');
  return [...out].sort();
}

/**
 * Convention-based source -> test mapping, used only as a FALLBACK when the
 * explicit module map does not match (FASTVERIFY-007):
 *   1. mirror path  src/<rel>.ts -> tests/<rel>.test.ts
 *   2. base name    any test containing <basename>.test.
 *   3. module       src/modules/<name>/** matches tests containing <name>
 */
export function matchTestsForSource(source: string, known: string[]): string[] {
  const segments = source.split('/');
  const rel = segments.slice(1);
  const fileName = rel[rel.length - 1]!;
  const baseName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '');
  const firstSegment = rel[0]!;
  const secondSegment = rel.length > 1 ? rel[1] : undefined;

  const mirror = `tests/${rel.join('/')}`.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts');
  const results = new Set<string>();

  for (const test of known) {
    if (test === mirror) results.add(test);
    if (test.includes(`/${baseName}.test.`) || test.includes(`/${baseName}.spec.`)) {
      results.add(test);
    }
    if (secondSegment) {
      if (test.includes(`/${secondSegment}.`) || test.includes(`/${secondSegment}/`)) {
        results.add(test);
      }
    }
  }

  return [...results].sort();
}

export interface Selection {
  tests: string[];
  escalateTo: 'none' | 'module' | 'platform';
  reason: string | null;
}

export function selectAffectedTests(
  repoRoot: string,
  changed: string[],
  config: VerificationConfig,
): Selection {
  const { sources, shared, tests, triggers, tooling, other } = classifyFiles(changed, config);
  const selection: Selection = { tests: [], escalateTo: 'none', reason: null };

  if (triggers.length > 0) {
    selection.escalateTo = 'platform';
    selection.reason = `verification trigger changed: ${triggers.join(', ')}`;
    return selection;
  }

  if (tooling.length > 0) {
    selection.escalateTo = 'platform';
    selection.reason = `verification tooling changed: ${tooling.join(', ')}`;
    return selection;
  }

  if (other.length > 0) {
    selection.escalateTo = 'platform';
    selection.reason = `unclassifiable changed files: ${other.join(', ')}`;
    return selection;
  }

  if (shared.length > 0) {
    selection.escalateTo = 'platform';
    selection.reason = `shared infrastructure source changed: ${shared.join(', ')}`;
    return selection;
  }

  const known = findTestFiles(repoRoot);
  const selected = new Set<string>(tests);

  for (const source of sources) {
    const matches = matchTestsForSource(source, known);
    if (matches.length > 0) {
      for (const match of matches) selected.add(match);
    } else if (config.escalateOnUnknownImpact) {
      selection.escalateTo = 'module';
      selection.reason = `no mapped tests for changed source: ${source}`;
    }
  }

  selection.tests = [...selected].sort();
  return selection;
}

const HELP = `Usage: pnpm exec tsx scripts/verification/affected.ts [--json]

Prints the impact analysis for the current git state: changed files,
classification, and the convention-based affected test selection.`;

export function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }
  const config = loadConfig(REPO_ROOT);
  const changed = gitChangedFiles(REPO_ROOT);
  const classification = classifyFiles(changed, config);
  const selection = selectAffectedTests(REPO_ROOT, changed, config);

  const report = {
    changed,
    classification,
    selected: selection.tests,
    escalateTo: selection.escalateTo,
    escalationReason: selection.reason,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('Changed:');
    for (const file of changed) console.log(`  ${file}`);
    console.log('Selected:');
    for (const file of selection.tests) console.log(`  ${file}`);
    console.log(`Escalation: ${selection.escalateTo}${selection.reason ? ` (${selection.reason})` : ''}`);
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === resolve(entry) || import.meta.url.endsWith(entry);
}

if (isDirectRun()) {
  main();
}
