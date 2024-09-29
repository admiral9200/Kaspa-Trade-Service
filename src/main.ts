import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppConfigService } from './modules/core/modules/config/app-config.service';
import * as WebSocket from 'websocket';

// Needed for Wasm
globalThis.WebSocket = WebSocket.w3cwebsocket;

let isShuttingDown = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      // Show error messages
      disableErrorMessages: false,
      // If user send extra data from the dto the data will be stripped
      whitelist: true,
      // To enable auto-transformation, set transform to true
      transform: true,
    }),
  );

  app.use(helmet());

  const appConfigService = app.get(AppConfigService);

  const port = appConfigService.getServicePort || 3000;

  console.log(`app running on port:::`, port);
  await app.listen(port);

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, async () => {
      isShuttingDown = true;

      console.log(`${signal} received. Starting graceful shutdown.`);

      // Set a timeout for the graceful shutdown
      const shutdownTimeout = setTimeout(() => {
        console.log('Graceful shutdown timed out. Forcing exit.');
        process.exit(1);
      }, 60_000); // 10 seconds timeout

      try {
        // Attempt to close the NestJS app
        await app.close();

        console.log('Graceful shutdown completed.');
        clearTimeout(shutdownTimeout);
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        clearTimeout(shutdownTimeout);
        process.exit(1);
      }
    });
  });
}

export function isServerShuttingDown() {
  return isShuttingDown;
}

bootstrap();
