import { readTelemetry } from './evidence.ts';

const HELP = `Usage: pnpm verify:telemetry [--json]

Aggregates verification telemetry from .vestara/evidence/telemetry/verification.jsonl
across runs: runs, tests selected/executed/cached, cache hit rate, escalation
frequency, and average duration.`;

interface Aggregate {
  runs: number;
  testsSelected: number;
  testsExecuted: number;
  testsCached: number;
  cacheHitRate: number;
  escalations: number;
  escalationRate: number;
  averageDurationMs: number;
  passes: number;
  failures: number;
  indeterminate: number;
}

function main(): void {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const entries = readTelemetry();
  const jsonFlag = process.argv.includes('--json');

  const aggregate: Aggregate = {
    runs: entries.length,
    testsSelected: 0,
    testsExecuted: 0,
    testsCached: 0,
    cacheHitRate: 0,
    escalations: 0,
    escalationRate: 0,
    averageDurationMs: 0,
    passes: 0,
    failures: 0,
    indeterminate: 0,
  };

  let totalExecutedOrCached = 0;
  for (const entry of entries) {
    aggregate.testsSelected += entry.selected;
    aggregate.testsExecuted += entry.executed;
    aggregate.testsCached += entry.cached;
    totalExecutedOrCached += entry.executed + entry.cached;
    if (entry.escalated) aggregate.escalations += 1;
    aggregate.averageDurationMs += entry.durationMs;
    if (entry.result === 'pass') aggregate.passes += 1;
    else if (entry.result === 'fail') aggregate.failures += 1;
    else aggregate.indeterminate += 1;
  }

  if (entries.length > 0) aggregate.averageDurationMs /= entries.length;
  if (totalExecutedOrCached > 0) aggregate.cacheHitRate = aggregate.testsCached / totalExecutedOrCached;
  if (entries.length > 0) aggregate.escalationRate = aggregate.escalations / entries.length;

  if (jsonFlag) {
    console.log(JSON.stringify(aggregate, null, 2));
    process.exit(0);
  }

  console.log('\nVerification telemetry');
  console.log('');
  console.log(`Runs              ${aggregate.runs}`);
  console.log(`Tests selected    ${aggregate.testsSelected}`);
  console.log(`Tests executed    ${aggregate.testsExecuted}`);
  console.log(`Tests cached      ${aggregate.testsCached}`);
  console.log(`Cache hit rate    ${(aggregate.cacheHitRate * 100).toFixed(1)}%`);
  console.log(`Escalations       ${aggregate.escalations} (${(aggregate.escalationRate * 100).toFixed(1)}%)`);
  console.log(`Passes            ${aggregate.passes}`);
  console.log(`Failures          ${aggregate.failures}`);
  console.log(`Indeterminate     ${aggregate.indeterminate}`);
  console.log(`Avg duration      ${(aggregate.averageDurationMs / 1000).toFixed(2)}s`);
  console.log('');
}

main();
