import { REPO_ROOT, loadConfig } from './affected.ts';
import { buildGraphReport, printGraphReport } from './graph/report.ts';

const HELP = `Usage: pnpm verify:graph [--json]

Cheap verification preflight for the validated graph and ownership index.
Prints graph validity, dependency closure, ownership coverage, and workspace coverage.
Flags: --json      machine-readable report`;

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const jsonFlag = process.argv.includes('--json');
  const config = loadConfig(REPO_ROOT);
  const report = buildGraphReport(REPO_ROOT, config);

  if (jsonFlag) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  } else {
    printGraphReport(report);
    process.exit(report.result === 'PASS' ? 0 : 1);
  }
}

main();
