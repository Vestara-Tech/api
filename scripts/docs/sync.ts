import { checkPlatformDocs, syncPlatformDocs } from './platform-summary.js';
import { parseDocsTargets } from './targets.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const targets = parseDocsTargets(argv);
  const check = argv.includes('--check');
  const dryRun = argv.includes('--dry-run');
  const write = argv.includes('--write') || (!check && !dryRun);

  if (check) {
    const result = await checkPlatformDocs(targets);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(`Docs drift detected: ${result.drift.join(', ')}`);
      process.exitCode = 1;
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`Docs in sync → ${targets.join(', ')}`);
    return;
  }

  const result = await syncPlatformDocs({ write, dryRun, targets });
  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(`Docs sync planned → ${targets.join(', ')}`);
    // eslint-disable-next-line no-console
    console.log(`Summary file: ${result.summaryPath}`);
    // eslint-disable-next-line no-console
    console.log(`README block: ${result.readmePath}`);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Docs synced → ${targets.join(', ')}`);
  // eslint-disable-next-line no-console
  console.log(`Summary file: ${result.summaryPath}`);
  // eslint-disable-next-line no-console
  console.log(`README block: ${result.readmePath}`);
}

void main();
