import 'reflect-metadata';
import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { posthog } from './posthog';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.error(`server.ready http://localhost:${port}/mcp`);

  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      await posthog.shutdown(); // flush queued events before exit
      await app.close();
      process.exit(0);
    });
  }
}

bootstrap();
