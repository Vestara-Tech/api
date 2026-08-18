import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

import { syncPlatformDocs, type DocsTarget } from '../docs/platform-summary.js';
import { DEFAULT_DOC_TARGETS } from '../docs/targets.js';

const REPO_ROOT = resolve(process.cwd());

export const DEFAULT_DOC_COMMIT_MESSAGE = 'docs: refresh generated documentation';
export const DEFAULT_DOC_COMMIT_PATHS = ['README.md', 'docs/automation/generated/platform-summary.md'] as const;
export const DEFAULT_DOC_REMOTE = 'origin';
const PROTECTED_BRANCHES = new Set(['main', 'master', 'trunk']);
const IGNORED_WORKTREE_PREFIXES = ['.vestara/'];

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface VerificationReportPayload {
  readonly version: 1;
  readonly level: string;
  readonly scope: string;
  readonly changedFiles: readonly string[];
  readonly affectedModules: readonly string[];
  readonly selectedTests: readonly string[];
  readonly executedTests: readonly string[];
  readonly reusedTests: readonly string[];
  readonly skippedTests: readonly string[];
  readonly passed: number;
  readonly failed: number;
  readonly cached: number;
  readonly escalated: boolean;
  readonly escalationReasons: readonly string[];
  readonly durationMs: number;
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly verified: boolean;
  readonly evidence: string | null;
  readonly reportPath: string;
  readonly fingerprint: string | null;
}

export interface VerificationSummary {
  readonly level: string;
  readonly scope: string;
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly cached: number;
  readonly executed: number;
  readonly durationMs: number;
  readonly reportPath: string;
  readonly fingerprint: string | null;
  readonly verified: boolean;
}

export interface DocsVerificationGateResult {
  readonly commands: readonly string[];
  readonly verification: VerificationSummary;
}

export interface CommitDocsOptions {
  readonly message?: string;
  readonly paths?: readonly string[];
  readonly dryRun?: boolean;
  readonly branch?: string;
  readonly remote?: string;
  readonly createDraftPr?: boolean;
}

export interface CommitDocsResult {
  readonly kind: 'skipped' | 'committed';
  readonly reason?: string;
  readonly branch: string;
  readonly paths: readonly string[];
  readonly verification: VerificationSummary;
  readonly commitSha?: string;
  readonly draftPrUrl?: string;
}

export interface PushDocsOptions {
  readonly remote?: string;
  readonly branch?: string;
  readonly dryRun?: boolean;
  readonly createDraftPr?: boolean;
  readonly allowProtected?: boolean;
}

export interface PushDocsResult {
  readonly remote: string;
  readonly branch: string;
  readonly commitSha: string;
  readonly draftPrUrl?: string;
}

export interface ShipDocsOptions extends CommitDocsOptions, PushDocsOptions {
  readonly targets?: readonly DocsTarget[];
}

export interface ShipDocsResult {
  readonly sync: Awaited<ReturnType<typeof syncPlatformDocs>>;
  readonly commit: CommitDocsResult;
  readonly push?: PushDocsResult;
}

function formatCommand(command: string, args: readonly string[]): string {
  return [command, ...args].join(' ');
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function toRepoRelativePath(path: string): string {
  const hadTrailingSlash = /[\\/]+$/.test(path);
  const absolute = resolve(REPO_ROOT, path);
  const rel = normalizePath(relative(REPO_ROOT, absolute));
  if (rel.startsWith('..')) {
    throw new Error(`Path is outside the repository root: ${path}`);
  }
  return hadTrailingSlash && !rel.endsWith('/') ? `${rel}/` : rel;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function runCommand(command: string, args: readonly string[], options: { readonly input?: string } = {}): CommandResult {
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    input: options.input,
  });
  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    stderr: typeof result.stderr === 'string' ? result.stderr : '',
  };
}

function requireSuccess(command: string, args: readonly string[], result: CommandResult): void {
  if (result.status === 0) return;
  const parts = [`Command failed: ${formatCommand(command, args)}`];
  if (result.status !== null) parts.push(`Exit code: ${result.status}`);
  if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trim()}`);
  if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout.trim()}`);
  throw new Error(parts.join('\n'));
}

function runChecked(command: string, args: readonly string[], options: { readonly input?: string } = {}): string {
  const result = runCommand(command, args, options);
  requireSuccess(command, args, result);
  return result.stdout;
}

function runCheckedLines(command: string, args: readonly string[]): string[] {
  return splitLines(runChecked(command, args));
}

function commandSucceeded(command: string, args: readonly string[]): boolean {
  return runCommand(command, args).status === 0;
}

function isProtectedBranch(branch: string): boolean {
  return PROTECTED_BRANCHES.has(branch);
}

function branchExists(branch: string): boolean {
  return commandSucceeded('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
}

export function getCurrentBranch(): string {
  const branch = runChecked('git', ['branch', '--show-current']).trim();
  if (!branch) {
    throw new Error('Unable to determine the current branch. Detached HEAD is not supported for docs publishing.');
  }
  return branch;
}

export function getRemoteDefaultBranch(remote: string): string {
  const symbolic = runCommand('git', ['symbolic-ref', '--quiet', '--short', `refs/remotes/${remote}/HEAD`]);
  if (symbolic.status === 0) {
    const branch = symbolic.stdout.trim();
    if (branch) return branch.replace(`${remote}/`, '');
  }

  const remoteShow = runCommand('git', ['remote', 'show', remote]);
  if (remoteShow.status === 0) {
    const match = remoteShow.stdout.match(/HEAD branch:\s*(.+)$/m);
    if (match?.[1]) return match[1].trim();
  }

  return 'main';
}

export function isAllowedPath(path: string, allowedPaths: readonly string[]): boolean {
  const candidate = toRepoRelativePath(path);
  return allowedPaths.some((allowedPath) => {
    const normalized = normalizePath(allowedPath);
    return normalized.endsWith('/') ? candidate.startsWith(normalized) : candidate === normalized;
  });
}

export function partitionPaths(paths: readonly string[], allowedPaths: readonly string[]): { readonly allowed: string[]; readonly rejected: string[] } {
  const allowed: string[] = [];
  const rejected: string[] = [];
  for (const path of paths) {
    if (isAllowedPath(path, allowedPaths)) {
      allowed.push(toRepoRelativePath(path));
    } else {
      rejected.push(toRepoRelativePath(path));
    }
  }
  return {
    allowed: [...new Set(allowed)].sort(),
    rejected: [...new Set(rejected)].sort(),
  };
}

export function collectWorkingTreeChanges(): string[] {
  const changed = new Set<string>();
  for (const file of runCheckedLines('git', ['diff', '--name-only', '--cached'])) changed.add(normalizePath(file));
  for (const file of runCheckedLines('git', ['diff', '--name-only'])) changed.add(normalizePath(file));
  for (const file of runCheckedLines('git', ['ls-files', '--others', '--exclude-standard'])) changed.add(normalizePath(file));
  return [...changed]
    .map(normalizePath)
    .filter((path) => path.length > 0 && !IGNORED_WORKTREE_PREFIXES.some((prefix) => path.startsWith(prefix)))
    .sort();
}

export function resolveDocsBranchName(message: string): string {
  const slug = message
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, 60) || 'docs-update';
  return `agent/${slug}`;
}

function resolveTargetPaths(targets: readonly DocsTarget[], syncResult: Awaited<ReturnType<typeof syncPlatformDocs>>): string[] {
  const paths: string[] = [];
  if (targets.includes('summary')) paths.push(toRepoRelativePath(syncResult.summaryPath));
  if (targets.includes('readme')) paths.push(toRepoRelativePath(syncResult.readmePath));
  return [...new Set(paths)].sort();
}

function formatCommitMessage(subject: string, body?: string): string {
  const trimmedBody = body?.trim();
  return trimmedBody ? `${subject}\n\n${trimmedBody}\n` : `${subject}\n`;
}

async function createCommitMessageFile(subject: string, body?: string): Promise<{ readonly filePath: string; readonly cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), 'vestara-docs-commit-'));
  const filePath = join(dir, 'COMMIT_EDITMSG');
  await writeFile(filePath, formatCommitMessage(subject, body), 'utf8');
  return {
    filePath,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

function parseVerificationReport(report: VerificationReportPayload): VerificationSummary {
  return {
    level: report.level,
    scope: report.scope,
    result: report.result,
    cached: report.cached,
    executed: report.executedTests.length,
    durationMs: report.durationMs,
    reportPath: report.reportPath,
    fingerprint: report.fingerprint,
    verified: report.verified,
  };
}

export function buildVerificationBody(commands: readonly string[], summary: VerificationSummary): string {
  const lines = [
    'Verification:',
    ...commands.map((command) => `- \`${command}\``),
    `- Result: ${summary.result.toUpperCase()}`,
    `- Scope: ${summary.scope}`,
    `- Level: ${summary.level}`,
    `- Executed tests: ${summary.executed}`,
    `- Cached: ${summary.cached}`,
    `- Verified: ${summary.verified ? 'yes' : 'no'}`,
    `- Duration: ${summary.durationMs}ms`,
  ];
  if (summary.fingerprint) lines.push(`- Fingerprint: ${summary.fingerprint}`);
  if (summary.reportPath) lines.push(`- Report: ${summary.reportPath}`);
  return lines.join('\n');
}

export function buildCommitBody(paths: readonly string[], commands: readonly string[], verification: VerificationSummary): string {
  const lines = [
    'Automated documentation sync.',
    '',
    'Updated paths:',
    ...paths.map((path) => `- \`${path}\``),
    '',
    buildVerificationBody(commands, verification),
  ];
  return lines.join('\n');
}

function formatFailure(command: string, args: readonly string[], result: CommandResult): string {
  const lines = [`Command failed: ${formatCommand(command, args)}`];
  if (result.status !== null) lines.push(`Exit code: ${result.status}`);
  if (result.stderr.trim()) lines.push('', 'stderr:', result.stderr.trim());
  if (result.stdout.trim()) lines.push('', 'stdout:', result.stdout.trim());
  return lines.join('\n');
}

async function runVerificationGate(targets: readonly DocsTarget[]): Promise<DocsVerificationGateResult> {
  const commands: string[] = [];

  const docsVerify = runCommand('pnpm', ['docs:verify', `--targets=${targets.join(',')}`]);
  commands.push(`pnpm docs:verify --targets=${targets.join(',')}`);
  if (docsVerify.status !== 0) {
    throw new Error(formatFailure('pnpm', ['docs:verify', `--targets=${targets.join(',')}`], docsVerify));
  }

  const verify = runCommand('pnpm', ['verify:affected', '--json']);
  commands.push('pnpm verify:affected --json');
  if (verify.status !== 0) {
    throw new Error(formatFailure('pnpm', ['verify:affected', '--json'], verify));
  }

  let parsed: VerificationReportPayload;
  try {
    parsed = JSON.parse(verify.stdout) as VerificationReportPayload;
  } catch (error) {
    throw new Error(`Unable to parse verification report JSON: ${(error as Error).message}`);
  }

  return {
    commands,
    verification: parseVerificationReport(parsed),
  };
}

export async function commitDocs(options: CommitDocsOptions = {}): Promise<CommitDocsResult> {
  const message = options.message ?? DEFAULT_DOC_COMMIT_MESSAGE;
  const allowedPaths = (options.paths && options.paths.length > 0 ? options.paths : DEFAULT_DOC_COMMIT_PATHS).map((path) =>
    toRepoRelativePath(path),
  );
  const changedFiles = collectWorkingTreeChanges();
  const partitioned = partitionPaths(changedFiles, allowedPaths);

  if (partitioned.rejected.length > 0) {
    throw new Error([
      'Refusing to commit because the working tree contains unapproved changes.',
      'Approved paths:',
      ...allowedPaths.map((path) => `- ${path}`),
      'Rejected changes:',
      ...partitioned.rejected.map((path) => `- ${path}`),
    ].join('\n'));
  }

  if (partitioned.allowed.length === 0) {
    return {
      kind: 'skipped',
      reason: 'No approved documentation changes are present.',
      branch: options.branch ?? (isProtectedBranch(getCurrentBranch()) ? resolveDocsBranchName(message) : getCurrentBranch()),
      paths: allowedPaths,
      verification: {
        level: 'unknown',
        scope: 'docs',
        result: 'pass',
        cached: 0,
        executed: 0,
        durationMs: 0,
        reportPath: '',
        fingerprint: null,
        verified: false,
      },
    };
  }

  const targets = DEFAULT_DOC_TARGETS;
  const verificationGate = await runVerificationGate(targets);

  const plannedBranch = options.branch ?? resolveDocsBranchName(message);
  if (options.dryRun) {
    return {
      kind: 'skipped',
      reason: 'Dry run requested.',
      branch: plannedBranch,
      paths: partitioned.allowed,
      verification: verificationGate.verification,
    };
  }

  const currentBranch = getCurrentBranch();
  const targetBranch = options.branch ?? (isProtectedBranch(currentBranch) ? plannedBranch : currentBranch);
  if (targetBranch !== currentBranch) {
    const targetExists = branchExists(targetBranch);
    const branchSwitch = targetExists ? runCommand('git', ['switch', targetBranch]) : runCommand('git', ['switch', '-c', targetBranch]);
    if (branchSwitch.status !== 0) {
      throw new Error(formatFailure('git', targetExists ? ['switch', targetBranch] : ['switch', '-c', targetBranch], branchSwitch));
    }
  }

  const add = runCommand('git', ['add', '--', ...partitioned.allowed]);
  if (add.status !== 0) {
    throw new Error(formatFailure('git', ['add', '--', ...partitioned.allowed], add));
  }

  const messageFile = await createCommitMessageFile(
    message,
    buildCommitBody(partitioned.allowed, verificationGate.commands, verificationGate.verification),
  );
  try {
    const commit = runCommand('git', ['commit', '-F', messageFile.filePath]);
    if (commit.status !== 0) {
      throw new Error(formatFailure('git', ['commit', '-F', messageFile.filePath], commit));
    }
  } finally {
    await messageFile.cleanup();
  }

  const commitSha = runChecked('git', ['rev-parse', 'HEAD']).trim();
  return {
    kind: 'committed',
    branch: getCurrentBranch(),
    paths: partitioned.allowed,
    verification: verificationGate.verification,
    commitSha,
  };
}

async function maybeCreateDraftPr(remote: string, branch: string, createDraftPr: boolean | undefined): Promise<string | undefined> {
  if (!createDraftPr) return undefined;

  const ghVersion = runCommand('gh', ['--version']);
  if (ghVersion.status !== 0) {
    throw new Error('Draft PR creation was requested, but the GitHub CLI (gh) is not available.');
  }

  const authStatus = runCommand('gh', ['auth', 'status']);
  if (authStatus.status !== 0) {
    throw new Error('Draft PR creation was requested, but gh is not authenticated. Run `gh auth login` first.');
  }

  const baseBranch = getRemoteDefaultBranch(remote);
  const pr = runCommand('gh', ['pr', 'create', '--draft', '--fill', '--head', branch, '--base', baseBranch]);
  if (pr.status !== 0) {
    throw new Error(formatFailure('gh', ['pr', 'create', '--draft', '--fill', '--head', branch, '--base', baseBranch], pr));
  }
  return pr.stdout.trim() || undefined;
}

export async function pushDocs(options: PushDocsOptions = {}): Promise<PushDocsResult> {
  const remote = options.remote ?? DEFAULT_DOC_REMOTE;
  const currentBranch = getCurrentBranch();
  if (options.branch && options.branch !== currentBranch) {
    throw new Error(`Push requested for branch "${options.branch}", but the current branch is "${currentBranch}".`);
  }
  if (!options.allowProtected && isProtectedBranch(currentBranch)) {
    throw new Error(`Refusing to push protected branch "${currentBranch}" without an explicit override.`);
  }

  if (options.dryRun) {
    return {
      remote,
      branch: currentBranch,
      commitSha: runChecked('git', ['rev-parse', 'HEAD']).trim(),
    };
  }

  const push = runCommand('git', ['push', '-u', remote, currentBranch]);
  if (push.status !== 0) {
    throw new Error(formatFailure('git', ['push', '-u', remote, currentBranch], push));
  }

  const commitSha = runChecked('git', ['rev-parse', 'HEAD']).trim();
  const draftPrUrl = await maybeCreateDraftPr(remote, currentBranch, options.createDraftPr);
  return {
    remote,
    branch: currentBranch,
    commitSha,
    draftPrUrl,
  };
}

export async function shipDocs(options: ShipDocsOptions = {}): Promise<ShipDocsResult> {
  const targets = options.targets ?? DEFAULT_DOC_TARGETS;
  const sync = await syncPlatformDocs({
    write: options.dryRun !== true,
    dryRun: options.dryRun === true,
    targets,
  });

  const paths = resolveTargetPaths(targets, sync);
  const commit = await commitDocs({
    message: options.message,
    paths,
    dryRun: options.dryRun,
    branch: options.branch,
    remote: options.remote,
  });

  if (commit.kind !== 'committed' || options.noPush === true) {
    return { sync, commit };
  }

  const push = await pushDocs({
    remote: options.remote,
    branch: commit.branch,
    dryRun: options.dryRun,
    createDraftPr: options.createDraftPr,
    allowProtected: options.allowProtected,
  });

  return { sync, commit, push };
}

export function describeShipResult(result: ShipDocsResult): string {
  const lines = [`Docs sync → ${result.sync.summaryPath}`];
  if (result.commit.kind === 'committed') {
    lines.push(`Commit → ${result.commit.commitSha ?? 'unknown'}`);
  } else {
    lines.push(`Commit → skipped${result.commit.reason ? ` (${result.commit.reason})` : ''}`);
  }
  if (result.push) {
    lines.push(`Push → ${result.push.remote}/${result.push.branch}`);
    if (result.push.draftPrUrl) lines.push(`Draft PR → ${result.push.draftPrUrl}`);
  }
  return lines.join('\n');
}
