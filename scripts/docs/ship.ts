import { DEFAULT_DOC_COMMIT_MESSAGE, describeShipResult, shipDocs } from '../git/docs-automation.js';
import { hasFlag, readFlagValue } from '../git/args.js';
import { parseDocsTargets } from './targets.js';

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm docs:ship [--message=<text>] [--branch=<name>] [--remote=<name>] [--targets=a,b] [--dry-run] [--no-push] [--pr]

Synchronizes generated documentation, runs the verification gate, creates a
commit, and optionally pushes the result to GitHub.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printHelp();
    return;
  }

  const result = await shipDocs({
    message: readFlagValue(argv, 'message') ?? DEFAULT_DOC_COMMIT_MESSAGE,
    branch: readFlagValue(argv, 'branch'),
    remote: readFlagValue(argv, 'remote'),
    targets: parseDocsTargets(argv),
    dryRun: hasFlag(argv, 'dry-run'),
    noPush: hasFlag(argv, 'no-push'),
    createDraftPr: hasFlag(argv, 'pr') || hasFlag(argv, 'draft-pr'),
    allowProtected: hasFlag(argv, 'allow-protected'),
  });

  // eslint-disable-next-line no-console
  console.log(describeShipResult(result));
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
