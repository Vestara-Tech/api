import { checkPlatformDocs } from './platform-summary.js';
import { parseDocsTargets } from './targets.js';

async function main(): Promise<void> {
  const targets = parseDocsTargets(process.argv.slice(2));
  const result = await checkPlatformDocs(targets);
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error(`Docs drift detected: ${result.drift.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`Docs in sync → ${targets.join(', ')}`);
}

void main();
