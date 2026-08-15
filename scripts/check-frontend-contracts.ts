import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const committed = resolve('vestara-apps', 'api-builder', 'src', 'api', 'contracts.ts');

async function main(): Promise<void> {
  const before = await readFile(committed, 'utf8');
  const result = spawnSync('npx', ['tsx', 'scripts/generate-frontend-contracts.ts'], {
    encoding: 'utf8',
    cwd: resolve('.'),
  });
  if (result.status !== 0) {
    // eslint-disable-next-line no-console
    console.error(result.stderr ?? result.stdout);
    process.exitCode = 1;
    return;
  }
  const after = await readFile(committed, 'utf8');
  if (before !== after) {
    // eslint-disable-next-line no-console
    console.error('Frontend contract drift: run `pnpm contracts:frontend` and commit the update.');
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('Frontend contracts in sync.');
  }
}

void main();
