import { buildApp } from './app.js';
import { createApplication } from './bootstrap/application.js';
import { loadConfig } from './config/schema.js';
import { readEnvironment } from './config/environment.js';

async function main(): Promise<void> {
  const config = loadConfig(readEnvironment());
  const application = createApplication(config);
  const app = await buildApp({ config, application });

  application.shutdown.add({
    name: 'http-server',
    close: () => app.close(),
  });
  application.shutdown.add({
    name: 'application',
    close: () => application.close(),
  });

  await app.listen({ host: config.host, port: config.port });

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, 'application.shutdown');
    void application.shutdown
      .shutdown(signal)
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error({ err }, 'application.shutdown-failed');
        process.exit(1);
      });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[vestara-api] fatal startup error', err);
  process.exit(1);
});
