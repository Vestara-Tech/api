import { DEFAULT_DOC_REMOTE, pushDocs } from './docs-automation.js';
import { hasFlag, readFlagValue } from './args.js';

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: pnpm docs:push [--remote=<name>] [--branch=<name>] [--dry-run] [--pr]

Pushes the current docs commit to the configured remote. Refuses to push a
protected branch unless the caller has already moved to a publish branch or
explicitly allowed protected pushes.`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, 'help') || hasFlag(argv, 'h')) {
    printHelp();
    return;
  }

  const result = await pushDocs({
    remote: readFlagValue(argv, 'remote') ?? DEFAULT_DOC_REMOTE,
    branch: readFlagValue(argv, 'branch'),
    dryRun: hasFlag(argv, 'dry-run'),
    createDraftPr: hasFlag(argv, 'pr') || hasFlag(argv, 'draft-pr'),
    allowProtected: hasFlag(argv, 'allow-protected'),
  });

  // eslint-disable-next-line no-console
  console.log(`Docs pushed → ${result.remote}/${result.branch}`);
  // eslint-disable-next-line no-console
  console.log(`Commit: ${result.commitSha}`);
  if (result.draftPrUrl) {
    // eslint-disable-next-line no-console
    console.log(`Draft PR: ${result.draftPrUrl}`);
  }
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
