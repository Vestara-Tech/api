import { runCommand } from '../git/docs-automation.js';
import { checkPlatformDocs } from './platform-summary.js';
import { parseDocsTargets } from './targets.js';

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function formatFailure(command: string, result: CommandResult): string {
  const lines = [`Command failed: ${command}`];
  if (result.status !== null) lines.push(`Exit code: ${result.status}`);
  if (result.stderr.trim()) lines.push('', 'stderr:', result.stderr.trim());
  if (result.stdout.trim()) lines.push('', 'stdout:', result.stdout.trim());
  return lines.join('\n');
}

async function main(): Promise<void> {
  const targets = parseDocsTargets(process.argv.slice(2));

  const platform = await checkPlatformDocs(targets);
  if (!platform.ok) {
    // eslint-disable-next-line no-console
    console.error(`Docs drift detected: ${platform.drift.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const openapi = runCommand('pnpm', ['openapi:check']);
  if (openapi.status !== 0) {
    throw new Error(formatFailure('pnpm openapi:check', openapi));
  }

  const contracts = runCommand('pnpm', ['contracts:frontend:check']);
  if (contracts.status !== 0) {
    throw new Error(formatFailure('pnpm contracts:frontend:check', contracts));
  }

  // eslint-disable-next-line no-console
  console.log(`Docs verified → ${targets.join(', ')}`);
}

void main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
