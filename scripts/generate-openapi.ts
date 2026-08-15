import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildApp } from '../src/app.js';
import { createApplication } from '../src/bootstrap/application.js';
import { loadConfig } from '../src/config/schema.js';

const output = resolve('contracts', 'openapi', 'vestara-api-v2.json');

async function main(): Promise<void> {
  const config = loadConfig({});
  const application = createApplication(config);
  const app = await buildApp({ config, application, exposeDocs: false });
  await app.ready();
  const spec = app.swagger();
  await mkdir(resolve('contracts', 'openapi'), { recursive: true });
  await writeFile(output, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`OpenAPI generated → ${output}`);
  await app.close();
}

void main();
