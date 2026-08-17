import { DEFAULT_DOC_COMMIT_MESSAGE, commitDocs } from './docs-automation.js';
import { hasFlag, readCsvFlag, readFlagValue } from './args.js';

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm docs:commit [--message=<text>] [--paths=a,b] [--branch=<name>] [--dry-run]

Stages only approved documentation paths, runs the verification gate, and creates
a commit with the verification summary in the commit body.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printHelp();
    return;
  }

  const result = await commitDocs({
    message: readFlagValue(argv, 'message') ?? DEFAULT_DOC_COMMIT_MESSAGE,
    paths: readCsvFlag(argv, 'paths'),
    branch: readFlagValue(argv, 'branch'),
    dryRun: hasFlag(argv, 'dry-run'),
  });

  // eslint-disable-next-line no-console
  console.log(`Docs commit → ${result.kind}`);
  // eslint-disable-next-line no-console
  console.log(`Branch: ${result.branch}`);
  // eslint-disable-next-line no-console
  console.log(`Paths: ${result.paths.join(', ') || '—'}`);
  if (result.kind === 'committed') {
    // eslint-disable-next-line no-console
    console.log(`Verification: ${result.verification.result.toUpperCase()} (${result.verification.scope}, ${result.verification.level})`);
  }
  if (result.commitSha) {
    // eslint-disable-next-line no-console
    console.log(`Commit: ${result.commitSha}`);
  }
  if (result.reason) {
    // eslint-disable-next-line no-console
    console.log(`Reason: ${result.reason}`);
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
