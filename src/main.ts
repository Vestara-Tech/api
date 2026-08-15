import { createApplication } from './bootstrap/application.js';
import { loadConfig } from './config/schema.js';
import { readEnvironment } from './config/environment.js';
import { VestaraApiServer } from './server.js';

async function main(): Promise<void> {
  const config = loadConfig(readEnvironment());
  const application = createApplication(config);

  application.logger.info('application.boot', {
    service: config.service,
    apiVersion: config.apiVersion,
    nodeEnv: config.nodeEnv,
  });

  const server = new VestaraApiServer({
    config,
    logger: application.logger,
    systemStatus: () => application.systemStatus(),
  });

  application.shutdown.add({
    name: 'http-server',
    close: () => server.close(),
  });
  application.shutdown.add({
    name: 'application',
    close: () => application.close(),
  });

  await server.listen();

  const shutdown = (signal: string): void => {
    application.logger.info('application.shutdown', { signal });
    void application.shutdown
      .shutdown(signal)
      .then(() => process.exit(0))
      .catch((err) => {
        application.logger.error('application.shutdown-failed', { error: err instanceof Error ? err.message : String(err) });
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
