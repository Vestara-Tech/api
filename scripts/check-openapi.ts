import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../src/app.js';
import { createApplication } from '../src/bootstrap/application.js';
import { loadConfig } from '../src/config/schema.js';

const committed = resolve('contracts', 'openapi', 'vestara-api-v2.json');

async function main(): Promise<void> {
  const config = loadConfig({});
  const application = createApplication(config);
  const app = await buildApp({ config, application, exposeDocs: false });
  await app.ready();
  const current = app.swagger();
  const stored = JSON.parse(await readFile(committed, 'utf8')) as unknown;
  if (JSON.stringify(current) !== JSON.stringify(stored)) {
    // eslint-disable-next-line no-console
    console.error('OpenAPI contract drift: run `pnpm openapi:generate` and commit the update.');
    process.exitCode = 1;
  } else {
    // eslint-disable-next-line no-console
    console.log('OpenAPI contract in sync.');
  }
  await app.close();
}

void main();
