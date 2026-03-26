import { buildApp } from './app.js';
import { disconnectPrisma } from './infrastructure/prisma/client.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';

/**
 * Gracefully shut down the Fastify server, disconnect Prisma, and exit.
 *
 * Ensures both `app.close()` and `disconnectPrisma()` complete before
 * the process exits. Logs the triggering signal for observability.
 */
async function shutdown(
  signal: string,
  app: { log: { info: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void }; close: () => Promise<void> },
): Promise<void> {
  app.log.info({ signal }, 'Received shutdown signal, closing server');
  try {
    await app.close();
    await disconnectPrisma();
  } catch (err) {
    app.log.error(err, 'Error during shutdown');
  }
  process.exit(0);
}

/**
 * Start the Fastify server and register graceful shutdown handlers.
 *
 * Listens on the configured PORT and HOST, then installs SIGINT/SIGTERM
 * handlers that await full shutdown before the process exits.
 */
async function start(): Promise<void> {
  const app = await buildApp();

  process.on('SIGINT', () => {
    void shutdown('SIGINT', app);
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM', app);
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Server listening on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start().catch((err: unknown) => {
  console.error('Fatal: failed to start server', err);
  process.exit(1);
});
